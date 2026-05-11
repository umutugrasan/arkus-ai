from fastapi import APIRouter, Depends, HTTPException
from typing import List
from datetime import datetime, timedelta
import json
import hashlib
from app.dependencies import get_current_user, get_db
from app.db.models import Product, Competitor, Marketplace, CompetitorPriceHistory
from app.services.gemini_service import ask_gemini, ask_gemini_with_search

router = APIRouter()



def _stable_seed(text: str) -> int:
    """Rakip ismine sabit bir sayisal seed uretir (ayni demo cagrisinda ayni grafik)."""
    return int(hashlib.md5(text.encode()).hexdigest()[:8], 16)


def _get_competitors_for_user(db, user_id: int, product_code: str) -> List[dict]:
    rows = (
        db.query(Product, Marketplace, Competitor)
        .join(Marketplace, Product.marketplace_id == Marketplace.id)
        .join(Competitor, Competitor.product_id == Product.id)
        .filter(
            Product.user_id == user_id,
            Product.product_code == product_code,
        )
        .all()
    )
    result = []
    for product, mp, c in rows:
        price_diff = round(product.price - c.price, 2)
        price_diff_pct = round(price_diff / product.price * 100, 1) if product.price else 0
        result.append({
            "marketplace": mp.name,
            "our_price": product.price,
            "our_rating": product.rating,
            "our_sales": product.sales_30d,
            "competitor_name": c.name,
            "competitor_price": c.price,
            "competitor_rating": c.rating,
            "competitor_sales": c.sales_30d,
            "competitor_review_count": c.review_count,
            "price_diff": price_diff,
            "price_diff_pct": price_diff_pct,
            "we_are": "pahali" if price_diff > 0 else ("ucuz" if price_diff < 0 else "esit"),
            "last_updated": c.last_updated,
        })
    return result


