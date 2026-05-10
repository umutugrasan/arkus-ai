from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import (
    auth, store, dashboard, products, reviews,
    competitors, arbitrage, financials, health_score,
    finance_guide, sourcing, chat, notifications, reports
)

app = FastAPI(
    title="Basiret AI - Satici Zekasi API",
    description="Coklu pazaryeri satici analiz ve danismanlik platformu",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # nginx reverse proxy arkasında olduğu için güvenli
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Kimlik Dogrulama"])
app.include_router(store.router, prefix="/api/store", tags=["Magaza Yonetimi"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(products.router, prefix="/api/products", tags=["Urun Yonetimi"])
app.include_router(reviews.router, prefix="/api/reviews", tags=["Yorum Analizi"])
app.include_router(competitors.router, prefix="/api/competitors", tags=["Rakip Analizi"])
app.include_router(arbitrage.router, prefix="/api/arbitrage", tags=["Arbitraj"])
app.include_router(financials.router, prefix="/api/financials", tags=["Finansal Analiz"])
app.include_router(health_score.router, prefix="/api/health", tags=["Saglik Skoru"])
app.include_router(finance_guide.router, prefix="/api/finance-guide", tags=["Finansman Yonlendirme"])
app.include_router(sourcing.router, prefix="/api/sourcing", tags=["Tedarik Avcisi"])
app.include_router(chat.router, prefix="/api/chat", tags=["AI Danismann"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Bildirimler"])
app.include_router(reports.router, prefix="/api/reports", tags=["Raporlar"])


@app.get("/")
def root():
    return {"message": "Basiret AI API aktif", "version": "1.0.0"}