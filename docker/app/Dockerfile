# ── PHP-FPM image for local docker-compose dev stack ─────────────────────────
FROM php:8.3-fpm

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        git \
        unzip \
        zip \
        libpng-dev \
        libjpeg62-turbo-dev \
        libfreetype6-dev \
        libzip-dev \
        libonig-dev \
        libxml2-dev \
        libpq-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
        pdo \
        pdo_mysql \
        pdo_pgsql \
        mbstring \
        bcmath \
        exif \
        gd \
        zip \
        opcache \
        pcntl \
    && rm -rf /var/lib/apt/lists/*

# Node.js 20 for npm run build inside the container (optional — assets
# are usually built on the host or in CI, but having it here avoids
# a separate service for local dev)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# PHP config: raise limits for file uploads and AI request timeouts
RUN { \
        echo 'upload_max_filesize = 100M'; \
        echo 'post_max_size       = 110M'; \
        echo 'max_file_uploads    = 20'; \
        echo 'max_execution_time  = 300'; \
        echo 'memory_limit        = 512M'; \
    } > /usr/local/etc/php/conf.d/app.ini

WORKDIR /var/www
