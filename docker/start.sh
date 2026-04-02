#!/usr/bin/env sh
set -e

PORT="${PORT:-80}"

# Render provides a dynamic PORT value; Apache must bind to it.
sed -ri "s/^Listen 80$/Listen ${PORT}/" /etc/apache2/ports.conf
sed -ri "s/:80>/:${PORT}>/g" /etc/apache2/sites-available/000-default.conf

# Suppress AH00558 warning in containerized environments.
echo "ServerName localhost" > /etc/apache2/conf-available/servername.conf
a2enconf servername >/dev/null

# Ensure Laravel runtime paths exist (especially when .dockerignore excludes them).
mkdir -p \
    /var/www/html/storage/logs \
    /var/www/html/storage/framework/cache \
    /var/www/html/storage/framework/sessions \
    /var/www/html/storage/framework/testing \
    /var/www/html/storage/framework/views \
    /var/www/html/bootstrap/cache

# Keep writable runtime directories healthy.
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache || true
chmod -R ug+rwx /var/www/html/storage /var/www/html/bootstrap/cache || true

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    php /var/www/html/artisan migrate --force || true
fi

exec apache2-foreground
