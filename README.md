# Arkus AI — Coklu Pazaryeri Satici Zekasi Paneli

**BTK Hackathon 26 | E-Ticaret Odakli AI Destekli Uygulama**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-async-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Gemini](https://img.shields.io/badge/Gemini-2.5--flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Arkus AI, birden fazla pazaryerinde (Trendyol, Hepsiburada, Amazon TR, N11) satis yapan e-ticaret saticilari icin yapay zeka destekli analiz ve danismanlik platformudur. Otonom ajanlar verileri toplar, analiz eder ve saticiya proaktif strateji onerir.

> **"Veriyi gosteren degil, strateji ureten bir sistem."**

---

## ⚡ Juri Quickstart (30 saniye)

```bash
# 1. Repoyu klonla + GEMINI_API_KEY'i .env'e ekle
git clone https://github.com/yunus-ozdemirr/arkus-aii.git arkus-ai && cd arkus-ai
cp .env.example .env   # sonra .env dosyasini ac, GEMINI_API_KEY satirini doldur

# 2. Tum servisleri ayaga kaldir
docker compose up -d --build

# 3. Tarayicida ac
#    Frontend:  http://localhost:3000  (login: demo@arkus.ai / demo123)
#    Swagger:   http://localhost:8000/docs

# 4. Demo akisini gor
#    - Dashboard -> AI Ozeti (Gemini stream)
#    - Yorum Analizi -> P001 sec -> otomatik AI analiz
#    - AI Chat -> "Bu ay neden karim dustu?"  (function-calling agent)
```

> 📐 **Mimari + BTK Kriterleri Eslemesi:** [**ARCHITECTURE.md**](./ARCHITECTURE.md)
>
> 🎥 **1 Dakikalik Tanitim:** *YouTube linki teslimde eklenecek*

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

## 🔌 Marketplace API Entegrasyonu (Mock → Prod)

Hackathon süresince Trendyol/Hepsiburada/Amazon TR/N11 satıcı paneli API'lerine erişimimiz yok — gerçek satıcı paneli API başvuru süreci haftalar sürer. Çözüm: **gerçek API'nin endpoint yapısını, auth pattern'ini ve response şemasını birebir taklit eden ayrı bir FastAPI servisi** (port 8001).

Bu sadece "demo için mock data" **değil** — production-ready bir **Marketplace Adapter Pattern**:

- ✅ Gerçek pazaryeri API'larındaki gibi `X-API-KEY` header auth
- ✅ Gerçek satıcı paneli endpoint isimleri (`/{marketplace}/products`, `/auth`, `/reviews`, `/store-info`)
- ✅ Trendyol response şemasıyla uyumlu JSON çıktı (`store_name`, `commission_rate`, `products[].competitors[]`)
- ✅ Per-marketplace izole auth (Trendyol/HB/Amazon TR/N11 ayrı slug + ayrı API key havuzu)
- ✅ Auth `403` / unknown marketplace `404` / rate-limit gibi gerçek API error code'larını döner

### Mock pazaryeri endpoint haritası

| Mock Endpoint (`localhost:8001`) | Gerçek Pazaryeri Karşılığı | Auth |
|---|---|---|
| `POST /{slug}/auth` | Mağaza OAuth / HMAC dogrulama | API key body |
| `GET /{slug}/store-info` | Mağaza profil + komisyon ayarları | `X-API-KEY` |
| `GET /{slug}/products` | Ürün listesi (+ rakip snapshot'ları) | `X-API-KEY` |
| `GET /{slug}/reviews?product_id=` | Müşteri yorumları, filtreli | `X-API-KEY` |

`slug`: `trendyol`, `hepsiburada`, `amazon-tr`, `n11`.

### Production geçişi: tek env değişkeni

```bash
# .env (development) — mock servis
MOCK_MARKETPLACE_API_URL=http://mock-api:8001

# .env (production) — gerçek pazaryeri
MOCK_MARKETPLACE_API_URL=https://api.trendyol.com/sapigw
```

Tüm HTTP çağrıları `backend/app/services/marketplace_api.py` içinde tek noktada toplandığı için, gerçek API'ye geçişte **backend kodunda 0 satır değişiklik** gerekir. Kullanıcı zaten kendi gerçek API key'ini `/api/v1/store/connect` endpoint'ine girer; demo key'lerin (`demo-key-trendyol` vb.) yerini gerçek key'ler alır. Frontend, ajan katmanı, calculator, AI servisleri **hiç dokunulmaz**.

> 📐 Sequence diagram + endpoint mapping + production checklist için: [**ARCHITECTURE.md § 4.5**](./ARCHITECTURE.md#45-marketplace-api-adapter-mock--prod-geçiş)

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

## 📊 BTK Hackathon 26 — Degerlendirme Kriterleri Eslemesi

| Kriter | Puan | Arkus AI'da nerede karsiliyor | Detay |
|---|---|---|---|
| Kullanici Degeri | 20 | 17 modul x 80+ endpoint, gercek satici problemine birebir cozum | [`ARCHITECTURE.md#10`](./ARCHITECTURE.md#10-btk-kriterleri-eşlemesi) |
| Teknik Puan | 20 | 4-layer mimari, async FastAPI, Pydantic v2, React 19 + Vite 8 | [`ARCHITECTURE.md#2`](./ARCHITECTURE.md#2-katmanlı-mimari-4-layer) |
| Performans / Dogruluk | 10 | Gemini cascade fallback, AI usage logging, "no fake response" politika | [`ARCHITECTURE.md#9`](./ARCHITECTURE.md#9-performans-önbellek-streaming) |
| Agentic Yapilar | 10 | 3 otonom ajan + function-calling chat, event bus | [`ARCHITECTURE.md#5`](./ARCHITECTURE.md#5-agentic-orkestrasyon) |
| Yenilikcilik | 10 | Conversational commerce + arbitraj + Gemini Vision + Google Search grounding | [`ARCHITECTURE.md#10`](./ARCHITECTURE.md#10-btk-kriterleri-eşlemesi) |
| Kullanici Dostu | 10 | SSE streaming UX, i18n TR/EN, dark mode, lazy load (initial 121KB gzip) | [`ARCHITECTURE.md#9`](./ARCHITECTURE.md#9-performans-önbellek-streaming) |
| Takim Calismasi | 10 | Net FE/BE ayrim, `types/api.ts` kontrati, git workflow | git log |
| Sunum ve Iletisim | 10 | README + ARCHITECTURE + OpenAPI auto-docs + 1dk video + public repo | bu dosya |

**Toplam mimari kanit dokumani:** [ARCHITECTURE.md](./ARCHITECTURE.md) — mermaid diagram + sequence + ERD + modul haritasi + her kritere kod referansi.

## Lisans

MIT — bkz. [LICENSE](./LICENSE)
