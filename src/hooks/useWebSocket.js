import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Compute exponential backoff delay for a given attempt number.
 * delay(attempt) = min(2^(attempt - 1) * 1000, 30000) ms
 * @param {number} attempt - The attempt number (1-based)
 * @returns {number} Delay in milliseconds
 */
export function computeBackoffDelay(attempt) {
  return Math.min(Math.pow(2, attempt - 1) * 1000, 30000);
}

/**
 * Resolve the WebSocket server URL.
 * Priority: VITE_WEBSOCKET_URL env var → derive from current hostname (production) → localhost fallback.
 * Deriving from hostname means Railway deployments work without setting the env var explicitly.
 */
function resolveWsUrl() {
  const envUrl = import.meta.env.VITE_WEBSOCKET_URL;
  if (envUrl && envUrl !== 'ws://localhost:3001') return envUrl;

  // In a browser on a Railway/production domain, derive the WS URL from the page origin.
  // e.g. https://apsolutionstap.up.railway.app → wss://tap-web-socket.up.railway.app
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // The WebSocket service is on a sibling Railway domain — use env var or hardcoded fallback
    return envUrl || `${protocol}//tap-web-socket.up.railway.app`;
  }

  return 'ws://localhost:3001';
}

const WS_URL = resolveWsUrl();
const MAX_RECONNECT_ATTEMPTS = 10;
const WS_CONNECT_TIMEOUT = 3000;
const SSE_CONNECT_TIMEOUT = 5000;
const AUTO_RETRY_DELAY = 30000;

/**
 * Connection states:
 * - connecting_ws: Attempting WebSocket connection
 * - connected_ws: WebSocket connection established
 * - connecting_sse: Falling back to SSE
 * - connected_sse: SSE connection established
 * - reconnecting: Lost connection, attempting to reconnect
 * - disconnected: All attempts exhausted or manually disconnected
 */

/**
 * Custom hook for WebSocket connection with SSE fallback,
 * exponential backoff reconnection, and session authentication.
 *
 * @param {string} sessionToken - PHP session token for authentication
 * @returns {{ connectionState: string, lastMessage: object|null, sendMessage: function, retryConnection: function }}
 */
