from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text, Date
from sqlalchemy.orm import relationship
from app.db.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    store_name = Column(String)
    token = Column(String, unique=True, index=True)
    created_at = Column(String)
    
    marketplaces = relationship("Marketplace", back_populates="user")

class Seller(Base):
    __tablename__ = "sellers"
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    owner = Column(String)
    member_since = Column(String)

class Marketplace(Base):
    __tablename__ = "marketplaces"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)  # trendyol, hepsiburada, amazon_tr
    store_name = Column(String)
    store_rating = Column(Float)
    commission_rate = Column(Float)
    ad_spend_30d = Column(Float)
    api_key = Column(String, nullable=True)
    store_url = Column(String, nullable=True)
    
    user = relationship("User", back_populates="marketplaces")
    products = relationship("Product", back_populates="marketplace")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    product_code = Column(String, index=True) # P001 vb.
    marketplace_id = Column(Integer, ForeignKey("marketplaces.id"))
    name = Column(String)
    category = Column(String)
    price = Column(Float)
    cost = Column(Float)
    stock = Column(Integer)
    sales_30d = Column(Integer)
    shipping_cost = Column(Float)
    rating = Column(Float)
    review_count = Column(Integer)
    return_rate = Column(Float)
    
    marketplace = relationship("Marketplace", back_populates="products")
    competitors = relationship("Competitor", back_populates="product")

class Competitor(Base):
    __tablename__ = "competitors"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    name = Column(String)
    price = Column(Float)
    rating = Column(Float)
    review_count = Column(Integer)
    sales_30d = Column(Integer)
    
    product = relationship("Product", back_populates="competitors")

class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True, index=True)
    product_code = Column(String, index=True) # Hangi urun grubuna ait oldugunu bilmek icin
    marketplace_name = Column(String)
    rating = Column(Integer)
    text = Column(Text)
    date = Column(String)

class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    product = Column(String)
    current_price = Column(Float)
    min_order = Column(Integer)
    shipping_days = Column(Integer)
    discount_pct = Column(Float)
