from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_marketplace_metrics, calculate_overall_metrics
from app.services.gemini_service import ask_gemini
import json

router = APIRouter()


def _calculate_scores():
    marketplaces = fetch_all_marketplaces(user.id)
    all_metrics = {}
    all_ratings = []
    total_products = 0

    for mp in marketplaces:
        mp_data = fetch_store_info(mp, user.id)
        if mp_data:
            all_metrics[mp] = calculate_marketplace_metrics(mp_data)
            all_ratings.append(mp_data["store_rating"])
            total_products += len(mp_data["products"])

    overall = calculate_overall_metrics(all_metrics)

    avg_rating = round(sum(all_ratings) / len(all_ratings), 2) if all_ratings else 0
    return_rate = overall["overall_return_rate"]
    net_margin = overall["overall_net_margin"]

    scores = {
        "satis_trendi": min(20, max(0, round(15 + net_margin * 0.2))),
        "kar_marji": min(15, max(0, round(net_margin * 0.5))),
        "iade_orani": min(15, max(0, round(15 - return_rate * 1.5))),
        "yorum_puani": min(10, max(0, round((avg_rating - 3) * 6.67))),
        "nakit_akisi": 8,
        "pazaryeri_cesitliligi": min(10, len(marketplaces) * 3),
        "urun_cesitliligi": min(10, round(total_products * 0.8)),
        "stok_sagligi": 7,
    }

    total = min(100, max(0, sum(scores.values())))

    metrics = {
        "avg_rating": avg_rating,
        "return_rate": return_rate,
        "net_margin": net_margin,
        "marketplace_count": len(marketplaces),
        "total_products": total_products,
        "total_revenue": overall["total_revenue"],
        "total_net_profit": overall["total_net_after_ads"],
    }

    return total, scores, metrics


@router.get("/score")
def get_score(user = Depends(get_current_user)):
    total, scores, metrics = _calculate_scores()
    return {"total_score": total, "scores": scores, "metrics": metrics}


@router.get("/breakdown")
def get_breakdown(user = Depends(get_current_user)):
    total, scores, metrics = _calculate_scores()

    max_scores = {
        "satis_trendi": 20,
        "kar_marji": 15,
        "iade_orani": 15,
        "yorum_puani": 10,
        "nakit_akisi": 10,
        "pazaryeri_cesitliligi": 10,
        "urun_cesitliligi": 10,
        "stok_sagligi": 10,
    }

    breakdown = []
    for key, score in scores.items():
        breakdown.append({
            "category": key,
            "score": score,
            "max_score": max_scores[key],
            "percentage": round(score / max_scores[key] * 100, 1),
        })

    breakdown.sort(key=lambda x: x["percentage"])
    return {"total_score": total, "breakdown": breakdown}


@router.get("/analyze")
async def analyze_score():
    total, scores, metrics = _calculate_scores()

    prompt = f"""Bu e-ticaret magazasinin saglik skorunu yorumla. Turkce yanit ver.

SKOR: {total}/100
DETAY: {json.dumps(scores, ensure_ascii=False)}
METRIKLER: {json.dumps(metrics, ensure_ascii=False)}

Su basliklarda yanit ver:
1. Genel degerlendirme (1-2 cumle)
2. Guclu yonler (en yuksek skorlu 3 alan)
3. Gelistirilmesi gerekenler (en dusuk skorlu 3 alan)
4. Skor artirma onerileri (somut aksiyonlar ve tahmini skor artisi)
"""

    system = "Sen bir e-ticaret magaza performans uzmansin. Magaza saglik skorlarini yorumlayip somut iyilestirme onerileri sunuyorsun."
    analysis = await ask_gemini(prompt, system)

    return {"total_score": total, "scores": scores, "ai_analysis": analysis}


@router.get("/history")
def score_history(user = Depends(get_current_user)):
    return {
        "history": [
            {"week": "Hafta 1", "score": 65},
            {"week": "Hafta 2", "score": 68},
            {"week": "Hafta 3", "score": 70},
            {"week": "Hafta 4", "score": 72},
        ]
    }