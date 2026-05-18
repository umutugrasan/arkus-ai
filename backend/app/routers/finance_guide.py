from fastapi import APIRouter, Depends
import asyncio
import json
import logging
from app.dependencies import get_current_user, get_db
from app.db.models import Financial
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_marketplace_metrics, calculate_overall_metrics
from app.services.gemini_service import ask_gemini, ask_gemini_with_search

logger = logging.getLogger(__name__)
router = APIRouter()

# Gemini Google Search cevap vermezse / quota dolduysa kullanilan sabit kredi listesi.
# Bu sayede /finance-guide sayfasi hicbir zaman bos / 404 / sonsuz spinner gostermez.
_FALLBACK_FINANCE_OPTIONS = [
    {
        "name": "KOSGEB KOBi Destek Programi",
        "provider": "KOSGEB",
        "max_amount": "300.000 TL",
        "interest": "%0 (faizsiz)",
        "term": "24 ay",
        "requirements": "KOBi belgesi, vergi levhasi, faaliyet 1 yil+",
        "min_score": 50,
        "min_monthly_revenue": 50000,
        "url": "https://www.kosgeb.gov.tr",
        "is_recommended": True,
        "recommendation_reason": "Faizsiz olmasi ve KOBi e-ticaret saticilarina uygun olmasi sebebiyle ilk degerlendirilmesi gereken secenek.",
    },
    {
        "name": "Halkbank Esnaf ve KOBi Kredisi",
        "provider": "Halkbank",
        "max_amount": "500.000 TL",
        "interest": "Piyasa kosullarinda degisken",
        "term": "36 ay",
        "requirements": "Ticaret sicil, vergi levhasi, son 6 ay hesap hareketi",
        "min_score": 60,
        "min_monthly_revenue": 150000,
        "url": "https://www.halkbank.com.tr",
        "is_recommended": False,
    },
    {
        "name": "Ziraat Bankasi KOBi Kredisi",
        "provider": "Ziraat Bankasi",
        "max_amount": "750.000 TL",
        "interest": "Piyasa kosullarinda degisken",
        "term": "48 ay",
        "requirements": "Vergi levhasi, son 1 yil hesap hareketi, teminat",
        "min_score": 65,
        "min_monthly_revenue": 250000,
        "url": "https://www.ziraatbank.com.tr",
        "is_recommended": False,
    },
]


def _classify_options(options: list, profile: dict) -> tuple[list, list]:
    """min_score + min_monthly_revenue'ye gore uygun/uygun degil olarak ayir."""
    eligible, not_eligible = [], []
    for opt in options:
        ok = (
            profile["eligibility_score"] >= opt.get("min_score", 0)
            and profile["monthly_revenue"] >= opt.get("min_monthly_revenue", 0)
        )
        entry = {**opt, "eligible": ok}
        if not ok:
            entry["reasons"] = [
                f"Uygunluk skoru {opt.get('min_score', 0)}+ olmali.",
                f"Aylik ciro {opt.get('min_monthly_revenue', 0):,} TL+ olmali.",
            ]
            not_eligible.append(entry)
        else:
            eligible.append(entry)
    return eligible, not_eligible

# FINANCE_OPTIONS kaldirildi. Artik gercek zamanli Gemini Google Search kullanilacak.

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


