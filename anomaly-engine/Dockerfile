FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy source code
COPY . .

# Expose port (Railway assigns PORT env var)
EXPOSE 5000

# Run with gunicorn for production
CMD gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 2 --timeout 120 "src.app:create_app()"
