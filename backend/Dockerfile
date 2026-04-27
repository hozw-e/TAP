FROM php:8.2-fpm-alpine

# Install nginx and required packages
RUN apk add --no-cache nginx

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_mysql

# Create nginx run directory
RUN mkdir -p /run/nginx

# Copy nginx config
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Copy backend files
COPY . /var/www/html/

# Set permissions
RUN chown -R www-data:www-data /var/www/html

# Copy and set start script
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80

CMD ["/start.sh"]