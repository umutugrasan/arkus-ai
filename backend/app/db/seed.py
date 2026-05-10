import json
import os
import hashlib
from sqlalchemy.orm import Session
from app.db.models import User, Seller, Marketplace, Product, Competitor, Review, Supplier
from app.db.database import engine, Base

MOCK_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "mock_raw.json")

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def seed_db(db: Session):
    # Eğer tablolar doluysa (demo kullanıcı varsa), seed etme
    if db.query(User).filter(User.email == "demo@basiret.ai").first():
        return

    # 0. Demo Kullanıcı Oluştur
    demo_user = User(
        name="Demo Kullanıcı",
        email="demo@basiret.ai",
        password=hash_password("demo123"),
        store_name="Demo Store",
        token="demo-token", # Frontend'deki hızlı erişim token'ı
        created_at="2026-05-10"
    )
    db.add(demo_user)
    db.commit()
    db.refresh(demo_user)

    with open(MOCK_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Seller
    s_data = data.get("seller", {})
    seller = Seller(
        id=s_data.get("id", "S001"),
        name=s_data.get("name", "Unknown"),
        owner=s_data.get("owner", "Unknown"),
        member_since=s_data.get("member_since", "")
    )
    db.add(seller)
    db.commit()

    # 2. Marketplaces, Products & Competitors
    for mp_name, mp_data in data.get("marketplaces", {}).items():
        marketplace = Marketplace(
            user_id=demo_user.id,  # MARKETPLACE'I KULLANICIYA ZIMMETLE
            name=mp_name,
            store_name=mp_data.get("store_name", ""),
            store_rating=mp_data.get("store_rating", 0.0),
            commission_rate=mp_data.get("commission_rate", 0.0),
            ad_spend_30d=mp_data.get("ad_spend_30d", 0.0)
        )
        db.add(marketplace)
        db.commit() 
        db.refresh(marketplace)

        for prod_data in mp_data.get("products", []):
            product = Product(
                product_code=prod_data.get("id"),
                marketplace_id=marketplace.id,
                name=prod_data.get("name"),
                category=prod_data.get("category"),
                price=prod_data.get("price"),
                cost=prod_data.get("cost"),
                stock=prod_data.get("stock"),
                sales_30d=prod_data.get("sales_30d"),
                shipping_cost=prod_data.get("shipping_cost"),
                rating=prod_data.get("rating"),
                review_count=prod_data.get("review_count"),
                return_rate=prod_data.get("return_rate")
            )
            db.add(product)
            db.commit()
            db.refresh(product)

            for comp_data in prod_data.get("competitors", []):
                competitor = Competitor(
                    product_id=product.id,
                    name=comp_data.get("name"),
                    price=comp_data.get("price"),
                    rating=comp_data.get("rating"),
                    review_count=comp_data.get("review_count"),
                    sales_30d=comp_data.get("sales_30d")
                )
                db.add(competitor)
            db.commit()

    # 3. Reviews
    for p_code, rev_list in data.get("reviews", {}).items():
        for rev_data in rev_list:
            review = Review(
                product_code=p_code,
                marketplace_name=rev_data.get("marketplace"),
                rating=rev_data.get("rating"),
                text=rev_data.get("text"),
                date=rev_data.get("date")
            )
            db.add(review)
    db.commit()

    # 4. Suppliers
    for sup_data in data.get("suppliers", []):
        supplier = Supplier(
            name=sup_data.get("name"),
            product=sup_data.get("product"),
            current_price=sup_data.get("current_price"),
            min_order=sup_data.get("min_order"),
            shipping_days=sup_data.get("shipping_days"),
            discount_pct=sup_data.get("discount_pct")
        )
        db.add(supplier)
    db.commit()
    print("Database seeded successfully with mock_raw.json data.")
