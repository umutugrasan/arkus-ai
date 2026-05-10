from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user
from app.db.database import SessionLocal
from app.db.models import Product, Marketplace
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_product_metrics, calculate_arbitrage

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _days_until_stockout(stock: int, sales_30d: int) -> float:
    daily = (sales_30d or 0) / 30
    return round(stock / daily, 1) if daily > 0 else 999.0


def _get_all_products_with_metrics(user_id: int):
    """
    Tum pazaryerlerinden ayni product_code'lu listingleri grupla,
    her listing icin calculator metriklerini ekle.
    """
    marketplaces = fetch_all_marketplaces(user_id)
    all_products = {}

    for mp in marketplaces:
        mp_data = fetch_store_info(mp, user_id)
        if not mp_data:
            continue
        commission = mp_data["commission_rate"]

        for p in mp_data["products"]:
            pid = p["id"]
            metrics = calculate_product_metrics(p, commission)
            stock = p.get("stock", 0)
            sales = p.get("sales_30d", 0)

            listing = {
                "marketplace": mp,
                "price": p["price"],
                "cost": p["cost"],
                "stock": stock,
                "sales_30d": sales,
                "shipping_cost": p.get("shipping_cost", 15),
                "rating": p.get("rating", 0),
                "review_count": p.get("review_count", 0),
                "return_rate": p.get("return_rate", 0),
                "commission_rate": commission,
                "days_until_stockout": _days_until_stockout(stock, sales),
                **metrics,
            }

            if pid not in all_products:
                all_products[pid] = {
                    "id": pid,
                    "name": p["name"],
                    "category": p["category"],
                    "listings": [],
                    "total_sales": 0,
                    "total_revenue": 0.0,
                    "total_net_profit": 0.0,
                    "total_stock": 0,
                }

            all_products[pid]["listings"].append(listing)
            all_products[pid]["total_sales"] += sales
            all_products[pid]["total_revenue"] += metrics["revenue"]
            all_products[pid]["total_net_profit"] += metrics["net_profit"]
            all_products[pid]["total_stock"] += stock

    # Toplam degerleri yuvarla + ortalama profit_per_item ekle
    for data in all_products.values():
        data["total_revenue"] = round(data["total_revenue"], 2)
        data["total_net_profit"] = round(data["total_net_profit"], 2)
        data["avg_profit_per_item"] = (
            round(data["total_net_profit"] / data["total_sales"], 2)
            if data["total_sales"] > 0 else 0.0
        )

    return all_products


@router.get("/list")
def list_products(user=Depends(get_current_user)):
    products = _get_all_products_with_metrics(user.id)
    result = []
    for pid, data in products.items():
        # En cok satan listing'i baz al (kart icin)
        best_listing = max(data["listings"], key=lambda l: l["sales_30d"]) if data["listings"] else None
        result.append({
            "id": data["id"],
            "name": data["name"],
            "category": data["category"],
            "marketplace_count": len(data["listings"]),
            "total_sales": data["total_sales"],
            "total_revenue": data["total_revenue"],
            "total_net_profit": data["total_net_profit"],
            "avg_profit_per_item": data["avg_profit_per_item"],
            "total_stock": data["total_stock"],
            "rating": best_listing["rating"] if best_listing else 0,
            "review_count": best_listing["review_count"] if best_listing else 0,
        })
    result.sort(key=lambda x: x["total_sales"], reverse=True)
    return {"products": result}


@router.get("/top-sellers")
def top_sellers(limit: int = 10, user=Depends(get_current_user)):
    products = _get_all_products_with_metrics(user.id)
    result = [
        {
            "id": data["id"],
            "name": data["name"],
            "category": data["category"],
            "total_sales": data["total_sales"],
            "total_revenue": data["total_revenue"],
            "total_net_profit": data["total_net_profit"],
            "avg_profit_per_item": data["avg_profit_per_item"],
        }
        for data in products.values()
    ]
    result.sort(key=lambda x: x["total_sales"], reverse=True)
    return {"top_sellers": result[:limit]}


@router.get("/low-stock")
def low_stock(threshold_days: int = 15, user=Depends(get_current_user)):
    products = _get_all_products_with_metrics(user.id)
    alerts = []

    for pid, data in products.items():
        for listing in data["listings"]:
            days_left = listing["days_until_stockout"]
            if days_left < threshold_days:
                alerts.append({
                    "product_id": pid,
                    "product_name": data["name"],
                    "marketplace": listing["marketplace"],
                    "stock": listing["stock"],
                    "daily_sales": round(listing["sales_30d"] / 30, 1) if listing["sales_30d"] else 0,
                    "days_until_stockout": days_left,
                    "urgency": "kritik" if days_left < 7 else "uyari",
                })

    alerts.sort(key=lambda x: x["days_until_stockout"])
    return {"low_stock_alerts": alerts}


@router.get("/{product_id}")
def get_product(product_id: str, user=Depends(get_current_user)):
    products = _get_all_products_with_metrics(user.id)
    if product_id not in products:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")
    return products[product_id]


@router.get("/{product_id}/compare")
def compare_product(product_id: str, user=Depends(get_current_user)):
    products = _get_all_products_with_metrics(user.id)
    if product_id not in products:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")

    data = products[product_id]
    if len(data["listings"]) < 2:
        return {
            "product_id": product_id,
            "message": "Bu urun sadece 1 pazaryerinde satiliyor, karsilastirma yapilamaz",
            "listings": data["listings"],
        }

    return calculate_arbitrage(product_id, data["listings"])


@router.get("/{product_id}/images")
def get_product_images(
    product_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Urun gorsellerini dondurur. Su anda her pazaryeri listingi icin ayri
    image_url'i toplar; gercek pazaryeri API'sinde ayrica multi-angle gorseller
    olur, biz tek gorseli simule ediyoruz.
    """
    rows = (
        db.query(Product, Marketplace)
        .join(Marketplace, Product.marketplace_id == Marketplace.id)
        .filter(
            Product.user_id == user.id,
            Product.product_code == product_id,
        )
        .all()
    )

    if not rows:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")

    images = []
    for product, mp in rows:
        primary = product.image_url or f"https://placehold.co/600x600?text={product.product_code}"
        # Pazaryeri basina 3 farkli aci sahte URL'i (gercekte API'den 5-8 gorsel gelir)
        gallery = [
            primary,
            f"{primary}&angle=side",
            f"{primary}&angle=detail",
        ]
        images.append({
            "marketplace": mp.name,
            "primary_image": primary,
            "gallery": gallery,
        })

    return {
        "product_id": product_id,
        "product_name": rows[0][0].name,
        "images_by_marketplace": images,
    }
