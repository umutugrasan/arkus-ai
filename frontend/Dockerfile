# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Önce sadece package dosyalarını kopyala (cache)
COPY package.json package-lock.json* ./

RUN npm ci --frozen-lockfile

# Kaynak kodu kopyala
COPY . .

# Production build (API istekleri /api prefix'i ile gidecek, nginx proxy yapacak)
RUN npm run build

# ─── Stage 2: Serve (nginx) ───────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Vite build çıktısını kopyala
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
