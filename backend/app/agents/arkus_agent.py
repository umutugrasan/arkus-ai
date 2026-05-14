import os
import logging
import json
from google import genai
from google.genai import types
from app.services.marketplace_api import (
    fetch_store_info, fetch_reviews, fetch_all_marketplaces,
    fetch_products, fetch_orders, fetch_suppliers,
)
from app.services.calculator import (
    calculate_marketplace_metrics, calculate_overall_metrics,
)

logger = logging.getLogger(__name__)

MODEL_CASCADE = [
    os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-1.5-flash",
]

_client = None


def get_client():
    global _client
    api_key = os.getenv("GEMINI_API_KEY")
    if _client is None and api_key and api_key != "your_gemini_api_key_here":
        _client = genai.Client(api_key=api_key)
    return _client


def _build_overview(user_id: int) -> dict:
    """Mevcut magaza durumunun ozet snapshot'i — chat'in baslangic context'i."""
    marketplaces = fetch_all_marketplaces(user_id)
    all_metrics = {}
    for mp in marketplaces:
        mp_data = fetch_store_info(mp, user_id)
        if mp_data:
            all_metrics[mp] = calculate_marketplace_metrics(mp_data)
    overall = calculate_overall_metrics(all_metrics)
    return {
        "connected_marketplaces": marketplaces,
        "total_revenue_30d": overall["total_revenue"],
        "net_profit_30d": overall["total_net_after_ads"],
        "net_margin_pct": overall["overall_net_margin"],
        "total_sales_30d": overall["total_sales"],
        "return_rate_pct": overall["overall_return_rate"],
        "roas": overall["overall_roas"],
        "marketplace_breakdown": {
            mp: {
                "revenue": m["total_revenue"],
                "net_margin_pct": m["net_margin_pct"],
                "sales": m["total_sales"],
            }
            for mp, m in all_metrics.items()
        },
    }


def run_arkus_agent(user_message: str, user_id: int) -> str:
    """
    Gemini Agent: function-calling tools (DB) + Google Search grounding (web).
    Tum magaza ozeti context olarak verilir, gerektiginde araclarla detayli veri ceker.
    """
    client = get_client()
    if not client:
        return "API Key tanimlanmamis veya gecersiz. .env dosyasini kontrol edin."

    overview = _build_overview(user_id)

    # user_id closure'larla baglanmis arac fonksiyonlari (Gemini'ye function-callable olarak verilir)
    def get_store_info(marketplace_name: str):
        """Belirli bir pazaryerindeki magazaya ait temel bilgileri ve urunleri getirir."""
        return fetch_store_info(marketplace_name, user_id)

    def get_reviews(marketplace: str, product_id: str = ""):
        """Saticinin urunlerine gelen musteri yorumlarini getirir. marketplace='all' ise tum yerlerden."""
        return fetch_reviews(marketplace, user_id, product_id)

    def get_all_marketplaces():
        """Saticinin bagli oldugu tum pazaryerlerini getirir."""
        return fetch_all_marketplaces(user_id)

    def get_products(marketplace_name: str):
        """Belirtilen pazaryerindeki urun listesini getirir."""
        return fetch_products(marketplace_name, user_id)

    def get_orders(marketplace_name: str):
        """Siparis verilerini getirir."""
        return fetch_orders(marketplace_name, user_id)

    def get_suppliers():
        """Tedarikci verilerini getirir."""
        return fetch_suppliers()

    tools = [
        get_store_info, get_reviews, get_all_marketplaces,
        get_products, get_orders, get_suppliers,
    ]

    system_instruction = (
        "Sen Arkus AI'sin, profesyonel bir e-ticaret danismanisin.\n\n"
        "Asagidaki SATICI DURUM OZETI'ni bilerek konusuyorsun:\n"
        f"{json.dumps(overview, ensure_ascii=False, indent=2)}\n\n"
        "Kurallar:\n"
        "1. Genel sorulara overview'daki rakamlarla cevap verebilirsin.\n"
        "2. Detay gerekirse arac fonksiyonlarini cagir (get_products, get_reviews vs.).\n"
        "3. Guncel piyasa/rakip/tedarikci/sektor verisi gerekirse Google Search kullan.\n"
        "4. Rakamlarla konus, somut aksiyon oner.\n\n"
        "Cevap formati:\n"
        "[Durum Analizi] - mevcut durumun ozeti\n"
        "[Veriye Dayali Rakamlar] - araclardan veya overview'dan net rakamlar\n"
        "[Somut Aksiyon Onerisi] - 1-2 cumlede ne yapmasi gerektigi"
    )

    config = types.GenerateContentConfig(
        tools=tools,
        system_instruction=system_instruction,
        temperature=0.2,
        top_p=0.8,
    )

    last_err = None
    for model in MODEL_CASCADE:
        try:
            chat = client.chats.create(model=model, config=config)
            response = chat.send_message(user_message)
            return response.text
        except Exception as e:
            last_err = e
            logger.warning(f"Agent model {model} failed: {type(e).__name__}: {e}")
            continue

    return (
        f"⚠️ **Bilgi:** Ajan sistemi cevap veremedi. Hata: {type(last_err).__name__}: {last_err}\n\n"
        f"Mevcut durum ozeti:\n```\n{json.dumps(overview, ensure_ascii=False, indent=2)}\n```"
    )
