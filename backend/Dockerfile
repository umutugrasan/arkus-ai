# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM python:3.11-slim AS base

WORKDIR /app

# Sistem bağımlılıkları
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Önce sadece requirements kopyala (layer cache optimizasyonu)
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Kaynak kodu kopyala
COPY . .

# ─── Runtime ──────────────────────────────────────────────────────────────────
EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
