import json
from fastapi import APIRouter, Depends
from datetime import datetime, timedelta
from collections import defaultdict
from app.dependencies import get_current_user, get_db
from app.db.models import Order, Product, Marketplace
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_marketplace_metrics, calculate_overall_metrics
from app.services.gemini_service import ask_gemini, ask_gemini_with_search, ask_gemini_stream
from app.sse import sse_response

router = APIRouter()



def _build_overview(user_id: int) -> dict:
    marketplaces = fetch_all_marketplaces(user_id)
    all_metrics = {}
    for mp in marketplaces:
        mp_data = fetch_store_info(mp, user_id)
        if mp_data:
            all_metrics[mp] = calculate_marketplace_metrics(mp_data)
    overall = calculate_overall_metrics(all_metrics)
    return {
        "overall": overall,
        "marketplace_count": len(marketplaces),
        "by_marketplace": {
            mp: {
                "total_revenue": m["total_revenue"],
                "total_net_profit": m["total_net_profit"],
                "net_margin_pct": m["net_margin_pct"],
                "total_sales": m["total_sales"],
            }
            for mp, m in all_metrics.items()
        },
    }


@router.get("/overview")
def get_overview(user=Depends(get_current_user)):
    return _build_overview(user.id)


@router.get("/marketplace-summary")
def get_marketplace_summary(user=Depends(get_current_user)):
    marketplaces = fetch_all_marketplaces(user.id)
    summaries = []

    for mp in marketplaces:
        mp_data = fetch_store_info(mp, user.id)
        if not mp_data:
            continue
        metrics = calculate_marketplace_metrics(mp_data)
        summaries.append({
            "marketplace": mp,
            "store_name": mp_data["store_name"],
            "store_rating": mp_data["store_rating"],
            "commission_rate": mp_data["commission_rate"],
            "total_revenue": metrics["total_revenue"],
            "total_net_profit": metrics["total_net_profit"],
            "net_margin_pct": metrics["net_margin_pct"],
            "total_sales": metrics["total_sales"],
            "return_rate": metrics["return_rate"],
            "ad_spend": metrics["ad_spend"],
            "roas": metrics["roas"],
            "product_count": len(mp_data["products"]),
        })

    return {"marketplaces": summaries}


