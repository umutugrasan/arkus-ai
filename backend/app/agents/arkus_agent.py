import os
import logging
import json
from collections import defaultdict
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

def get_client():
    """
    Chat pool'undan sirayla bir key cek + per-key client cache'i kullan.
    gemini_service'in pool infrastructure'ini kullanir — boylece chat ayri
    pool'a baglanir, agent tick'leri quota'ya yedirse bile chat ayakta kalir.
    """
    from app.services.gemini_service import get_client as get_pooled_client
    return get_pooled_client(pool="chat")


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


def _build_rich_context(user_id: int) -> dict:
    """
    AI Chat için zengin context — overview + ürün-bazlı detay.
    Tek bir snapshot'ta tool çağırmadan cevaplanabilen soruların >%80'ini karşılar:
    en çok satan / en kârlı / düşük stoklu / düşük puanlı ürün hangisi, vs.
    """
    marketplaces = fetch_all_marketplaces(user_id)
    all_metrics: dict = {}
    listings: list = []  # her marketplace × product satırı

    for mp in marketplaces:
        mp_data = fetch_store_info(mp, user_id)
        if not mp_data:
            continue
        all_metrics[mp] = calculate_marketplace_metrics(mp_data)
        commission_rate = mp_data.get("commission_rate", 0) or 0
        store_name = mp_data.get("store_name") or mp
        for p in mp_data.get("products", []):
            price = p.get("price") or 0
            cost = p.get("cost") or 0
            sales = p.get("sales_30d") or 0
            shipping = p.get("shipping_cost") or 0
            revenue = price * sales
            commission_amt = revenue * commission_rate / 100
            net_profit = revenue - (cost * sales) - commission_amt - (shipping * sales)
            listings.append({
                "id": p.get("id"),
                "name": p.get("name"),
                "category": p.get("category"),
                "marketplace": mp,
                "store_name": store_name,
                "price": price,
                "cost": cost,
                "stock": p.get("stock") or 0,
                "sales_30d": sales,
                "rating": p.get("rating") or 0,
                "review_count": p.get("review_count") or 0,
                "return_rate_pct": p.get("return_rate") or 0,
                "revenue_30d": round(revenue, 2),
                "net_profit_30d": round(net_profit, 2),
                "net_margin_pct": round(net_profit / revenue * 100, 1) if revenue else 0,
            })

    overall = calculate_overall_metrics(all_metrics)

    # Aynı product_code farklı marketplace'de ayrı listing — toplam satış/kar için topla
    totals = defaultdict(lambda: {
        "name": "", "category": "",
        "marketplaces": [], "total_sales_30d": 0,
        "total_revenue_30d": 0.0, "total_net_profit_30d": 0.0,
        "total_stock": 0, "avg_rating": 0.0, "total_review_count": 0,
    })
    rating_acc: dict = defaultdict(list)
    for l in listings:
        k = l["id"]
        t = totals[k]
        t["name"] = l["name"]
        t["category"] = l["category"]
        t["marketplaces"].append(l["marketplace"])
        t["total_sales_30d"] += l["sales_30d"]
        t["total_revenue_30d"] += l["revenue_30d"]
        t["total_net_profit_30d"] += l["net_profit_30d"]
        t["total_stock"] += l["stock"]
        t["total_review_count"] += l["review_count"]
        if l["rating"]:
            rating_acc[k].append(l["rating"])
    for k, ratings in rating_acc.items():
        totals[k]["avg_rating"] = round(sum(ratings) / len(ratings), 2)

    by_product = [{"id": k, **v, "total_revenue_30d": round(v["total_revenue_30d"], 2),
                   "total_net_profit_30d": round(v["total_net_profit_30d"], 2)}
                  for k, v in totals.items()]

    top_selling = sorted(by_product, key=lambda x: x["total_sales_30d"], reverse=True)[:10]
    most_profitable = sorted(by_product, key=lambda x: x["total_net_profit_30d"], reverse=True)[:10]
    least_profitable = sorted(by_product, key=lambda x: x["total_net_profit_30d"])[:5]
    low_stock = [l for l in listings if l["stock"] < 50]
    low_stock = sorted(low_stock, key=lambda x: x["stock"])[:10]
    low_rated = [l for l in listings if l["rating"] and l["rating"] < 4.0]
    low_rated = sorted(low_rated, key=lambda x: x["rating"])[:10]
    high_return = sorted([l for l in listings if l["return_rate_pct"] > 5.0],
                         key=lambda x: x["return_rate_pct"], reverse=True)[:5]

    return {
        "connected_marketplaces": marketplaces,
        "totals_30d": {
            "revenue": overall["total_revenue"],
            "net_profit_after_ads": overall["total_net_after_ads"],
            "net_margin_pct": overall["overall_net_margin"],
            "sales_units": overall["total_sales"],
            "return_rate_pct": overall["overall_return_rate"],
            "roas": overall["overall_roas"],
        },
        "by_marketplace": {
            mp: {
                "revenue_30d": m["total_revenue"],
                "net_profit_30d": m["total_net_profit"],
                "net_margin_pct": m["net_margin_pct"],
                "sales_30d": m["total_sales"],
                "return_rate_pct": m["return_rate"],
                "ad_spend_30d": m["ad_spend"],
                "roas": m["roas"],
            }
            for mp, m in all_metrics.items()
        },
        "products_aggregated": by_product,
        "top_selling_products_30d": top_selling,
        "most_profitable_products_30d": most_profitable,
        "least_profitable_products_30d": least_profitable,
        "low_stock_listings": low_stock,
        "low_rated_listings": low_rated,
        "high_return_rate_listings": high_return,
        "all_listings_count": len(listings),
    }


