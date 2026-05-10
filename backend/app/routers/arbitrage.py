from fastapi import APIRouter, Depends, HTTPException
import json
from app.dependencies import get_current_user
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_arbitrage
from app.services.gemini_service import ask_gemini, ask_gemini_with_search

router = APIRouter()


def _get_product_listings(user_id: int, product_code: str) -> list:
    """Tum bagli pazaryerlerinde ayni product_code'lu listingleri toplar."""
    marketplaces = fetch_all_marketplaces(user_id)
    listings = []

    for mp in marketplaces:
        mp_data = fetch_store_info(mp, user_id)
        if not mp_data:
            continue
        for p in mp_data["products"]:
            if p["id"] != product_code:
                continue
            listings.append({
                "marketplace": mp,
                "price": p["price"],
                "cost": p["cost"],
                "stock": p["stock"],
                "sales_30d": p["sales_30d"],
                "shipping_cost": p.get("shipping_cost", 15),
                "rating": p.get("rating", 0),
                "return_rate": p.get("return_rate", 0),
                "commission_rate": mp_data["commission_rate"],
            })
    return listings


def _build_all_arbitrage(user_id: int) -> list:
    """Tum urunler icin (en az 2 pazaryeri olanlar) arbitraj firsatlarini hesaplar."""
    marketplaces = fetch_all_marketplaces(user_id)
    product_map = {}

    for mp in marketplaces:
        mp_data = fetch_store_info(mp, user_id)
        if not mp_data:
            continue
        for p in mp_data["products"]:
            pid = p["id"]
            if pid not in product_map:
                product_map[pid] = {"name": p["name"], "category": p["category"], "listings": []}
            product_map[pid]["listings"].append({
                "marketplace": mp,
                "price": p["price"],
                "cost": p["cost"],
                "stock": p["stock"],
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
            arb["category"] = data["category"]
            opportunities.append(arb)
    return opportunities


@router.get("/opportunities")
def get_opportunities(user=Depends(get_current_user)):
    """Tum arbitraj firsatlari, aylik fark (monthly_opportunity) buyukten kucuge."""
    opportunities = _build_all_arbitrage(user.id)
    opportunities.sort(key=lambda x: x["monthly_opportunity"], reverse=True)

    summary = {
        "total_opportunities": len(opportunities),
        "total_monthly_potential": round(
            sum(o["monthly_opportunity"] for o in opportunities), 2
        ),
        "biggest_gap_product": opportunities[0]["product_name"] if opportunities else None,
    }
    return {"summary": summary, "opportunities": opportunities}


@router.get("/{product_id}")
def get_arbitrage_detail(product_id: str, user=Depends(get_current_user)):
    """Tek urun icin pazaryerleri arasi detayli karsilastirma."""
    listings = _get_product_listings(user.id, product_id)
    if not listings:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")
    if len(listings) < 2:
        raise HTTPException(
            status_code=400,
            detail="Bu urun birden fazla pazaryerinde satilmiyor, arbitraj yapilamaz",
        )

    arb = calculate_arbitrage(product_id, listings)
    return arb


@router.get("/{product_id}/analyze")
async def analyze_arbitrage(
    product_id: str,
    use_web: bool = True,
    user=Depends(get_current_user),
):
    listings = _get_product_listings(user.id, product_id)
    if not listings:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")
    if len(listings) < 2:
        raise HTTPException(
            status_code=400,
            detail="Bu urun birden fazla pazaryerinde satilmiyor, arbitraj yapilamaz",
        )

    arb = calculate_arbitrage(product_id, listings)
    product_name = listings[0].get("name") or product_id

    web_note = (
        f"\n\nEK GOREV: Google Search ile bu urun kategorisi icin Trendyol/Hepsiburada/Amazon TR'de "
        f"**anlik ortalama satis fiyatlarini** ara: \"{product_id}\". "
        "Pazaryeri arasi gerçek fiyat farkını DB verisiyle karşılaştır."
        if use_web else ""
    )

    prompt = f"""Bu urunun farkli pazaryerlerindeki karlilik verilerini analiz et. Turkce yanit ver.

VERILER:
{json.dumps(arb, ensure_ascii=False, indent=2)}
{web_note}

Su basliklarda analiz yap:
1. Hangi pazaryerinde net birim kar en yuksek? Neden?
2. Aylik kayip firsat (en iyi - en kotu pazaryeri farki) ne kadar?
3. Stok dagilimi optimal mi? Nereye stok kaydirmali?
4. Somut arbitraj stratejisi (fiyat, stok, reklam butcesi)
"""

    system = (
        "Sen bir capraz pazaryeri e-ticaret uzmansin. Web aramasiyla gercek anlik pazaryeri "
        "fiyatlarini bulup farkli pazaryerlerindeki fiyat ve performans farklarini analiz edip "
        "strateji onerisi sunuyorsun."
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
        **arb,
        "ai_analysis": analysis,
        "web_sources": sources,
        "used_web_search": used_web,
    }
