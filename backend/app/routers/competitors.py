from fastapi import APIRouter, HTTPException
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.gemini_service import ask_gemini
import json

router = APIRouter()


def _get_competitors(product_id: str):
    marketplaces = fetch_all_marketplaces()
    result = []

    for mp in marketplaces:
        mp_data = fetch_store_info(mp)
        if not mp_data:
            continue
        for p in mp_data["products"]:
            if p["id"] == product_id:
                for c in p.get("competitors", []):
                    price_diff = round(p["price"] - c["price"], 2)
                    price_diff_pct = round(price_diff / p["price"] * 100, 1)
                    result.append({
                        "marketplace": mp,
                        "our_price": p["price"],
                        "our_rating": p["rating"],
                        "our_sales": p["sales_30d"],
                        "competitor_name": c["name"],
                        "competitor_price": c["price"],
                        "competitor_rating": c["rating"],
                        "competitor_sales": c["sales_30d"],
                        "price_diff": price_diff,
                        "price_diff_pct": price_diff_pct,
                        "we_are": "pahali" if price_diff > 0 else "ucuz",
                    })
    return result


@router.get("/{product_id}")
def get_competitors(product_id: str):
    comps = _get_competitors(product_id)
    if not comps:
        raise HTTPException(status_code=404, detail="Rakip bulunamadi")
    return {"product_id": product_id, "competitors": comps}


@router.get("/{product_id}/analyze")
async def analyze_competitors(product_id: str):
    comps = _get_competitors(product_id)
    if not comps:
        raise HTTPException(status_code=404, detail="Rakip bulunamadi")

    prompt = f"""Asagidaki rakip verilerini analiz et. Turkce yanit ver.

VERILER:
{json.dumps(comps, ensure_ascii=False, indent=2)}

Su basliklarda analiz yap:
1. En tehlikeli rakip kim ve neden?
2. Fiyat pozisyonumuz nasil?
3. Rakiplerin guclu ve zayif yonleri
4. Somut strateji onerileri (fiyat, urun aciklamasi, reklam)
"""

    system = "Sen bir e-ticaret strateji uzmansin. Rakip analizleri yapip saticilara somut aksiyon onerileri sunuyorsun."
    analysis = await ask_gemini(prompt, system)

    return {"product_id": product_id, "competitors": comps, "ai_analysis": analysis}


@router.get("/{product_id}/price-map")
def price_map(product_id: str):
    comps = _get_competitors(product_id)
    if not comps:
        raise HTTPException(status_code=404, detail="Rakip bulunamadi")

    by_mp = {}
    for c in comps:
        mp = c["marketplace"]
        if mp not in by_mp:
            by_mp[mp] = {"our_price": c["our_price"], "competitors": []}
        by_mp[mp]["competitors"].append({
            "name": c["competitor_name"],
            "price": c["competitor_price"],
            "diff": c["price_diff"],
        })

    return {"product_id": product_id, "price_map": by_mp}