def run_arkus_agent(user_message: str, user_id: int) -> str:
    """
    Gemini Agent: function-calling tools (DB) + Google Search grounding (web).
    Tum magaza ozeti context olarak verilir, gerektiginde araclarla detayli veri ceker.
    """
    client = get_client()
    if not client:
        return "API Key tanimlanmamis veya gecersiz. .env dosyasini kontrol edin."

    overview = _build_rich_context(user_id)

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
        "Asagidaki SATICI VERILERI sana SAGLANMIS DURUMDADIR — kullanici ek bilgi gondermesi gerekmez:\n"
        f"{json.dumps(overview, ensure_ascii=False, indent=2)}\n\n"
        "ONEMLI KURALLAR:\n"
        "1. Yukaridaki context'te ZATEN urun-bazli detay vardir:\n"
        "   - 'products_aggregated': her urunun pazaryeri-toplam satis/ciro/kar bilgileri\n"
        "   - 'top_selling_products_30d': en cok satan urunler (sirali)\n"
        "   - 'most_profitable_products_30d': en karli urunler\n"
        "   - 'low_stock_listings': stok kritik urun-pazaryeri kombinasyonlari\n"
        "   - 'low_rated_listings': dusuk puanli urunler\n"
        "   - 'high_return_rate_listings': iade orani yuksek urunler\n"
        "   - 'by_marketplace': her pazaryerinin ciro/kar/satis/ROAS rakamlari\n"
        "2. ASLA 'verim yok' / 'urun bazinda bilgi bulunmamakta' / 'entegrasyon gerekli' gibi cevap VERME.\n"
        "   Tum veriler context'te. Direkt sorulan rakami orada bul ve goster.\n"
        "3. Soru icin ekstra detay gerekirse (bireysel yorum metni, siparis tarihi vs.) arac fonksiyonlarini cagir.\n"
        "4. Guncel piyasa/rakip/tedarikci/sektor verisi gerekirse Google Search kullan.\n"
        "5. Rakamlarla konus, somut aksiyon oner. Markdown kullan ama abartma. Turkce yanit ver.\n\n"
        "Cevap formati:\n"
        "**[Durum Analizi]** - kisa giris + ana bulgu\n"
        "**[Veriye Dayali Rakamlar]** - context'ten net rakamlar (urun adi + sayi)\n"
        "**[Somut Aksiyon Onerisi]** - 1-2 cumlede ne yapmasi gerektigi"
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
