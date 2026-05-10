from fastapi import APIRouter, Depends
import json
from app.dependencies import get_current_user
from app.db.database import SessionLocal
from app.db.models import Financial
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_marketplace_metrics, calculate_overall_metrics
from app.services.gemini_service import ask_gemini, ask_gemini_with_search

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
        "min_monthly_revenue": 100000,
    },
    {
        "name": "Halkbank E-Ticaret KOBi Kredisi",
        "provider": "Halkbank",
        "max_amount": "500.000 TL",
        "interest": "%1.29 aylik",
        "term": "36 ay",
        "requirements": "Ticaret sicil, vergi levhasi",
        "min_score": 60,
        "min_monthly_revenue": 200000,
    },
    {
        "name": "Is Bankasi Isletme Kredisi",
        "provider": "Is Bankasi",
        "max_amount": "1.000.000 TL",
        "interest": "%1.49 aylik",
        "term": "48 ay",
        "requirements": "2 yil faaliyet, mali tablolar",
        "min_score": 65,
        "min_monthly_revenue": 500000,
    },
    {
        "name": "Garanti BBVA KOBi Destek",
        "provider": "Garanti BBVA",
        "max_amount": "750.000 TL",
        "interest": "%1.39 aylik",
        "term": "36 ay",
        "requirements": "KOBi belgesi, 1 yil faaliyet",
        "min_score": 55,
        "min_monthly_revenue": 300000,
    },
    {
        "name": "KOSGEB Girisimci Destegi",
        "provider": "KOSGEB",
        "max_amount": "300.000 TL (hibe+kredi)",
        "interest": "%0",
        "term": "24 ay",
        "requirements": "Yeni girisimci, is plani",
        "min_score": 40,
        "min_monthly_revenue": 50000,
    },
]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _calc_eligibility_score(net_margin, monthly_revenue, positive_months, total_months):
    """
    Finansman uygunluk skoru (0-100). 4 bilesen:
    - Marj (40 puan): net_margin / 25 * 40
    - Ciro (30 puan): log10 olcekli (1M+ TL = 30)
    - Cash flow tutarliligi (20 puan): pozitif ay orani
    - Aktivite (10 puan): tarihsel veri var mi
    """
    margin_score = min(40, max(0, (net_margin or 0) / 25 * 40))
    if monthly_revenue <= 0:
        revenue_score = 0
    else:
        # 100K -> 12, 500K -> 24, 1M -> 30
        import math
        revenue_score = min(30, max(0, math.log10(monthly_revenue / 10000) * 12))
    consistency_score = (positive_months / total_months * 20) if total_months > 0 else 0
    activity_score = 10 if total_months >= 3 else (5 if total_months > 0 else 0)
    return round(margin_score + revenue_score + consistency_score + activity_score)


def _get_seller_profile(db, user_id: int) -> dict:
    marketplaces = fetch_all_marketplaces(user_id)
    all_metrics = {}
    for mp in marketplaces:
        mp_data = fetch_store_info(mp, user_id)
        if mp_data:
            all_metrics[mp] = calculate_marketplace_metrics(mp_data)
    overall = calculate_overall_metrics(all_metrics)

    history = (
        db.query(Financial)
        .filter(Financial.user_id == user_id)
        .order_by(Financial.month.asc())
        .all()
    )
    positive_months = sum(1 for h in history if (h.calculated_profit or 0) > 0)
    cash_balance = sum(h.calculated_profit or 0 for h in history)

    score = _calc_eligibility_score(
        overall["overall_net_margin"],
        overall["total_revenue"],
        positive_months,
        len(history),
    )

    return {
        "eligibility_score": score,
        "monthly_revenue": overall["total_revenue"],
        "monthly_net_profit": overall["total_net_after_ads"],
        "net_margin_pct": overall["overall_net_margin"],
        "cash_balance": round(cash_balance, 2),
        "positive_months": positive_months,
        "total_history_months": len(history),
        "marketplace_count": len(marketplaces),
    }


