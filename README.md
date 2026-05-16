# Arkus AI — Coklu Pazaryeri Satici Zekasi Paneli

**BTK Hackathon 26 | E-Ticaret Odakli AI Destekli Uygulama**

Arkus AI, birden fazla pazaryerinde (Trendyol, Hepsiburada, Amazon TR, N11) satis yapan e-ticaret saticilari icin yapay zeka destekli analiz ve danismanlik platformudur. Otonom ajanlar verileri toplar, analiz eder ve saticiya proaktif strateji onerir.

> **"Veriyi gosteren degil, strateji ureten bir sistem."**

## Problem

E-ticaret saticilari 3-4 farkli pazaryerinde ayri panellere girip verileri kontrol ediyor. Yuzlerce yorumu okuyamiyor, rakipleri takip edemiyor, finansal durumunu analiz edemiyor.

## Cozum

Arkus AI 4 katmanli mimariyle:
1. **Veri Toplama** — Sahte/gercek pazaryeri API'lerinden otomatik veri cekme
2. **Hesaplama Motoru** — Ham veriden kar marji, ROAS, saglik skoru otomatik hesap
3. **Agentic AI** — Otonom ajanlar veri ceker, analiz eder, kullanici sormadan oneri sunar
4. **Sunum** — Dashboard, grafikler, AI chat, bildirimler, raporlar

## Moduller (17+ Modul, 80+ Endpoint)

| Modul | Endpoint Prefix | Aciklama |
|---|---|---|
| Kimlik Dogrulama | `/api/auth` | register/login/me/change-password/update-profile |
| Magaza Yonetimi | `/api/store` | connect/connections/disconnect/sync/sync-all/update-key |
| Dashboard | `/api/dashboard` | overview/marketplace-summary/trends/ai-summary |
| Urun Yonetimi | `/api/products` | list/by-id/compare/top-sellers/low-stock/images |
| Yorum Analizi | `/api/reviews` | filtreli liste/sentiment/analyze/compare/history/analyze-custom |
| Rakip Analizi | `/api/competitors` | by-id/analyze/price-map/track |
| Arbitraj | `/api/arbitrage` | opportunities/by-id/analyze |
| Finansal Analiz | `/api/financials` | overview/by-marketplace/by-product/expenses/cash-flow/analyze |
| Saglik Skoru | `/api/health` | score/breakdown/analyze/history (8 kategori, 0-100) |
| Finansman Rehberi | `/api/finance-guide` | options/eligibility/analyze (KOSGEB, bankalar) |
| Tedarik Avcisi | `/api/sourcing` | suppliers/best-price/opportunities/real-search/alerts CRUD |
| AI Danisman Chat | `/api/chat` | ask/history/clear (function-calling agent + tum context) |
| Bildirimler | `/api/notifications` | list/unread-count/read/read-all/generate |
| Raporlar | `/api/reports` | daily/weekly/list/by-id |
| Listeleme Optimizasyonu | `/api/listing-optimizer` | optimize/keywords/description/history/analyze-current |
| Gorsel Analiz | `/api/image-analyzer` | analyze/suggestions/history (Gemini Vision) |
| Otonom Ajanlar | `/api/agents` | status/run-all/{name}/run |

## Mimari Diyagram

```
                              ┌────────────────────────┐
                              │  Sahte Pazaryeri API   │
                              │  (mock-api, port 8001) │
                              │  Trendyol/HB/Amazon    │
                              └───────────┬────────────┘
                                          │ HTTP (X-API-KEY)
                                          ▼
┌─────────────┐   REST API   ┌────────────────────────┐    Tool Calling    ┌─────────────────┐
│   React +   │ ◄──────────► │    FastAPI Backend     │ ◄─────────────────►│   Gemini 2.5    │
│  Tailwind   │              │      (port 8000)       │                    │  + Web Search   │
│  Recharts   │              │                        │                    │   Grounding     │
└─────────────┘              │  ┌─────────────────┐   │                    └─────────────────┘
                             │  │ Otonom Ajanlar  │   │
                             │  │ Review/Compet./ │   │
                             │  │ Report Agents   │   │
                             │  └─────────────────┘   │
                             │  ┌─────────────────┐   │
                             │  │   PostgreSQL    │   │
                             │  │   (15+ tablo)   │   │
                             │  └─────────────────┘   │
                             └────────────────────────┘
                                          │
                                          │ Adminer (port 8080)
                                          ▼
                                  DB yonetim arayuzu
```

**Veri akisi (tek yon):**
```
mock_raw.json -> mock-api (HTTP) -> backend -> PostgreSQL -> endpoint response
```

Bu mimaride mock-api'yi gercek pazaryeri API'siyle degistirmek tek satirlik degisiklik:
`MOCK_MARKETPLACE_API_URL=https://api.trendyol.com`

## Veritabani

15+ tablo: users, marketplace_connections, products, reviews, review_analyses, competitors, competitor_price_history, orders, financials, notifications, reports, chat_history, price_alerts, listing_optimizations, image_analyses, suppliers, sellers.

