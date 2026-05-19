from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from collections import Counter
import json
import re
from app.dependencies import get_current_user, get_db
from app.db.models import Product, Marketplace, ListingOptimization
from app.services.gemini_service import ask_gemini, ask_gemini_with_search

router = APIRouter()


# Pazaryeri-spesifik baslik/aciklama limitleri (gercek dunya kurallari)
MARKETPLACE_RULES = {
    "trendyol": {
        "title_min": 30, "title_max": 80, "title_ideal_min": 50, "title_ideal_max": 70,
        "description_min": 100, "description_max": 4000,
        "allows_emoji": True, "allows_capslock_words": True,
    },
    "hepsiburada": {
        "title_min": 25, "title_max": 50, "title_ideal_min": 35, "title_ideal_max": 50,
        "description_min": 100, "description_max": 3000,
        "allows_emoji": False, "allows_capslock_words": False,
    },
    "amazon_tr": {
        "title_min": 50, "title_max": 200, "title_ideal_min": 80, "title_ideal_max": 150,
        "description_min": 200, "description_max": 2000,
        "allows_emoji": False, "allows_capslock_words": False,
    },
    "n11": {
        "title_min": 25, "title_max": 65, "title_ideal_min": 40, "title_ideal_max": 60,
        "description_min": 100, "description_max": 3000,
        "allows_emoji": True, "allows_capslock_words": False,
    },
}

# Pazaryerlerinde yasak/uyari kelimeler (gercek deneyim)
BANNED_PATTERNS = [
    r"\b(orijinal|original)\b",  # marka taklit riski
    r"\b(garantili|garanti)\b",  # spesifik garanti suresi belirtmeden kullanma
    r"!!+", r"\?\?+",            # cift noktalama
    r"\b(mukemmel|en iyi|essiz|harika)\b",  # subjektif iddialar (Trendyol bunlari dusurur)
]

