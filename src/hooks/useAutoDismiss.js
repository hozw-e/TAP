import { useEffect } from 'react';

/**
 * Auto-dismiss a transient modal/notification after a delay.
 *
 * Extracted from VisitorPage.jsx, which had ~13 identical effects of the form:
 *   useEffect(() => {
 *     if (state.show) {
 *       const t = setTimeout(() => setState(reset), delay);
 *       return () => clearTimeout(t);
 *     }
 *   }, [state.show]);
 *
 * @param {boolean}  isOpen    Whether the thing is currently shown.
 * @param {Function} onDismiss Called when the delay elapses (resets state).
 * @param {number}   delay     Milliseconds before auto-dismiss (default 5000).
 */
export function useAutoDismiss(isOpen, onDismiss, delay = 5000) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setTimeout(onDismiss, delay);
    return () => clearTimeout(timer);
    // Match the original behavior: effects keyed only on the `show` flag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
}
