# Arkus AI — Coklu Pazaryeri Satici Zekasi Paneli

**BTK Hackathon 26 | E-Ticaret Odakli AI Destekli Uygulama**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-async-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Gemini](https://img.shields.io/badge/Gemini-2.5--flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![Cloud Run](https://img.shields.io/badge/Google_Cloud-Run-4285F4?logo=googlecloud&logoColor=white)](https://cloud.google.com/run)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Arkus AI, birden fazla pazaryerinde (Trendyol, Hepsiburada, Amazon TR, N11) satis yapan e-ticaret saticilari icin yapay zeka destekli analiz ve danismanlik platformudur. Otonom ajanlar verileri toplar, analiz eder ve saticiya proaktif strateji onerir.

> **"Veriyi gosteren degil, strateji ureten bir sistem."**

---

## 🚀 Canli Demo

> **[https://arkus.tr](https://arkus.tr)** — Google Cloud Run uzerinde production deployment.
>
> Demo hesap: `demo@arkus.ai` / `demo123`

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
#    Canli:     https://arkus.tr

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

## Moduller (17 Modul · 19 Router · 93 Endpoint)

| Modul | Endpoint Prefix | Aciklama |
|---|---|---|
| Kimlik Dogrulama | `/api/v1/auth` | register/login/refresh/me/change-password/update-profile/verify-email/forgot-password |
| Magaza Yonetimi | `/api/v1/store` | connect/connections/disconnect/sync/sync-all/update-key |
| Dashboard | `/api/v1/dashboard` | overview/marketplace-summary/trends/ai-summary (+ SSE stream) |
| Urun Yonetimi | `/api/v1/products` | list/by-id/compare/top-sellers/low-stock/images |
| Yorum Analizi | `/api/v1/reviews` | filtreli liste/sentiment/analyze/compare/history/analyze-custom (+ SSE) |
| Rakip Analizi | `/api/v1/competitors` | by-id/analyze/price-map/track |
| Arbitraj | `/api/v1/arbitrage` | opportunities/by-id/analyze |
| Finansal Analiz | `/api/v1/financials` | full/overview/by-marketplace/by-product/expenses/cash-flow/analyze |
| Saglik Skoru | `/api/v1/health-score` | score/breakdown/trends/recommendations (8 kategori, 0-100) |
| Finansman Rehberi | `/api/v1/finance-guide` | options/eligibility/analyze (KOSGEB, bankalar) |
| Tedarik Avcisi | `/api/v1/sourcing` | suppliers/best-price/opportunities/real-search/scrape/alerts CRUD |
| AI Danisman Chat | `/api/v1/chat` | ask/history/clear (+ SSE) — function-calling agent |
| Bildirimler | `/api/v1/notifications` | list/unread-count/read/read-all/generate |
| Raporlar | `/api/v1/reports` | daily/weekly/generate/list/by-id/delete (+ SSE) |
| Listeleme Optimizasyonu | `/api/v1/listing-optimizer` | optimize/keywords/description/history/analyze-current |
| Gorsel Analiz | `/api/v1/image-analyzer` | analyze/suggestions/history (Gemini Vision) |
| Otonom Ajanlar | `/api/v1/agents` | status/run-all/{name}/run |

> Ek olarak: `/api/v1/uploads` (gorsel yukleme) ve `/health` (liveness/readiness probe). Toplam **19 router · 93 endpoint**.

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
                             │  │ 5 Otonom Ajan + │   │                              ▲
                             │  │  Chat Agent     │   │                              │
                             │  │ (orchestrator)  │   │              ┌───────────────┴────────────┐
                             │  └─────────────────┘   │              │ Amac-bazli Key Havuzu      │
                             │  ┌─────────────────┐   │              │ agents·chat·analyze·vision │
                             │  │   PostgreSQL    │   │              └────────────────────────────┘
                             │  │   (19 tablo)    │   │
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

> 📐 Sequence diagram + endpoint mapping + production checklist için: [**ARCHITECTURE.md § 4.5**](./ARCHITECTURE.md)

## Veritabani

**19 tablo** (SQLAlchemy ORM, PostgreSQL 15): `users`, `sellers`, `marketplace_connections`, `products`, `reviews`, `review_analyses`, `competitors`, `competitor_price_history`, `orders`, `financials`, `notifications`, `reports`, `chat_history`, `price_alerts`, `listing_optimizations`, `image_analyses`, `suppliers`, `audit_logs` (denetim izi: login / parola / API key degisiklikleri), `ai_usage_logs` (her Gemini cagrisi: endpoint, model, sure, hata tipi).

Tablolar uygulama acilisinda `Base.metadata.create_all` ile olusturulur; `seed.py` mock-api'den idempotent seed yapar.

## Otonom Ajanlar

`orchestrator.py` 5 ajani sirayla calistirir; ajanlar bir **event bus** uzerinden birbirini besler. `scheduler.py` periyodik tetikler (`AGENT_INTERVAL_SECONDS`, `0` = kapali) — ayrica `/api/v1/agents/run-all` ile manuel.

| Ajan | Tetikleyici | Cikti |
|---|---|---|
| **ReviewAnalyzerAgent** | Periyodik / yeni yorum | Yorumlari analiz eder; %40+ negatif olunca bildirim + `high_negative_reviews` event |
| **CompetitorWatchAgent** | Periyodik | Fiyat tarihcesinden %3+/%5+ degisim tespit eder; bildirim + `price_changed` event |
| **SourcingAgent** | `price_changed` event'i | Fiyat dususunde daha ucuz tedarikci arar (AliExpress / Trendyol), marj onerisi sunar |
| **ReviewResponseAgent** | `high_negative_reviews` event'i | Negatif yorumlara taslak yanit uretir, bildirime ekler |
| **ReportAgent** | Gunluk | Tum ajanlardan event toplayip yonetici raporu uretir |

Ayrica **`arkus_agent.py`** — AI Chat'in function-calling konusma ajani (pipeline'da degil; `/api/v1/chat` cagirir, 6 DB aracini gerektiginde kullanir).

## AI Ozellikleri

- **Gemini 2.5 Flash** (cascade fallback: 2.0 / 1.5)
- **Amac-bazli API key havuzu** — 5 izole pool (`agents`, `chat`, `analyze`, `vision`, `default`). Her pool icinde round-robin; 429'da ilgili key 60 sn cooldown'a alinir; pool tukenince `default`'a duser. Yuksek istek kapasitesi + demo sirasinda chat'in kotaya takilmamasi icin **chat pool izole**.
- **Google Search Grounding** — `/analyze` endpoint'leri webden gercek anlik veri ceker (rakip fiyatlari, tedarikci listesi, sektor benchmark, guncel kredi sartlari)
- **Gemini Vision** — urun gorseli analizi (`/api/v1/image-analyzer/`)
- **Tool-calling Agent** — AI Chat agentic mod, gerektiginde 6 DB aracini cagirir
- **Cached AI Analizleri** — `review_analyses`, `listing_optimizations`, `image_analyses` tablolarinda gecmis (7 gun TTL)

## 🔎 Tedarik Avcisi & Web Scraping

`Tedarik Avcisi` modulu bir urun icin gercek toptan tedarik fiyatlarini bulur. Cok katmanli arama zinciri — `backend/app/services/scrapers/`:

- **Trendyol perakende fiyati** — production'da `ScraperAPI` HTTP render API ile JS-render edilmis arama sayfasi cekilir; local'de dogrudan Playwright.
- **AliExpress** — resmi Affiliate/DS API (`ALIEXPRESS_APP_KEY` varsa) → yoksa Playwright fallback.
- **Gemini toptan arama** — Google Search grounding ile Alibaba / 1688 / DHgate toptan fiyatlari (token limitinde kirpilan JSON yanitini kurtaran tolerant parser).
- Sonuclar **"Satis Fiyati"** (Trendyol perakende) ve **"Toptanci Fiyatlari"** (web/B2B) olarak ayrilir, kar marji hesaplanir.

> Production'da Chromium fallback'leri **kapalidir** (Cloud Run bellek koruması). `SCRAPER_API_KEY` tanimliysa yalnizca hafif HTTP yollari kullanilir; aksi halde local'de Playwright devreye girer.

## Hizli Baslangic

### Docker (onerilen)

`.env` dosyasi olustur:
```bash
GEMINI_API_KEY=your-real-key-from-aistudio.google.com
# Opsiyonel:
# GEMINI_MODEL=gemini-2.5-flash
# AGENT_INTERVAL_SECONDS=3600  # 0 = scheduler kapali
# SCRAPER_API_KEY=...          # Tedarik Avcisi web scraping (opsiyonel)
# GEMINI_API_KEYS_CHAT=k1,k2   # Chat icin izole pool (opsiyonel)
# GEMINI_API_KEYS_AGENTS=...
# GEMINI_API_KEYS_ANALYZE=...
# GEMINI_API_KEYS_VISION=...
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

## ☁️ Production Deployment (Google Cloud Run)

Proje **Google Cloud Run** uzerinde 3 ayri servis olarak calisir; veritabani **Cloud SQL (PostgreSQL)**. Canli URL: **[https://arkus.tr](https://arkus.tr)**.

| Servis | Bolge | Not |
|---|---|---|
| `mock-api-service` | `europe-west3` | Sahte pazaryeri API |
| `backend-service` | `europe-west3` | FastAPI · 2 CPU / 2 Gi · Cloud SQL'e bagli |
| `frontend-service` | `europe-west1` | Nginx + statik build (`VITE_API_URL` build-time gomulu) |

Cloud SQL instance: `gen-lang-client-0173678969:europe-west3:arkus-db` (PostgreSQL 15).

### CI/CD — `.github/workflows/deploy.yml`

`main` branch'ine push otomatik tetiklenir:

```
mock-api deploy (8001)
        ↓ url'i capture
backend deploy (8080, Cloud SQL'e bagli, MOCK_API_URL set)
        ↓ url'i capture
frontend deploy (Vite build-arg ile VITE_API_URL gomulu)
        ↓
backend CORS'u arkus.tr + frontend-service URL'iyle sikilastir
```

### Gerekli GitHub Secrets

| Secret | Amaç |
|---|---|
| `GCP_PROJECT_ID` | GCP proje ID |
| `GCP_SA_KEY` | Service account JSON key (Cloud Run Admin + Artifact Registry Writer) |
| `JWT_SECRET` | Production JWT (32+ kar.) — boot'ta validate edilir |
| `DATABASE_URL` | `postgresql+psycopg://...?host=/cloudsql/<instance>` |
| `GEMINI_API_KEY` | Tek-key fallback |
| `GEMINI_API_KEYS_AGENTS` / `_CHAT` / `_ANALYZE` / `_VISION` / `_DEFAULT` | Amac-bazli havuzlar (virgulle ayrilmis) |
| `SCRAPER_API_KEY` | Production'da Trendyol render — Playwright/Chromium kapatma sinyali |

### CI Gating — `.github/workflows/pr-checks.yml`

`main`'e PR acildiginda gatekeeper iki is olarak calisir:

- **backend-check** — `py_compile` (tum app + mock_api), ardindan SQLite + dummy secret'larla `pytest -q` smoke suite
- **frontend-check** — `tsc -b --pretty false` (TypeScript hatalari) + `vite build` (production bundle)

Iki kontrol de gecmeden merge edilemez.

### Local vs Production env farklari

| Degisken | Local (docker compose) | Production (Cloud Run) |
|---|---|---|
| `APP_ENV` | `development` | `production` |
| `DATABASE_URL` | Compose `db` servisi | Cloud SQL unix socket |
| `MOCK_MARKETPLACE_API_URL` | `http://mock-api:8001` | mock-api-service Cloud Run URL |
| `CORS_ORIGINS` | `*` | `https://arkus.tr,https://www.arkus.tr,<frontend-service-url>` |
| `SCRAPER_API_KEY` | Bos (Playwright fallback aktif) | Set (Chromium kapali, HTTP render) |
| `AGENT_INTERVAL_SECONDS` | `3600` veya `0` | `3600` |
| Gemini pool'lar | Tek `GEMINI_API_KEY` yetebilir | 5 ayri pool secret'lari |

## Teknolojiler

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Recharts, Framer Motion, react-router 7
- **Backend:** Python 3.11, FastAPI, SQLAlchemy 2.x, Pydantic v2, httpx, slowapi (rate limit), structlog
- **AI:** Google Gemini API (2.5 Flash + Vision + Google Search Grounding), amac-bazli key havuzu
- **Web Scraping:** ScraperAPI (HTTP render), Playwright + playwright-stealth, curl_cffi, BeautifulSoup / lxml
- **Database:** PostgreSQL 15 — local'de Docker volume, production'da Cloud SQL
- **Mock Marketplace:** Ayri FastAPI servisi (port 8001), X-API-KEY auth simulasyonu
- **Container / Deploy:** Docker Compose (local) · Google Cloud Run + GitHub Actions CI/CD (production)
- **i18n:** Turkce / Ingilizce dil destegi

## Repo Yapisi

```
arkus-ai/
├── backend/
│   ├── app/
│   │   ├── agents/              # 5 otonom ajan + arkus_agent (chat) + orchestrator + scheduler
│   │   ├── data/                # mock_raw.json (mock-api'nin veri kaynagi)
│   │   ├── db/                  # SQLAlchemy modeller (19 tablo) + seed
│   │   ├── routers/             # 19 router · 93 endpoint
│   │   ├── services/            # calculator, gemini_service, marketplace_api
│   │   │   └── scrapers/        # ScraperAPI / Playwright / AliExpress tedarik scraper'lari
│   │   ├── dependencies.py
│   │   └── main.py
│   ├── mock_api/                # Sahte Pazaryeri API (port 8001) + Dockerfile
│   ├── tests/                   # pytest smoke + Gemini havuz + ajan testleri
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/          # layout / shared / ui bilesenleri (ConfirmDialog dahil)
│   │   ├── context/             # Auth, Toast, I18n, Analysis context
│   │   ├── i18n/                # Turkce / Ingilizce ceviriler
│   │   ├── pages/               # 24 sayfa bileseni
│   │   ├── services/            # API servis katmani
│   │   └── utils/               # formatters, motion, streaming, chartTheme
│   ├── nginx.conf
│   └── package.json
├── .github/workflows/           # deploy.yml (Cloud Run) + pr-checks.yml (CI)
├── docker-compose.yml
├── ARCHITECTURE.md
└── README.md
```

## Test Akisi (Swagger)

1. `POST /api/v1/auth/login` body `{"email": "demo@arkus.ai", "password": "demo123"}` → token
2. `GET /api/v1/dashboard/overview` (Bearer token) → genel metrikler
3. `GET /api/v1/dashboard/ai-summary` → Gemini'den gunaydin ozeti + web piyasa notu
4. `GET /api/v1/reviews/P001/analyze?detail=detailed` → yorum analizi (cache'li)
5. `POST /api/v1/notifications/generate` → otomatik bildirim tespiti (rakip fiyat, stok, vs.)
6. `GET /api/v1/sourcing/real-search/Bluetooth Kulaklik` → Google Search ile gercek tedarikci fiyatlari
7. `POST /api/v1/agents/run-all` → 5 ajan sirayla calisir, event flow ile rapora doner

## 📊 BTK Hackathon 26 — Degerlendirme Kriterleri Eslemesi

| Kriter | Puan | Arkus AI'da nerede karsiliyor | Detay |
|---|---|---|---|
| Kullanici Degeri | 20 | 17 modul × 93 endpoint, gercek satici problemine birebir cozum | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| Teknik Puan | 20 | 4-layer mimari, async FastAPI, Pydantic v2, React 19 + Vite, Cloud Run + CI/CD | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| Performans / Dogruluk | 10 | Gemini cascade + amac-bazli key havuzu, AI usage logging, "no fake response" politika | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| Agentic Yapilar | 10 | 5 otonom ajan + function-calling chat, event bus | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| Yenilikcilik | 10 | Conversational commerce + arbitraj + Tedarik Avcisi + Gemini Vision + Search grounding | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| Kullanici Dostu | 10 | SSE streaming UX, i18n TR/EN, dark mode, lazy load + framer-motion | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| Takim Calismasi | 10 | Net FE/BE ayrim, `types/api.ts` kontrati, git workflow, PR CI gating | git log |
| Sunum ve Iletisim | 10 | README + ARCHITECTURE + OpenAPI auto-docs + 1dk video + canli demo (arkus.tr) | bu dosya |

**Toplam mimari kanit dokumani:** [ARCHITECTURE.md](./ARCHITECTURE.md) — mermaid diagram + sequence + ERD + modul haritasi + her kritere kod referansi.

## Lisans

MIT — bkz. [LICENSE](./LICENSE)
