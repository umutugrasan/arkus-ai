from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_marketplace_metrics, calculate_overall_metrics

router = APIRouter()


@router.get("/overview")
def get_overview(user = Depends(get_current_user)):
    marketplaces = fetch_all_marketplaces(user.id)
    all_metrics = {}

    for mp in marketplaces:
        mp_data = fetch_store_info(mp, user.id)
        if mp_data:
            all_metrics[mp] = calculate_marketplace_metrics(mp_data)

    overall = calculate_overall_metrics(all_metrics)

    return {
        "overall": overall,
        "marketplace_count": len(marketplaces),
    }


@router.get("/marketplace-summary")
def get_marketplace_summary(user = Depends(get_current_user)):
    marketplaces = fetch_all_marketplaces(user.id)
    summaries = []

    for mp in marketplaces:
        mp_data = fetch_store_info(mp, user.id)
        if mp_data:
            metrics = calculate_marketplace_metrics(mp_data)
            summaries.append({
                "marketplace": mp,
                "store_name": mp_data["store_name"],
                "store_rating": mp_data["store_rating"],
                "commission_rate": mp_data["commission_rate"],
                "total_revenue": metrics["total_revenue"],
                "total_net_profit": metrics["total_net_profit"],
                "net_margin_pct": metrics["net_margin_pct"],
                "total_sales": metrics["total_sales"],
                "return_rate": metrics["return_rate"],
                "ad_spend": metrics["ad_spend"],
                "roas": metrics["roas"],
                "product_count": len(mp_data["products"]),
            })

    return {"marketplaces": summaries}


@router.get("/trends")
def get_trends(period: int = 30, user = Depends(get_current_user)):
    # Mock trend verisi - gercek urunde pazaryeri API'sindan cekilir
    if period == 7:
        return {
            "period": "7 gun",
            "daily": [
                {"date": "2026-05-04", "revenue": 52000, "sales": 78, "returns": 5},
                {"date": "2026-05-05", "revenue": 61000, "sales": 92, "returns": 7},
                {"date": "2026-05-06", "revenue": 48000, "sales": 71, "returns": 4},
                {"date": "2026-05-07", "revenue": 55000, "sales": 83, "returns": 6},
                {"date": "2026-05-08", "revenue": 67000, "sales": 98, "returns": 8},
                {"date": "2026-05-09", "revenue": 72000, "sales": 105, "returns": 5},
                {"date": "2026-05-10", "revenue": 58000, "sales": 86, "returns": 6},
            ],
        }
    else:
        return {
            "period": "30 gun",
            "weekly": [
                {"week": "Hafta 1", "revenue": 380000, "sales": 560, "returns": 38},
                {"week": "Hafta 2", "revenue": 420000, "sales": 620, "returns": 42},
                {"week": "Hafta 3", "revenue": 395000, "sales": 590, "returns": 35},
                {"week": "Hafta 4", "revenue": 450000, "sales": 680, "returns": 48},
            ],
        }