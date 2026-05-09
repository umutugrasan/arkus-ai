from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.marketplace_api import fetch_suppliers, fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_overall_metrics, calculate_marketplace_metrics
from app.services.gemini_service import ask_gemini
import json
import os

router = APIRouter()

ALERTS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "price_alerts.json")


def _load_alerts():
    if not os.path.exists(ALERTS_PATH):
        return []
    with open(ALERTS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_alerts(alerts):
    with open(ALERTS_PATH, "w", encoding="utf-8") as f:
        json.dump(alerts, f, ensure_ascii=False, indent=2)


@router.get("/suppliers")
def list_suppliers():
    suppliers = fetch_suppliers()

    enriched = []
    for s in suppliers:
        discounted_price = s["current_price"] * (1 - s.get("discount_pct", 0) / 100)
        enriched.append({
            **s,
            "discounted_price": round(discounted_price, 2),
            "has_discount": s.get("discount_pct", 0) > 0,
        })

    return {"suppliers": enriched}


@router.get("/best-price/{product_name}")
def best_price(product_name: str):
    suppliers = fetch_suppliers()
    matches = [s for s in suppliers if product_name.lower() in s["product"].lower()]

    if not matches:
        raise HTTPException(status_code=404, detail="Bu urun icin tedarikci bulunamadi")

    for s in matches:
        s["discounted_price"] = round(s["current_price"] * (1 - s.get("discount_pct", 0) / 100), 2)

    matches.sort(key=lambda x: x["discounted_price"])

    return {
        "product": product_name,
        "best_supplier": matches[0],
        "all_suppliers": matches,
    }


@router.get("/opportunities")
async def sourcing_opportunities():
    suppliers = fetch_suppliers()

    marketplaces = fetch_all_marketplaces()
    all_metrics = {}
    for mp in marketplaces:
        mp_data = fetch_store_info(mp)
        if mp_data:
            all_metrics[mp] = calculate_marketplace_metrics(mp_data)

    overall = calculate_overall_metrics(all_metrics)

    prompt = f"""Asagidaki tedarikci ve finansal verileri analiz et. Turkce yanit ver.

TEDARIKCILER:
{json.dumps(suppliers, ensure_ascii=False, indent=2)}

FINANSAL DURUM:
- Nakit bakiye: 284.000 TL
- Aylik net kar: {overall['total_net_after_ads']} TL
- Aylik gelir: {overall['total_revenue']} TL

Su basliklarda analiz yap:
1. En uygun tedarikci onerileri
2. Indirimli tedarikci firsatlari
3. Nakit akisi uygun mu stok yatirimi icin?
4. "Su an alim yapmanin tam zamani" veya "bekle" gibi zamanlama onerisi
5. Kar marjini artiracak tedarikci degisikligi onerileri
"""

    system = "Sen bir e-ticaret tedarik zinciri uzmansin. Saticilara en uygun tedarikciyi bulmak ve maliyet optimizasyonu konularinda danismanlik yapiyorsun."
    analysis = await ask_gemini(prompt, system)

    return {"suppliers": suppliers, "ai_analysis": analysis}


class AlertRequest(BaseModel):
    product_name: str
    target_price: float
    supplier_name: str = ""


@router.post("/alerts")
def create_alert(req: AlertRequest):
    alerts = _load_alerts()

    new_alert = {
        "id": f"A{len(alerts) + 1:03d}",
        "product_name": req.product_name,
        "target_price": req.target_price,
        "supplier_name": req.supplier_name,
        "status": "active",
        "created_at": "2026-05-10",
    }

    alerts.append(new_alert)
    _save_alerts(alerts)
    return {"message": "Alarm olusturuldu", "alert": new_alert}


@router.get("/alerts")
def list_alerts():
    alerts = _load_alerts()
    return {"alerts": alerts}


@router.delete("/alerts/{alert_id}")
def delete_alert(alert_id: str):
    alerts = _load_alerts()
    alerts = [a for a in alerts if a["id"] != alert_id]
    _save_alerts(alerts)
    return {"message": "Alarm silindi"}