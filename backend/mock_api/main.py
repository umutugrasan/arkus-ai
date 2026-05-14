"""
Sahte Pazaryeri API Simulasyonu
Trendyol, Hepsiburada, Amazon TR satici panel API'lerini taklit eder.
Port: 8001
Demo amacli — gercek urunde ana backend buraya yerine gercek pazaryeri API'sine baglanir.
"""

import json
import os
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# mock_raw.json ana backend ile paylasilan veri kaynagi
DATA_PATH = os.path.join(
    os.path.dirname(__file__), "..", "app", "data", "mock_raw.json"
)

# Demo amacli sabit API key'ler (gercek urunde her satici icin uretilir)
VALID_API_KEYS = {
    "trendyol": ["demo-key-trendyol", "TRY-DEMO-12345-ABCDE"],
    "hepsiburada": ["demo-key-hepsiburada", "HB-DEMO-67890-FGHIJ"],
    "amazon_tr": ["demo-key-amazon_tr", "AMZ-DEMO-13579-KLMNO"],
    "n11": ["demo-key-n11", "N11-DEMO-24680-PRSTU"],
}

# 3 sahte pazaryeri ana backend'in mock_raw.json'daki key'lerine eslesir
MARKETPLACE_KEY = {
    "trendyol": "trendyol",
    "hepsiburada": "hepsiburada",
    "amazon-tr": "amazon_tr",   # URL'de dash, JSON'da underscore
    "n11": "n11",
}


def _load_data():
    """Her cagrida sıfırdan oku — boylece mock_raw.json degisirse otomatik yansir."""
    if not os.path.exists(DATA_PATH):
        return {}
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _check_api_key(marketplace_slug: str, api_key: Optional[str]):
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail=f"X-API-KEY header gerekli ({marketplace_slug})",
        )
    mp_internal = MARKETPLACE_KEY.get(marketplace_slug)
    if not mp_internal:
        raise HTTPException(status_code=404, detail="Bilinmeyen pazaryeri")
    valid_keys = VALID_API_KEYS.get(mp_internal, [])
    if api_key not in valid_keys:
        raise HTTPException(
            status_code=403,
            detail=f"Gecersiz API key. {marketplace_slug} icin yetkili degil.",
        )
    return mp_internal


# ---- FastAPI app ----

