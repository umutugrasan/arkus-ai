from fastapi import APIRouter, Depends
import json
from app.dependencies import get_current_user, get_db
from app.db.models import Financial
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_marketplace_metrics, calculate_overall_metrics
from app.services.gemini_service import ask_gemini, ask_gemini_with_search

router = APIRouter()



def _get_all_metrics(user_id: int):
    marketplaces = fetch_all_marketplaces(user_id)
    all_metrics = {}
    for mp in marketplaces:
        mp_data = fetch_store_info(mp, user_id)
        if mp_data:
            all_metrics[mp] = calculate_marketplace_metrics(mp_data)
    return all_metrics


@router.get("/overview")
def financial_overview(user=Depends(get_current_user), db=Depends(get_db)):
    all_metrics = _get_all_metrics(user.id)
    overall = calculate_overall_metrics(all_metrics)

    # Tarihsel finansals (son 3 ay) trend grafik icin
    history = (
        db.query(Financial)
        .filter(Financial.user_id == user.id)
        .order_by(Financial.month.asc())
        .all()
    )
    monthly_history = [
        {
            "month": h.month,
            "revenue": h.revenue,
            "profit": h.calculated_profit,
            "margin_pct": h.calculated_margin,
            "roas": h.calculated_roas,
            "ad_spend": h.ad_spend,
        }
        for h in history
    ]

    return {"overall": overall, "monthly_history": monthly_history}


@router.get("/by-marketplace")
def by_marketplace(user=Depends(get_current_user)):
    all_metrics = _get_all_metrics(user.id)
    result = []
    for mp, metrics in all_metrics.items():
        result.append({
            "marketplace": mp,
            "revenue": metrics["total_revenue"],
            "cost": metrics["total_cost"],
            "commission": metrics["total_commission"],
            "shipping": metrics["total_shipping"],
            "ad_spend": metrics["ad_spend"],
            "gross_profit": metrics["total_gross_profit"],
            "net_profit": metrics["total_net_profit"],
            "net_after_ads": metrics["net_after_ads"],
            "net_margin_pct": metrics["net_margin_pct"],
            "roas": metrics["roas"],
            "sales": metrics["total_sales"],
        })
    result.sort(key=lambda x: x["net_after_ads"], reverse=True)
    return {"marketplaces": result}


@router.get("/by-product")
def by_product(user=Depends(get_current_user)):
    all_metrics = _get_all_metrics(user.id)
    products = {}
    for mp, metrics in all_metrics.items():
        for pm in metrics["product_metrics"]:
            pid = pm["id"]
            if pid not in products:
                products[pid] = {
                    "id": pid,
                    "name": pm["name"],
                    "total_revenue": 0.0,
                    "total_cost": 0.0,
                    "total_commission": 0.0,
                    "total_shipping": 0.0,
                    "total_net_profit": 0.0,
                    "total_sales": 0,
                }
            p = products[pid]
            p["total_revenue"] += pm["revenue"]
            p["total_cost"] += pm["total_cost"]
            p["total_commission"] += pm["commission_amount"]
            p["total_shipping"] += pm["total_shipping"]
            p["total_net_profit"] += pm["net_profit"]
            p["total_sales"] += pm["sales_30d"]

    result = list(products.values())
    for r in result:
        r["total_revenue"] = round(r["total_revenue"], 2)
        r["total_cost"] = round(r["total_cost"], 2)
        r["total_commission"] = round(r["total_commission"], 2)
        r["total_shipping"] = round(r["total_shipping"], 2)
        r["total_net_profit"] = round(r["total_net_profit"], 2)
        r["net_margin_pct"] = (
            round(r["total_net_profit"] / r["total_revenue"] * 100, 2)
            if r["total_revenue"] > 0 else 0
        )
        r["profit_per_item"] = (
            round(r["total_net_profit"] / r["total_sales"], 2)
            if r["total_sales"] > 0 else 0
        )
    result.sort(key=lambda x: x["total_net_profit"], reverse=True)
    return {"products": result}


@router.get("/expenses")
def expense_breakdown(user=Depends(get_current_user)):
    all_metrics = _get_all_metrics(user.id)
    overall = calculate_overall_metrics(all_metrics)

    total_expense = (
        overall["total_cost"]
        + overall["total_commission"]
        + overall["total_shipping"]
        + overall["total_ad_spend"]
    )
    if total_expense == 0:
        return {"total_expense": 0, "breakdown": {}}

    def _row(amount):
        return {"amount": round(amount, 2), "pct": round(amount / total_expense * 100, 1)}

    breakdown = {
        "urun_maliyeti": _row(overall["total_cost"]),
        "komisyon": _row(overall["total_commission"]),
        "kargo": _row(overall["total_shipping"]),
        "reklam": _row(overall["total_ad_spend"]),
    }
    return {"total_expense": round(total_expense, 2), "breakdown": breakdown}


