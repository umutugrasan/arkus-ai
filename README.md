# 🔍 Basiret AI — Çoklu Pazaryeri Satıcı Zekası Paneli

**BTK Hackathon 26 | E-Ticaret Odaklı AI Destekli Uygulama**

Basiret AI, birden fazla pazaryerinde (Trendyol, Hepsiburada, Amazon TR) satış yapan e-ticaret satıcıları için yapay zeka destekli analiz ve danışmanlık platformudur.

> **"Veriyi gösteren değil, strateji üreten bir sistem."**

## 🎯 Problem

E-ticaret satıcıları 3-4 farklı pazaryerinde ayrı ayrı panellere girip verileri kontrol ediyor. Yüzlerce yorumu okuyamıyor, rakipleri takip edemiyor, finansal durumunu analiz edemiyor.

## 💡 Çözüm

Basiret AI, tüm pazaryerlerindeki verileri birleştirir ve Gemini AI ile analiz ederek satıcıya **doğal dilde strateji önerileri** sunar.

## 🧩 Modüller

| Modül | Açıklama |
|-------|----------|
| **Ana Dashboard** | Tüm pazaryerlerinden birleşik genel bakış |
| **Yorum Analizi** | AI duygu analizi, şikayet kategorileri, iyileştirme önerileri |
| **Rakip Karşılaştırma** | Fiyat, puan karşılaştırma + AI strateji önerisi |
| **Çapraz Pazaryeri Arbitraj** | Aynı ürünün farklı pazaryerlerindeki fiyat/talep analizi |
| **Mağaza Sağlık Skoru** | 0-100 arası AI puanı, tüm verileri birleştiren tek metrik |
| **Finansal Panel** | Gelir-gider, kâr marjı, nakit akışı + finansman yönlendirme |
| **AI Danışman Chat** | Türkçe doğal dilde soru-cevap |
| **Tedarik ve İndirim Avcısı** | Tedarikçi fiyat takibi + alım zamanlaması önerisi |

## 🏗️ Teknik Mimari

```
┌─────────────┐     REST API      ┌──────────────┐     ┌────────────┐
│   React +   │ ◄──────────────► │   FastAPI    │ ◄──► │ Gemini API │
│  Tailwind   │                   │   Backend    │     └────────────┘
│  Recharts   │                   │              │
└─────────────┘                   │  ┌─────────┐ │
                                  │  │Mock Data│ │
                                  │  └─────────┘ │
                                  └──────────────┘
```

## 🚀 Kurulum

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# .env dosyasına Gemini API key'inizi ekleyin
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🔑 API Endpoints

| Endpoint | Açıklama |
|----------|----------|
| `GET /api/dashboard/overview` | Genel bakış verileri |
| `GET /api/reviews/product/{id}` | Ürün yorumları |
| `GET /api/reviews/analyze/{id}` | AI yorum analizi |
| `GET /api/competitors/analyze/{id}` | AI rakip analizi |
| `GET /api/arbitrage/opportunities` | Arbitraj fırsatları |
| `GET /api/financials/overview` | Finansal özet |
| `GET /api/financials/analyze` | AI finansal analiz |
| `GET /api/health/score` | Mağaza sağlık skoru |
| `POST /api/chat/ask` | AI danışman sohbet |
| `GET /api/sourcing/opportunities` | Tedarik fırsatları |

## 🛠️ Teknolojiler

- **Frontend:** React, Tailwind CSS, Recharts
- **Backend:** Python, FastAPI
- **AI:** Google Gemini API
- **Veri:** Mock Data (JSON)

## 👥 Takım

BTK Hackathon 26 Katılımcıları

## 📄 Lisans

MIT
