"""
Marketplace API Service (PostgreSQL Integrated & Multi-Tenant)
Gercek urunde burasi Trendyol, Hepsiburada, Amazon TR API'lerine baglanir.
Hackathon versiyonunda kendi PostgreSQL veritabanindan okur ve user_id bazli filtreler.
"""

from typing import List, Dict, Any, Optional
from app.db.database import SessionLocal
from app.db.models import Seller, Marketplace, Product, Competitor, Review, Supplier

def get_db():
    db = SessionLocal()
    try:
        return db
    except Exception:
        db.close()
        raise

def fetch_store_info(marketplace_name: str, user_id: int) -> Optional[Dict[str, Any]]:
    """Belirli bir kullanicinin pazaryerindeki magazaya ait temel bilgileri getirir."""
    db = get_db()
    mp = db.query(Marketplace).filter(Marketplace.name == marketplace_name, Marketplace.user_id == user_id).first()
    if not mp:
        db.close()
        return None
    
    result = {
        "store_name": mp.store_name,
        "store_rating": mp.store_rating,
        "commission_rate": mp.commission_rate,
        "ad_spend_30d": mp.ad_spend_30d,
        "products": fetch_products(marketplace_name, user_id)
    }
    db.close()
    return result

def fetch_products(marketplace_name: str, user_id: int) -> List[Dict[str, Any]]:
    """Belirtilen pazaryerindeki ürün listesini getirir."""
    db = get_db()
    mp = db.query(Marketplace).filter(Marketplace.name == marketplace_name, Marketplace.user_id == user_id).first()
    if not mp:
        db.close()
        return []
    
    products = db.query(Product).filter(Product.marketplace_id == mp.id).all()
    result = []
    for p in products:
        comps = db.query(Competitor).filter(Competitor.product_id == p.id).all()
        comp_list = [
            {"name": c.name, "price": c.price, "rating": c.rating, "review_count": c.review_count, "sales_30d": c.sales_30d} 
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
            "competitors": comp_list
        })
    db.close()
    return result

def fetch_orders(marketplace_name: str, user_id: int) -> List[Dict[str, Any]]:
    """Belirtilen pazaryerindeki sipariş/satış verilerini getirir."""
    return []

def fetch_reviews(marketplace: str, user_id: int, product_id: str = "") -> List[Dict[str, Any]]:
    """Saticinin urunlerine gelen musteri yorumlarini getirir. Sadece kullaniciya ait urunlerin yorumlari gosterilmelidir."""
    db = get_db()
    
    # Once kullaniciya ait tum urun id (kod) listesini bulmaliyiz ki baskasinin yorumunu cekmesin
    my_mps = db.query(Marketplace).filter(Marketplace.user_id == user_id).all()
    my_mp_ids = [m.id for m in my_mps]
    
    if not my_mp_ids:
        db.close()
        return []
        
    my_products = db.query(Product).filter(Product.marketplace_id.in_(my_mp_ids)).all()
    my_product_codes = [p.product_code for p in my_products]
    
    if not my_product_codes:
        db.close()
        return []

    query = db.query(Review).filter(Review.product_code.in_(my_product_codes))
    
    if marketplace != "all":
        query = query.filter(Review.marketplace_name == marketplace)
        
    if product_id:
        query = query.filter(Review.product_code == product_id)
        
    reviews = query.all()
    result = [
        {"marketplace": r.marketplace_name, "rating": r.rating, "text": r.text, "date": r.date}
        for r in reviews
    ]
    db.close()
    return result

def fetch_all_marketplaces(user_id: int) -> List[str]:
    """Saticinin su anda bagli oldugu tum pazaryerlerinin isimlerini dondurur."""
    db = get_db()
    mps = db.query(Marketplace).filter(Marketplace.user_id == user_id).all()
    result = [m.name for m in mps]
    db.close()
    return result

def fetch_suppliers() -> List[Dict[str, Any]]:
    """Tedarikci verilerini cek (Tedarikciler tum kullanicilar icin ortaktir)"""
    db = get_db()
    sups = db.query(Supplier).all()
    result = [
        {"name": s.name, "product": s.product, "current_price": s.current_price, "min_order": s.min_order, "shipping_days": s.shipping_days, "discount_pct": s.discount_pct}
        for s in sups
    ]
    db.close()
    return result