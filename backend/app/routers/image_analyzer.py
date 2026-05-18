from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import json
import re
from app.dependencies import get_current_user, get_db
from app.db.models import Product, Marketplace, ImageAnalysis
from app.services.gemini_service import ask_gemini_vision

router = APIRouter()


# Pazaryeri gorsel kurallari (gercek deneyim)
IMAGE_RULES = {
    "trendyol": {
        "min_resolution": "800x800",
        "ideal_resolution": "1200x1200",
        "background": "Beyaz veya temiz, gradient olmasin",
        "watermark": "Yasak",
        "text_overlay": "Sinirli (sadece ozellik vurgusu)",
        "min_count": 1,
        "ideal_count": 5,
    },
    "hepsiburada": {
        "min_resolution": "1000x1000",
        "ideal_resolution": "1500x1500",
        "background": "Tam beyaz (#FFFFFF)",
        "watermark": "Yasak",
        "text_overlay": "Yasak (logo disinda)",
        "min_count": 1,
        "ideal_count": 6,
    },
    "amazon_tr": {
        "min_resolution": "1000x1000",
        "ideal_resolution": "2000x2000",
        "background": "Tam beyaz (#FFFFFF)",
        "watermark": "Yasak",
        "text_overlay": "Yasak (urun uzeri ozellik etiketi disinda)",
        "min_count": 1,
        "ideal_count": 7,
    },
    "n11": {
        "min_resolution": "600x600",
        "ideal_resolution": "1000x1000",
        "background": "Beyaz veya neutral",
        "watermark": "Yasak",
        "text_overlay": "Sinirli",
        "min_count": 1,
        "ideal_count": 5,
    },
}



def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _resolve_product(db, user_id: int, product_code: str):
    return (
        db.query(Product, Marketplace)
        .join(Marketplace, Product.marketplace_id == Marketplace.id)
        .filter(Product.user_id == user_id, Product.product_code == product_code)
        .first()
    )


