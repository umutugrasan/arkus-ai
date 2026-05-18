"""
SourcingAgent + ReviewResponseAgent davranis testleri.

Gercek DB ile (SQLite) test — TestClient fixture'i kullanmiyoruz cunku
agent'lari direkt cagirmamiz ve DB state'i fixture'larla kurmamiz daha izole.
"""

import asyncio
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

from app.db.models import User, Product, Supplier, Review, PriceAlert, Notification
from app.agents.sourcing_agent import SourcingAgent
from app.agents.review_response_agent import ReviewResponseAgent


# ─── Yardimcilar ─────────────────────────────────────────────────────────────

def _db_session():
    """Test DB session — conftest'in setup ettigi SQLite uzerinden."""
    from app.db.database import SessionLocal, Base, engine
    Base.metadata.create_all(bind=engine)
    return SessionLocal()


def _make_user(db, email="agent-test@x.com") -> User:
    u = db.query(User).filter(User.email == email).first()
    if u:
        return u
    u = User(name="Agent Test", email=email, password="hash",
            store_name="Test Store", email_verified=True, created_at="2026-05-18")
    db.add(u); db.commit(); db.refresh(u)
    return u


def _clear_db_for_user(db, user_id):
    """Test izolasyonu: bu user'a ait DB state'i sifirla.

    NOT: Review.product_code yabanci anahtar olmadigi icin orphan kalabilir.
    Test guvenligi icin test product_code'larini agresif sekilde temizliyoruz.
    """
    db.query(Notification).filter(Notification.user_id == user_id).delete()
    db.query(PriceAlert).filter(PriceAlert.user_id == user_id).delete()
    # Bilinen test product_code'lari (fixture'larda kullanilan)
    test_codes = ["P-RR", "P-SRC"]
    db.query(Review).filter(Review.product_code.in_(test_codes)).delete(
        synchronize_session=False
    )
    db.query(Product).filter(Product.user_id == user_id).delete()
    db.query(Supplier).delete()
    db.commit()


# ─── SourcingAgent testleri ─────────────────────────────────────────────────

@pytest.fixture
def sourcing_setup():
    """Test fixture: temiz DB + user + 2 supplier + 1 product"""
    db = _db_session()
    u = _make_user(db, "sourcing-test@x.com")
    _clear_db_for_user(db, u.id)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    # 2 supplier: biri indirimli (son 24 saatte guncel), biri indirimsiz
    db.add_all([
        Supplier(name="Alibaba GZ", product="Bluetooth Kulaklik",
                 current_price=100.0, min_order=50, shipping_days=14,
                 discount_pct=15.0, last_checked_at=now),
        Supplier(name="Toptanbul X", product="Bluetooth Kulaklik",
                 current_price=140.0, min_order=20, shipping_days=3,
                 discount_pct=0, last_checked_at=now),
    ])
    # Kullanicinin urunu: mevcut maliyet 130 TL (Alibaba'da 85 TL → %35 tasarruf)
    db.add(Product(
        user_id=u.id, product_code="P-SRC", marketplace_id=None,
        name="Bluetooth Kulaklik Pro",
        category="Elektronik", price=200.0, cost=130.0,
        stock=50, sales_30d=30,
    ))
    db.commit()
    yield db, u
    _clear_db_for_user(db, u.id)
    db.close()


def test_sourcing_detects_fresh_discount(sourcing_setup):
    db, u = sourcing_setup
    agent = SourcingAgent()
    result = asyncio.run(agent.run(u.id, db))
    assert result.status == "ok"
    assert result.notifications_created >= 1
    # Indirim bildirimi olusmus mu?
    notifs = db.query(Notification).filter(
        Notification.user_id == u.id,
        Notification.type == "tedarikci_indirimi",
    ).all()
    assert len(notifs) >= 1
    assert "Alibaba GZ" in notifs[0].title
    # Event yayinlandi mi?
    events = [e for e in result.events if e.type == "supplier_discount"]
    assert len(events) >= 1


