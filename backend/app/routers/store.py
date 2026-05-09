from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces

router = APIRouter()


class ConnectRequest(BaseModel):
    marketplace: str
    api_key: str = ""
    store_url: str = ""


# Bagli pazaryerlerini simule et
connected_stores = {
    "trendyol": {"connected": True, "store_name": "TechStore Official", "connected_at": "2026-04-01"},
    "hepsiburada": {"connected": True, "store_name": "TechStore HB", "connected_at": "2026-04-05"},
    "amazon_tr": {"connected": True, "store_name": "TechStore TR Amazon", "connected_at": "2026-04-10"},
}


@router.post("/connect")
def connect_marketplace(req: ConnectRequest):
    mp = req.marketplace.lower()
    if mp not in ["trendyol", "hepsiburada", "amazon_tr", "n11"]:
        raise HTTPException(status_code=400, detail="Desteklenmeyen pazaryeri")

    store_info = fetch_store_info(mp)
    if not store_info:
        raise HTTPException(status_code=404, detail="Pazaryeri verisi bulunamadi")

    connected_stores[mp] = {
        "connected": True,
        "store_name": store_info["store_name"],
        "connected_at": "2026-05-10",
    }

    return {"message": f"{mp} basariyla baglandi", "store": connected_stores[mp]}


@router.get("/connections")
def list_connections():
    return {"connections": connected_stores}


@router.delete("/disconnect/{marketplace}")
def disconnect_marketplace(marketplace: str):
    mp = marketplace.lower()
    if mp not in connected_stores:
        raise HTTPException(status_code=404, detail="Bu pazaryeri bagli degil")

    del connected_stores[mp]
    return {"message": f"{mp} baglantisi kaldirildi"}


@router.get("/sync/{marketplace}")
def sync_marketplace(marketplace: str):
    mp = marketplace.lower()
    if mp not in connected_stores:
        raise HTTPException(status_code=404, detail="Bu pazaryeri bagli degil")

    store_info = fetch_store_info(mp)
    if not store_info:
        raise HTTPException(status_code=404, detail="Veri cekilemedi")

    return {
        "message": f"{mp} verileri basariyla senkronize edildi",
        "store_name": store_info["store_name"],
        "product_count": len(store_info["products"]),
        "store_rating": store_info["store_rating"],
    }


@router.get("/sync-all")
def sync_all():
    results = {}
    for mp in connected_stores:
        store_info = fetch_store_info(mp)
        if store_info:
            results[mp] = {
                "store_name": store_info["store_name"],
                "product_count": len(store_info["products"]),
                "store_rating": store_info["store_rating"],
            }

    return {"message": "Tum pazaryerleri senkronize edildi", "results": results}