from fastapi import APIRouter, HTTPException
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_product_metrics, calculate_arbitrage
from app.services.gemini_service import ask_gemini
import json

router = APIRouter()


def _get_product_listings(product_id: str):
    marketplaces = fetch_all_marketplaces()
    listings = []

    for mp in marketplaces:
        mp_data = fetch_store_info(mp)
        if not mp_data:
            continue
        for p in mp_data["products"]:
            if p["id"] == product_id:
                listings.append({
                    "marketplace": mp,
                    "price": p["price"],
                    "cost": p["cost"],
                    "stock": p["stock"],
                    "sales_30d": p["sales_30d"],
                    "shipping_cost": p.get("shipping_cost", 15),
                    "rating": p["rating"],
                    "return_rate": p.get("return_rate", 0),
                    "commission_rate": mp_data["commission_rate"],
                })
    return listings


@router.get("/opportunities")
def get_opportunities():
    marketplaces = fetch_all_marketplaces()
    product_map = {}

    for mp in marketplaces:
        mp_data = fetch_store_info(mp)
        if not mp_data:
            continue
        for p in mp_data["products"]:
            pid = p["id"]
            if pid not in product_map:
                product_map[pid] = {"name": p["name"], "listings": []}
            product_map[pid]["listings"].append({
                "marketplace": mp,
                "price": p["price"],
                "cost": p["cost"],
                "sales_30d": p["sales_30d"],
                "shipping_cost": p.get("shipping_cost", 15),
                "commission_rate": mp_data["commission_rate"],
            })

    opportunities = []
    for pid, data in product_map.items():
        if len(data["listings"]) < 2:
            continue
        arb = calculate_arbitrage(pid, data["listings"])
        if arb:
            arb["product_name"] = data["name"]
            opportunities.append(arb)

    opportunities.sort(key=lambda x: x["profit_gap_per_item"], reverse=True)
    return {"opportunities": opportunities}


@router.get("/{product_id}")
def get_arbitrage_detail(product_id: str):
    listings = _get_product_listings(product_id)
    if len(listings) < 2:
        raise HTTPException(status_code=400, detail="Bu urun birden fazla pazaryerinde satilmiyor")

    arb = calculate_arbitrage(product_id, listings)
    return arb


@router.get("/{product_id}/analyze")
async def analyze_arbitrage(product_id: str):
    listings = _get_product_listings(product_id)
    if len(listings) < 2:
        raise HTTPException(status_code=400, detail="Bu urun birden fazla pazaryerinde satilmiyor")

    arb = calculate_arbitrage(product_id, listings)

    prompt = f"""Bu urunun farkli pazaryerlerindeki karlilik verilerini analiz et. Turkce yanit ver.

VERILER:
{json.dumps(arb, ensure_ascii=False, indent=2)}

Su basliklarda analiz yap:
1. Hangi pazaryerinde fiyat avantajimiz var?
2. Komisyon dahil net karlilik karsilastirmasi
3. Stok dagılımı dogru mu?
4. Somut arbitraj stratejisi onerisi
"""

    system = "Sen bir capraz pazaryeri e-ticaret uzmansin. Farkli pazaryerlerindeki fiyat ve performans farklarini analiz edip strateji onerisi sunuyorsun."
    analysis = await ask_gemini(prompt, system)

    return {**arb, "ai_analysis": analysis}