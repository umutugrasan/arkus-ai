from fastapi import APIRouter, Depends, HTTPException
import json
from datetime import datetime
from typing import Optional
from app.dependencies import get_current_user, get_db
from app.db.models import Report
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_marketplace_metrics, calculate_overall_metrics
from app.services.gemini_service import ask_gemini, ask_gemini_with_search, ask_gemini_stream
from app.sse import sse_response

router = APIRouter()



def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _build_metrics(user_id: int):
    marketplaces = fetch_all_marketplaces(user_id)
    all_metrics = {}
    for mp in marketplaces:
        mp_data = fetch_store_info(mp, user_id)
        if mp_data:
            all_metrics[mp] = calculate_marketplace_metrics(mp_data)
    overall = calculate_overall_metrics(all_metrics)
    return all_metrics, overall


def _save_report(db, user_id, type_, title, content, metrics):
    rep = Report(
        user_id=user_id,
        type=type_,
        title=title,
        content=content,
        metrics_json=metrics,
        created_at=_now(),
    )
    db.add(rep)
    db.commit()
    db.refresh(rep)
    return rep


def _to_dict(r: Report) -> dict:
    """
    Defensive: frontend null-check yapmiyorsa toLocaleString() crash yapmasin.
    Tum numerik alanlari 0 default'la, tum string alanlari "" default'la.
    Hem `metrics` (eski sema) hem `metrics_json` (yeni) hem root flatten doneriz.
    """
    m = r.metrics_json or {}
    # Eski sema "profit" kullaniyordu, yeni "net_profit". Ikisini de doldur.
    revenue = m.get("revenue") or 0
    net_profit = m.get("net_profit") or m.get("profit") or 0
    sales = m.get("sales") or 0
    return {
        "id": r.id,
        "type": r.type or "",
        "title": r.title or "",
        "content": r.content or "",
        "metrics": {
            "revenue": revenue,
            "profit": net_profit,        # legacy key
            "net_profit": net_profit,    # yeni key
            "sales": sales,
            **m,                         # tum digerleri (return_rate, roas, marketplaces, ...)
        },
        "metrics_json": m,
        "revenue": revenue,
        "net_profit": net_profit,
        "profit": net_profit,            # legacy root flatten
        "sales": sales,
        "created_at": r.created_at or "",
    }


