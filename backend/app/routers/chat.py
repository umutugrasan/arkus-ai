from fastapi import APIRouter
from pydantic import BaseModel
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_marketplace_metrics, calculate_overall_metrics
from app.services.gemini_service import ask_gemini
import json
import os

router = APIRouter()

HISTORY_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "chat_history.json")


def _load_history():
    if not os.path.exists(HISTORY_PATH):
        return []
    with open(HISTORY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_history(history):
    with open(HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)


class ChatMessage(BaseModel):
    message: str
    token: str = ""


@router.post("/ask")
async def ask(msg: ChatMessage):
    # Tum veriyi context olarak hazirla
    marketplaces = fetch_all_marketplaces()
    all_metrics = {}
    mp_summary = {}

    for mp in marketplaces:
        mp_data = fetch_store_info(mp)
        if mp_data:
            metrics = calculate_marketplace_metrics(mp_data)
            all_metrics[mp] = metrics
            mp_summary[mp] = {
                "store_rating": mp_data["store_rating"],
                "revenue": metrics["total_revenue"],
                "net_profit": metrics["total_net_profit"],
                "sales": metrics["total_sales"],
                "return_rate": metrics["return_rate"],
                "top_products": [
                    {"name": p["name"], "sales": p["sales_30d"], "profit": p["net_profit"]}
                    for p in metrics["product_metrics"][:3]
                ],
            }

    overall = calculate_overall_metrics(all_metrics)

    context = {
        "overall": {
            "revenue": overall["total_revenue"],
            "net_profit": overall["total_net_after_ads"],
            "margin": overall["overall_net_margin"],
            "sales": overall["total_sales"],
            "return_rate": overall["overall_return_rate"],
        },
        "marketplaces": mp_summary,
        "cash_balance": 284000,
    }

    prompt = f"""Sen "Basiret AI" adli e-ticaret danismansin. Saticinin tum magaza verilerine erisiimin var.

MAGAZA VERILERI:
{json.dumps(context, ensure_ascii=False, indent=2)}

SATICININ SORUSU:
{msg.message}

Kurallar:
- Turkce yanit ver
- Verilere dayanarak somut, spesifik cevaplar ver
- Rakamlari kullan, genel cevaplar verme
- Kisa ve net ol (maksimum 300 kelime)
- Aksiyon onerileri sun
"""

    system = "Sen Basiret AI, bir e-ticaret satici danismansin. Samimi ama profesyonel ol. Her zaman veriye dayali somut oneriler sun."
    response = await ask_gemini(prompt, system)

    # Gecmise kaydet
    history = _load_history()
    history.append({
        "question": msg.message,
        "answer": response,
        "timestamp": "2026-05-10",
    })
    _save_history(history)

    return {"response": response}


@router.get("/history")
def get_history(token: str = ""):
    history = _load_history()
    return {"history": history}


@router.delete("/history")
def clear_history(token: str = ""):
    _save_history([])
    return {"message": "Sohbet gecmisi temizlendi"}