from fastapi import APIRouter, Depends
import json
from app.dependencies import get_current_user, get_db
from app.db.models import Financial, Product, Marketplace
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_marketplace_metrics, calculate_overall_metrics
from app.services.gemini_service import ask_gemini, ask_gemini_with_search

router = APIRouter()

# 8 kategori, toplam 100 puan
MAX_SCORES = {
    "satis_trendi": 20,
    "kar_marji": 15,
    "iade_orani": 15,
    "yorum_puani": 10,
    "nakit_akisi": 10,
    "pazaryeri_cesitliligi": 10,
    "urun_cesitliligi": 10,
    "stok_sagligi": 10,
}



def _score_satis_trendi(history):
    """3 aylik gelir trendine bakar. Yukselen=yuksek puan."""
    if len(history) < 2:
        return 12
    first = history[0].revenue or 0
    last = history[-1].revenue or 0
    if first == 0:
        return 10
    growth_pct = (last - first) / first * 100
    # %20+ buyume -> 20, sabit -> 10, %20+ dusus -> 0
    score = 10 + min(10, max(-10, growth_pct / 2))
    return max(0, min(20, round(score)))


def _score_kar_marji(net_margin):
    # 30%+ -> 15, 0% -> 0
    return max(0, min(15, round(net_margin / 2)))


def _score_iade_orani(return_rate):
    # %0 -> 15, %10+ -> 0
    return max(0, min(15, round(15 - return_rate * 1.5)))


def _score_yorum_puani(avg_rating):
    # 5.0 -> 10, 3.0 -> 0
    return max(0, min(10, round((avg_rating - 3) * 5)))


def _score_nakit_akisi(monthly_net, history):
    """Aylik net pozitif + tarihte tutarli ise yuksek."""
    if monthly_net <= 0:
        return 0
    base = 6
    if history:
        positive_months = sum(1 for h in history if (h.calculated_profit or 0) > 0)
        base = round(positive_months / len(history) * 8) + 2
    return max(0, min(10, base))


def _score_pazaryeri_cesitliligi(connected_count):
    # 1->3, 2->6, 3+->10
    if connected_count <= 0:
        return 0
    return min(10, connected_count * 3 + 1)


def _score_urun_cesitliligi(unique_products):
    # 1 urun -> 2, 5 urun -> 10
    return max(0, min(10, round(unique_products * 2)))


def _score_stok_sagligi(db, user_id):
    """days_until_stockout >= 14 olan listing oranina gore."""
    products = db.query(Product).filter(Product.user_id == user_id).all()
    if not products:
        return 5
    healthy = 0
    for p in products:
        daily = (p.sales_30d or 0) / 30
        days_left = (p.stock or 0) / daily if daily > 0 else 999
        if days_left >= 14:
            healthy += 1
    pct = healthy / len(products)
    return max(0, min(10, round(pct * 10)))


def _calculate_scores(db, user_id):
    marketplaces = fetch_all_marketplaces(user_id)
    all_metrics = {}
    all_ratings = []

    for mp in marketplaces:
        mp_data = fetch_store_info(mp, user_id)
        if mp_data:
            all_metrics[mp] = calculate_marketplace_metrics(mp_data)
            if mp_data.get("store_rating"):
                all_ratings.append(mp_data["store_rating"])

    overall = calculate_overall_metrics(all_metrics)
    avg_rating = round(sum(all_ratings) / len(all_ratings), 2) if all_ratings else 0
    return_rate = overall["overall_return_rate"]
    net_margin = overall["overall_net_margin"]
    monthly_net = overall["total_net_after_ads"]

    history = (
        db.query(Financial)
        .filter(Financial.user_id == user_id)
        .order_by(Financial.month.asc())
        .all()
    )
    unique_products = (
        db.query(Product.product_code)
        .filter(Product.user_id == user_id)
        .distinct()
        .count()
    )

    scores = {
        "satis_trendi": _score_satis_trendi(history),
        "kar_marji": _score_kar_marji(net_margin),
        "iade_orani": _score_iade_orani(return_rate),
        "yorum_puani": _score_yorum_puani(avg_rating),
        "nakit_akisi": _score_nakit_akisi(monthly_net, history),
        "pazaryeri_cesitliligi": _score_pazaryeri_cesitliligi(len(marketplaces)),
        "urun_cesitliligi": _score_urun_cesitliligi(unique_products),
        "stok_sagligi": _score_stok_sagligi(db, user_id),
    }

    total = min(100, max(0, sum(scores.values())))
    metrics = {
        "avg_rating": avg_rating,
        "return_rate": return_rate,
        "net_margin": net_margin,
        "marketplace_count": len(marketplaces),
        "unique_products": unique_products,
        "monthly_net_profit": monthly_net,
        "total_revenue_30d": overall["total_revenue"],
    }
    return total, scores, metrics