def test_sourcing_detects_cheaper_alternative(sourcing_setup):
    db, u = sourcing_setup
    agent = SourcingAgent()
    result = asyncio.run(agent.run(u.id, db))
    # Kullanicinin product.cost = 130, Alibaba discounted_price = 85 → %34 tasarruf
    cheap_alts = result.details.get("cheaper_alternatives", [])
    assert len(cheap_alts) >= 1
    alt = cheap_alts[0]
    assert alt["product_code"] == "P-SRC"
    assert alt["savings_pct"] > 10
    # Notification olusmus mu?
    notifs = db.query(Notification).filter(
        Notification.user_id == u.id,
        Notification.type == "ucuz_tedarikci",
    ).all()
    assert len(notifs) >= 1


def test_sourcing_triggers_active_price_alert(sourcing_setup):
    db, u = sourcing_setup
    # Aktif alarm ekle: target_price 90 TL, Alibaba'da 85 TL → tetiklenmeli
    alert = PriceAlert(
        user_id=u.id, product_name="Bluetooth Kulaklik",
        target_price=90.0, supplier=None, status="active",
        created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    )
    db.add(alert); db.commit(); db.refresh(alert)

    agent = SourcingAgent()
    result = asyncio.run(agent.run(u.id, db))
    triggered = result.details.get("triggered_alerts", [])
    assert len(triggered) == 1
    assert triggered[0]["product_name"] == "Bluetooth Kulaklik"
    # Alert status guncellendi mi?
    db.refresh(alert)
    assert alert.status == "triggered"
    # Critical severity ile bildirim
    notifs = db.query(Notification).filter(
        Notification.user_id == u.id,
        Notification.type == "fiyat_alarmi",
    ).all()
    assert len(notifs) == 1
    assert notifs[0].severity == "critical"


def test_sourcing_idempotent_no_duplicate_notif(sourcing_setup):
    """Aynı tick'te tekrar calistirilirsa duplicate bildirim atmamali."""
    db, u = sourcing_setup
    agent = SourcingAgent()
    asyncio.run(agent.run(u.id, db))
    first_count = db.query(Notification).filter(
        Notification.user_id == u.id
    ).count()
    # Ikinci tick — yeni bildirim olusmamali
    asyncio.run(agent.run(u.id, db))
    second_count = db.query(Notification).filter(
        Notification.user_id == u.id
    ).count()
    assert first_count == second_count


def test_sourcing_no_user_products_no_alternatives(sourcing_setup):
    """Kullanici urunu yoksa 'ucuz tedarikci' bildirimi olusmamali."""
    db, u = sourcing_setup
    # Tum product'lari sil
    db.query(Product).filter(Product.user_id == u.id).delete()
    db.commit()
    agent = SourcingAgent()
    result = asyncio.run(agent.run(u.id, db))
    assert result.status == "ok"
    cheap_alts = result.details.get("cheaper_alternatives", [])
    assert len(cheap_alts) == 0


# ─── ReviewResponseAgent testleri ────────────────────────────────────────────

@pytest.fixture
def review_response_setup():
    """Test fixture: user + 1 product + 2 negatif + 1 pozitif yorum."""
    db = _db_session()
    u = _make_user(db, "rr-test@x.com")
    _clear_db_for_user(db, u.id)

    db.add(Product(
        user_id=u.id, product_code="P-RR", marketplace_id=None,
        name="Test Urun", category="Test",
        price=100.0, cost=60.0, stock=10, sales_30d=5,
    ))
    today_iso = datetime.now().date().isoformat()
    db.add_all([
        Review(product_code="P-RR", marketplace_name="trendyol",
               rating=1, text="Cok kotuydu, kargo geç geldi", date=today_iso),
        Review(product_code="P-RR", marketplace_name="hepsiburada",
               rating=2, text="Beklentilerimi karsilamadi", date=today_iso),
        Review(product_code="P-RR", marketplace_name="trendyol",
               rating=5, text="Harikaydi!", date=today_iso),  # pozitif - islenmemeli
    ])
    db.commit()
    yield db, u
    _clear_db_for_user(db, u.id)
    db.close()


