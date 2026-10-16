import '../styles/ConnectionStatus.css';

/**
 * Determine the display state from a connection state string.
 * Returns { dotColor, label, title, showRetry }
 *
 * The label distinguishes a true real-time WebSocket link ("Live") from the
 * degraded Server-Sent-Events fallback ("Live (fallback)"), so an admin can
 * tell at a glance whether updates are arriving over the primary channel. The
 * `title` carries a longer explanation for the hover tooltip.
 *
 * @param {string} connectionState
 * @returns {{ dotColor: 'green'|'amber'|'red'|'none', label: string, title: string, showRetry: boolean }}
 */
export function getConnectionDisplay(connectionState) {
  const isReconnecting =
    connectionState === 'connecting_ws' ||
    connectionState === 'connecting_sse' ||
    connectionState === 'reconnecting';

  if (connectionState === 'connected_ws') {
    return {
      dotColor: 'green',
      label: 'Live',
      title: 'Real-time updates active (WebSocket)',
      showRetry: false,
    };
  }
  if (connectionState === 'connected_sse') {
    return {
      dotColor: 'amber',
      label: 'Live (fallback)',
      title: 'Real-time updates active over SSE fallback (WebSocket unavailable)',
      showRetry: false,
    };
  }
  if (isReconnecting) {
    return {
      dotColor: 'red',
      label: 'Reconnecting...',
      title: 'Reconnecting to the real-time server',
      showRetry: false,
    };
  }
  if (connectionState === 'disconnected') {
    return {
      dotColor: 'red',
      label: 'Offline',
      title: 'Not connected — live updates are paused',
      showRetry: true,
    };
  }
  return { dotColor: 'none', label: '', title: '', showRetry: false };
}

/**
 * ConnectionStatus — displays the current WebSocket/SSE connection state
 * in the dashboard header.
 *
 * @param {{ connectionState: string, onRetry: function }} props
 * - connectionState: one of connecting_ws, connected_ws, connecting_sse, connected_sse, reconnecting, disconnected
 * - onRetry: callback invoked when the user clicks the Retry button (only shown when disconnected)
 */
function ConnectionStatus({ connectionState, onRetry }) {
  const { dotColor, label, title, showRetry } = getConnectionDisplay(connectionState);

  const dotClass = `connection-dot${dotColor !== 'none' ? ` connection-dot--${dotColor}` : ''}`;

  return (
    <div className="connection-status" role="status" aria-live="polite" title={title}>
      <span className={dotClass} aria-hidden="true"></span>
      <span className="connection-status-label">{label}</span>
      {showRetry && onRetry && (
        <button
          className="connection-status-retry"
          onClick={onRetry}
          type="button"
          aria-label="Retry connection"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export default ConnectionStatus;
