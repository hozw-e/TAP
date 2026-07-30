import '../styles/ConnectionStatus.css';

/**
 * Determine the display state from a connection state string.
 * Returns { dotColor, label, showRetry }
 *
 * @param {string} connectionState
 * @returns {{ dotColor: 'green'|'red'|'none', label: string, showRetry: boolean }}
 */
export function getConnectionDisplay(connectionState) {
  const isConnected = connectionState === 'connected_ws' || connectionState === 'connected_sse';
  const isReconnecting =
    connectionState === 'connecting_ws' ||
    connectionState === 'connecting_sse' ||
    connectionState === 'reconnecting';
  const isDisconnected = connectionState === 'disconnected';

  if (isConnected) {
    return { dotColor: 'green', label: 'Connected', showRetry: false };
  }
  if (isReconnecting) {
    return { dotColor: 'red', label: 'Reconnecting...', showRetry: false };
  }
  if (isDisconnected) {
    return { dotColor: 'red', label: 'Disconnected', showRetry: true };
  }
  return { dotColor: 'none', label: '', showRetry: false };
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
  const { dotColor, label, showRetry } = getConnectionDisplay(connectionState);

  const dotClass = `connection-dot${dotColor !== 'none' ? ` connection-dot--${dotColor}` : ''}`;

  return (
    <div className="connection-status" role="status" aria-live="polite">
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