TURKISH_STOPWORDS = {
    "ve", "veya", "ile", "icin", "bir", "bu", "su", "o", "ki", "da", "de",
    "den", "dan", "te", "ta", "ya", "ye", "yi", "yu", "in", "un", "an", "en",
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


def _save_optimization(db, product_id, original_title, optimized_title, keywords, description):
    rec = ListingOptimization(
        product_id=product_id,
        original_title=original_title,
        optimized_title=optimized_title,
        keywords=keywords,
        description=description,
        created_at=_now(),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


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


# ---- SEO / Quality Analysis ----

def _normalize_word(w: str) -> str:
    return re.sub(r"[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]", "", w.lower())


def _analyze_title(title: str, marketplace: str, keywords: list = None) -> dict:
    """Bir basligi pazaryeri kurallarina ve SEO best practice'lere gore analiz et."""
    rules = MARKETPLACE_RULES.get(marketplace, MARKETPLACE_RULES["trendyol"])
    length = len(title)
    word_count = len(title.split())
    warnings = []

    # 1. Karakter limiti
    in_hard_limit = rules["title_min"] <= length <= rules["title_max"]
    in_ideal_range = rules["title_ideal_min"] <= length <= rules["title_ideal_max"]
    if length < rules["title_min"]:
        warnings.append(f"Cok kisa ({length} char, min {rules['title_min']})")
    elif length > rules["title_max"]:
        warnings.append(f"Limit asildi ({length} char, max {rules['title_max']})")
    elif not in_ideal_range:
        warnings.append(f"Ideal aralik {rules['title_ideal_min']}-{rules['title_ideal_max']} char (su anki: {length})")

    # 2. Emoji kontrolu
    has_emoji = bool(re.search(r"[\U0001F300-\U0001FAFF\U00002600-\U000027BF]", title))
    if has_emoji and not rules["allows_emoji"]:
        warnings.append(f"{marketplace} emoji'ye izin vermiyor")

    # 3. CAPSLOCK kelime
    capslock_words = [w for w in title.split() if len(w) > 2 and w.isupper()]
    if capslock_words and not rules["allows_capslock_words"]:
        warnings.append(f"{marketplace} CAPSLOCK kelimelere izin vermiyor: {', '.join(capslock_words[:3])}")

    # 4. Yasak kelimeler
    banned_hits = []
    for pattern in BANNED_PATTERNS:
        m = re.search(pattern, title, re.IGNORECASE)
        if m:
            banned_hits.append(m.group(0))
    if banned_hits:
        warnings.append(f"Riskli/yasak kelimeler: {', '.join(set(banned_hits))}")

    # 5. Cift noktalama / fazla bosluk
    if re.search(r"\s{2,}", title):
        warnings.append("Cift bosluk var")
    if re.search(r"[.,;:]\s*[.,;:]", title):
        warnings.append("Cift noktalama isareti")

    # 6. Keyword yerlesimi (ilk 30 karakterde primary keyword olmali)
    keyword_in_first_30 = False
    if keywords:
        first_30 = title[:30].lower()
        keyword_in_first_30 = any(kw.lower() in first_30 for kw in keywords[:3])
        if not keyword_in_first_30:
            warnings.append("Primary keyword ilk 30 char'da yok (SEO icin onemli)")

    # 7. Keyword density
    title_words = [_normalize_word(w) for w in title.split()]
    title_words = [w for w in title_words if w and w not in TURKISH_STOPWORDS]
    word_freq = Counter(title_words)
    keyword_density = {}
    if keywords:
        for kw in keywords[:5]:
            kw_norm = _normalize_word(kw)
            count = sum(1 for w in title_words if kw_norm in w)
            if count > 0:
                keyword_density[kw] = {
                    "count": count,
                    "density_pct": round(count / max(1, len(title_words)) * 100, 1),
                }

    # 8. SEO skor hesabi (0-100)
    score = 100
    if not in_hard_limit:
        score -= 30
    elif not in_ideal_range:
        score -= 10
    if has_emoji and not rules["allows_emoji"]:
        score -= 15
    if capslock_words and not rules["allows_capslock_words"]:
        score -= 10
    score -= min(30, len(banned_hits) * 10)
    if keywords and not keyword_in_first_30:
        score -= 15
    if word_count < 4:
        score -= 10  # cok kisa, az anlam
    score = max(0, min(100, score))

    return {
        "length": length,
        "word_count": word_count,
        "in_hard_limit": in_hard_limit,
        "in_ideal_range": in_ideal_range,
        "marketplace_rules": rules,
        "seo_score": score,
        "has_emoji": has_emoji,
        "has_capslock_words": bool(capslock_words),
        "banned_hits": banned_hits,
        "keyword_in_first_30_chars": keyword_in_first_30,
        "keyword_density": keyword_density,
        "warnings": warnings,
    }


def _diff_titles(original: str, optimized: str) -> dict:
    """Eski-yeni karsilastirmasi."""
    orig_words = set(_normalize_word(w) for w in original.split() if _normalize_word(w) not in TURKISH_STOPWORDS)
    new_words = set(_normalize_word(w) for w in optimized.split() if _normalize_word(w) not in TURKISH_STOPWORDS)
    added = new_words - orig_words
    removed = orig_words - new_words
    return {
        "original_length": len(original),
        "optimized_length": len(optimized),
        "length_delta": len(optimized) - len(original),
        "added_words": sorted(added - {""}),
        "removed_words": sorted(removed - {""}),
    }


# ---- Endpoints ----

class OptimizeRequest(BaseModel):
    target_marketplace: Optional[str] = None


@router.post("/{product_id}/optimize")
async def optimize_listing(
    product_id: str,
    req: Optional[OptimizeRequest] = None,
    use_web: bool = True,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    row = _resolve_product(db, user.id, product_id)
    if not row:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")
    product, mp = row
    target_mp = (req.target_marketplace if req else None) or mp.name
    rules = MARKETPLACE_RULES.get(target_mp, MARKETPLACE_RULES["trendyol"])

    web_note = (
        f"\n\nEK GOREV: Google Search ile {target_mp} ve diger pazaryerlerinde "
        f"\"{product.name}\" benzeri urunlerin en cok satan/yorum alan basliklarini incele. "
        f"Hangi anahtar kelime kombinasyonlari one cikiyor?"
        if use_web else ""
    )

    # Pazaryeri kurallari prompt'a aciktan yaziliyor — Gemini bunlara uyacak
    prompt = f"""Asagidaki e-ticaret urununun baslik ve aciklamasini {target_mp.upper()} icin
optimize et. Turkce yanit ver.

URUN BILGILERI:
- Mevcut baslik: "{product.name}"
- Kategori: {product.category}
- Fiyat: {product.price} TL
- Puan: {product.rating} ({product.review_count} yorum)

{target_mp.upper()} BASLIK KURALLARI (kesinlikle uymalisin):
- Karakter araligi: {rules['title_min']}-{rules['title_max']} (ideal {rules['title_ideal_min']}-{rules['title_ideal_max']})
- Emoji izinli mi: {'Evet' if rules['allows_emoji'] else 'Hayir'}
- BUYUK HARFLI kelime izinli mi: {'Evet' if rules['allows_capslock_words'] else 'Hayir'}
- Aciklama: {rules['description_min']}-{rules['description_max']} karakter
- Primary keyword ilk 30 karakterde olmali
- "Orijinal", "garantili", "mukemmel" gibi subjektif/riskli kelimelerden kacin
{web_note}

CIKTIYI sadece JSON formatinda dondur:
```json
{{
  "optimized_title": "Yeni baslik (yukaridaki karakter limitine uy)",
  "keywords": ["primary_keyword", "kelime2", "..."],
  "description": "Markdown aciklama (limit icinde)",
  "improvements": ["3 madde — mevcut basliga gore iyilestirme"],
  "expected_impact": "1-2 cumle, beklenen donusum/SEO etkisi",
  "primary_keyword": "ilk 30 karakter'da olan ana kelime"
}}
```
"""
    system = (
        f"Sen bir e-ticaret SEO uzmanisin. {target_mp.upper()} pazaryerinin baslik algoritmasini ve "
        "musteri arama davranisini biliyorsun. Verilen kurallara KESIN uyacaksin. Sadece JSON dondur."
    )

    sources, used_web = [], False
    if use_web:
        result = await ask_gemini_with_search(prompt, system, pool="analyze")
        raw = result["text"]
        sources = result["sources"]
        used_web = result["used_search"]
    else:
        raw = await ask_gemini(prompt, system, pool="analyze")

    parsed = _try_extract_json(raw) or {}
    optimized_title = parsed.get("optimized_title") or product.name
    keywords = parsed.get("keywords") or []
    description = parsed.get("description") or ""

    # Profesyonel analiz: ikisini de skorla
    orig_analysis = _analyze_title(product.name, target_mp, keywords)
    new_analysis = _analyze_title(optimized_title, target_mp, keywords)
    diff = _diff_titles(product.name, optimized_title)

    rec = _save_optimization(db, product.id, product.name, optimized_title, keywords, description)

    return {
        "id": rec.id,
        "product_id": product_id,
        "target_marketplace": target_mp,
        "comparison": {
            "original": {
                "title": product.name,
                "analysis": orig_analysis,
            },
            "optimized": {
                "title": optimized_title,
                "analysis": new_analysis,
            },
            "seo_score_delta": new_analysis["seo_score"] - orig_analysis["seo_score"],
            "diff": diff,
        },
        "keywords": keywords,
        "description": description,
        "description_length": len(description),
        "description_ok": rules["description_min"] <= len(description) <= rules["description_max"],
        "improvements": parsed.get("improvements") or [],
        "expected_impact": parsed.get("expected_impact") or "",
        "primary_keyword": parsed.get("primary_keyword"),
        "web_sources": sources,
        "used_web_search": used_web,
        "marketplace_rules": rules,
        "ready_to_apply": (
            new_analysis["seo_score"] > 70
            and new_analysis["in_hard_limit"]
            and not new_analysis["banned_hits"]
        ),
        "publish_note": (
            "Bu baslik ve aciklamayi Trendyol/HB Seller API'sine gondererek "
            "canli yayinlama icin 'Uygula' butonu gerek. Bu hackathon surumunde "
            "API key entegrasyonu yok, sonucu manuel kopyala."
        ),
        "raw_ai_output": raw if not parsed else None,
        "created_at": rec.created_at,
    }


@router.post("/{product_id}/keywords")
async def suggest_keywords(
    product_id: str,
    use_web: bool = True,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    row = _resolve_product(db, user.id, product_id)
    if not row:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")
    product, mp = row

    web_note = (
        f"\n\nEK GOREV: Google Search ile \"{product.name}\" icin Turkiye'de trend olan "
        "anahtar kelimeleri, uzun-kuyruk arama terimlerini ve mevsimsel kelimeleri ara. "
        "Trendyol/HB arama oneri kutusunda gozuken otomatik tamamlama orneklerini de incele."
        if use_web else ""
    )

    prompt = f"""Bu urun icin pazaryeri anahtar kelime stratejisi olustur:

URUN: "{product.name}"
KATEGORI: {product.category}
PAZARYERI: {mp.name}
FIYAT: {product.price} TL
{web_note}

CIKTI sadece JSON:
```json
{{
  "primary_keywords": ["5 yuksek-hacim ana kelime"],
  "long_tail_keywords": ["8 uzun-kuyruk (3-5 kelime)"],
  "trending_keywords": ["3-5 webden buldugun guncel trend"],
  "seasonal_keywords": ["mevsim/donem'e ozel kelimeler varsa"],
  "negative_keywords": ["bu urune uymayan, eklenmemesi gerekenler"],
  "search_intent_groups": {{
    "bilgi_arayan": ["..."],
    "satin_almaya_yakin": ["..."],
    "fiyat_karsilastiran": ["..."]
  }},
  "estimated_difficulty": {{
    "kelime": "dusuk/orta/yuksek - tahmini rekabet"
  }},
  "strategy_note": "Hangi keyword'le baslamali ve neden? 2-3 cumle."
}}
```
"""
    system = "Sen bir e-ticaret SEO uzmanisin. Sadece JSON dondur."

    sources, used_web = [], False
    if use_web:
        result = await ask_gemini_with_search(prompt, system, pool="analyze")
        raw = result["text"]
        sources = result["sources"]
        used_web = result["used_search"]
    else:
        raw = await ask_gemini(prompt, system, pool="analyze")

    parsed = _try_extract_json(raw) or {}

    all_keywords = []
    for k in ("primary_keywords", "long_tail_keywords", "trending_keywords", "seasonal_keywords"):
        all_keywords.extend(parsed.get(k, []) or [])

    rec = _save_optimization(db, product.id, product.name, product.name, all_keywords, None)

    return {
        "id": rec.id,
        "product_id": product_id,
        "product_name": product.name,
        "marketplace": mp.name,
        "keywords_breakdown": parsed,
        "all_keywords": all_keywords,
        "total_keyword_count": len(all_keywords),
        "web_sources": sources,
        "used_web_search": used_web,
        "raw_ai_output": raw if not parsed else None,
        "created_at": rec.created_at,
    }


@router.post("/{product_id}/description")
async def generate_description(
    product_id: str,
    use_web: bool = True,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    row = _resolve_product(db, user.id, product_id)
    if not row:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")
    product, mp = row
    rules = MARKETPLACE_RULES.get(mp.name, MARKETPLACE_RULES["trendyol"])

    web_note = (
        f"\n\nEK GOREV: Google Search ile \"{product.name}\" benzeri urunlerin Trendyol/HB'de "
        "yuksek satan urun aciklamalarini incele. Hangi yapilanma daha cok donusum getiriyor?"
        if use_web else ""
    )

    prompt = f"""{mp.name.upper()} pazaryerine uygun, satis odakli urun aciklamasi yaz.

URUN: "{product.name}"
KATEGORI: {product.category}
FIYAT: {product.price} TL
PUAN: {product.rating} ({product.review_count} yorum)
ACIKLAMA LIMIT: {rules['description_min']}-{rules['description_max']} karakter, hedef {rules['description_min'] + 200}
{web_note}

Aciklama yapisi:
1. **Baslangic vurusu** (1 cumle - benzersiz deger onerisi)
2. **Ozellikler** (5-7 madde, fayda odakli)
3. **Kullanim senaryolari** (2-3 cumle)
4. **Garanti/kargo/iade bilgisi**
5. **CTA** (cagri metni)

Markdown formatinda dondur. {"Emoji" if rules['allows_emoji'] else "Emoji KULLANMA"}.
Asiri pazarlamaci dilden kacin. "Orijinal", "garantili", "mukemmel" gibi riskli kelimeler kullanma.
"""
    system = (
        f"Sen bir e-ticaret copywriter'sin. {mp.name.upper()} kurallarina uyarak satis odakli "
        "urun aciklamalari yaziyorsun. Limit icinde kal."
    )

    sources, used_web = [], False
    if use_web:
        result = await ask_gemini_with_search(prompt, system, pool="analyze")
        description = result["text"]
        sources = result["sources"]
        used_web = result["used_search"]
    else:
        description = await ask_gemini(prompt, system, pool="analyze")

    char_count = len(description) if description else 0
    word_count = len(description.split()) if description else 0
    within_limit = rules["description_min"] <= char_count <= rules["description_max"]

    rec = _save_optimization(db, product.id, product.name, product.name, None, description)

    return {
        "id": rec.id,
        "product_id": product_id,
        "product_name": product.name,
        "marketplace": mp.name,
        "description": description,
        "char_count": char_count,
        "word_count": word_count,
        "within_marketplace_limit": within_limit,
        "marketplace_limits": {
            "min": rules["description_min"], "max": rules["description_max"],
        },
        "web_sources": sources,
        "used_web_search": used_web,
        "created_at": rec.created_at,
    }


@router.get("/{product_id}/history")
def optimization_history(
    product_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    row = _resolve_product(db, user.id, product_id)
    if not row:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")
    product, mp = row

    rows = (
        db.query(ListingOptimization)
        .filter(ListingOptimization.product_id == product.id)
        .order_by(ListingOptimization.id.desc())
        .all()
    )

    # Her history kaydina seo skorunu da ekle
    items = []
    for r in rows:
        analysis = (
            _analyze_title(r.optimized_title, mp.name, r.keywords or [])
            if r.optimized_title else None
        )
        items.append({
            "id": r.id,
            "original_title": r.original_title,
            "optimized_title": r.optimized_title,
            "seo_score": analysis["seo_score"] if analysis else None,
            "warnings_count": len(analysis["warnings"]) if analysis else None,
            "keywords": r.keywords,
            "has_description": bool(r.description),
            "description_preview": (r.description[:120] + "...") if r.description and len(r.description) > 120 else r.description,
            "created_at": r.created_at,
        })

    return {
        "product_id": product_id,
        "product_name": product.name,
        "marketplace": mp.name,
        "total": len(rows),
        "best_seo_score": max((i["seo_score"] or 0) for i in items) if items else None,
        "optimizations": items,
    }


@router.get("/{product_id}/optimization/{opt_id}")
def get_optimization(
    product_id: str,
    opt_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Gecmisteki tek bir optimizasyon kaydini AI cagrisi yapmadan yeniden uretir.
    Frontend 'Gecmis' sekmesinden bir kayda tiklayinca eski sonucu detayli gosterir."""
    row = _resolve_product(db, user.id, product_id)
    if not row:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")
    product, mp = row

    rec = (
        db.query(ListingOptimization)
        .filter(
            ListingOptimization.id == opt_id,
            ListingOptimization.product_id == product.id,
        )
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Optimizasyon kaydi bulunamadi")

    keywords = rec.keywords or []
    original_title = rec.original_title or product.name
    optimized_title = rec.optimized_title or original_title
    rules = MARKETPLACE_RULES.get(mp.name, MARKETPLACE_RULES["trendyol"])

    orig_analysis = _analyze_title(original_title, mp.name, keywords)
    new_analysis = _analyze_title(optimized_title, mp.name, keywords)
    diff = _diff_titles(original_title, optimized_title)

    return {
        "id": rec.id,
        "product_id": product_id,
        "target_marketplace": mp.name,
        "comparison": {
            "original": {"title": original_title, "analysis": orig_analysis},
            "optimized": {"title": optimized_title, "analysis": new_analysis},
            "seo_score_delta": new_analysis["seo_score"] - orig_analysis["seo_score"],
            "diff": diff,
        },
        "keywords": keywords,
        "description": rec.description or "",
        "description_length": len(rec.description or ""),
        "description_ok": rules["description_min"] <= len(rec.description or "") <= rules["description_max"],
        # improvements / expected_impact AI ciktisi — DB'de saklanmadigi icin bos doner.
        "improvements": [],
        "expected_impact": "",
        "primary_keyword": keywords[0] if keywords else None,
        "web_sources": [],
        "used_web_search": False,
        "marketplace_rules": rules,
        "ready_to_apply": (
            new_analysis["seo_score"] > 70
            and new_analysis["in_hard_limit"]
            and not new_analysis["banned_hits"]
        ),
        "publish_note": (
            "Bu kayit gecmisten yeniden acildi. Baslik ve aciklamayi pazaryeri "
            "panelinden manuel kopyalayabilirsiniz."
        ),
        "raw_ai_output": None,
        "created_at": rec.created_at,
    }


@router.get("/{product_id}/analyze-current")
def analyze_current_listing(
    product_id: str,
    target_marketplace: Optional[str] = None,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Mevcut baslik kalitesini olcer (AI'ye gitmeden). 'optimize edilmesi gerekir mi?' kontrolu."""
    row = _resolve_product(db, user.id, product_id)
    if not row:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")
    product, mp = row
    target = target_marketplace or mp.name

    analysis = _analyze_title(product.name, target, [])
    return {
        "product_id": product_id,
        "current_title": product.name,
        "target_marketplace": target,
        "analysis": analysis,
        "recommendation": (
            "Acil optimize et"
            if analysis["seo_score"] < 50
            else "Optimize edilebilir"
            if analysis["seo_score"] < 80
            else "Baslik iyi durumda"
        ),
    }
