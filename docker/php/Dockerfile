FROM php:8.4-fpm

# --- System dependencies ---
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        unzip \
        zip \
        curl \
        libpq-dev \
        libzip-dev \
        libicu-dev \
        libpng-dev \
        libjpeg-dev \
        libfreetype6-dev \
        libonig-dev \
    && rm -rf /var/lib/apt/lists/*

# --- PHP extensions ---
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
        pdo_pgsql \
        pgsql \
        zip \
        gd \
        intl \
        bcmath \
        pcntl \
        opcache \
    && pecl install redis \
    && docker-php-ext-enable redis

# --- Composer ---
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# --- Entrypoint ---
COPY docker/php/entrypoint.sh /usr/local/bin/octopus-entrypoint.sh
RUN chmod +x /usr/local/bin/octopus-entrypoint.sh

WORKDIR /var/www/html

EXPOSE 9000