def _split_options(profile):
    eligible, not_eligible = [], []
    for opt in FINANCE_OPTIONS:
        ok = (
            profile["eligibility_score"] >= opt["min_score"]
            and profile["monthly_revenue"] >= opt["min_monthly_revenue"]
        )
        entry = {**opt, "eligible": ok}
        if not ok:
            reasons = []
            if profile["eligibility_score"] < opt["min_score"]:
                reasons.append(
                    f"uygunluk skoru {opt['min_score']}+ olmali "
                    f"(suanki: {profile['eligibility_score']})"
                )
            if profile["monthly_revenue"] < opt["min_monthly_revenue"]:
                reasons.append(
                    f"aylik ciro {opt['min_monthly_revenue']:,} TL+ olmali "
                    f"(suanki: {profile['monthly_revenue']:,.0f})"
                )
            entry["reasons"] = reasons
        if ok:
            eligible.append(entry)
        else:
            not_eligible.append(entry)
    return eligible, not_eligible


@router.get("/options")
def get_options(user=Depends(get_current_user), db=Depends(get_db)):
    profile = _get_seller_profile(db, user.id)
    eligible, not_eligible = _split_options(profile)
    return {
        "seller_profile": profile,
        "eligible_options": eligible,
        "not_eligible_options": not_eligible,
        "total_options": len(FINANCE_OPTIONS),
    }


@router.get("/eligibility")
def check_eligibility(user=Depends(get_current_user), db=Depends(get_db)):
    profile = _get_seller_profile(db, user.id)
    eligible, not_eligible = _split_options(profile)

    score = profile["eligibility_score"]
    if score >= 70:
        status, message = "guclu", "Finansal durumunuz guclu. Cogu kredi secenegine uygunsunuz."
    elif score >= 50:
        status, message = "orta", "Finansal durumunuz orta. Bazi kredi seceneklerine uygunsunuz."
    else:
        status, message = "zayif", "Finansal durum gelistirilmeli. Marj ve ciroyu artirin."

    return {
        "profile": profile,
        "status": status,
        "message": message,
        "eligible_options_count": len(eligible),
        "total_options": len(FINANCE_OPTIONS),
    }


@router.get("/analyze")
async def analyze_finance(
    use_web: bool = True,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    profile = _get_seller_profile(db, user.id)
    eligible, _ = _split_options(profile)

    web_note = (
        "\n\nEK GOREV: Google Search ile **guncel KOSGEB, Halkbank, Is Bankasi, Garanti BBVA "
        "e-ticaret/KOBi kredi programlarinin son sartlarini** ara (faiz, vade, basvuru sartlari, "
        "2025/2026 guncel). DB'deki listeyi web'den buldugun anlik verilerle dogrula veya guncelle. "
        "Kaynagi belli et."
        if use_web else ""
    )

    prompt = f"""Bu e-ticaret saticisinin finansal profiline gore finansman onerisi sun. Turkce yanit ver.

SATICI PROFILI:
{json.dumps(profile, ensure_ascii=False, indent=2)}

DB'DEKI UYGUN SECENEKLER:
{json.dumps(eligible, ensure_ascii=False, indent=2)}
{web_note}

Su basliklarda analiz yap:
1. Saticinin su anki finansal durumu (1-2 cumle)
2. Hangi kredi/finansman secenegi en uygun ve neden (guncel faiz/vade ile)
3. Ne kadarlik finansman almasi mantikli (mevcut ciro/marja gore)
4. Finansmani ne icin kullanmali (stok, reklam, yeni urun, lojistik)
5. Dikkat etmesi gereken riskler (geri odeme, faiz yuku)
"""
    system = (
        "Sen bir KOBi finansal danismansin. Web aramasiyla guncel kredi programlarini "
        "doğrularsın. Kredi vermiyorsun, bilgilendirme/yonlendirme yapiyorsun. "
        "Somut, kaynakli, kisisel oneriler sun. Garanti vermekten kacin."
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
        "profile": profile,
        "eligible_options": eligible,
        "ai_analysis": analysis,
        "web_sources": sources,
        "used_web_search": used_web,
    }
