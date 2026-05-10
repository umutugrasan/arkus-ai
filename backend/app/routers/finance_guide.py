from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_marketplace_metrics, calculate_overall_metrics
from app.services.gemini_service import ask_gemini
import json

router = APIRouter()

FINANCE_OPTIONS = [
    {
        "name": "KOSGEB Mikro KOBi Kredisi",
        "provider": "KOSGEB",
        "max_amount": "150.000 TL",
        "interest": "%0 (destekli)",
        "term": "24 ay",
        "requirements": "KOBi belgesi, 3 yil faaliyet",
        "min_score": 50,
        "min_revenue": 100000,
    },
    {
        "name": "Halkbank E-Ticaret KOBi Kredisi",
        "provider": "Halkbank",
        "max_amount": "500.000 TL",
        "interest": "%1.29 aylik",
        "term": "36 ay",
        "requirements": "Ticaret sicil, vergi levhasi",
        "min_score": 60,
        "min_revenue": 200000,
    },
    {
        "name": "Is Bankasi Isletme Kredisi",
        "provider": "Is Bankasi",
        "max_amount": "1.000.000 TL",
        "interest": "%1.49 aylik",
        "term": "48 ay",
        "requirements": "2 yil faaliyet, mali tablolar",
        "min_score": 65,
        "min_revenue": 500000,
    },
    {
        "name": "Garanti BBVA KOBi Destek",
        "provider": "Garanti BBVA",
        "max_amount": "750.000 TL",
        "interest": "%1.39 aylik",
        "term": "36 ay",
        "requirements": "KOBi belgesi, 1 yil faaliyet",
        "min_score": 55,
        "min_revenue": 300000,
    },
    {
        "name": "KOSGEB Girisimci Destegi",
        "provider": "KOSGEB",
        "max_amount": "300.000 TL (hibe+kredi)",
        "interest": "%0",
        "term": "24 ay",
        "requirements": "Yeni girisimci, is plani",
        "min_score": 40,
        "min_revenue": 50000,
    },
]


def _get_seller_profile():
    marketplaces = fetch_all_marketplaces(user.id)
    all_metrics = {}
    for mp in marketplaces:
        mp_data = fetch_store_info(mp, user.id)
        if mp_data:
            all_metrics[mp] = calculate_marketplace_metrics(mp_data)

    overall = calculate_overall_metrics(all_metrics)

    # basit skor hesabi
    score = min(100, max(0, round(50 + overall["overall_net_margin"] * 1.5)))

    return {
        "health_score": score,
        "monthly_revenue": overall["total_revenue"],
        "monthly_net_profit": overall["total_net_after_ads"],
        "net_margin": overall["overall_net_margin"],
        "cash_balance": 284000,
    }


@router.get("/options")
def get_options(user = Depends(get_current_user)):
    profile = _get_seller_profile()

    eligible = []
    not_eligible = []

    for opt in FINANCE_OPTIONS:
        is_eligible = (
            profile["health_score"] >= opt["min_score"]
            and profile["monthly_revenue"] >= opt["min_revenue"]
        )
        entry = {**opt, "eligible": is_eligible}
        if is_eligible:
            eligible.append(entry)
        else:
            not_eligible.append(entry)

    return {
        "seller_profile": profile,
        "eligible_options": eligible,
        "not_eligible_options": not_eligible,
    }


@router.get("/eligibility")
def check_eligibility(user = Depends(get_current_user)):
    profile = _get_seller_profile()

    eligible_count = sum(
        1 for opt in FINANCE_OPTIONS
        if profile["health_score"] >= opt["min_score"]
        and profile["monthly_revenue"] >= opt["min_revenue"]
    )

    if profile["health_score"] >= 70:
        status = "guclu"
        message = "Finansal durumunuz guclu. Cogu kredi secenegine uygunsunuz."
    elif profile["health_score"] >= 50:
        status = "orta"
        message = "Finansal durumunuz orta. Bazi kredi seceneklerine uygunsunuz."
    else:
        status = "zayif"
        message = "Finansal durumunuz gelistirilmeli. Saglik skorunuzu artirin."

    return {
        "profile": profile,
        "status": status,
        "message": message,
        "eligible_options_count": eligible_count,
        "total_options": len(FINANCE_OPTIONS),
    }


@router.get("/analyze")
async def analyze_finance():
    profile = _get_seller_profile()

    eligible = [
        opt for opt in FINANCE_OPTIONS
        if profile["health_score"] >= opt["min_score"]
        and profile["monthly_revenue"] >= opt["min_revenue"]
    ]

    prompt = f"""Bu e-ticaret saticisinin finansal profiline gore finansman onerisi sun. Turkce yanit ver.

SATICI PROFILI:
{json.dumps(profile, ensure_ascii=False, indent=2)}

UYGUN SECENEKLER:
{json.dumps(eligible, ensure_ascii=False, indent=2)}

Su basliklarda analiz yap:
1. Saticinin su anki finansal durumu
2. Hangi kredi/finansman secenegi en uygun ve neden
3. Ne kadarlik finansman almasi mantikli
4. Finansmani ne icin kullanmali (stok, reklam, yeni urun)
5. Dikkat etmesi gereken riskler
"""

    system = "Sen bir KOBi finansal danismansin. Kredi vermiyorsun, sadece bilgilendirme ve yonlendirme yapiyorsun. Somut ve kisisel oneriler sun."
    analysis = await ask_gemini(prompt, system)

    return {"profile": profile, "eligible_options": eligible, "ai_analysis": analysis}