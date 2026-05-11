from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from app.dependencies import get_current_user, get_db
from app.db.models import Marketplace, Product, Competitor, CompetitorPriceHistory
from app.services.marketplace_api import fetch_raw_marketplace_data

router = APIRouter()

SUPPORTED_MARKETPLACES = {"trendyol", "hepsiburada", "amazon_tr", "n11"}



def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


class ConnectRequest(BaseModel):
    marketplace: str
    api_key: str = ""
    store_url: str = ""


class UpdateKeyRequest(BaseModel):
    api_key: str


def _sync_products_for_marketplace(db, user, mp_row: Marketplace) -> int:
    """
    Sahte pazaryeri API'sinden urunleri ceker ve products tablosuna upsert eder.
    Mevcut urunleri gunceller, yeni gelenleri ekler. Return: islenen urun sayisi.
    """
    raw = fetch_raw_marketplace_data(mp_row.name)
    if not raw:
        return 0

    # Magaza meta verisini de tazele
    mp_row.store_name = raw.get("store_name", mp_row.store_name)
    mp_row.store_rating = raw.get("store_rating", mp_row.store_rating)
    mp_row.commission_rate = raw.get("commission_rate", mp_row.commission_rate)
    mp_row.ad_spend_30d = raw.get("ad_spend_30d", mp_row.ad_spend_30d)

    count = 0
    for p in raw.get("products", []):
        existing = (
            db.query(Product)
            .filter(
                Product.marketplace_id == mp_row.id,
                Product.product_code == p.get("id"),
            )
            .first()
        )
        if existing:
            existing.name = p.get("name")
            existing.category = p.get("category")
            existing.price = p.get("price")
            existing.cost = p.get("cost")
            existing.stock = p.get("stock")
            existing.sales_30d = p.get("sales_30d", 0)
            existing.shipping_cost = p.get("shipping_cost", 0.0)
            existing.rating = p.get("rating", 0.0)
            existing.review_count = p.get("review_count", 0)
            existing.return_rate = p.get("return_rate", 0.0)
            product = existing
        else:
            product = Product(
                user_id=user.id,
                product_code=p.get("id"),
                marketplace_id=mp_row.id,
                name=p.get("name"),
                category=p.get("category"),
                price=p.get("price"),
                cost=p.get("cost"),
                stock=p.get("stock"),
                sales_30d=p.get("sales_30d", 0),
                shipping_cost=p.get("shipping_cost", 0.0),
                rating=p.get("rating", 0.0),
                review_count=p.get("review_count", 0),
                return_rate=p.get("return_rate", 0.0),
                image_url=p.get(
                    "image_url",
                    f"https://placehold.co/400x400?text={p.get('id')}",
                ),
            )
            db.add(product)
            db.flush()  # product.id icin

        # Rakipleri tazele: once mevcut rakipleri sil, yenilerini ekle
        # Snapshot kaydet: yeni fiyatlari competitor_price_history'e yaz
        today = datetime.now().date().isoformat()
        db.query(Competitor).filter(Competitor.product_id == product.id).delete()
        for c in p.get("competitors", []):
            db.add(Competitor(
                product_id=product.id,
                name=c.get("name"),
                price=c.get("price"),
                rating=c.get("rating"),
                review_count=c.get("review_count"),
                sales_30d=c.get("sales_30d"),
                last_updated=_now(),
            ))
            # Ayni gun icin snapshot varsa onu update et, yoksa yeni ekle
            existing_snap = (
                db.query(CompetitorPriceHistory)
                .filter(
                    CompetitorPriceHistory.product_id == product.id,
                    CompetitorPriceHistory.competitor_name == c.get("name"),
                    CompetitorPriceHistory.captured_at == today,
                )
                .first()
            )
            if existing_snap:
                existing_snap.price = c.get("price")
                existing_snap.rating = c.get("rating")
            else:
                db.add(CompetitorPriceHistory(
                    product_id=product.id,
                    competitor_name=c.get("name"),
                    price=c.get("price"),
                    rating=c.get("rating"),
                    captured_at=today,
                ))
        count += 1

    db.commit()
    return count