export function useWebSocket(sessionToken) {
  const [connectionState, setConnectionState] = useState('connecting_ws');
  const [lastMessage, setLastMessage] = useState(null);

  const wsRef = useRef(null);
  const sseRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const autoRetryTimerRef = useRef(null);
  const connectTimeoutRef = useRef(null);
  const unmountedRef = useRef(false);
  const tokenRef = useRef(sessionToken);

  // Keep token ref updated
  useEffect(() => {
    tokenRef.current = sessionToken;
  }, [sessionToken]);

  const cleanup = useCallback(() => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (autoRetryTimerRef.current) {
      clearTimeout(autoRetryTimerRef.current);
      autoRetryTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  }, []);

  const handleMessage = useCallback((data) => {
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      setLastMessage(parsed);
    } catch (err) {
      // Malformed message — log and ignore per design doc
      console.warn('useWebSocket: malformed message received', err);
    }
  }, []);

  const connectSSE = useCallback(() => {
    if (unmountedRef.current) return;

    setConnectionState('connecting_sse');

    const sseUrl = WS_URL.replace('ws', 'http') + `/events/stream?token=${encodeURIComponent(tokenRef.current)}`;

    const sseTimeout = setTimeout(() => {
      // SSE failed to connect within 5s
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      if (!unmountedRef.current) {
        setConnectionState('disconnected');
        // Schedule auto-retry after 30s
        autoRetryTimerRef.current = setTimeout(() => {
          if (!unmountedRef.current) {
            reconnectAttemptRef.current = 0;
            connectWebSocket();
          }
        }, AUTO_RETRY_DELAY);
      }
    }, SSE_CONNECT_TIMEOUT);

    try {
      const eventSource = new EventSource(sseUrl);
      sseRef.current = eventSource;

      eventSource.onopen = () => {
        clearTimeout(sseTimeout);
        if (!unmountedRef.current) {
          setConnectionState('connected_sse');
          reconnectAttemptRef.current = 0;
        }
      };

      eventSource.onmessage = (event) => {
        handleMessage(event.data);
      };

      eventSource.onerror = () => {
        // If we haven't connected yet, let the timeout handle it
        if (connectionState === 'connected_sse' || sseRef.current?.readyState === EventSource.CLOSED) {
          clearTimeout(sseTimeout);
          sseRef.current = null;
          if (!unmountedRef.current) {
            // Connection lost after being established — try reconnecting
            scheduleReconnect();
          }
        }
      };
    } catch (err) {
      clearTimeout(sseTimeout);
      if (!unmountedRef.current) {
        setConnectionState('disconnected');
        autoRetryTimerRef.current = setTimeout(() => {
          if (!unmountedRef.current) {
            reconnectAttemptRef.current = 0;
            connectWebSocket();
          }
        }, AUTO_RETRY_DELAY);
      }
    }
  }, [handleMessage]);

  const scheduleReconnect = useCallback(() => {
    if (unmountedRef.current) return;

    reconnectAttemptRef.current += 1;
    const attempt = reconnectAttemptRef.current;

    if (attempt > MAX_RECONNECT_ATTEMPTS) {
      setConnectionState('disconnected');
      // Schedule auto-retry after 30s
      autoRetryTimerRef.current = setTimeout(() => {
        if (!unmountedRef.current) {
          reconnectAttemptRef.current = 0;
          connectWebSocket();
        }
      }, AUTO_RETRY_DELAY);
      return;
    }

    setConnectionState('reconnecting');
    const delay = computeBackoffDelay(attempt);

    reconnectTimerRef.current = setTimeout(() => {
      if (!unmountedRef.current) {
        connectWebSocket();
      }
    }, delay);
  }, []);

  const connectWebSocket = useCallback(() => {
    if (unmountedRef.current) return;

    // Clean up any existing connections
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    setConnectionState('connecting_ws');

    const wsUrl = `${WS_URL}?token=${encodeURIComponent(tokenRef.current)}`;
    let wsConnected = false;

    // Set timeout for WS connection - fall back to SSE if fails within 3s
    connectTimeoutRef.current = setTimeout(() => {
      if (!wsConnected && !unmountedRef.current) {
        // WS failed to connect within 3s, fall back to SSE
        if (wsRef.current) {
          wsRef.current.onopen = null;
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.onmessage = null;
          wsRef.current.close();
          wsRef.current = null;
        }
        connectSSE();
      }
    }, WS_CONNECT_TIMEOUT);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        wsConnected = true;
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        if (!unmountedRef.current) {
          setConnectionState('connected_ws');
          reconnectAttemptRef.current = 0;
        }
      };

      ws.onmessage = (event) => {
        handleMessage(event.data);
      };

      ws.onclose = (event) => {
        wsRef.current = null;

        if (unmountedRef.current) return;

        // Handle auth expiry close code
        if (event.code === 4401) {
          cleanup();
          window.location.href = '/login';
          return;
        }

        // If WS hasn't connected yet, let the timeout handle the SSE fallback
        if (!wsConnected) return;

        // Connection was established then lost — attempt reconnect
        scheduleReconnect();
      };

      ws.onerror = () => {
        // onerror is always followed by onclose, so we handle it there
        // But if we haven't connected yet and there's still time on the timeout,
        // close immediately to trigger SSE fallback faster
        if (!wsConnected && wsRef.current) {
          wsRef.current.close();
        }
      };
    } catch (err) {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      if (!unmountedRef.current) {
        connectSSE();
      }
    }
  }, [cleanup, connectSSE, handleMessage, scheduleReconnect]);

  const sendMessage = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      wsRef.current.send(payload);
    }
  }, []);

  const retryConnection = useCallback(() => {
    cleanup();
    reconnectAttemptRef.current = 0;
    connectWebSocket();
  }, [cleanup, connectWebSocket]);

  // Initial connection on mount
  useEffect(() => {
    unmountedRef.current = false;

    if (sessionToken) {
      connectWebSocket();
    }

    return () => {
      unmountedRef.current = true;
      cleanup();
    };
  }, [sessionToken]);

  return {
    connectionState,
    lastMessage,
    sendMessage,
    retryConnection,
  };
}
