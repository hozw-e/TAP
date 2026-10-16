# ============================================================================
# Consolidated single-origin image for Railway.
#
# Serves BOTH the React SPA and the PHP /api backend from one domain so the
# session cookie is first-party. This is what makes login work in Safari/Brave
# and inside the installed mobile PWA (which block cross-site cookies).
#
#   Stage 1 (node)  -> builds the React app into /app/dist
#   Stage 2 (php)   -> nginx + PHP-FPM; backend at /var/www/html,
#                      the built SPA at /var/www/html/public
# ============================================================================

# ---- Stage 1: build the React frontend ----
FROM node:20-alpine AS frontend
WORKDIR /app

# Install deps first for better layer caching.
# Use `npm install` (not `npm ci`) so the Linux build container can resolve the
# correct platform-specific binaries (e.g. esbuild's linux-x64 build) at build
# time. `npm ci` requires every platform's optional deps to be pre-recorded in
# package-lock.json, which an install run on Windows/macOS does not guarantee.
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

# Build the SPA. VITE_API_BASE_URL is intentionally left unset so the app
# defaults to the same-origin '/api' path (see src/services/api.js).
COPY . .
RUN npm run build


# ---- Stage 2: PHP backend + nginx, serving the built SPA ----
FROM php:8.2-fpm-alpine

# ca-certificates is REQUIRED: alpine ships without a root CA bundle, so PHP's
# cURL fails TLS verification on outbound https:// calls (e.g. publishing
# attendance events to the WebSocket server) without it.
RUN apk add --no-cache nginx curl-dev ca-certificates \
    && update-ca-certificates

RUN docker-php-ext-install pdo pdo_mysql curl

RUN mkdir -p /run/nginx

# nginx config for the consolidated routing (/api -> PHP, everything -> SPA).
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Backend PHP app at the web root.
COPY backend/ /var/www/html/

# Built React SPA served from /var/www/html/public.
COPY --from=frontend /app/dist/ /var/www/html/public/

RUN chown -R www-data:www-data /var/www/html

COPY docker/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80

CMD ["/start.sh"]
