#!/usr/bin/env bash
set -e

cd /var/www/html

echo "[octopus] Waiting for PostgreSQL at ${DB_HOST:-postgres}:${DB_PORT:-5432}..."
until php -r "exit(@fsockopen(getenv('DB_HOST')?:'postgres', (int)(getenv('DB_PORT')?:5432)) ? 0 : 1);" 2>/dev/null; do
  sleep 2
done
echo "[octopus] PostgreSQL is up."

# Note: vendor/ lives in a named volume, so the directory always exists but may
# be empty on first boot — check for the autoloader, not the directory.
if [ ! -f vendor/autoload.php ]; then
  echo "[octopus] Installing PHP dependencies..."
  composer install --no-interaction --prefer-dist --optimize-autoloader
fi

if [ ! -f .env ]; then
  echo "[octopus] Creating .env from .env.example..."
  cp .env.example .env
fi

# Generate APP_KEY if missing.
if ! grep -q "^APP_KEY=base64:" .env; then
  echo "[octopus] Generating application key..."
  php artisan key:generate --force
fi

# Ensure writable storage/cache dirs. a+rwX (X = dirs only) is needed because
# one-off exec'd commands (migrate/seed) run as root while PHP-FPM runs as
# www-data — root-created files must stay readable for FPM.
mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache
chmod -R a+rwX storage bootstrap/cache || true

echo "[octopus] Running database migrations..."
php artisan migrate --force --seed || php artisan migrate --force

# Public storage symlink for locally served documents.
if [ ! -e public/storage ]; then
  php artisan storage:link
fi

# Clear & warm caches.
php artisan optimize:clear || true

echo "[octopus] Boot complete. Starting: $*"
exec "$@"