def test_review_response_drafts_negative_only(review_response_setup):
    """Sadece rating <= 2 yorumlara taslak uretilir, pozitifler atlanir."""
    db, u = review_response_setup

    # Gemini'yi mock'la — gercek API cagirmasin
    async def fake_ask_gemini(prompt, system, **kwargs):
        return "Merhaba, yasadiginiz sorun icin uzgunuz. Iletisime gecelim, cozelim."

    with patch("app.agents.review_response_agent.ask_gemini", new=fake_ask_gemini):
        agent = ReviewResponseAgent()
        result = asyncio.run(agent.run(u.id, db))

    assert result.status == "ok"
    # 2 negatif yorum vardi, 2 taslak olusmali (pozitif atlandi)
    assert result.notifications_created == 2
    notifs = db.query(Notification).filter(
        Notification.user_id == u.id,
        Notification.type == "yorum_cevap_taslagi",
    ).all()
    assert len(notifs) == 2
    # Event'ler yayinlandi
    events = [e for e in result.events if e.type == "review_response_drafted"]
    assert len(events) == 2


def test_review_response_idempotent(review_response_setup):
    """Ayni yorum icin tekrar taslak uretilmez."""
    db, u = review_response_setup

    async def fake_ask_gemini(prompt, system, **kwargs):
        return "Taslak metin"

    with patch("app.agents.review_response_agent.ask_gemini", new=fake_ask_gemini):
        agent = ReviewResponseAgent()
        # Ilk tick
        r1 = asyncio.run(agent.run(u.id, db))
        # Ikinci tick — ayni yorumlara tekrar taslak olusturmamali
        r2 = asyncio.run(agent.run(u.id, db))

    assert r1.notifications_created == 2
    assert r2.notifications_created == 0


def test_review_response_max_drafts_per_tick(review_response_setup):
    """Tick basina MAX 5 taslak. 10 yorum varsa sadece 5 islenir."""
    db, u = review_response_setup
    today_iso = datetime.now().date().isoformat()
    # 8 ek negatif yorum ekle (toplam 10 negatif)
    for i in range(8):
        db.add(Review(product_code="P-RR", marketplace_name="trendyol",
                      rating=1, text=f"Kotu yorum #{i}", date=today_iso))
    db.commit()

    async def fake_ask_gemini(prompt, system, **kwargs):
        return "Taslak"

    with patch("app.agents.review_response_agent.ask_gemini", new=fake_ask_gemini):
        agent = ReviewResponseAgent()
        result = asyncio.run(agent.run(u.id, db))

    assert result.notifications_created == ReviewResponseAgent.MAX_DRAFTS_PER_TICK


def test_review_response_skips_ai_fallback_message(review_response_setup):
    """AI 'Gercek AI/web analizi alinamadi' mesajiyla donerse taslak olusturmaz."""
    db, u = review_response_setup

    async def fake_failed_ask(prompt, system, **kwargs):
        return "Gercek AI/web analizi su anda alinamadi. Sebep: quota dolu."

    with patch("app.agents.review_response_agent.ask_gemini", new=fake_failed_ask):
        agent = ReviewResponseAgent()
        result = asyncio.run(agent.run(u.id, db))

    # AI fail mesaji → taslak yok
    assert result.notifications_created == 0


def test_review_response_no_products_no_drafts(review_response_setup):
    """Kullanicinin urunu yoksa hicbir taslak uretilmez."""
    db, u = review_response_setup
    db.query(Product).filter(Product.user_id == u.id).delete()
    db.commit()

    agent = ReviewResponseAgent()
    result = asyncio.run(agent.run(u.id, db))
    assert result.status == "ok"
    assert result.notifications_created == 0


def test_review_response_only_recent(review_response_setup):
    """LOOKBACK_DAYS'den eski yorumlar islenmemeli."""
    db, u = review_response_setup
    # 30 gun once tarihli ek negatif yorum
    old_date = (datetime.now() - timedelta(days=30)).date().isoformat()
    db.add(Review(product_code="P-RR", marketplace_name="trendyol",
                  rating=1, text="Eski yorum", date=old_date))
    db.commit()

    async def fake_ask_gemini(prompt, system, **kwargs):
        return "Taslak"

    with patch("app.agents.review_response_agent.ask_gemini", new=fake_ask_gemini):
        agent = ReviewResponseAgent()
        result = asyncio.run(agent.run(u.id, db))

    # 2 yeni yorum + 1 eski yorum vardi; sadece 2 yeni islenmeli
    assert result.notifications_created == 2