def _try_extract_json(text: str):
    if not text:
        return None
    fenced = re.search(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", text, re.DOTALL)
    candidate = fenced.group(1) if fenced else None
    if not candidate:
        match = re.search(r"(\{.*\}|\[.*\])", text, re.DOTALL)
        candidate = match.group(1) if match else None
    if not candidate:
        return None
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        return None


def _save_analysis(db, product_id, image_url, score, suggestions):
    rec = ImageAnalysis(
        product_id=product_id,
        image_url=image_url,
        score=score,
        suggestions=suggestions,
        created_at=_now(),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


# ---- Endpoints ----

class AnalyzeRequest(BaseModel):
    image_url: Optional[str] = None  # Verilirse product.image_url yerine bu kullanilir


@router.post("/{product_id}/analyze")
async def analyze_image(
    product_id: str,
    req: Optional[AnalyzeRequest] = None,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Gemini Vision ile urun gorseli analiz et: arka plan, aydinlatma, cerceveleme,
    pazaryeri kurali uyumu. Sonucu image_analyses tablosuna kaydeder.
    """
    row = _resolve_product(db, user.id, product_id)
    if not row:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")
    product, mp = row

    image_url = (req.image_url if req else None) or product.image_url
    if not image_url:
        raise HTTPException(status_code=400, detail="Urun icin image_url yok, request'te image_url ver")

    rules = IMAGE_RULES.get(mp.name, IMAGE_RULES["trendyol"])

    prompt = f"""Bu e-ticaret urununun gorselini {mp.name.upper()} pazaryeri kurallarina gore analiz et.

URUN: {product.name}
KATEGORI: {product.category}

{mp.name.upper()} GORSEL KURALLARI:
- Minimum cozunurluk: {rules['min_resolution']} (ideal {rules['ideal_resolution']})
- Arka plan: {rules['background']}
- Watermark: {rules['watermark']}
- Yazi/etiket: {rules['text_overlay']}

CIKTI SADECE asagidaki JSON formatinda olsun, baska metin ekleme:
```json
{{
  "overall_score": 0-100,
  "scores": {{
    "arka_plan": 0-10,
    "aydinlatma": 0-10,
    "cerceveleme": 0-10,
    "cozunurluk_algisi": 0-10,
    "kalite": 0-10,
    "pazaryeri_uyumu": 0-10
  }},
  "detected_issues": ["maddesel: ornegin 'Arka plan gradyan, beyaz olmali'"],
  "positive_aspects": ["iyi yonler"],
  "object_detection": {{
    "primary_product_visible": true,
    "occupies_pct": 0-100,
    "watermark_detected": false,
    "text_overlay_detected": false,
    "background_type": "beyaz | gradient | renkli | dogal | dagilik"
  }},
  "marketplace_compliance": {{
    "{mp.name}_uyumlu": true,
    "compliance_notes": ["..."]
  }}
}}
```"""

    system = (
        f"Sen bir e-ticaret gorsel kalite uzmanisin. {mp.name.upper()} pazaryeri kurallarini "
        "biliyorsun. Verilen gorseli objektif degerlendir, sadece JSON dondur."
    )

    result = await ask_gemini_vision(image_url, prompt, system, pool="vision")
    raw = result["text"]
    parsed = _try_extract_json(raw) or {}

    overall_score = float(parsed.get("overall_score", 0)) if parsed else 0.0
    detected_issues = parsed.get("detected_issues") or []
    suggestions_text = "; ".join(detected_issues) if detected_issues else (raw or "Analiz yapilamadi")

    rec = _save_analysis(db, product.id, image_url, overall_score, suggestions_text)

    return {
        "id": rec.id,
        "product_id": product_id,
        "product_name": product.name,
        "marketplace": mp.name,
        "image_url": image_url,
        "overall_score": overall_score,
        "scores_breakdown": parsed.get("scores"),
        "detected_issues": detected_issues,
        "positive_aspects": parsed.get("positive_aspects") or [],
        "object_detection": parsed.get("object_detection") or {},
        "marketplace_compliance": parsed.get("marketplace_compliance") or {},
        "marketplace_rules": rules,
        "vision_model": result.get("model"),
        "raw_ai_output": raw if not parsed else None,
        "created_at": rec.created_at,
    }


@router.post("/{product_id}/suggestions")
async def improvement_suggestions(
    product_id: str,
    req: Optional[AnalyzeRequest] = None,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Gemini Vision ile gorseli inceler ve aksiyon odakli iyilestirme onerileri uretir.
    /analyze daha cok skorlama yapar, bu daha cok 'ne yapmaliyim' diyen pratik liste.
    """
    row = _resolve_product(db, user.id, product_id)
    if not row:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")
    product, mp = row

    image_url = (req.image_url if req else None) or product.image_url
    if not image_url:
        raise HTTPException(status_code=400, detail="image_url yok")

    rules = IMAGE_RULES.get(mp.name, IMAGE_RULES["trendyol"])

    prompt = f"""Bu urun gorseli icin {mp.name.upper()}'de daha iyi donusum ve SEO icin **somut iyilestirme
onerileri** uret. Hayali oneriler verme, sadece gercekten gordugun sorunlara dair konus.

URUN: {product.name}
{mp.name.upper()} KURALLARI: arka plan {rules['background']}, watermark {rules['watermark']}, ideal {rules['ideal_count']} gorsel

CIKTI sadece JSON:
```json
{{
  "priority_actions": [
    {{
      "action": "Yapilacak somut sey",
      "reason": "Nedeni",
      "expected_impact": "Beklenen etki (donusum/CTR)",
      "difficulty": "kolay | orta | zor"
    }}
  ],
  "additional_shots_needed": ["Eksik olan gorsel turleri: detay, kullanim, paketleme vs."],
  "competitor_comparison_note": "Sektordeki basarili urun gorselleri nasil farkli? (genel gozlem)",
  "tools_to_use": ["Onerilen ucretsiz/ucretli tool: ornek 'remove.bg ile arka plan kaldir'"],
  "estimated_score_after_fixes": 0-100
}}
```"""

    system = (
        "Sen bir e-ticaret gorsel optimizasyon danismanisin. Pratik, aksiyon odakli "
        "tavsiyeler veriyorsun. Sadece JSON dondur."
    )

    result = await ask_gemini_vision(image_url, prompt, system, pool="vision")
    raw = result["text"]
    parsed = _try_extract_json(raw) or {}

    actions = parsed.get("priority_actions") or []
    suggestions_text = "; ".join(
        f"{a.get('action', '')} ({a.get('difficulty', '')})"
        for a in actions
    ) if actions else (raw or "Oneri yok")

    rec = _save_analysis(
        db, product.id, image_url,
        float(parsed.get("estimated_score_after_fixes") or 0),
        suggestions_text,
    )

    return {
        "id": rec.id,
        "product_id": product_id,
        "product_name": product.name,
        "marketplace": mp.name,
        "image_url": image_url,
        "priority_actions": actions,
        "additional_shots_needed": parsed.get("additional_shots_needed") or [],
        "competitor_comparison_note": parsed.get("competitor_comparison_note"),
        "tools_to_use": parsed.get("tools_to_use") or [],
        "estimated_score_after_fixes": parsed.get("estimated_score_after_fixes"),
        "vision_model": result.get("model"),
        "raw_ai_output": raw if not parsed else None,
        "created_at": rec.created_at,
    }


@router.get("/{product_id}/history")
def analysis_history(
    product_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    row = _resolve_product(db, user.id, product_id)
    if not row:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")
    product, _ = row

    rows = (
        db.query(ImageAnalysis)
        .filter(ImageAnalysis.product_id == product.id)
        .order_by(ImageAnalysis.id.desc())
        .all()
    )
    return {
        "product_id": product_id,
        "product_name": product.name,
        "total": len(rows),
        "best_score": max((r.score or 0) for r in rows) if rows else None,
        "analyses": [
            {
                "id": r.id,
                "image_url": r.image_url,
                "score": r.score,
                "suggestions": r.suggestions,
                "created_at": r.created_at,
            }
            for r in rows
        ],
    }