app = FastAPI(
    title="Sahte Pazaryeri API",
    description=(
        "Trendyol, Hepsiburada, Amazon TR satici panel API'lerinin demo simulasyonu. "
        "Ana Basiret AI backend'i bu API'yi gercek pazaryeri API'siymis gibi cagirir."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "Sahte Pazaryeri API aktif",
        "endpoints": [
            "GET /marketplaces",
            "GET /seller",
            "GET /suppliers",
            "GET /trendyol/products",
            "GET /hepsiburada/products",
            "GET /amazon-tr/products",
            "GET /n11/products",
            "POST /{trendyol|hepsiburada|amazon-tr|n11}/auth",
            "GET /{slug}/store-info",
            "GET /{slug}/reviews",
        ],
        "demo_api_keys": VALID_API_KEYS,
    }


@app.get("/marketplaces")
def list_marketplaces():
    """Sistem tarafindan desteklenen pazaryerleri listesi (URL slug + ic ad)."""
    data = _load_data()
    available = list(data.get("marketplaces", {}).keys())
    # Slug <-> internal eslestirmesi
    slugs = {slug: internal for slug, internal in MARKETPLACE_KEY.items() if internal in available}
    return {
        "marketplaces": [
            {
                "slug": slug,
                "internal_name": internal,
                "store_name": data["marketplaces"].get(internal, {}).get("store_name"),
            }
            for slug, internal in slugs.items()
        ]
    }


@app.get("/seller")
def get_seller():
    """Satici (mağaza sahibi) meta verisi."""
    data = _load_data()
    seller = data.get("seller", {})
    if not seller:
        raise HTTPException(status_code=404, detail="Satici verisi yok")
    return seller


@app.get("/suppliers")
def get_suppliers():
    """Tedarikci listesi (Alibaba/AliExpress/yerli)."""
    data = _load_data()
    return {"total": len(data.get("suppliers", [])), "suppliers": data.get("suppliers", [])}


class AuthRequest(BaseModel):
    api_key: str
    store_url: Optional[str] = None


@app.post("/{marketplace_slug}/auth")
def authenticate(marketplace_slug: str, req: AuthRequest):
    """API key dogrulama simulasyonu. Gercek pazaryeri API'lerinde OAuth/HMAC olur."""
    mp_internal = MARKETPLACE_KEY.get(marketplace_slug)
    if not mp_internal:
        raise HTTPException(status_code=404, detail="Bilinmeyen pazaryeri")
    valid_keys = VALID_API_KEYS.get(mp_internal, [])
    if req.api_key not in valid_keys:
        raise HTTPException(status_code=403, detail="Gecersiz API key")

    data = _load_data()
    mp_data = data.get("marketplaces", {}).get(mp_internal, {})
    return {
        "authenticated": True,
        "marketplace": marketplace_slug,
        "store_name": mp_data.get("store_name"),
        "store_rating": mp_data.get("store_rating"),
        "session_token": f"session-{mp_internal}-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "expires_in_hours": 24,
    }


@app.get("/{marketplace_slug}/store-info")
def store_info(
    marketplace_slug: str,
    x_api_key: Optional[str] = Header(None, alias="X-API-KEY"),
):
    mp_internal = _check_api_key(marketplace_slug, x_api_key)
    data = _load_data()
    mp_data = data.get("marketplaces", {}).get(mp_internal)
    if not mp_data:
        raise HTTPException(status_code=404, detail="Pazaryeri verisi yok")
    return {
        "marketplace": marketplace_slug,
        "store_name": mp_data.get("store_name"),
        "store_rating": mp_data.get("store_rating"),
        "commission_rate": mp_data.get("commission_rate"),
        "ad_spend_30d": mp_data.get("ad_spend_30d"),
        "product_count": len(mp_data.get("products", [])),
    }


@app.get("/{marketplace_slug}/products")
def get_products(
    marketplace_slug: str,
    x_api_key: Optional[str] = Header(None, alias="X-API-KEY"),
    include_competitors: bool = True,
    category: Optional[str] = None,
    min_stock: Optional[int] = None,
):
    """Gercek pazaryeri API'lerine benzer urun listesi endpoint'i."""
    mp_internal = _check_api_key(marketplace_slug, x_api_key)
    data = _load_data()
    mp_data = data.get("marketplaces", {}).get(mp_internal)
    if not mp_data:
        raise HTTPException(status_code=404, detail="Pazaryeri verisi yok")

    products = mp_data.get("products", [])
    if category:
        products = [p for p in products if category.lower() in p.get("category", "").lower()]
    if min_stock is not None:
        products = [p for p in products if p.get("stock", 0) >= min_stock]
    if not include_competitors:
        products = [{k: v for k, v in p.items() if k != "competitors"} for p in products]

    return {
        "marketplace": marketplace_slug,
        "store_name": mp_data.get("store_name"),
        "store_rating": mp_data.get("store_rating"),
        "commission_rate": mp_data.get("commission_rate"),
        "ad_spend_30d": mp_data.get("ad_spend_30d"),
        "total": len(products),
        "products": products,
    }


@app.get("/{marketplace_slug}/reviews")
def get_reviews(
    marketplace_slug: str,
    product_id: Optional[str] = None,
    x_api_key: Optional[str] = Header(None, alias="X-API-KEY"),
):
    mp_internal = _check_api_key(marketplace_slug, x_api_key)
    data = _load_data()

    all_reviews = []
    for pid, reviews in data.get("reviews", {}).items():
        for r in reviews:
            if r.get("marketplace") == mp_internal:
                all_reviews.append({**r, "product_id": pid})

    if product_id:
        all_reviews = [r for r in all_reviews if r["product_id"] == product_id]

    return {
        "marketplace": marketplace_slug,
        "total": len(all_reviews),
        "reviews": all_reviews,
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "mock-marketplace-api"}
