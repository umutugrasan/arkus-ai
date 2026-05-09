"""
Mock Marketplace API Service
Gercek urunde burasi Trendyol, Hepsiburada, Amazon TR API'lerine baglanir.
Hackathon icin mock data doner.
"""

import json
import os

MOCK_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "mock_raw.json")

_raw_data = None


def _load_raw():
    global _raw_data
    if _raw_data is None:
        with open(MOCK_PATH, "r", encoding="utf-8") as f:
            _raw_data = json.load(f)
    return _raw_data


def fetch_store_info(marketplace: str):
    """Pazaryerinden magaza bilgilerini cek"""
    data = _load_raw()
    return data["marketplaces"].get(marketplace, None)


def fetch_products(marketplace: str):
    """Pazaryerinden urun listesini cek"""
    data = _load_raw()
    mp = data["marketplaces"].get(marketplace)
    if not mp:
        return []
    return mp["products"]


def fetch_orders(marketplace: str):
    """Pazaryerinden siparis/satis verilerini cek"""
    data = _load_raw()
    mp = data["marketplaces"].get(marketplace)
    if not mp:
        return []
    return mp.get("orders", [])


def fetch_reviews(marketplace: str, product_id: str = None):
    """Pazaryerinden yorumlari cek"""
    data = _load_raw()
    reviews = data.get("reviews", {})
    if product_id:
        all_reviews = reviews.get(product_id, [])
        if marketplace != "all":
            return [r for r in all_reviews if r["marketplace"] == marketplace]
        return all_reviews
    return reviews


def fetch_all_marketplaces():
    """Tum bagli pazaryerlerini getir"""
    data = _load_raw()
    return list(data["marketplaces"].keys())


def fetch_suppliers():
    """Tedarikci verilerini cek"""
    data = _load_raw()
    return data.get("suppliers", [])