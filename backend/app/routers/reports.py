from fastapi import APIRouter, HTTPException
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_marketplace_metrics, calculate_overall_metrics
from app.services.gemini_service import ask_gemini
import json
import os

router = APIRouter()

REPORTS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "reports.json")


def _load_reports():
    if not os.path.exists(REPORTS_PATH):
        return []
    with open(REPORTS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_reports(reports):
    with open(REPORTS_PATH, "w", encoding="utf-8") as f:
        json.dump(reports, f, ensure_ascii=False, indent=2)


@router.post("/daily")
async def generate_daily_report():
    marketplaces = fetch_all_marketplaces()
    all_metrics = {}
    for mp in marketplaces:
        mp_data = fetch_store_info(mp)
        if mp_data:
            all_metrics[mp] = calculate_marketplace_metrics(mp_data)

    overall = calculate_overall_metrics(all_metrics)

    prompt = f"""Asagidaki verilere dayanarak gunluk ozet raporu olustur. Turkce yanit ver.

GENEL:
- Toplam gelir: {overall['total_revenue']} TL
- Net kar: {overall['total_net_after_ads']} TL
- Toplam satis: {overall['total_sales']} adet
- Iade orani: {overall['overall_return_rate']}%
- ROAS: {overall['overall_roas']}

PAZARYERI BAZLI:
{json.dumps({{mp: {{"revenue": m["total_revenue"], "profit": m["total_net_profit"], "sales": m["total_sales"]}} for mp, m in all_metrics.items()}}, ensure_ascii=False, indent=2)}

Rapor formati:
1. Gunun ozeti (2-3 cumle)
2. One cikan metrikler (iyi ve kotu)
3. Dikkat edilmesi gerekenler
4. Bugunku oncelikli aksiyonlar (3 madde)
"""

    system = "Sen bir e-ticaret rapor uzmanisin. Kisa, net ve aksiyon odakli gunluk raporlar olusturuyorsun."
    report_content = await ask_gemini(prompt, system)

    reports = _load_reports()
    new_report = {
        "id": f"R{len(reports) + 1:03d}",
        "type": "daily",
        "title": "Gunluk Ozet Raporu - 10 Mayis 2026",
        "content": report_content,
        "metrics": {
            "revenue": overall["total_revenue"],
            "profit": overall["total_net_after_ads"],
            "sales": overall["total_sales"],
        },
        "created_at": "2026-05-10",
    }

    reports.append(new_report)
    _save_reports(reports)

    return new_report


@router.post("/weekly")
async def generate_weekly_report():
    marketplaces = fetch_all_marketplaces()
    all_metrics = {}
    for mp in marketplaces:
        mp_data = fetch_store_info(mp)
        if mp_data:
            all_metrics[mp] = calculate_marketplace_metrics(mp_data)

    overall = calculate_overall_metrics(all_metrics)

    prompt = f"""Asagidaki verilere dayanarak haftalik performans raporu olustur. Turkce yanit ver.

VERILER:
{json.dumps(overall, ensure_ascii=False, indent=2)}

Rapor formati:
1. Haftanin ozeti
2. Pazaryeri bazli performans karsilastirmasi
3. En iyi ve en kotu performans gosteren urunler
4. Haftalik trendler ve uyarilar
5. Gelecek hafta icin strateji onerileri (5 madde)
"""

    system = "Sen bir e-ticaret performans analistsin. Detayli haftalik raporlar olusturuyorsun."
    report_content = await ask_gemini(prompt, system)

    reports = _load_reports()
    new_report = {
        "id": f"R{len(reports) + 1:03d}",
        "type": "weekly",
        "title": "Haftalik Performans Raporu - 5-10 Mayis 2026",
        "content": report_content,
        "metrics": {
            "revenue": overall["total_revenue"],
            "profit": overall["total_net_after_ads"],
            "sales": overall["total_sales"],
        },
        "created_at": "2026-05-10",
    }

    reports.append(new_report)
    _save_reports(reports)

    return new_report


@router.get("/list")
def list_reports(token: str = ""):
    reports = _load_reports()
    return {"reports": reports}


@router.get("/{report_id}")
def get_report(report_id: str):
    reports = _load_reports()
    for r in reports:
        if r["id"] == report_id:
            return r
    raise HTTPException(status_code=404, detail="Rapor bulunamadi")