@router.get("/cash-flow")
def cash_flow(user=Depends(get_current_user), db=Depends(get_db)):
    all_metrics = _get_all_metrics(user.id)
    overall = calculate_overall_metrics(all_metrics)

    # 3 aylik tarihsel net karin toplami = mevcut bakiye varsayimi (demo)
    history = (
        db.query(Financial)
        .filter(Financial.user_id == user.id)
        .order_by(Financial.month.asc())
        .all()
    )
    accumulated_profit = sum(h.calculated_profit for h in history) if history else 0.0

    monthly_revenue = overall["total_revenue"]
    monthly_net_profit = overall["total_net_after_ads"]
    pending_receivables = round(monthly_revenue * 0.3, 2)
    upcoming_expenses = round(overall["total_cost"] * 0.4 + (overall["total_ad_spend"] or 0) * 0.5, 2)

    current_balance = round(max(accumulated_profit, monthly_net_profit), 2)
    runway_months = round(current_balance / upcoming_expenses, 1) if upcoming_expenses > 0 else None
    health = "iyi" if monthly_net_profit > 0 and runway_months and runway_months > 3 else (
        "dikkat" if monthly_net_profit > 0 else "kritik"
    )

    return {
        "current_balance": current_balance,
        "monthly_revenue": monthly_revenue,
        "monthly_net_profit": monthly_net_profit,
        "pending_receivables": pending_receivables,
        "upcoming_expenses": upcoming_expenses,
        "runway_months": runway_months,
        "health": health,
        "monthly_history": [
            {"month": h.month, "profit": h.calculated_profit, "revenue": h.revenue}
            for h in history
        ],
    }


@router.get("/analyze")
async def analyze_financials(
    use_web: bool = True,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    all_metrics = _get_all_metrics(user.id)
    overall = calculate_overall_metrics(all_metrics)

    mp_summary = {
        mp: {
            "revenue": m["total_revenue"],
            "net_profit": m["total_net_profit"],
            "net_margin": m["net_margin_pct"],
            "commission": m["total_commission"],
            "ad_spend": m["ad_spend"],
            "roas": m["roas"],
        }
        for mp, m in all_metrics.items()
    }

    history = (
        db.query(Financial)
        .filter(Financial.user_id == user.id)
        .order_by(Financial.month.asc())
        .all()
    )
    history_summary = [
        {"month": h.month, "revenue": h.revenue, "profit": h.calculated_profit, "margin_pct": h.calculated_margin}
        for h in history
    ]

    web_note = (
        "\n\nEK GOREV: Google Search ile **Turkiye e-ticaret sektorunun guncel benchmark "
        "verilerini** ara (ortalama kar marji, komisyon oranlari, ROAS sektor ortalamasi, "
        "2025/2026 trend). Saticinin metrikleri sektor ortalamasina gore nerede?"
        if use_web else ""
    )

    prompt = f"""Asagidaki e-ticaret saticisinin finansal verilerini analiz et. Turkce yanit ver.

GENEL OZET (son 30 gun):
{json.dumps(overall, ensure_ascii=False, indent=2)}

PAZARYERI BAZLI:
{json.dumps(mp_summary, ensure_ascii=False, indent=2)}

AYLIK TARIHCE:
{json.dumps(history_summary, ensure_ascii=False, indent=2)}
{web_note}

Su basliklarda analiz yap:
1. Gelir-gider trendi (aylik gecmise gore yon)
2. Kar marji analizi ve optimizasyon onerileri (sektör ortalamasıyla karsilastir)
3. Komisyon optimizasyonu (hangi pazaryeri daha karli)
4. Reklam harcamasi ROI degerlendirmesi (ROAS - sektor benchmark'ina gore)
5. Finansman yonlendirmesi (guncel KOSGEB, KOBi kredisi uygunlugu)
"""
    system = (
        "Sen bir KOBi finansal danismansin. Web aramasiyla guncel sektor benchmark verilerini "
        "bulup e-ticaret saticilarina gelir-gider analizi yapip somut finansal oneriler sunuyorsun."
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
        "overall": overall,
        "by_marketplace": mp_summary,
        "monthly_history": history_summary,
        "ai_analysis": analysis,
        "web_sources": sources,
        "used_web_search": used_web,
    }
