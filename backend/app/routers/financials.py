from fastapi import APIRouter
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_marketplace_metrics, calculate_overall_metrics
from app.services.gemini_service import ask_gemini
import json

router = APIRouter()


def _get_all_metrics():
    marketplaces = fetch_all_marketplaces()
    all_metrics = {}
    for mp in marketplaces:
        mp_data = fetch_store_info(mp)
        if mp_data:
            all_metrics[mp] = calculate_marketplace_metrics(mp_data)
    return all_metrics


@router.get("/overview")
def financial_overview():
    all_metrics = _get_all_metrics()
    overall = calculate_overall_metrics(all_metrics)
    return {"overall": overall}


@router.get("/by-marketplace")
def by_marketplace():
    all_metrics = _get_all_metrics()
    result = []
    for mp, metrics in all_metrics.items():
        result.append({
            "marketplace": mp,
            "revenue": metrics["total_revenue"],
            "net_profit": metrics["total_net_profit"],
            "net_margin_pct": metrics["net_margin_pct"],
            "commission": metrics["total_commission"],
            "ad_spend": metrics["ad_spend"],
            "roas": metrics["roas"],
            "sales": metrics["total_sales"],
        })
    result.sort(key=lambda x: x["net_profit"], reverse=True)
    return {"marketplaces": result}


@router.get("/by-product")
def by_product():
    all_metrics = _get_all_metrics()
    products = {}
    for mp, metrics in all_metrics.items():
        for pm in metrics["product_metrics"]:
            pid = pm["id"]
            if pid not in products:
                products[pid] = {"id": pid, "name": pm["name"], "total_revenue": 0, "total_net_profit": 0, "total_sales": 0}
            products[pid]["total_revenue"] += pm["revenue"]
            products[pid]["total_net_profit"] += pm["net_profit"]
            products[pid]["total_sales"] += pm["sales_30d"]

    result = list(products.values())
    for r in result:
        r["net_margin_pct"] = round(r["total_net_profit"] / r["total_revenue"] * 100, 2) if r["total_revenue"] > 0 else 0
    result.sort(key=lambda x: x["total_net_profit"], reverse=True)
    return {"products": result}


@router.get("/expenses")
def expense_breakdown():
    all_metrics = _get_all_metrics()
    overall = calculate_overall_metrics(all_metrics)

    total_expense = overall["total_cost"] + overall["total_commission"] + overall["total_shipping"] + overall["total_ad_spend"]

    breakdown = {
        "urun_maliyeti": {"amount": overall["total_cost"], "pct": round(overall["total_cost"] / total_expense * 100, 1)},
        "komisyon": {"amount": overall["total_commission"], "pct": round(overall["total_commission"] / total_expense * 100, 1)},
        "kargo": {"amount": overall["total_shipping"], "pct": round(overall["total_shipping"] / total_expense * 100, 1)},
        "reklam": {"amount": overall["total_ad_spend"], "pct": round(overall["total_ad_spend"] / total_expense * 100, 1)},
    }

    return {"total_expense": round(total_expense, 2), "breakdown": breakdown}


@router.get("/cash-flow")
def cash_flow():
    all_metrics = _get_all_metrics()
    overall = calculate_overall_metrics(all_metrics)

    return {
        "current_balance": 284000,
        "monthly_revenue": overall["total_revenue"],
        "monthly_net_profit": overall["total_net_after_ads"],
        "pending_receivables": round(overall["total_revenue"] * 0.3, 2),
        "upcoming_expenses": round(overall["total_cost"] * 0.4 + 50000, 2),
        "runway_months": round(284000 / (overall["total_cost"] * 0.4 + 50000), 1),
    }


@router.get("/analyze")
async def analyze_financials():
    all_metrics = _get_all_metrics()
    overall = calculate_overall_metrics(all_metrics)

    mp_summary = {}
    for mp, m in all_metrics.items():
        mp_summary[mp] = {
            "revenue": m["total_revenue"],
            "net_profit": m["total_net_profit"],
            "net_margin": m["net_margin_pct"],
            "commission": m["total_commission"],
            "ad_spend": m["ad_spend"],
            "roas": m["roas"],
        }

    prompt = f"""Asagidaki e-ticaret saticisinin finansal verilerini analiz et. Turkce yanit ver.

GENEL OZET:
{json.dumps(overall, ensure_ascii=False, indent=2)}

PAZARYERI BAZLI:
{json.dumps(mp_summary, ensure_ascii=False, indent=2)}

Su basliklarda analiz yap:
1. Gelir-gider trendi nasil?
2. Kar marji analizi ve optimizasyon onerileri
3. Komisyon optimizasyonu (hangi pazaryeri daha karli)
4. Reklam harcamasi ROI degerlendirmesi
5. Finansman yonlendirmesi (KOSGEB, KOBi kredisi onerileri)
"""

    system = "Sen bir KOBi finansal danismansin. E-ticaret saticilarina gelir-gider analizi yapip somut finansal oneriler sunuyorsun."
    analysis = await ask_gemini(prompt, system)

    return {"overall": overall, "by_marketplace": mp_summary, "ai_analysis": analysis}