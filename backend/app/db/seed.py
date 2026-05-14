"""
Database seeding — TAM API MANTIGI.
Seed verisi mock-api (port 8001) HTTP endpoint'lerinden cekilir.
JSON dosyalarini direkt okumak YOK. Tek veri akisi:
  mock_raw.json -> mock-api -> backend (HTTP) -> PostgreSQL
"""

import os
import random
import logging
import time
from datetime import datetime, timedelta
import httpx
from sqlalchemy.orm import Session
from app.db.models import (
    User, Seller, Marketplace, Product, Competitor, Review, Supplier,
    Order, Financial, Notification, PriceAlert, CompetitorPriceHistory,
)
from app.db.database import engine, Base
from app.security import hash_password

logger = logging.getLogger(__name__)

MOCK_API_BASE = os.getenv("MOCK_MARKETPLACE_API_URL", "http://mock-api:8001")
DEMO_KEYS = {
    "trendyol": "demo-key-trendyol",
    "hepsiburada": "demo-key-hepsiburada",
    "amazon_tr": "demo-key-amazon_tr",
    "n11": "demo-key-n11",
}
SLUG = {"trendyol": "trendyol", "hepsiburada": "hepsiburada", "amazon_tr": "amazon-tr", "n11": "n11"}


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _api_get(path: str, headers: dict = None, retries: int = 5, delay: float = 2.0):
    """Mock-api'ye GET. Healthcheck race condition icin retry'li."""
    url = f"{MOCK_API_BASE}{path}"
    last_err = None
    for attempt in range(retries):
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(url, headers=headers or {})
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            last_err = e
            logger.warning(f"mock-api {path} attempt {attempt+1}/{retries} failed: {type(e).__name__}: {e}")
            time.sleep(delay)
    raise RuntimeError(f"mock-api'ye ulasilamadi ({path}): {last_err}")


def seed_db(db: Session):
    # Demo kullanici varsa tekrar seed etme
    if db.query(User).filter(User.email == "demo@basiret.ai").first():
        return

    logger.info("Seeding via mock-api at %s", MOCK_API_BASE)

    # 1. users (her zaman lokal — kullanici, mock-api'nin urunu degil)
    demo_user = User(
        name="Demo Kullanici",
        email="demo@basiret.ai",
        password=hash_password("demo123"),
        store_name="Demo Store",
        email_verified=True,
        created_at="2026-05-10",
    )
    db.add(demo_user)
    db.commit()
    db.refresh(demo_user)

    # Auxiliary - seller (mock-api'den)
    s_data = _api_get("/seller")
    seller = Seller(
        id=s_data.get("id", "S001"),
        name=s_data.get("name", "Unknown"),
        owner=s_data.get("owner", "Unknown"),
        member_since=s_data.get("member_since", ""),
    )
    db.add(seller)
    db.commit()

    # 2. marketplace_connections + 3. products + 6. competitors
    mp_list = _api_get("/marketplaces").get("marketplaces", [])
    marketplace_objs = {}
    products_by_code = {}

    for mp_info in mp_list:
        slug = mp_info["slug"]
        internal = mp_info["internal_name"]
        api_key = DEMO_KEYS.get(internal, "")
        headers = {"X-API-KEY": api_key}

        mp_data = _api_get(f"/{slug}/products", headers=headers)

        marketplace = Marketplace(
            user_id=demo_user.id,
            name=internal,
            store_name=mp_data.get("store_name", ""),
            store_rating=mp_data.get("store_rating", 0.0),
            commission_rate=mp_data.get("commission_rate", 0.0),
            ad_spend_30d=mp_data.get("ad_spend_30d", 0.0),
            api_key=api_key,
            store_url=f"https://{internal}.com/demo-store",
            status="connected",
            connected_at="2026-05-01",
        )
        db.add(marketplace)
        db.commit()
        db.refresh(marketplace)
        marketplace_objs[internal] = marketplace

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
            products_by_code[(internal, prod_data.get("id"))] = product

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

                # 14 gunluk fiyat tarihcesi (deterministik salinim)
                base_price = comp_data.get("price", 0)
                name_seed = sum(ord(c) for c in (comp_data.get("name", "") or ""))
                for d in range(14, 0, -1):
                    day = (datetime.now().date() - timedelta(days=d))
                    offset_pct = (((name_seed >> (d % 7)) & 0xF) / 15.0 - 0.5) * 0.08
                    historical = round(base_price * (1 + offset_pct), 2)
                    db.add(CompetitorPriceHistory(
                        product_id=product.id,
                        competitor_name=comp_data.get("name"),
                        price=historical,
                        rating=comp_data.get("rating"),
                        captured_at=day.isoformat(),
                    ))
                db.add(CompetitorPriceHistory(
                    product_id=product.id,
                    competitor_name=comp_data.get("name"),
                    price=base_price,
                    rating=comp_data.get("rating"),
                    captured_at=datetime.now().date().isoformat(),
                ))
            db.commit()

    # 4. reviews (her pazaryeri icin ayri cek)
    for mp_info in mp_list:
        slug = mp_info["slug"]
        internal = mp_info["internal_name"]
        api_key = DEMO_KEYS.get(internal, "")
        headers = {"X-API-KEY": api_key}
        rev_data = _api_get(f"/{slug}/reviews", headers=headers)
        for r in rev_data.get("reviews", []):
            review = Review(
                product_code=r.get("product_id"),
                marketplace_name=internal,
                rating=r.get("rating"),
                text=r.get("text"),
                date=r.get("date"),
                sentiment=None,
                category=None,
            )
            db.add(review)
    db.commit()

    # 15. suppliers (mock-api'den)
    sup_resp = _api_get("/suppliers")
    for sup_data in sup_resp.get("suppliers", []):
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

    # 7. orders - urun satislarindan turetilmis (cross-pazaryeri olduk icin lokal mantik)
    statuses = ["delivered", "delivered", "delivered", "pending", "returned"]
    today = datetime.now().date()
    for (mp_name, _code), product in products_by_code.items():
        sales = product.sales_30d or 0
        order_count = max(1, sales // 20)
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

    # 8. financials - son 3 ay agregasyon
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

    # 9. notifications - basit ornek (gercek tespit /generate ile yapilir)
    sample_notifs = [
        ("stock", "Stok Uyarisi", "Akilli Saat Fitness Tracker stoku kritik seviyede.", "warning"),
        ("supplier", "Tedarikci Indirimi", "Alibaba - GZ Wearables Akilli Saat icin %12 indirim sundu.", "info"),
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

    # 12. price_alerts ornek
    db.add(PriceAlert(
        user_id=demo_user.id,
        product_name="Bluetooth Kulaklik",
        target_price=400.0,
        supplier="Alibaba - ShenZhen Audio",
        status="active",
        created_at=_now(),
    ))
    db.commit()

    logger.info("Database seeded successfully via mock-api (15 tables + sellers).")
    print("Database seeded successfully via mock-api (15 tables + sellers).")