@router.post("/daily")
async def generate_daily_report(
    use_web: bool = True,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    all_metrics, overall = _build_metrics(user.id)
    today = datetime.now().strftime("%d %B %Y")

    mp_summary = {
        mp: {
            "revenue": m["total_revenue"],
            "profit": m["total_net_profit"],
            "sales": m["total_sales"],
            "margin_pct": m["net_margin_pct"],
        }
        for mp, m in all_metrics.items()
    }

    web_note = (
        "\n\nEK GOREV: Google Search ile Turkiye e-ticaret sektorunde bugun one cikan "
        "haber/trend var mi (kargo zammi, vergi degisikligi, kampanya donemi) bir satirlik not ekle."
        if use_web else ""
    )

    prompt = f"""Asagidaki verilere dayanarak gunluk ozet raporu olustur. Turkce yanit ver.

TARIH: {today}

GENEL ({overall['total_sales']} satis):
- Toplam gelir: {overall['total_revenue']:,.2f} TL
- Net kar (reklamdan sonra): {overall['total_net_after_ads']:,.2f} TL
- Iade orani: {overall['overall_return_rate']}%
- ROAS: {overall['overall_roas']}

PAZARYERI BAZLI:
{json.dumps(mp_summary, ensure_ascii=False, indent=2)}
{web_note}

Rapor formati:
1. **Gunun Ozeti** (2-3 cumle)
2. **One Cikan Metrikler** (iyi 2, kotu 2)
3. **Dikkat Edilmesi Gerekenler**
4. **Bugunku Oncelikli Aksiyonlar** (3 madde, somut)
"""
    system = (
        "Sen bir e-ticaret rapor uzmanisin. Web aramasiyla guncel sektor durumu bilgisi "
        "alip kisa, net ve aksiyon odakli gunluk raporlar olusturuyorsun."
    )

    sources = []
    if use_web:
        result = await ask_gemini_with_search(prompt, system)
        content = result["text"]
        sources = result["sources"]
    else:
        content = await ask_gemini(prompt, system)

    metrics = {
        "revenue": overall["total_revenue"],
        "net_profit": overall["total_net_after_ads"],
        "sales": overall["total_sales"],
        "return_rate": overall["overall_return_rate"],
        "roas": overall["overall_roas"],
        "marketplaces": mp_summary,
        "web_sources": sources,
    }
    rep = _save_report(
        db, user.id, "daily",
        f"Gunluk Ozet Raporu - {today}",
        content, metrics,
    )
    return _to_dict(rep)


def _build_weekly_prompt(user_id):
    all_metrics, overall = _build_metrics(user_id)
    today = datetime.now().strftime("%d %B %Y")

    mp_summary = {
        mp: {
            "revenue": m["total_revenue"],
            "profit": m["total_net_profit"],
            "sales": m["total_sales"],
            "margin_pct": m["net_margin_pct"],
            "roas": m["roas"],
        }
        for mp, m in all_metrics.items()
    }

    # En iyi/en kotu urunler
    all_products = []
    for mp, m in all_metrics.items():
        for p in m["product_metrics"]:
            all_products.append({**p, "marketplace": mp})
    all_products.sort(key=lambda p: p["net_profit"], reverse=True)
    top_3 = all_products[:3]
    bottom_3 = all_products[-3:] if len(all_products) >= 3 else []

    prompt = f"""Asagidaki verilere dayanarak haftalik performans raporu olustur. Turkce yanit ver.

TARIH ARALIGI: Son 7 gun (rapor: {today})

GENEL OZET:
{json.dumps(overall, ensure_ascii=False, indent=2)}

PAZARYERI BAZLI:
{json.dumps(mp_summary, ensure_ascii=False, indent=2)}

EN IYI 3 URUN (net kar):
{json.dumps(top_3, ensure_ascii=False, indent=2)}

EN KOTU 3 URUN:
{json.dumps(bottom_3, ensure_ascii=False, indent=2)}

Rapor formati:
1. **Haftanin Ozeti** (3-4 cumle)
2. **Pazaryeri Bazli Performans** (hangisi yukseldi, hangisi dustu)
3. **En Iyi 3 Urun** ve **En Kotu 3 Urun** (rakamlarla)
4. **Haftalik Trendler ve Uyarilar**
5. **Gelecek Hafta Strateji Onerileri** (5 madde, somut)
"""
    system = (
        "Sen bir e-ticaret performans analistsin. Web aramasiyla guncel sektor durumu "
        "alip detayli haftalik raporlar olusturuyorsun."
    )

    metrics = {
        "revenue": overall["total_revenue"],
        "net_profit": overall["total_net_after_ads"],
        "sales": overall["total_sales"],
        "return_rate": overall["overall_return_rate"],
        "roas": overall["overall_roas"],
        "marketplaces": mp_summary,
        "top_products": [p["id"] for p in top_3],
        "bottom_products": [p["id"] for p in bottom_3],
    }
    return prompt, system, metrics, today

@router.post("/weekly")
async def generate_weekly_report(
    use_web: bool = True,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    prompt, system, metrics, today = _build_weekly_prompt(user.id)
    
    web_note = (
        "\n\nEK GOREV: Google Search ile Turkiye e-ticaret sektorunde son 7 gun "
        "trend olan haberleri ve bir sonraki haftanin onemli takvim olaylarini (kampanya, "
        "tatil, vergi tarihi) raporun sonuna 'PIYASA NOTLARI' basligiyla ekle."
    )
    if use_web:
        prompt += web_note

    sources = []
    if use_web:
        result = await ask_gemini_with_search(prompt, system)
        content = result["text"]
        sources = result["sources"]
    else:
        content = await ask_gemini(prompt, system)

    metrics["web_sources"] = sources

    rep = _save_report(
        db, user.id, "weekly",
        f"Haftalik Performans Raporu - {today}",
        content, metrics,
    )
    return _to_dict(rep)


def _build_daily_prompt(user_id):
    all_metrics, overall = _build_metrics(user_id)
    today = datetime.now().strftime("%d %B %Y")
    mp_summary = {
        mp: {"revenue": m["total_revenue"], "profit": m["total_net_profit"],
             "sales": m["total_sales"], "margin_pct": m["net_margin_pct"]}
        for mp, m in all_metrics.items()
    }
    prompt = f"""Asagidaki verilere dayanarak gunluk ozet raporu olustur. Turkce yanit ver.

TARIH: {today}

GENEL ({overall['total_sales']} satis):
- Toplam gelir: {overall['total_revenue']:,.2f} TL
- Net kar: {overall['total_net_after_ads']:,.2f} TL
- Iade orani: %{overall['overall_return_rate']}
- ROAS: {overall['overall_roas']}

PAZARYERI BAZLI:
{json.dumps(mp_summary, ensure_ascii=False, indent=2)}

Rapor formati:
1. **Gunun Ozeti** (2-3 cumle)
2. **One Cikan Metrikler** (iyi 2, kotu 2)
3. **Dikkat Edilmesi Gerekenler**
4. **Bugunku Oncelikli Aksiyonlar** (3 madde)
"""
    system = "Sen bir e-ticaret rapor uzmanisin. Kisa, net, aksiyon odakli gunluk raporlar olusturuyorsun."
    metrics = {
        "revenue": overall["total_revenue"],
        "net_profit": overall["total_net_after_ads"],
        "sales": overall["total_sales"],
        "return_rate": overall["overall_return_rate"],
        "roas": overall["overall_roas"],
        "marketplaces": mp_summary,
    }
    return prompt, system, metrics, today


@router.post("/daily/stream")
async def generate_daily_stream(
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """SSE: rapor token token akar, bittiginde DB'ye yazilir."""
    prompt, system, metrics, today = _build_daily_prompt(user.id)

    async def event_stream():
        yield f"event: meta\ndata: {json.dumps({'type': 'daily', 'date': today, 'metrics': metrics}, ensure_ascii=False)}\n\n"
        parts = []
        async for chunk in ask_gemini_stream(
            prompt, system, endpoint="reports.daily.stream", user_id=user.id,
        ):
            if chunk.get("done"):
                full_text = "".join(parts)
                rec_id = None
                is_fallback = full_text.startswith("⚠️") or "gercek ai/web analizi su anda alinamadi" in full_text.lower()
                if not is_fallback and full_text:
                    rep = _save_report(
                        db, user.id, "daily",
                        f"Gunluk Ozet Raporu - {today}",
                        full_text, metrics,
                    )
                    rec_id = rep.id
                evt = "error" if chunk.get("error") else "done"
                yield f"event: {evt}\ndata: {json.dumps({'id': rec_id, 'full_text': full_text, 'is_fallback': is_fallback, 'error': chunk.get('error')}, ensure_ascii=False)}\n\n"
                return
            txt = chunk.get("text", "")
            if txt:
                parts.append(txt)
                yield f"event: chunk\ndata: {json.dumps({'text': txt}, ensure_ascii=False)}\n\n"

    return sse_response(event_stream())

@router.post("/weekly/stream")
async def generate_weekly_stream(
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """SSE: haftalik rapor token token akar, bittiginde DB'ye yazilir."""
    prompt, system, metrics, today = _build_weekly_prompt(user.id)
    
    web_note = (
        "\n\nEK GOREV: Google Search ile Turkiye e-ticaret sektorunde son 7 gun "
        "trend olan haberleri ve bir sonraki haftanin onemli takvim olaylarini (kampanya, "
        "tatil, vergi tarihi) raporun sonuna 'PIYASA NOTLARI' basligiyla ekle."
    )
    prompt += web_note

    async def event_stream():
        yield f"event: meta\ndata: {json.dumps({'type': 'weekly', 'date': today, 'metrics': metrics}, ensure_ascii=False)}\n\n"
        parts = []
        async for chunk in ask_gemini_stream(
            prompt, system, endpoint="reports.weekly.stream", user_id=user.id,
        ):
            if chunk.get("done"):
                full_text = "".join(parts)
                rec_id = None
                is_fallback = full_text.startswith("⚠️") or "gercek ai/web analizi su anda alinamadi" in full_text.lower()
                if not is_fallback and full_text:
                    rep = _save_report(
                        db, user.id, "weekly",
                        f"Haftalik Performans Raporu - {today}",
                        full_text, metrics,
                    )
                    rec_id = rep.id
                evt = "error" if chunk.get("error") else "done"
                yield f"event: {evt}\ndata: {json.dumps({'id': rec_id, 'full_text': full_text, 'is_fallback': is_fallback, 'error': chunk.get('error')}, ensure_ascii=False)}\n\n"
                return
            txt = chunk.get("text", "")
            if txt:
                parts.append(txt)
                yield f"event: chunk\ndata: {json.dumps({'text': txt}, ensure_ascii=False)}\n\n"

    return sse_response(event_stream())


@router.get("/list")
def list_reports(
    type: Optional[str] = None,
    limit: int = 50,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    q = db.query(Report).filter(Report.user_id == user.id)
    if type:
        q = q.filter(Report.type == type)
    rows = q.order_by(Report.id.desc()).limit(limit).all()
    def _safe(m, *keys):
        for k in keys:
            v = m.get(k) if m else None
            if v is not None:
                return v
        return 0

    return {
        "total": len(rows),
        "reports": [
            # Listede preview + metrics flatten — null yerine 0/"" don, frontend crash etmesin
            {
                "id": r.id,
                "type": r.type or "",
                "title": r.title or "",
                "metrics": {
                    "revenue": _safe(r.metrics_json, "revenue"),
                    "profit": _safe(r.metrics_json, "net_profit", "profit"),
                    "net_profit": _safe(r.metrics_json, "net_profit", "profit"),
                    "sales": _safe(r.metrics_json, "sales"),
                    **(r.metrics_json or {}),
                },
                "revenue": _safe(r.metrics_json, "revenue"),
                "net_profit": _safe(r.metrics_json, "net_profit", "profit"),
                "profit": _safe(r.metrics_json, "net_profit", "profit"),
                "sales": _safe(r.metrics_json, "sales"),
                "preview": (r.content[:200] + "...") if r.content and len(r.content) > 200 else (r.content or ""),
                "created_at": r.created_at or "",
            }
            for r in rows
        ],
    }


@router.get("/{report_id}")
def get_report(
    report_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    r = (
        db.query(Report)
        .filter(Report.id == report_id, Report.user_id == user.id)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Rapor bulunamadi")
    return _to_dict(r)