## Otonom Ajanlar

| Ajan | Tetikleyici | Cikti |
|---|---|---|
| **ReviewAnalyzerAgent** | Her saatte / yeni yorum | Yorumlari analiz eder, %40+ negatif olunca bildirim atar |
| **CompetitorWatchAgent** | Periyodik | Fiyat tarihcesinden %3+ degisim tespit, bildirim + event |
| **ReportAgent** | Gunluk | Diger ajanlardan event toplayip gunluk rapor uretir |

Ajanlar birbirini tetikleyebilir (event flow): CompetitorWatch -> price_changed event -> ReportAgent rapora dahil eder.

## AI Ozellikleri

- **Gemini 2.5 Flash** (cascade fallback: 2.0 / 1.5)
- **Google Search Grounding** — `/analyze` endpoint'leri webden gercek anlik veri ceker (rakip fiyatlari, tedarikci listesi, sektor benchmark, guncel kredi sartlari)
- **Gemini Vision** — urun gorseli analizi (`/api/image-analyzer/`)
- **Tool-calling Agent** — AI Chat agentic mod, gerektiginde DB araclarini cagirir
- **Cached AI Analizleri** — review_analyses, listing_optimizations, image_analyses tablolarinda gecmis

## Hizli Baslangic

### Docker (onerilen)

`.env` dosyasi olustur:
```bash
GEMINI_API_KEY=your-real-key-from-aistudio.google.com
# Opsiyonel:
# GEMINI_MODEL=gemini-2.5-flash
# AGENT_INTERVAL_SECONDS=3600  # 0 = scheduler kapali
```

Tum mikroservisler tek komutta:
```bash
docker compose up -d --build
```

Servisler:
- **Frontend:** http://localhost:3000
- **Backend API + Swagger:** http://localhost:8000/docs
- **Sahte Pazaryeri API:** http://localhost:8001/docs
- **Adminer (DB):** http://localhost:8080 (sistem: PostgreSQL, sunucu: `db`, kullanici: `arkus`, parola: `arkuspassword`, veritabani: `arkus_db`)

Demo kullanici:
```
Email: demo@arkus.ai
Sifre: demo123
```

Durdurmak icin:
```bash
docker compose down
```

Temiz sifirlamak icin (DB volume dahil):
```bash
docker compose down -v
docker compose up -d --build
```

### Manuel Kurulum

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Mock pazaryeri API (ayri terminal)
cd backend
uvicorn mock_api.main:app --reload --port 8001

# Frontend (ayri terminal)
cd frontend
npm install && npm run dev
```

## Teknolojiler

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Recharts, Framer Motion
- **Backend:** Python 3.11, FastAPI, SQLAlchemy, httpx
- **AI:** Google Gemini API (2.5 Flash + Vision + Google Search Grounding)
- **Database:** PostgreSQL 15 (Docker volume)
- **Mock Marketplace:** Ayri FastAPI servisi (port 8001), X-API-KEY auth simulasyonu
- **Container:** Docker Compose multi-service (db + mock-api + backend + frontend + adminer)
- **i18n:** Turkce / Ingilizce dil destegi

## Repo Yapisi

```
arkus-ai/
├── backend/
│   ├── app/
│   │   ├── agents/              # Otonom ajanlar + orchestrator + scheduler
│   │   ├── data/                # mock_raw.json (mock-api'nin veri kaynagi)
│   │   ├── db/                  # SQLAlchemy modeller + seed
│   │   ├── routers/             # 17 modul router
│   │   ├── services/            # calculator, gemini_service, marketplace_api
│   │   ├── dependencies.py
│   │   └── main.py
│   ├── mock_api/                # Sahte Pazaryeri API (port 8001)
│   │   ├── main.py
│   │   └── Dockerfile
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/          # UI bileşenleri (layout, shared, ui)
│   │   ├── context/             # Auth, Toast, i18n context
│   │   ├── i18n/                # Turkce/Ingilizce ceviriler
│   │   ├── pages/               # Sayfa bileşenleri (17+ sayfa)
│   │   ├── services/            # API servis katmani
│   │   └── utils/               # Yardimci fonksiyonlar
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Test Akisi (Swagger)

1. `POST /api/auth/login` body `{"email": "demo@arkus.ai", "password": "demo123"}` → token
2. `GET /api/dashboard/overview?token=...` → genel metrikler
3. `GET /api/dashboard/ai-summary?token=...` → Gemini'den gunaydin ozeti + web piyasa notu
4. `GET /api/reviews/P001/analyze?detail=detailed&token=...` → yorum analizi (cache'li)
5. `POST /api/notifications/generate?token=...` → otomatik bildirim tespiti (rakip fiyat, stok, vs.)
6. `GET /api/sourcing/real-search/Bluetooth Kulaklik?token=...` → Google Search ile gercek tedarikci fiyatlari
7. `POST /api/agents/run-all?token=...` → 3 ajan sirayla calisir, event flow ile rapora doner

## Lisans

MIT
