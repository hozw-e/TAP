#!/bin/sh
# Start PHP-FPM in the background, then nginx in the foreground (keeps the
# container alive). nginx proxies /api/*.php to PHP-FPM on 127.0.0.1:9000.
php-fpm -D
nginx -g "daemon off;"
