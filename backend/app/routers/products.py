from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_product_metrics, calculate_arbitrage

router = APIRouter()


def _get_all_products_with_metrics():
    marketplaces = fetch_all_marketplaces(user.id)
    all_products = {}

    for mp in marketplaces:
        mp_data = fetch_store_info(mp, user.id)
        if not mp_data:
            continue
        commission = mp_data["commission_rate"]

        for p in mp_data["products"]:
            pid = p["id"]
            metrics = calculate_product_metrics(p, commission)

            listing = {
                "marketplace": mp,
                "price": p["price"],
                "cost": p["cost"],
                "stock": p["stock"],
                "sales_30d": p["sales_30d"],
                "shipping_cost": p.get("shipping_cost", 15),
                "rating": p["rating"],
                "review_count": p["review_count"],
                "return_rate": p.get("return_rate", 0),
                "commission_rate": commission,
                **metrics,
            }

            if pid not in all_products:
                all_products[pid] = {
                    "id": pid,
                    "name": p["name"],
                    "category": p["category"],
                    "listings": [],
                    "total_sales": 0,
                    "total_revenue": 0,
                    "total_net_profit": 0,
                }

            all_products[pid]["listings"].append(listing)
            all_products[pid]["total_sales"] += p["sales_30d"]
            all_products[pid]["total_revenue"] += metrics["revenue"]
            all_products[pid]["total_net_profit"] += metrics["net_profit"]

    return all_products


@router.get("/list")
def list_products(user = Depends(get_current_user)):
    products = _get_all_products_with_metrics()
    result = []
    for pid, data in products.items():
        result.append({
            "id": data["id"],
            "name": data["name"],
            "category": data["category"],
            "marketplace_count": len(data["listings"]),
            "total_sales": data["total_sales"],
            "total_revenue": round(data["total_revenue"], 2),
            "total_net_profit": round(data["total_net_profit"], 2),
        })
    result.sort(key=lambda x: x["total_sales"], reverse=True)
    return {"products": result}


@router.get("/top-sellers")
def top_sellers(user = Depends(get_current_user)):
    products = _get_all_products_with_metrics()
    result = []
    for pid, data in products.items():
        result.append({
            "id": data["id"],
            "name": data["name"],
            "total_sales": data["total_sales"],
            "total_revenue": round(data["total_revenue"], 2),
            "total_net_profit": round(data["total_net_profit"], 2),
        })
    result.sort(key=lambda x: x["total_sales"], reverse=True)
    return {"top_sellers": result[:10]}


@router.get("/low-stock")
def low_stock(user = Depends(get_current_user)):
    products = _get_all_products_with_metrics()
    alerts = []

    for pid, data in products.items():
        for listing in data["listings"]:
            daily_sales = listing["sales_30d"] / 30
            days_left = round(listing["stock"] / daily_sales, 1) if daily_sales > 0 else 999

            if days_left < 15:
                alerts.append({
                    "product_id": pid,
                    "product_name": data["name"],
                    "marketplace": listing["marketplace"],
                    "stock": listing["stock"],
                    "daily_sales": round(daily_sales, 1),
                    "days_until_stockout": days_left,
                    "urgency": "kritik" if days_left < 7 else "uyari",
                })

    alerts.sort(key=lambda x: x["days_until_stockout"])
    return {"low_stock_alerts": alerts}


@router.get("/{product_id}")
def get_product(product_id: str, user = Depends(get_current_user)):
    products = _get_all_products_with_metrics()
    if product_id not in products:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")

    return products[product_id]


@router.get("/{product_id}/compare")
def compare_product(product_id: str, user = Depends(get_current_user)):
    products = _get_all_products_with_metrics()
    if product_id not in products:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")

    data = products[product_id]
    if len(data["listings"]) < 2:
        return {"message": "Bu urun sadece 1 pazaryerinde satiliyor, karsilastirma yapilamaz"}

    arbitrage = calculate_arbitrage(product_id, data["listings"])
    return arbitrage