@router.get("/trends")
def get_trends(period: int = 30, user=Depends(get_current_user), db=Depends(get_db)):
    """
    Orders tablosundan tarih bazli gelir/satis/iade trendi cikarir.
    period=7  -> son 7 gun, gunluk
    period=30 -> son 30 gun, haftalik 4 grup
    Hicbir order yoksa veya tum aktivite sifirsa, frontend'in EmptyState
    gosterebilmesi icin daily/weekly bos array doner.
    """
    today = datetime.now().date()
    start = today - timedelta(days=period)

    user_orders = (
        db.query(Order)
        .filter(Order.user_id == user.id, Order.date >= start.isoformat())
        .all()
    )

    if period == 7:
        # gunluk grupla
        buckets = {(start + timedelta(days=i)).isoformat(): {"revenue": 0.0, "sales": 0, "returns": 0}
                   for i in range(period + 1)}
        for o in user_orders:
            if o.date not in buckets:
                continue
            b = buckets[o.date]
            if o.status == "delivered":
                b["revenue"] += o.total or 0.0
                b["sales"] += o.quantity or 0
            elif o.status == "returned":
                b["returns"] += o.quantity or 0
        daily = [
            {"date": d, **{k: round(v, 2) if isinstance(v, float) else v for k, v in vals.items()}}
            for d, vals in sorted(buckets.items())
        ]
        # Eger hicbir gunde aktivite yoksa, dummy 0-fill grafik yerine bos dön.
        if not any(d["revenue"] or d["sales"] or d["returns"] for d in daily):
            return {"period": "7 gun", "daily": []}
        return {"period": "7 gun", "daily": daily}

    # period=30 -> 4 haftaya bol
    weeks = [{"week": f"Hafta {i+1}", "revenue": 0.0, "sales": 0, "returns": 0} for i in range(4)]
    for o in user_orders:
        try:
            o_date = datetime.fromisoformat(o.date).date()
        except (TypeError, ValueError):
            continue
        idx = min(3, max(0, (o_date - start).days // 7))
        if o.status == "delivered":
            weeks[idx]["revenue"] += o.total or 0.0
            weeks[idx]["sales"] += o.quantity or 0
        elif o.status == "returned":
            weeks[idx]["returns"] += o.quantity or 0
    for w in weeks:
        w["revenue"] = round(w["revenue"], 2)
    if not any(w["revenue"] or w["sales"] or w["returns"] for w in weeks):
        return {"period": "30 gun", "weekly": []}
    return {"period": "30 gun", "weekly": weeks}


@router.get("/ai-summary")
async def get_ai_summary(
    use_web: bool = True,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Gemini ile dashboard ilk girisinde gosterilecek genel durum ozeti.
    Tum DB metrikleri context olarak verilir, AI proaktif uyarilar yazar.
    """
    overview = _build_overview(user.id)
    overall = overview["overall"]

    # Stok kritik urunler
    low_stock = (
        db.query(Product)
        .filter(Product.user_id == user.id, Product.stock < 50)
        .order_by(Product.stock.asc())
        .limit(5)
        .all()
    )
    low_stock_lines = [
        f"- {p.name}: {p.stock} adet (gunluk satis ~{(p.sales_30d or 0)/30:.1f})"
        for p in low_stock
    ]

    # Dusuk puanli urunler
    low_rated = (
        db.query(Product)
        .filter(Product.user_id == user.id, Product.rating < 4.0)
        .order_by(Product.rating.asc())
        .limit(5)
        .all()
    )
    low_rated_lines = [f"- {p.name}: {p.rating} ({p.review_count} yorum)" for p in low_rated]

    today = datetime.now().date()
    last_7 = (
        db.query(Order)
        .filter(
            Order.user_id == user.id,
            Order.status == "delivered",
            Order.date >= (today - timedelta(days=7)).isoformat(),
        )
        .all()
    )
    sales_7d = sum(o.quantity or 0 for o in last_7)
    revenue_7d = sum(o.total or 0 for o in last_7)

    context = f"""
SATICI MAGAZA DURUMU (DB'den otomatik hesaplanmis):

GENEL METRIKLER (son 30 gun):
- Toplam ciro: {overall['total_revenue']:,.2f} TL
- Net kar (reklamdan once): {overall['total_net_profit']:,.2f} TL
- Net kar (reklamdan sonra): {overall['total_net_after_ads']:,.2f} TL
- Net kar marji: %{overall['overall_net_margin']}
- Toplam satis: {overall['total_sales']} adet
- Iade orani: %{overall['overall_return_rate']}
- Genel ROAS: {overall['overall_roas']}
- Bagli pazaryeri sayisi: {overview['marketplace_count']}

PAZARYERI BAZLI:
{chr(10).join(f"- {mp}: {m['total_revenue']:,.0f} TL ciro, %{m['net_margin_pct']} marj, {m['total_sales']} satis" for mp, m in overview['by_marketplace'].items())}

SON 7 GUN: {sales_7d} satis, {revenue_7d:,.2f} TL ciro

STOK KRITIK URUNLER:
{chr(10).join(low_stock_lines) if low_stock_lines else '- Yok'}

DUSUK PUANLI URUNLER:
{chr(10).join(low_rated_lines) if low_rated_lines else '- Yok'}
"""

    if use_web:
        context += (
            "\n\nEK GOREV: Google Search ile **bugun Turkiye e-ticaret sektorunde "
            "trend olan haberleri** (1-2 cumle) bul ve ozetin sonuna 'PIYASA NOTU' "
            "olarak ekle (kampanya donemi, kargo zammi, vergi degisikligi vs.)."
        )

    system = (
        "Sen Arkus AI'sin, bir e-ticaret danismani. Saticiyi sabah 'gunaydin' dercesine selamlayan, "
        "kisa ve aksiyon odakli bir genel durum ozeti yaz. 4-6 cumle. Acil dikkat gerektiren 1-2 noktayi "
        "vurgula (stok, dusuk puan, marj dususu vs.). Sonunda tek satirla ne yapmasi gerektigini soyle. "
        "Markdown kullan ama abartma."
    )

    sources, used_web = [], False
    if use_web:
        result = await ask_gemini_with_search(context, system_instruction=system)
        summary = result["text"]
        sources = result["sources"]
        used_web = result["used_search"]
    else:
        summary = await ask_gemini(context, system_instruction=system)

    return {
        "summary": summary,
        "web_sources": sources,
        "used_web_search": used_web,
        "snapshot": {
            "total_revenue_30d": overall["total_revenue"],
            "net_profit_30d": overall["total_net_after_ads"],
            "net_margin_pct": overall["overall_net_margin"],
            "sales_7d": sales_7d,
            "revenue_7d": round(revenue_7d, 2),
            "low_stock_count": len(low_stock),
            "low_rated_count": len(low_rated),
        },
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


@router.get("/ai-summary/stream")
async def get_ai_summary_stream(
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    SSE: AI ozetini token token gonderir. Frontend ChatGPT gibi yazarken gosterir.
    Hizli ilk-byte: kullanici "salak gibi" beklemez.
    """
    overview = _build_overview(user.id)
    overall = overview["overall"]
    low_stock = (
        db.query(Product)
        .filter(Product.user_id == user.id, Product.stock < 50)
        .order_by(Product.stock.asc()).limit(5).all()
    )
    low_rated = (
        db.query(Product)
        .filter(Product.user_id == user.id, Product.rating < 4.0)
        .order_by(Product.rating.asc()).limit(5).all()
    )
    today = datetime.now().date()
    last_7 = (
        db.query(Order)
        .filter(
            Order.user_id == user.id, Order.status == "delivered",
            Order.date >= (today - timedelta(days=7)).isoformat(),
        ).all()
    )
    sales_7d = sum(o.quantity or 0 for o in last_7)
    revenue_7d = sum(o.total or 0 for o in last_7)

    low_stock_lines = [
        f"- {p.name}: {p.stock} adet" for p in low_stock
    ]
    low_rated_lines = [f"- {p.name}: {p.rating}" for p in low_rated]

    context = f"""SATICI DURUMU (son 30 gun):
- Ciro: {overall['total_revenue']:,.2f} TL
- Net kar (reklamdan sonra): {overall['total_net_after_ads']:,.2f} TL
- Marj: %{overall['overall_net_margin']}
- Satis: {overall['total_sales']} adet
- Iade: %{overall['overall_return_rate']}
- ROAS: {overall['overall_roas']}
- Pazaryeri sayisi: {overview['marketplace_count']}

SON 7 GUN: {sales_7d} satis, {revenue_7d:,.2f} TL

STOK KRITIK:
{chr(10).join(low_stock_lines) if low_stock_lines else '- Yok'}

DUSUK PUAN:
{chr(10).join(low_rated_lines) if low_rated_lines else '- Yok'}
"""

    system = (
        "Sen Arkus AI'sin, bir e-ticaret danismani. Saticiyi sabah 'gunaydin' "
        "tarzinda selamlayan, 4-6 cumlelik aksiyon odakli ozet yaz. Acil noktayi vurgula. "
        "Markdown kullan ama abartma. Turkce yanit ver."
    )

    snapshot = {
        "total_revenue_30d": overall["total_revenue"],
        "net_profit_30d": overall["total_net_after_ads"],
        "net_margin_pct": overall["overall_net_margin"],
        "sales_7d": sales_7d,
        "revenue_7d": round(revenue_7d, 2),
        "low_stock_count": len(low_stock),
        "low_rated_count": len(low_rated),
    }

    async def event_stream():
        yield f"event: meta\ndata: {json.dumps({'snapshot': snapshot}, ensure_ascii=False)}\n\n"
        parts = []
        async for chunk in ask_gemini_stream(
            context, system, endpoint="dashboard.ai_summary.stream", user_id=user.id,
        ):
            if chunk.get("done"):
                evt = "error" if chunk.get("error") else "done"
                yield f"event: {evt}\ndata: {json.dumps({'full_text': ''.join(parts), 'model': chunk.get('model'), 'error': chunk.get('error')}, ensure_ascii=False)}\n\n"
                return
            txt = chunk.get("text", "")
            if txt:
                parts.append(txt)
                yield f"event: chunk\ndata: {json.dumps({'text': txt}, ensure_ascii=False)}\n\n"

    return sse_response(event_stream())
