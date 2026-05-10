from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.dependencies import get_current_user
from app.db.database import SessionLocal
from app.db.models import Review, ReviewAnalysis, Product, Marketplace
from app.services.gemini_service import ask_gemini

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _resolve_internal_product(db, user_id: int, product_code: str):
    """product_code'a sahip kullaniciya ait herhangi bir Product satirini dondurur (FK icin)."""
    return (
        db.query(Product)
        .filter(Product.user_id == user_id, Product.product_code == product_code)
        .first()
    )


def _user_owns_product(db, user_id: int, product_code: str) -> bool:
    return _resolve_internal_product(db, user_id, product_code) is not None


def _filter_reviews(
    db, user_id: int, product_code: str,
    marketplace: Optional[str] = None,
    month: Optional[str] = None,
    last_n: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> List[Review]:
    if not _user_owns_product(db, user_id, product_code):
        return []

    q = db.query(Review).filter(Review.product_code == product_code)
    if marketplace and marketplace != "all":
        q = q.filter(Review.marketplace_name == marketplace)
    if month:
        q = q.filter(Review.date.like(f"{month}%"))
    if date_from:
        q = q.filter(Review.date >= date_from)
    if date_to:
        q = q.filter(Review.date <= date_to)
    q = q.order_by(Review.date.desc())
    if last_n:
        q = q.limit(last_n)
    return q.all()


def _sentiment_breakdown(reviews: List[Review]) -> dict:
    total = len(reviews)
    if total == 0:
        return {"total_reviews": 0}
    positive = sum(1 for r in reviews if r.rating >= 4)
    negative = sum(1 for r in reviews if r.rating <= 2)
    neutral = total - positive - negative
    avg_rating = round(sum(r.rating for r in reviews) / total, 2)
    return {
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
    }


async def _run_analysis(reviews: List[Review], detail: str) -> str:
    if not reviews:
        return "Analiz icin yorum bulunamadi."

    reviews_text = "\n".join(
        f"- [{r.marketplace_name}] Puan: {r.rating}/5 - \"{r.text}\""
        for r in reviews[:80]
    )

    if detail == "short":
        prompt = (
            "Asagidaki musteri yorumlarini analiz et. 3-4 cumlelik kisa Turkce ozet ver. "
            "En kritik sikayet ve en cok begenilen yon belirgin olsun.\n\nYORUMLAR:\n"
            + reviews_text
        )
    else:
        prompt = f"""Asagidaki e-ticaret urun yorumlarini detayli analiz et. Turkce yanit ver.

YORUMLAR:
{reviews_text}

Su basliklarda analiz yap:
1. Genel duygu durumu (pozitif/negatif/notr yuzdeleri)
2. En sik sikayet edilen konular (kategorize et, yuzdelerle)
3. En cok begenilen ozellikler
4. Pazaryerleri arasi farklar
5. Somut iyilestirme onerileri (tahmini puan artisiyla birlikte)
"""
    system = (
        "Sen bir e-ticaret uzmansin. Saticilara yorumlari analiz edip somut aksiyon onerileri sunuyorsun."
    )
    return await ask_gemini(prompt, system)


# --------- Endpoints ---------

@router.get("/{product_id}")
def get_reviews(
    product_id: str,
    marketplace: str = "all",
    month: Optional[str] = None,    # "2026-05" gibi
    last_n: Optional[int] = None,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    if not _user_owns_product(db, user.id, product_id):
        raise HTTPException(status_code=404, detail="Urun bulunamadi")

    reviews = _filter_reviews(db, user.id, product_id, marketplace, month, last_n)
    return {
        "product_id": product_id,
        "marketplace": marketplace,
        "month": month,
        "last_n": last_n,
        "total": len(reviews),
        "reviews": [
            {"marketplace": r.marketplace_name, "rating": r.rating, "text": r.text, "date": r.date}
            for r in reviews
        ],
    }


@router.get("/{product_id}/sentiment")
def get_sentiment(
    product_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    if not _user_owns_product(db, user.id, product_id):
        raise HTTPException(status_code=404, detail="Urun bulunamadi")

    reviews = _filter_reviews(db, user.id, product_id)
    breakdown = _sentiment_breakdown(reviews)
    if breakdown["total_reviews"] == 0:
        raise HTTPException(status_code=404, detail="Yorum bulunamadi")

    by_mp = {}
    for r in reviews:
        mp = r.marketplace_name
        if mp not in by_mp:
            by_mp[mp] = {"count": 0, "total_rating": 0, "positive": 0, "negative": 0}
        by_mp[mp]["count"] += 1
        by_mp[mp]["total_rating"] += r.rating
        if r.rating >= 4:
            by_mp[mp]["positive"] += 1
        elif r.rating <= 2:
            by_mp[mp]["negative"] += 1
    for mp in by_mp:
        by_mp[mp]["avg_rating"] = round(by_mp[mp]["total_rating"] / by_mp[mp]["count"], 2)

    return {"product_id": product_id, **breakdown, "by_marketplace": by_mp}


@router.get("/{product_id}/analyze")
async def analyze_reviews(
    product_id: str,
    detail: str = "short",   # short | detailed
    refresh: bool = False,   # True ise cache yok say, yeniden uret
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Urun secildiginde otomatik cagrilir. Cache var ise kayitli analizi doner;
    yoksa Gemini'den uretip review_analyses tablosuna yazar.
    """
    if detail not in ("short", "detailed"):
        raise HTTPException(status_code=400, detail="detail short|detailed olmali")

    product = _resolve_internal_product(db, user.id, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")

    if not refresh:
        cached = (
            db.query(ReviewAnalysis)
            .filter(
                ReviewAnalysis.product_id == product.id,
                ReviewAnalysis.analysis_type == detail,
            )
            .order_by(ReviewAnalysis.id.desc())
            .first()
        )
        if cached:
            return {
                "product_id": product_id,
                "detail": detail,
                "cached": True,
                "ai_analysis": cached.content,
                "created_at": cached.created_at,
            }

    reviews = _filter_reviews(db, user.id, product_id)
    if not reviews:
        raise HTTPException(status_code=404, detail="Yorum bulunamadi")

    analysis = await _run_analysis(reviews, detail)

    record = ReviewAnalysis(
        product_id=product.id,
        analysis_type=detail,
        content=analysis,
        filters={"marketplace": "all", "review_count": len(reviews)},
        created_at=_now(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "product_id": product_id,
        "detail": detail,
        "cached": False,
        "total_reviews": len(reviews),
        "ai_analysis": analysis,
        "created_at": record.created_at,
    }


@router.get("/{product_id}/compare")
def compare_reviews(
    product_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    if not _user_owns_product(db, user.id, product_id):
        raise HTTPException(status_code=404, detail="Urun bulunamadi")

    reviews = _filter_reviews(db, user.id, product_id)
    if not reviews:
        raise HTTPException(status_code=404, detail="Yorum bulunamadi")

    by_mp = {}
    for r in reviews:
        mp = r.marketplace_name
        if mp not in by_mp:
            by_mp[mp] = {"reviews": [], "total_rating": 0, "count": 0}
        by_mp[mp]["reviews"].append(r)
        by_mp[mp]["total_rating"] += r.rating
        by_mp[mp]["count"] += 1

    comparison = {}
    for mp, data in by_mp.items():
        cnt = data["count"]
        pos = sum(1 for r in data["reviews"] if r.rating >= 4)
        neg = sum(1 for r in data["reviews"] if r.rating <= 2)
        comparison[mp] = {
            "avg_rating": round(data["total_rating"] / cnt, 2),
            "total_reviews": cnt,
            "positive": pos,
            "negative": neg,
            "positive_pct": round(pos / cnt * 100, 1),
            "negative_pct": round(neg / cnt * 100, 1),
        }

    return {"product_id": product_id, "marketplace_comparison": comparison}


@router.get("/{product_id}/history")
def analysis_history(
    product_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Bu urun icin daha once kaydedilmis tum analizler (eskiden yeniye)."""
    product = _resolve_internal_product(db, user.id, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")

    rows = (
        db.query(ReviewAnalysis)
        .filter(ReviewAnalysis.product_id == product.id)
        .order_by(ReviewAnalysis.id.desc())
        .all()
    )
    return {
        "product_id": product_id,
        "total": len(rows),
        "analyses": [
            {
                "id": r.id,
                "analysis_type": r.analysis_type,
                "filters": r.filters,
                "content": r.content,
                "created_at": r.created_at,
            }
            for r in rows
        ],
    }


class CustomAnalyzeRequest(BaseModel):
    marketplace: Optional[str] = "all"
    month: Optional[str] = None       # "2026-05"
    last_n: Optional[int] = None
    date_from: Optional[str] = None   # "2026-04-01"
    date_to: Optional[str] = None     # "2026-05-10"
    detail: str = "detailed"


@router.post("/{product_id}/analyze-custom")
async def analyze_custom(
    product_id: str,
    req: CustomAnalyzeRequest,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    if req.detail not in ("short", "detailed"):
        raise HTTPException(status_code=400, detail="detail short|detailed olmali")

    product = _resolve_internal_product(db, user.id, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")

    reviews = _filter_reviews(
        db, user.id, product_id,
        marketplace=req.marketplace,
        month=req.month,
        last_n=req.last_n,
        date_from=req.date_from,
        date_to=req.date_to,
    )
    if not reviews:
        raise HTTPException(status_code=404, detail="Filtreyle eslesen yorum bulunamadi")

    analysis = await _run_analysis(reviews, req.detail)

    record = ReviewAnalysis(
        product_id=product.id,
        analysis_type="custom",
        content=analysis,
        filters=req.dict(),
        created_at=_now(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "product_id": product_id,
        "filters": req.dict(),
        "total_reviews": len(reviews),
        "ai_analysis": analysis,
        "created_at": record.created_at,
        "analysis_id": record.id,
    }
