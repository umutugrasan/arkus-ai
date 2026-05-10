from sqlalchemy import (
    Column, Integer, String, Float, ForeignKey, Text, Date, DateTime, Boolean, JSON
)
from sqlalchemy.orm import relationship
from app.db.database import Base


# 1. users
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password = Column(String)  # password_hash
    store_name = Column(String)
    token = Column(String, unique=True, index=True)
    email_verified = Column(Boolean, default=False)
    verification_code = Column(String, nullable=True)
    created_at = Column(String)

    marketplaces = relationship("Marketplace", back_populates="user")


# Auxiliary - existing seller info from mock_raw.json (kept for backward compat)
class Seller(Base):
    __tablename__ = "sellers"
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    owner = Column(String)
    member_since = Column(String)


# 2. marketplace_connections
class Marketplace(Base):
    __tablename__ = "marketplace_connections"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)  # trendyol, hepsiburada, amazon_tr
    store_name = Column(String)
    store_rating = Column(Float)
    commission_rate = Column(Float)
    ad_spend_30d = Column(Float)
    api_key = Column(String, nullable=True)
    store_url = Column(String, nullable=True)
    status = Column(String, default="connected")  # connected | disconnected | error
    connected_at = Column(String, nullable=True)

    user = relationship("User", back_populates="marketplaces")
    products = relationship("Product", back_populates="marketplace")


# 3. products
class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    product_code = Column(String, index=True)  # ext_id (P001 vb.)
    marketplace_id = Column(Integer, ForeignKey("marketplace_connections.id"))
    name = Column(String)
    category = Column(String)
    price = Column(Float)
    cost = Column(Float)
    stock = Column(Integer)
    sales_30d = Column(Integer, default=0)
    shipping_cost = Column(Float, default=0.0)
    rating = Column(Float, default=0.0)
    review_count = Column(Integer, default=0)
    return_rate = Column(Float, default=0.0)
    image_url = Column(String, nullable=True)

    marketplace = relationship("Marketplace", back_populates="products")
    competitors = relationship("Competitor", back_populates="product")


# 4. reviews
class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True, index=True)
    product_code = Column(String, index=True)
    marketplace_name = Column(String)
    rating = Column(Integer)
    text = Column(Text)
    date = Column(String)
    sentiment = Column(String, nullable=True)   # positive | neutral | negative
    category = Column(String, nullable=True)    # kargo | kalite | fiyat | iade vs.


# 5. review_analyses
class ReviewAnalysis(Base):
    __tablename__ = "review_analyses"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), index=True)
    analysis_type = Column(String)        # short | detailed | custom
    content = Column(Text)                # AI ciktisi
    filters = Column(JSON, nullable=True) # {marketplace, month, last_n} vb.
    created_at = Column(String)


# 6. competitors
class Competitor(Base):
    __tablename__ = "competitors"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    name = Column(String)
    price = Column(Float)
    rating = Column(Float)
    review_count = Column(Integer)
    sales_30d = Column(Integer)
    last_updated = Column(String, nullable=True)

    product = relationship("Product", back_populates="competitors")


# 7. orders
class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    marketplace_name = Column(String)
    quantity = Column(Integer)
    total = Column(Float)
    date = Column(String)
    status = Column(String)  # delivered | pending | returned | cancelled


# 8. financials
class Financial(Base):
    __tablename__ = "financials"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    month = Column(String, index=True)         # 2026-05 vb.
    revenue = Column(Float, default=0.0)
    cost = Column(Float, default=0.0)
    commission = Column(Float, default=0.0)
    shipping = Column(Float, default=0.0)
    ad_spend = Column(Float, default=0.0)
    calculated_profit = Column(Float, default=0.0)
    calculated_margin = Column(Float, default=0.0)
    calculated_roas = Column(Float, default=0.0)


# 9. notifications
class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    type = Column(String)        # stock | review | competitor | supplier vb.
    title = Column(String)
    message = Column(Text)
    severity = Column(String)    # info | warning | critical
    read = Column(Boolean, default=False)
    created_at = Column(String)


# 10. reports
class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    type = Column(String)        # daily | weekly
    title = Column(String)
    content = Column(Text)
    metrics_json = Column(JSON, nullable=True)
    created_at = Column(String)


# 11. chat_history
class ChatHistory(Base):
    __tablename__ = "chat_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    question = Column(Text)
    answer = Column(Text)
    created_at = Column(String)


# 12. price_alerts
class PriceAlert(Base):
    __tablename__ = "price_alerts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    product_name = Column(String)
    target_price = Column(Float)
    supplier = Column(String, nullable=True)
    status = Column(String, default="active")   # active | triggered | cancelled
    created_at = Column(String)


# 13. listing_optimizations
class ListingOptimization(Base):
    __tablename__ = "listing_optimizations"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), index=True)
    original_title = Column(String)
    optimized_title = Column(String)
    keywords = Column(JSON, nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(String)


# 14. image_analyses
class ImageAnalysis(Base):
    __tablename__ = "image_analyses"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), index=True)
    image_url = Column(String)
    score = Column(Float)
    suggestions = Column(Text, nullable=True)
    created_at = Column(String)


# 15. suppliers
class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    product = Column(String)
    current_price = Column(Float)
    min_order = Column(Integer)
    shipping_days = Column(Integer)
    discount_pct = Column(Float)
    last_checked_at = Column(String, nullable=True)
