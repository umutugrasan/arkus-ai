import json
import os
import hashlib
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.db.models import (
    User, Seller, Marketplace, Product, Competitor, Review, Supplier,
    ReviewAnalysis, Order, Financial, Notification, Report, ChatHistory,
    PriceAlert, ListingOptimization, ImageAnalysis,
)
from app.db.database import engine, Base

MOCK_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "mock_raw.json")


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def seed_db(db: Session):
    # Demo kullanici varsa tekrar seed etme
    if db.query(User).filter(User.email == "demo@basiret.ai").first():
        return

    # 1. users
    demo_user = User(
        name="Demo Kullanici",
        email="demo@basiret.ai",
        password=hash_password("demo123"),
        store_name="Demo Store",
        token="demo-token",
        email_verified=True,
        created_at="2026-05-10",
    )
    db.add(demo_user)
    db.commit()
    db.refresh(demo_user)

    with open(MOCK_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Auxiliary - seller
    s_data = data.get("seller", {})
    seller = Seller(
        id=s_data.get("id", "S001"),
        name=s_data.get("name", "Unknown"),
        owner=s_data.get("owner", "Unknown"),
        member_since=s_data.get("member_since", ""),
    )
    db.add(seller)
    db.commit()

    # 2. marketplace_connections, 3. products, 6. competitors
    marketplace_objs = {}
    products_by_code = {}  # product_code -> Product
    for mp_name, mp_data in data.get("marketplaces", {}).items():
        marketplace = Marketplace(
            user_id=demo_user.id,
            name=mp_name,
            store_name=mp_data.get("store_name", ""),
            store_rating=mp_data.get("store_rating", 0.0),
            commission_rate=mp_data.get("commission_rate", 0.0),
            ad_spend_30d=mp_data.get("ad_spend_30d", 0.0),
            api_key=f"demo-key-{mp_name}",
            store_url=f"https://{mp_name}.com/demo-store",
            status="connected",
            connected_at="2026-05-01",
        )
        db.add(marketplace)
        db.commit()
        db.refresh(marketplace)
        marketplace_objs[mp_name] = marketplace

        for prod_data in mp_data.get("products", []):
            product = Product(
                user_id=demo_user.id,
                product_code=prod_data.get("id"),
                marketplace_id=marketplace.id,
                name=prod_data.get("name"),
                category=prod_data.get("category"),
                price=prod_data.get("price"),
                cost=prod_data.get("cost"),
                stock=prod_data.get("stock"),
                sales_30d=prod_data.get("sales_30d", 0),
                shipping_cost=prod_data.get("shipping_cost", 0.0),
                rating=prod_data.get("rating", 0.0),
                review_count=prod_data.get("review_count", 0),
                return_rate=prod_data.get("return_rate", 0.0),
                image_url=prod_data.get(
                    "image_url",
                    f"https://placehold.co/400x400?text={prod_data.get('id')}",
                ),
            )
            db.add(product)
            db.commit()
            db.refresh(product)
            products_by_code[(mp_name, prod_data.get("id"))] = product

            for comp_data in prod_data.get("competitors", []):
                competitor = Competitor(
                    product_id=product.id,
                    name=comp_data.get("name"),
                    price=comp_data.get("price"),
                    rating=comp_data.get("rating"),
                    review_count=comp_data.get("review_count"),
                    sales_30d=comp_data.get("sales_30d"),
                    last_updated=_now(),
                )
                db.add(competitor)
            db.commit()

    # 4. reviews
    for p_code, rev_list in data.get("reviews", {}).items():
        for rev_data in rev_list:
            review = Review(
                product_code=p_code,
                marketplace_name=rev_data.get("marketplace"),
                rating=rev_data.get("rating"),
                text=rev_data.get("text"),
                date=rev_data.get("date"),
                sentiment=None,   # AI analizinde doldurulur
                category=None,
            )
            db.add(review)
    db.commit()

    # 15. suppliers
    for sup_data in data.get("suppliers", []):
        supplier = Supplier(
            name=sup_data.get("name"),
            product=sup_data.get("product"),
            current_price=sup_data.get("current_price"),
            min_order=sup_data.get("min_order"),
            shipping_days=sup_data.get("shipping_days"),
            discount_pct=sup_data.get("discount_pct"),
            last_checked_at=_now(),
        )
        db.add(supplier)
    db.commit()

    # 7. orders - urun satislarindan turetilmis sahte siparisler
    statuses = ["delivered", "delivered", "delivered", "pending", "returned"]
    today = datetime.now().date()
    for (mp_name, _code), product in products_by_code.items():
        sales = product.sales_30d or 0
        order_count = max(1, sales // 20)  # her 20 satisi 1 siparise indirgeyelim
        for i in range(order_count):
            qty = random.randint(1, 3)
            order_date = today - timedelta(days=random.randint(0, 30))
            db.add(Order(
                user_id=demo_user.id,
                product_id=product.id,
                marketplace_name=mp_name,
                quantity=qty,
                total=round(product.price * qty, 2),
                date=order_date.isoformat(),
                status=random.choice(statuses),
            ))
    db.commit()

    # 8. financials - son 3 ay icin agregat
    months = ["2026-03", "2026-04", "2026-05"]
    for m in months:
        revenue = 0.0
        cost = 0.0
        commission = 0.0
        shipping = 0.0
        ad_spend = 0.0
        for mp in marketplace_objs.values():
            month_orders = (
                db.query(Order)
                .filter(Order.marketplace_name == mp.name, Order.status == "delivered")
                .all()
            )
            mp_revenue = sum(o.total for o in month_orders) / len(months)
            revenue += mp_revenue
            commission += mp_revenue * (mp.commission_rate or 0) / 100
            ad_spend += (mp.ad_spend_30d or 0) / len(months)
        # ilgili ay icin urun bazli maliyet & kargo tahmini
        for product in products_by_code.values():
            cost += (product.cost or 0) * ((product.sales_30d or 0) / len(months))
            shipping += (product.shipping_cost or 0) * ((product.sales_30d or 0) / len(months))

        profit = revenue - cost - commission - shipping - ad_spend
        margin = (profit / revenue * 100) if revenue else 0.0
        roas = (revenue / ad_spend) if ad_spend else 0.0

        db.add(Financial(
            user_id=demo_user.id,
            month=m,
            revenue=round(revenue, 2),
            cost=round(cost, 2),
            commission=round(commission, 2),
            shipping=round(shipping, 2),
            ad_spend=round(ad_spend, 2),
            calculated_profit=round(profit, 2),
            calculated_margin=round(margin, 2),
            calculated_roas=round(roas, 2),
        ))
    db.commit()

    # 9. notifications - ornek bildirimler
    sample_notifs = [
        ("stock", "Stok Uyarisi", "Akilli Saat Fitness Tracker stoku kritik seviyede (67 adet).", "warning"),
        ("review", "Puan Dususu", "Akilli Saat'in son 7 gunde puani 4.0'dan 3.6'ya dustu.", "critical"),
        ("supplier", "Tedarikci Indirimi", "Alibaba - GZ Wearables Akilli Saat icin %12 indirim sundu.", "info"),
        ("competitor", "Rakip Fiyat Degistirdi", "SesDunyasi kulaklik fiyatini 50 TL dusurdu.", "warning"),
    ]
    for typ, title, msg, sev in sample_notifs:
        db.add(Notification(
            user_id=demo_user.id,
            type=typ,
            title=title,
            message=msg,
            severity=sev,
            read=False,
            created_at=_now(),
        ))
    db.commit()

    # 12. price_alerts - ornek alarm
    db.add(PriceAlert(
        user_id=demo_user.id,
        product_name="Bluetooth Kulaklik",
        target_price=400.0,
        supplier="Alibaba - ShenZhen Audio",
        status="active",
        created_at=_now(),
    ))
    db.commit()

    # 5. review_analyses, 10. reports, 11. chat_history,
    # 13. listing_optimizations, 14. image_analyses
    # -> Bu tablolar bos olarak yaratilir; ilgili AI cagri/router'lar dolduracak.

    print("Database seeded successfully (15 tables + sellers).")