@router.post("/connect")
def connect_marketplace(
    req: ConnectRequest,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    mp = req.marketplace.lower()
    if mp not in SUPPORTED_MARKETPLACES:
        raise HTTPException(status_code=400, detail="Desteklenmeyen pazaryeri")

    raw = fetch_raw_marketplace_data(mp) or {}

    existing = (
        db.query(Marketplace)
        .filter(Marketplace.user_id == user.id, Marketplace.name == mp)
        .first()
    )
    if existing:
        existing.api_key = req.api_key or existing.api_key
        existing.store_url = req.store_url or existing.store_url
        existing.status = "connected"
        existing.connected_at = _now()
        mp_row = existing
    else:
        mp_row = Marketplace(
            user_id=user.id,
            name=mp,
            store_name=raw.get("store_name", f"{mp.capitalize()} Store"),
            store_rating=raw.get("store_rating", 0.0),
            commission_rate=raw.get("commission_rate", 0.0),
            ad_spend_30d=raw.get("ad_spend_30d", 0.0),
            api_key=req.api_key or f"demo-key-{mp}",
            store_url=req.store_url or f"https://{mp}.com",
            status="connected",
            connected_at=_now(),
        )
        db.add(mp_row)
        db.flush()

    product_count = _sync_products_for_marketplace(db, user, mp_row) if raw else 0
    db.commit()

    return {
        "message": f"{mp} basariyla baglandi",
        "store": {
            "marketplace": mp_row.name,
            "store_name": mp_row.store_name,
            "status": mp_row.status,
            "connected_at": mp_row.connected_at,
            "product_count": product_count,
        },
    }


@router.get("/connections")
def list_connections(user=Depends(get_current_user), db=Depends(get_db)):
    rows = db.query(Marketplace).filter(Marketplace.user_id == user.id).all()
    connections = []
    for m in rows:
        product_count = (
            db.query(Product).filter(Product.marketplace_id == m.id).count()
        )
        connections.append({
            "marketplace": m.name,
            "store_name": m.store_name,
            "store_rating": m.store_rating,
            "status": m.status,
            "connected_at": m.connected_at,
            "store_url": m.store_url,
            "product_count": product_count,
        })
    return {"connections": connections}


@router.delete("/disconnect/{marketplace}")
def disconnect_marketplace(
    marketplace: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    mp = marketplace.lower()
    row = (
        db.query(Marketplace)
        .filter(Marketplace.user_id == user.id, Marketplace.name == mp)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Bu pazaryeri bagli degil")

    row.status = "disconnected"
    row.api_key = None
    db.commit()
    return {"message": f"{mp} baglantisi kaldirildi"}


@router.get("/sync/{marketplace}")
def sync_marketplace(
    marketplace: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    mp = marketplace.lower()
    row = (
        db.query(Marketplace)
        .filter(
            Marketplace.user_id == user.id,
            Marketplace.name == mp,
            Marketplace.status == "connected",
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Bu pazaryeri bagli degil")

    product_count = _sync_products_for_marketplace(db, user, row)
    return {
        "message": f"{mp} verileri senkronize edildi",
        "marketplace": mp,
        "product_count": product_count,
        "synced_at": _now(),
    }


@router.get("/sync-all")
def sync_all(user=Depends(get_current_user), db=Depends(get_db)):
    rows = (
        db.query(Marketplace)
        .filter(Marketplace.user_id == user.id, Marketplace.status == "connected")
        .all()
    )
    results = {}
    for row in rows:
        product_count = _sync_products_for_marketplace(db, user, row)
        results[row.name] = {
            "store_name": row.store_name,
            "product_count": product_count,
        }
    return {
        "message": "Tum pazaryerleri senkronize edildi",
        "results": results,
        "synced_at": _now(),
    }


@router.put("/update-key/{marketplace}")
def update_api_key(
    marketplace: str,
    req: UpdateKeyRequest,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    mp = marketplace.lower()
    row = (
        db.query(Marketplace)
        .filter(Marketplace.user_id == user.id, Marketplace.name == mp)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Bu pazaryeri bagli degil")

    row.api_key = req.api_key
    row.status = "connected"  # key guncellendiginde reaktive et
    db.commit()
    return {"message": f"{mp} API key guncellendi", "status": row.status}
