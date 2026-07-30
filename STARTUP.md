# APDC Real-Time Anomaly Detection — Startup Guide

This document describes how to start all three services for the real-time anomaly detection pipeline.

## Architecture Overview

```
ESP32 NFC Reader
    → PHP Backend (XAMPP Apache, port 80)
        → Node.js WebSocket Server (port 3001)
            → React Dashboard (Vite dev server, port 5173)
            → Python Anomaly Engine (port 5000)
```

## Prerequisites

- **XAMPP** with Apache and MySQL running
- **Node.js** v18+ installed
- **Python** 3.10+ installed
- **npm** packages installed in both root and `websocket-server/`

## Environment Variables

All environment variables are configured in the root `.env` file:

| Variable | Default | Description |
|----------|---------|-------------|
| `WEBSOCKET_SERVER_URL` | `http://localhost:3001` | URL for PHP → WS event publishing |
| `WEBSOCKET_PORT` | `3001` | Port for the WebSocket server |
| `WEBSOCKET_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:80` | Allowed origins for WS connections |
| `ANOMALY_ENGINE_URL` | `http://localhost:5000` | Python anomaly engine URL |
| `ANOMALY_ENGINE_HEALTH_INTERVAL` | `15000` | Health check polling interval (ms) |
| `PHP_SESSION_VALIDATE_URL` | `http://localhost:80/api/auth/validate-session.php` | Session validation endpoint |
| `PHP_SESSION_RECHECK_INTERVAL` | `60000` | Session re-check interval (ms) |
| `VITE_WEBSOCKET_URL` | `ws://localhost:3001` | WebSocket URL for React frontend |

## Starting the Services

### 1. PHP Backend (XAMPP Apache)

Already running via XAMPP. Ensure Apache and MySQL are started in the XAMPP Control Panel.

- **URL**: `http://localhost:80`
- **API**: `http://localhost:80/api/`

No additional steps needed — `scan.php` automatically publishes events to the WebSocket server on each NFC scan.

### 2. Node.js WebSocket Server

```bash
cd websocket-server
npm start
```

Or from the project root:

```bash
npm run ws:start
```

- **URL**: `http://localhost:3001`
- **Health check**: `GET http://localhost:3001/health`
- **Internal event endpoint**: `POST http://localhost:3001/internal/event`
- **SSE fallback**: `GET http://localhost:3001/events/stream`

The WebSocket server will:
- Accept WebSocket connections from the React dashboard (with session token auth)
- Receive attendance events from PHP via HTTP POST
- Forward events to the Python anomaly engine for analysis
- Broadcast alerts to connected dashboard clients
- Monitor engine health every 15 seconds (circuit breaker)

### 3. Python Anomaly Engine

```bash
cd anomaly-engine
pip install -r requirements.txt
python -m src.app
```

- **URL**: `http://localhost:5000`
- **Health check**: `GET http://localhost:5000/health`
- **Analysis endpoint**: `POST http://localhost:5000/analyze`
- **Config endpoint**: `GET/PUT http://localhost:5000/config`

The anomaly engine will:
- Analyze attendance events for 4 pattern types
- Query MySQL for historical attendance data
- Persist detected alerts to the `anomaly_alerts` table
- Respond to health checks from the WebSocket server

### 4. React Frontend (Development)

```bash
npm run dev
```

- **URL**: `http://localhost:5173`

The React dashboard will:
- Connect to the WebSocket server via `ws://localhost:3001`
- Display real-time attendance events
- Show anomaly alerts in the At-Risk Students panel
- Show connection and engine status indicators

## Startup Order

For best results, start services in this order:

1. **XAMPP** (Apache + MySQL) — database must be available first
2. **Python Anomaly Engine** — so it's ready when the WS server starts health checks
3. **Node.js WebSocket Server** — connects to both PHP and Python services
4. **React Frontend** — connects to the WebSocket server

## Data Flow

### Attendance Event Flow

1. ESP32 sends NFC scan → `POST /api/nfc/scan.php`
2. PHP records attendance in MySQL
3. PHP fire-and-forget POST → `http://localhost:3001/internal/event` (200ms timeout)
4. WebSocket server validates event schema
5. WebSocket server broadcasts `attendance_event` to all connected clients
6. WebSocket server forwards event to anomaly engine → `POST http://localhost:5000/analyze`
7. If anomaly detected (score > threshold), broadcasts `anomaly_alert` to clients

### Circuit Breaker Behavior

- If the anomaly engine is down, the WebSocket server queues events (max 500)
- After 3 consecutive health check failures → circuit opens
- When engine recovers → circuit transitions to half-open → processes queued events
- Dashboard shows "Anomaly detection unavailable" indicator when circuit is open

## Running Tests

```bash
# Frontend property tests + unit tests
npm test

# WebSocket server tests
npm run ws:test
# or: cd websocket-server && npm test

# Python anomaly engine tests
cd anomaly-engine
python -m pytest tests/ -v
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| WebSocket connection refused | Ensure WS server is running on port 3001 |
| Anomaly engine unavailable | Check Python service is running on port 5000 |
| Events not broadcasting | Check WEBSOCKET_SERVER_URL in .env matches WS server address |
| Session validation failing | Ensure Apache is running and PHP sessions are enabled |
| CORS errors in browser | Verify WEBSOCKET_ALLOWED_ORIGINS includes your frontend URL |
