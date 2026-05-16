# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time API URL (Vite VITE_* prefix). CI/CD sirasinda:
#   docker build --build-arg VITE_API_URL=https://backend.example.com/api/v1 ...
# Tanimli degilse client.ts kendi fallback'ine duser.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Once sadece package dosyalarini kopyala (cache)
COPY package.json package-lock.json* ./

RUN npm ci --frozen-lockfile

# Kaynak kodu kopyala
COPY . .

# Production build (Vite ENV VITE_API_URL'i import.meta.env.VITE_API_URL'a gomer)
RUN npm run build

# ─── Stage 2: Serve (nginx) ───────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Vite build ciktisini kopyala
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
