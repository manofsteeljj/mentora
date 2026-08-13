# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Composer dependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM composer:2.8 AS vendor

WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Node / Vite asset build
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS assets

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Copy everything that Vite needs to build
COPY resources ./resources
COPY public     ./public
COPY logo       ./logo
COPY vite.config.js ./
# tailwind / postcss configs (copy only if present)
COPY tailwind.config.* postcss.config.* ./

RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — Production PHP/Apache image
# ─────────────────────────────────────────────────────────────────────────────
FROM php:8.3-apache-bookworm AS app

# System packages + PHP extensions
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libzip-dev \
        libpq-dev \
        libpng-dev \
        libjpeg62-turbo-dev \
        libfreetype6-dev \
        libonig-dev \
        libxml2-dev \
        zlib1g-dev \
        unzip \
        git \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
        pdo_mysql \
        pgsql \
        pdo_pgsql \
        mbstring \
        bcmath \
        exif \
        gd \
        zip \
        opcache \
        pcntl \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

# PHP runtime config
RUN { \
        echo 'upload_max_filesize = 100M'; \
        echo 'post_max_size       = 110M'; \
        echo 'max_file_uploads    = 20'; \
        echo 'max_execution_time  = 300'; \
        echo 'memory_limit        = 512M'; \
    } > /usr/local/etc/php/conf.d/app.ini

# OPcache tuned for production
RUN { \
        echo 'opcache.enable=1'; \
        echo 'opcache.memory_consumption=256'; \
        echo 'opcache.interned_strings_buffer=16'; \
        echo 'opcache.max_accelerated_files=20000'; \
        echo 'opcache.validate_timestamps=0'; \
        echo 'opcache.fast_shutdown=1'; \
    } > /usr/local/etc/php/conf.d/opcache.ini

# Point Apache at Laravel's /public directory
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' \
        /etc/apache2/sites-available/*.conf \
        /etc/apache2/apache2.conf \
        /etc/apache2/conf-available/*.conf

WORKDIR /var/www/html

# Copy application source (respects .dockerignore)
COPY . .

# Overlay build artefacts from previous stages
COPY --from=vendor /app/vendor        ./vendor
COPY --from=assets /app/public/build  ./public/build

# Copy start script
COPY docker/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

# Fix permissions
RUN chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R ug+rwx storage bootstrap/cache

EXPOSE 80

CMD ["/usr/local/bin/start.sh"]