@router.get("/score")
def get_score(user=Depends(get_current_user), db=Depends(get_db)):
    total, scores, metrics = _calculate_scores(db, user.id)
    if total >= 80:
        grade = "A"
        label = "Mukemmel"
    elif total >= 65:
        grade = "B"
        label = "Iyi"
    elif total >= 50:
        grade = "C"
        label = "Orta"
    else:
        grade = "D"
        label = "Iyilestirme gerek"
    return {
        "total_score": total,
        "grade": grade,
        "label": label,
        "scores": scores,
        "metrics": metrics,
    }


@router.get("/breakdown")
def get_breakdown(user=Depends(get_current_user), db=Depends(get_db)):
    total, scores, metrics = _calculate_scores(db, user.id)
    breakdown = [
        {
            "category": key,
            "score": score,
            "max_score": MAX_SCORES[key],
            "percentage": round(score / MAX_SCORES[key] * 100, 1),
        }
        for key, score in scores.items()
    ]
    breakdown.sort(key=lambda x: x["percentage"])
    return {"total_score": total, "breakdown": breakdown, "metrics": metrics}


@router.get("/analyze")
async def analyze_score(
    use_web: bool = True,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    total, scores, metrics = _calculate_scores(db, user.id)

    web_note = (
        "\n\nEK GOREV: Google Search ile Turkiye e-ticaret sektorunde "
        "**ortalama satici puani, ortalama iade orani, ortalama kar marji** "
        "guncel verilerini ara. Saticinin durumunu bu benchmark'a gore yorumla."
        if use_web else ""
    )

    prompt = f"""Bu e-ticaret magazasinin saglik skorunu yorumla. Turkce yanit ver.

SKOR: {total}/100
KATEGORI PUANLARI: {json.dumps(scores, ensure_ascii=False)}
MAX PUANLAR: {json.dumps(MAX_SCORES, ensure_ascii=False)}
HAM METRIKLER: {json.dumps(metrics, ensure_ascii=False)}
{web_note}

Su basliklarda yanit ver:
1. Genel degerlendirme (1-2 cumle, skor seviyesine uygun ton, sektor ortalamasiyla)
2. Guclu yonler (en yuksek 3 kategori, neden iyiler)
3. Gelistirilmesi gerekenler (en dusuk 3 kategori, somut sebepleri)
4. Skor artirma yol haritasi (her oneri yaninda tahmini skor artisi)
"""
    system = (
        "Sen bir e-ticaret magaza performans uzmansin. Web aramasiyla sektor benchmark'larini "
        "bulup magaza saglik skorlarini yorumluyorsun, somut iyilestirme onerileri sunuyorsun."
    )

    sources, used_web = [], False
    if use_web:
        result = await ask_gemini_with_search(prompt, system, pool="analyze")
        analysis = result["text"]
        sources = result["sources"]
        used_web = result["used_search"]
    else:
        analysis = await ask_gemini(prompt, system, pool="analyze")

    return {
        "total_score": total,
        "scores": scores,
        "ai_analysis": analysis,
        "web_sources": sources,
        "used_web_search": used_web,
    }


@router.get("/history")
def score_history(user=Depends(get_current_user), db=Depends(get_db)):
    """
    financials tablosundaki aylik kayitlardan turetilmis tarihsel skor.
    Her ay icin: net_margin (kar marji puani), revenue trendi, profit (nakit akisi)
    bilesenleri yeniden hesaplanir; sabit kategorler (pazaryeri, urun cesitliligi,
    yorum puani vs.) icin guncel degerler kullanilir.
    """
    rows = (
        db.query(Financial)
        .filter(Financial.user_id == user.id)
        .order_by(Financial.month.asc())
        .all()
    )

    # Sabit kismi: bugunku hesabi tek sefer cikar
    current_total, current_scores, _ = _calculate_scores(db, user.id)
    static_part = (
        current_scores["yorum_puani"]
        + current_scores["pazaryeri_cesitliligi"]
        + current_scores["urun_cesitliligi"]
        + current_scores["iade_orani"]
        + current_scores["stok_sagligi"]
    )

    history = []
    for i, h in enumerate(rows):
        # Trend: i=0 icin kendisi, sonrakiler i-1'e gore
        prev = rows[i - 1].revenue if i > 0 else h.revenue
        growth = ((h.revenue - prev) / prev * 100) if prev else 0
        trend_score = max(0, min(20, round(10 + growth / 2)))

        margin_score = _score_kar_marji(h.calculated_margin or 0)
        cash_score = _score_nakit_akisi(h.calculated_profit or 0, rows[: i + 1])

        month_total = static_part + trend_score + margin_score + cash_score
        history.append({
            "month": h.month,
            "score": min(100, max(0, month_total)),
            "revenue": h.revenue,
            "profit": h.calculated_profit,
            "margin_pct": h.calculated_margin,
        })

    # Bugunku skoru en sona ekle (ay=current)
    history.append({
        "month": "current",
        "score": current_total,
        "revenue": None,
        "profit": None,
        "margin_pct": None,
    })

    return {"history": history, "current_score": current_total}