async def _fetch_real_finance_options(profile):
    score = profile["eligibility_score"]
    revenue = profile["monthly_revenue"]
    
    prompt = f"""Google Search grounding kullanarak Turkiye'de 2025/2026 yili icin e-ticaret saticilarina, KOBI'lere ve girisimcilere yonelik GUNCEL gercek banka kredilerini, KOSGEB veya devlet desteklerini bul.
Bu saticinin uygunluk skoru: {score}/100, aylik cirosu: {revenue} TL.

Sadece gercek ve basvurulabilir olan en mantikli 4-5 secenegi listele. En mantikli gordugun 1 tanesini 'is_recommended': true yap ve nedenini (recommendation_reason) belirt.
Ayrica her destek/kredi icin basvurulabilecek GERCEK BIR URL (url) bulup ekle.

Lutfen ASAGIDAKI JSON FORMATINDA (array olarak) don, markdown veya baska metin Ekleme:
[
  {{
    "name": "Kredi/Destek Adi",
    "provider": "Saglayici (Banka/Kurum adi)",
    "max_amount": "Maksimum Tutar (ornegin 500.000 TL)",
    "interest": "Faiz orani",
    "term": "Vade süresi",
    "requirements": "Basvuru sartlari (kisa)",
    "min_score": 50,
    "min_monthly_revenue": 100000,
    "url": "https://kosgeb.gov.tr/...",
    "is_recommended": true,
    "recommendation_reason": "Faizsiz olmasi ve e-ticaret cirosuna tam uygun olmasi sebebiyle en mantikli secenek."
  }}
]"""
    system = "Sen bir finans ve e-ticaret danismanisin. Web aramasiyla guncel kredi programlarini JSON olarak dondersin."

    options: list = []
    source = "ai"  # 'ai' | 'fallback'
    error: str | None = None

    try:
        # Gemini Google Search 20 sn icinde donmezse fallback'e gec.
        result = await asyncio.wait_for(
            ask_gemini_with_search(prompt, system, pool="analyze"),
            timeout=20,
        )
        raw_text = (result.get("text") or "").replace("```json", "").replace("```", "").strip()
        try:
            options = json.loads(raw_text) if raw_text else []
        except json.JSONDecodeError:
            options = []
            error = "ai_invalid_json"
    except asyncio.TimeoutError:
        logger.warning("Finansman AI Fetch: 20s timeout, fallback'e geciliyor")
        error = "ai_timeout"
    except Exception as e:
        logger.error(f"Finansman AI Fetch Error: {type(e).__name__}: {e}")
        error = "ai_error"

    # AI bos / hatali dondu → sabit listeyi kullan
    if not isinstance(options, list) or not options:
        options = list(_FALLBACK_FINANCE_OPTIONS)
        source = "fallback"

    eligible, not_eligible = _classify_options(options, profile)
    # Klasifiye edilmis listelere meta bilgi ekle (frontend gostermek isteyebilir)
    for opt in eligible + not_eligible:
        opt.setdefault("source", source)
    return eligible, not_eligible, source, error

@router.get("/options")
async def get_options(user=Depends(get_current_user), db=Depends(get_db)):
    profile = _get_seller_profile(db, user.id)
    eligible, not_eligible, source, error = await _fetch_real_finance_options(profile)
    return {
        "seller_profile": profile,
        "eligible_options": eligible,
        "not_eligible_options": not_eligible,
        "total_options": len(eligible) + len(not_eligible),
        "data_source": source,  # "ai" | "fallback"
        "ai_error": error,      # None | "ai_timeout" | "ai_invalid_json" | "ai_error"
    }

@router.get("/eligibility")
def check_eligibility(user=Depends(get_current_user), db=Depends(get_db)):
    profile = _get_seller_profile(db, user.id)


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
        "eligible_options_count": 0, # Not checking anymore to save AI quota
        "total_options": 0,
    }


@router.get("/analyze")
async def analyze_finance(
    use_web: bool = True,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    profile = _get_seller_profile(db, user.id)
    # Performansi artirmak ve AI kotasini korumak icin onceden uretilmis opsiyonlari frontend
    # body'den gonderebilir veya sadece profil bilgisiyle analiz yaptirabiliriz.
    # Burada sadece profile dayali genel analiz yapiyoruz.
    eligible = [] 

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
        result = await ask_gemini_with_search(prompt, system, pool="analyze")
        analysis = result["text"]
        sources = result["sources"]
        used_web = result["used_search"]
    else:
        analysis = await ask_gemini(prompt, system, pool="analyze")

    return {
        "profile": profile,
        "eligible_options": eligible,
        "ai_analysis": analysis,
        "web_sources": sources,
        "used_web_search": used_web,
    }
