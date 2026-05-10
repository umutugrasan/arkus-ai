"""
Marketplace API Service (Pure HTTP / mock-api)
Tum sahte pazaryeri verisi yalnizca mock-api (port 8001) HTTP endpoint'lerinden cekilir.
JSON dosyasi okuma YOK. Gercek urunde mock-api yerine Trendyol/HB/Amazon API'leri konur.

Database-driven okuma fonksiyonlari (fetch_store_info, fetch_products vs.) hala dogrudan
PostgreSQL'den okur — orada zaten sync ile mock-api'den cekilmis veri var.
"""

import os
import logging
from typing import List, Dict, Any, Optional
import httpx
from app.db.database import SessionLocal
from app.db.models import Seller, Marketplace, Product, Competitor, Review, Supplier

logger = logging.getLogger(__name__)

MOCK_API_BASE = os.getenv("MOCK_MARKETPLACE_API_URL", "http://mock-api:8001")
MP_SLUG = {
    "trendyol": "trendyol",
    "hepsiburada": "hepsiburada",
    "amazon_tr": "amazon-tr",
}
DEMO_KEYS = {
    "trendyol": "demo-key-trendyol",
    "hepsiburada": "demo-key-hepsiburada",
    "amazon_tr": "demo-key-amazon_tr",
}


def fetch_raw_marketplace_data(marketplace_name: str) -> Optional[Dict[str, Any]]:
    """
    Sahte pazaryeri API'sinden HAM veri ceker.
    JSON fallback YOK — mock-api ayakta olmali (docker depends_on healthcheck garanti eder).
    Mock-api hata verirse None doner, caller bunu handle eder.
    """
    slug = MP_SLUG.get(marketplace_name)
    if not slug:
        logger.warning(f"Bilinmeyen marketplace: {marketplace_name}")
        return None

    api_key = DEMO_KEYS.get(marketplace_name, "")
    url = f"{MOCK_API_BASE}/{slug}/products"
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(url, headers={"X-API-KEY": api_key})
            if resp.status_code != 200:
                logger.warning(f"mock-api {slug} non-200 ({resp.status_code})")
                return None
            data = resp.json()
            return {
                "store_name": data.get("store_name"),
                "store_rating": data.get("store_rating"),
                "commission_rate": data.get("commission_rate"),
                "ad_spend_30d": data.get("ad_spend_30d"),
                "products": data.get("products", []),
            }
    except Exception as e:
        logger.error(f"mock-api {slug} failed: {type(e).__name__}: {e}")
        return None


def _get_db_session():
    return SessionLocal()


# ---- DB-driven okuyucular (mock-api ile direkt ilgisiz, sync sonrasi DB'den okur) ----

def fetch_store_info(marketplace_name: str, user_id: int) -> Optional[Dict[str, Any]]:
    """Belirli bir kullanicinin pazaryerindeki magazaya ait temel bilgileri getirir (DB)."""
    db = _get_db_session()
    try:
        mp = (
            db.query(Marketplace)
            .filter(
                Marketplace.name == marketplace_name,
                Marketplace.user_id == user_id,
            )
            .first()
        )
        if not mp:
            return None
        return {
            "store_name": mp.store_name,
            "store_rating": mp.store_rating,
            "commission_rate": mp.commission_rate,
            "ad_spend_30d": mp.ad_spend_30d,
            "products": fetch_products(marketplace_name, user_id),
        }
    finally:
        db.close()


def fetch_products(marketplace_name: str, user_id: int) -> List[Dict[str, Any]]:
    """Belirtilen pazaryerindeki urun listesini DB'den getirir."""
    db = _get_db_session()
    try:
        mp = (
            db.query(Marketplace)
            .filter(
                Marketplace.name == marketplace_name,
                Marketplace.user_id == user_id,
            )
            .first()
        )
        if not mp:
            return []
        products = db.query(Product).filter(Product.marketplace_id == mp.id).all()
        result = []
        for p in products:
            comps = db.query(Competitor).filter(Competitor.product_id == p.id).all()
            comp_list = [
                {
                    "name": c.name,
                    "price": c.price,
                    "rating": c.rating,
                    "review_count": c.review_count,
                    "sales_30d": c.sales_30d,
                }
                for c in comps
            ]
            result.append({
                "id": p.product_code,
                "name": p.name,
                "category": p.category,
                "price": p.price,
                "cost": p.cost,
                "stock": p.stock,
                "sales_30d": p.sales_30d,
                "shipping_cost": p.shipping_cost,
                "rating": p.rating,
                "review_count": p.review_count,
                "return_rate": p.return_rate,
                "competitors": comp_list,
            })
        return result
    finally:
        db.close()


def fetch_orders(marketplace_name: str, user_id: int) -> List[Dict[str, Any]]:
    """Siparis verileri (su an Orders tablosundan)."""
    return []


def fetch_reviews(marketplace: str, user_id: int, product_id: str = "") -> List[Dict[str, Any]]:
    """Saticinin urunlerine gelen musteri yorumlarini DB'den getirir."""
    db = _get_db_session()
    try:
        my_mps = db.query(Marketplace).filter(Marketplace.user_id == user_id).all()
        my_mp_ids = [m.id for m in my_mps]
        if not my_mp_ids:
            return []
        my_products = (
            db.query(Product).filter(Product.marketplace_id.in_(my_mp_ids)).all()
        )
        my_product_codes = [p.product_code for p in my_products]
        if not my_product_codes:
            return []

        query = db.query(Review).filter(Review.product_code.in_(my_product_codes))
        if marketplace != "all":
            query = query.filter(Review.marketplace_name == marketplace)
        if product_id:
            query = query.filter(Review.product_code == product_id)

        reviews = query.all()
        return [
            {
                "marketplace": r.marketplace_name,
                "rating": r.rating,
                "text": r.text,
                "date": r.date,
            }
            for r in reviews
        ]
    finally:
        db.close()


def fetch_all_marketplaces(user_id: int) -> List[str]:
    """Saticinin bagli oldugu tum pazaryerleri (DB)."""
    db = _get_db_session()
    try:
        mps = db.query(Marketplace).filter(Marketplace.user_id == user_id).all()
        return [m.name for m in mps]
    finally:
        db.close()


def fetch_suppliers() -> List[Dict[str, Any]]:
    """Tedarikci verileri (DB, sync icinden mock-api'den gelmis)."""
    db = _get_db_session()
    try:
        sups = db.query(Supplier).all()
        return [
            {
                "name": s.name,
                "product": s.product,
                "current_price": s.current_price,
                "min_order": s.min_order,
                "shipping_days": s.shipping_days,
                "discount_pct": s.discount_pct,
            }
            for s in sups
        ]
    finally:
        db.close()
