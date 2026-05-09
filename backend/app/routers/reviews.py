from fastapi import APIRouter, HTTPException
from app.services.marketplace_api import fetch_reviews
from app.services.gemini_service import ask_gemini

router = APIRouter()


@router.get("/{product_id}")
def get_reviews(product_id: str, marketplace: str = "all"):
    reviews = fetch_reviews(marketplace, product_id)
    if not reviews:
        raise HTTPException(status_code=404, detail="Yorum bulunamadi")

    return {"product_id": product_id, "total": len(reviews), "reviews": reviews}


@router.get("/{product_id}/sentiment")
def get_sentiment(product_id: str):
    reviews = fetch_reviews("all", product_id)
    if not reviews:
        raise HTTPException(status_code=404, detail="Yorum bulunamadi")

    total = len(reviews)
    positive = len([r for r in reviews if r["rating"] >= 4])
    negative = len([r for r in reviews if r["rating"] <= 2])
    neutral = total - positive - negative
    avg_rating = round(sum(r["rating"] for r in reviews) / total, 2)

    by_mp = {}
    for r in reviews:
        mp = r["marketplace"]
        if mp not in by_mp:
            by_mp[mp] = {"count": 0, "total_rating": 0, "positive": 0, "negative": 0}
        by_mp[mp]["count"] += 1
        by_mp[mp]["total_rating"] += r["rating"]
        if r["rating"] >= 4:
            by_mp[mp]["positive"] += 1
        elif r["rating"] <= 2:
            by_mp[mp]["negative"] += 1

    for mp in by_mp:
        by_mp[mp]["avg_rating"] = round(by_mp[mp]["total_rating"] / by_mp[mp]["count"], 2)

    return {
        "product_id": product_id,
        "total_reviews": total,
        "avg_rating": avg_rating,
        "sentiment": {
            "positive": positive,
            "negative": negative,
            "neutral": neutral,
            "positive_pct": round(positive / total * 100, 1),
            "negative_pct": round(negative / total * 100, 1),
            "neutral_pct": round(neutral / total * 100, 1),
        },
        "by_marketplace": by_mp,
    }


@router.get("/{product_id}/analyze")
async def analyze_reviews(product_id: str):
    reviews = fetch_reviews("all", product_id)
    if not reviews:
        raise HTTPException(status_code=404, detail="Yorum bulunamadi")

    reviews_text = "\n".join(
        [f"- [{r['marketplace']}] Puan: {r['rating']}/5 - \"{r['text']}\"" for r in reviews]
    )

    prompt = f"""Asagidaki e-ticaret urun yorumlarini analiz et. Turkce yanit ver.

YORUMLAR:
{reviews_text}

Su basliklarda analiz yap:
1. Genel duygu durumu (pozitif/negatif/notr yuzdeleri)
2. En sik sikayet edilen konular (kategorize et, yuzdelerle)
3. En cok begenilen ozellikler
4. Pazaryerleri arasi farklar
5. Somut iyilestirme onerileri (tahmini puan artisiyla birlikte)
"""

    system = "Sen bir e-ticaret uzmansin. Saticilara yorumlari analiz edip somut aksiyon onerileri sunuyorsun."
    analysis = await ask_gemini(prompt, system)

    return {"product_id": product_id, "total_reviews": len(reviews), "ai_analysis": analysis}


@router.get("/{product_id}/compare")
def compare_reviews(product_id: str):
    reviews = fetch_reviews("all", product_id)
    if not reviews:
        raise HTTPException(status_code=404, detail="Yorum bulunamadi")

    by_mp = {}
    for r in reviews:
        mp = r["marketplace"]
        if mp not in by_mp:
            by_mp[mp] = {"reviews": [], "total_rating": 0, "count": 0}
        by_mp[mp]["reviews"].append(r)
        by_mp[mp]["total_rating"] += r["rating"]
        by_mp[mp]["count"] += 1

    comparison = {}
    for mp, data in by_mp.items():
        avg = round(data["total_rating"] / data["count"], 2)
        pos = len([r for r in data["reviews"] if r["rating"] >= 4])
        neg = len([r for r in data["reviews"] if r["rating"] <= 2])
        comparison[mp] = {
            "avg_rating": avg,
            "total_reviews": data["count"],
            "positive": pos,
            "negative": neg,
            "positive_pct": round(pos / data["count"] * 100, 1),
            "negative_pct": round(neg / data["count"] * 100, 1),
        }

    return {"product_id": product_id, "marketplace_comparison": comparison}