# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM python:3.11-slim AS base

WORKDIR /app

# Sistem bağımlılıkları (gcc + Playwright/Chromium için gerekli kütüphaneler)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
    libasound2 libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Önce sadece requirements kopyala (layer cache optimizasyonu)
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Chromium tarayıcısını indir (Playwright için)
RUN playwright install chromium

# Kaynak kodu kopyala
COPY . .

# ─── Runtime ──────────────────────────────────────────────────────────────────
EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "4"]
