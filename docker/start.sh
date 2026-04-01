#!/usr/bin/env sh
set -e

PORT="${PORT:-80}"

# Render provides a dynamic PORT value; Apache must bind to it.
sed -ri "s/^Listen 80$/Listen ${PORT}/" /etc/apache2/ports.conf
sed -ri "s/:80>/:${PORT}>/g" /etc/apache2/sites-available/000-default.conf

# Keep writable runtime directories healthy.
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache || true
chmod -R ug+rwx /var/www/html/storage /var/www/html/bootstrap/cache || true

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    php /var/www/html/artisan migrate --force || true
fi

exec apache2-foreground
