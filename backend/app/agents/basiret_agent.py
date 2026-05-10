import os
from google import genai
from google.genai import types
from app.services.marketplace_api import fetch_store_info, fetch_reviews, fetch_all_marketplaces, fetch_products, fetch_orders, fetch_suppliers
import json

_client = None

def get_client():
    global _client
    api_key = os.getenv("GEMINI_API_KEY")
    if _client is None and api_key and api_key != "your_gemini_api_key_here":
        _client = genai.Client(api_key=api_key)
    return _client

def run_basiret_agent(user_message: str, user_id: int) -> str:
    """
    Gemini 3.5 Flash (veya 3.1) kullanarak kullanicinin sorusuna yanit uretir.
    Gerektiginde tanimli araclari (tools) cagirarak veri ceker.
    """
    client = get_client()
    if not client:
        return "API Key tanımlanmadı veya geçersiz. Lütfen .env dosyasını kontrol edin."

    # Gemini'nin kendi basina user_id gonderemeyecegi icin closure (wrapper) fonksiyonlar olusturuyoruz:
    def get_store_info(marketplace_name: str):
        """Belirli bir pazaryerindeki magazaya ait temel bilgileri getirir."""
        return fetch_store_info(marketplace_name, user_id)
        
    def get_reviews(marketplace: str, product_id: str = ""):
        """Saticinin urunlerine gelen musteri yorumlarini getirir."""
        return fetch_reviews(marketplace, user_id, product_id)
        
    def get_all_marketplaces():
        """Saticinin bagli oldugu tum pazaryerlerini getirir."""
        return fetch_all_marketplaces(user_id)
        
    def get_products(marketplace_name: str):
        """Belirtilen pazaryerindeki ürün listesini getirir."""
        return fetch_products(marketplace_name, user_id)
        
    def get_orders(marketplace_name: str):
        """Siparis verilerini getirir."""
        return fetch_orders(marketplace_name, user_id)

    # Tedarikciler ortak, user_id gerekmiyor ama yine de sarmalayalim
    def get_suppliers():
        """Tedarikci verilerini cek."""
        return fetch_suppliers()

    # Kullanilacak araclarin listesi
    tools = [
        get_store_info, 
        get_reviews, 
        get_all_marketplaces,
        get_products,
        get_orders,
        get_suppliers
    ]

    system_instruction = (
        "Sen Basiret AI'sın. Kullanıcı sorularına cevap vermeden önce mutlaka araçları (tools) kullanarak veri çek.\n"
        "Rakamlarla konuş, somut stratejiler öner ve profesyonel bir e-ticaret danışmanı gibi davran.\n"
        "Cevap formatın şu şekilde olmalı:\n"
        "[Durum Analizi] (Mevcut durumun kisa bir ozeti)\n"
        "[Veriye Dayalı Rakamlar] (Aractan cektigin net rakamlar)\n"
        "[Somut Aksiyon Önerisi] (Saticinin ne yapmasi gerektigine dair taktik)"
    )

    config = types.GenerateContentConfig(
        tools=tools,
        system_instruction=system_instruction,
        temperature=0.2,
        top_p=0.8,
    )

    try:
        chat = client.chats.create(
            model="gemini-3.1-flash-lite", 
            config=config
        )
        response = chat.send_message(user_message)
        return response.text

    except Exception as e:
        return f"⚠️ **Bilgi:** Ajan sistemi bir hata ile karsilasti. Detay: {str(e)}"
