import { useState, useEffect, useRef, useCallback } from 'react';
import { nfcAPI } from '../services/api';

/**
 * Custom hook for NFC scanning with polling
 * @param {boolean} isScanning - Whether to actively poll for scans
 * @param {function} onScan - Callback when NFC is scanned: onScan(uid, isUnassigned)
 */
export function useNFCScanner(isScanning, onScan) {
  const [isPolling, setIsPolling] = useState(false);
  const lastUIDRef = useRef(null);
  const intervalRef = useRef(null);
  const onScanRef = useRef(onScan);

  // Keep the callback ref up to date
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return; // Already polling

    setIsPolling(true);

    intervalRef.current = setInterval(async () => {
      try {
        const response = await nfcAPI.getLastScan();

        if (response.success && response.data.uid) {
          const { uid, unassigned } = response.data;

          // Only trigger if it's a new UID
          if (uid !== lastUIDRef.current) {
            lastUIDRef.current = uid;

            if (onScanRef.current) {
              onScanRef.current(uid, unassigned);
            }

            // Mark scan as consumed so it isn't picked up again
            await nfcAPI.clearScan();
          }
        }
      } catch (error) {
        console.error('NFC polling error:', error);
      }
    }, 500);
  }, []);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
    lastUIDRef.current = null;
  }, []);

  useEffect(() => {
    if (isScanning) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => stopPolling();
  }, [isScanning, startPolling, stopPolling]);

  return {
    isPolling,
    stopPolling,
  };
}