@router.get("/{product_id}")
def get_competitors(
    product_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    comps = _get_competitors_for_user(db, user.id, product_id)
    if not comps:
        raise HTTPException(status_code=404, detail="Rakip bulunamadi")
    return {"product_id": product_id, "total": len(comps), "competitors": comps}


@router.get("/{product_id}/analyze")
async def analyze_competitors(
    product_id: str,
    detail: str = "short",   # short | detailed
    use_web: bool = True,    # Trendyol/HB/Amazon'da gercek rakip fiyatlari arasin mi
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    if detail not in ("short", "detailed"):
        raise HTTPException(status_code=400, detail="detail short|detailed olmali")

    comps = _get_competitors_for_user(db, user.id, product_id)
    if not comps:
        raise HTTPException(status_code=404, detail="Rakip bulunamadi")

    # Urun ismini alalim ki web aramasi yapabilelim
    product_name = (
        db.query(Product)
        .filter(Product.user_id == user.id, Product.product_code == product_id)
        .first()
    )
    product_name = product_name.name if product_name else product_id

    web_note = (
        f"\n\nEK GOREV: Asagidaki urun icin Trendyol.com, Hepsiburada.com ve Amazon.com.tr'de "
        f"**gercek anlik rakip fiyatlarini Google Search ile** ara: \"{product_name}\". "
        "En az 3 farkli satici bul, fiyatlarini DB'deki rakiplerle karsilastir."
        if use_web else ""
    )

    if detail == "short":
        prompt = (
            "Asagidaki rakip verilerine bakarak 3-4 cumlelik kisa Turkce ozet yaz. "
            "En tehlikeli rakip ve fiyat pozisyonumuza dair tek aksiyon onerisi belirgin olsun.\n\n"
            f"DB'DEKI RAKIPLER:\n{json.dumps(comps, ensure_ascii=False, indent=2)}"
            + web_note
        )
    else:
        prompt = f"""Asagidaki rakip verilerini detayli analiz et. Turkce yanit ver.

DB'DEKI RAKIPLER:
{json.dumps(comps, ensure_ascii=False, indent=2)}
{web_note}

Su basliklarda analiz yap:
1. En tehlikeli rakip kim ve neden? (DB + webde gordugun)
2. Fiyat pozisyonumuz nasil? (pazaryeri bazinda, anlik web fiyatlariyla karsilastir)
3. Rakiplerin guclu ve zayif yonleri (puan, satis hacmi, yorum sayisi)
4. Somut strateji onerileri (fiyat, urun aciklamasi, reklam butcesi)
"""

    system = (
        "Sen bir e-ticaret strateji uzmansin. Web aramasi ile gercek anlik rakip fiyatlarini "
        "bulup saticilara somut aksiyon onerileri sunuyorsun."
    )

    sources, used_web = [], False
    if use_web:
        result = await ask_gemini_with_search(prompt, system)
        analysis = result["text"]
        sources = result["sources"]
        used_web = result["used_search"]
    else:
        analysis = await ask_gemini(prompt, system)

    return {
        "product_id": product_id,
        "product_name": product_name,
        "detail": detail,
        "competitors": comps,
        "ai_analysis": analysis,
        "web_sources": sources,
        "used_web_search": used_web,
    }


@router.get("/{product_id}/price-map")
def price_map(
    product_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    comps = _get_competitors_for_user(db, user.id, product_id)
    if not comps:
        raise HTTPException(status_code=404, detail="Rakip bulunamadi")

    by_mp = {}
    for c in comps:
        mp = c["marketplace"]
        if mp not in by_mp:
            by_mp[mp] = {
                "our_price": c["our_price"],
                "min_competitor_price": c["competitor_price"],
                "max_competitor_price": c["competitor_price"],
                "competitors": [],
            }
        bucket = by_mp[mp]
        bucket["competitors"].append({
            "name": c["competitor_name"],
            "price": c["competitor_price"],
            "rating": c["competitor_rating"],
            "sales_30d": c["competitor_sales"],
            "diff": c["price_diff"],
            "diff_pct": c["price_diff_pct"],
        })
        bucket["min_competitor_price"] = min(bucket["min_competitor_price"], c["competitor_price"])
        bucket["max_competitor_price"] = max(bucket["max_competitor_price"], c["competitor_price"])

    # Pazar konumu (bizim fiyat ortalamaya gore)
    for mp, bucket in by_mp.items():
        avg_comp = sum(x["price"] for x in bucket["competitors"]) / len(bucket["competitors"])
        bucket["avg_competitor_price"] = round(avg_comp, 2)
        if bucket["our_price"] < bucket["min_competitor_price"]:
            bucket["position"] = "en ucuz"
        elif bucket["our_price"] > bucket["max_competitor_price"]:
            bucket["position"] = "en pahali"
        else:
            bucket["position"] = "orta"

    return {"product_id": product_id, "price_map": by_mp}


@router.get("/{product_id}/track")
def track_price_changes(
    product_id: str,
    days: int = 14,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Rakip fiyat degisim gecmisi. competitor_price_history tablosundan gercek
    snapshot'lari okur. Her sync'te yeni snapshot eklenir, bu yuzden zaman
    icinde daha zengin tarihce olusur.
    """
    # Once kullaniciya ait Product satirlarini bul (product_code ile birden fazla
    # satir olabilir cunku farkli marketplace'lerde)
    product_rows = (
        db.query(Product, Marketplace)
        .join(Marketplace, Product.marketplace_id == Marketplace.id)
        .filter(Product.user_id == user.id, Product.product_code == product_id)
        .all()
    )
    if not product_rows:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")

    product_ids = [p.id for p, _ in product_rows]
    mp_lookup = {p.id: mp.name for p, mp in product_rows}

    cutoff = (datetime.now().date() - timedelta(days=days)).isoformat()
    snapshots = (
        db.query(CompetitorPriceHistory)
        .filter(
            CompetitorPriceHistory.product_id.in_(product_ids),
            CompetitorPriceHistory.captured_at >= cutoff,
        )
        .order_by(CompetitorPriceHistory.captured_at.asc())
        .all()
    )

    if not snapshots:
        return {
            "product_id": product_id,
            "period_days": days,
            "tracked_count": 0,
            "histories": [],
            "message": "Henuz fiyat tarihcesi yok. Sync calisirsa snapshot eklenir.",
        }

    # Grupla: (pid, competitor_name) -> snapshots
    groups = {}
    for s in snapshots:
        groups.setdefault((s.product_id, s.competitor_name), []).append(s)

    histories = []
    for (pid, name), snaps in groups.items():
        timeline = [{"date": s.captured_at, "price": s.price} for s in snaps]
        prices = [t["price"] for t in timeline]
        change = round(timeline[-1]["price"] - timeline[0]["price"], 2)
        change_pct = (
            round(change / timeline[0]["price"] * 100, 2)
            if timeline[0]["price"] else 0
        )
        histories.append({
            "competitor": name,
            "marketplace": mp_lookup.get(pid),
            "current_price": timeline[-1]["price"],
            "min_in_period": min(prices),
            "max_in_period": max(prices),
            "change_in_period": change,
            "change_pct": change_pct,
            "trend": "yukselis" if change > 0 else ("dusus" if change < 0 else "sabit"),
            "snapshot_count": len(timeline),
            "timeline": timeline,
        })

    return {
        "product_id": product_id,
        "period_days": days,
        "tracked_count": len(histories),
        "histories": histories,
    }
