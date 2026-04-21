import { useState, useEffect, useRef } from 'react';
import { nfcAPI } from '../services/api';

/**
 * Custom hook for NFC scanning with polling
 * @param {boolean} isScanning - Whether to actively poll for scans
 * @param {function} onScan - Callback when NFC is scanned: onScan(uid, isUnassigned)
 */
export function useNFCScanner(isScanning, onScan) {
  const [isPolling, setIsPolling] = useState(false);
  const [lastUID, setLastUID] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isScanning) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => stopPolling();
  }, [isScanning]);

  const startPolling = () => {
    if (intervalRef.current) return; // Already polling

    setIsPolling(true);

    intervalRef.current = setInterval(async () => {
      try {
        const response = await nfcAPI.getLastScan();

        if (response.success && response.data.uid) {
          const { uid, unassigned } = response.data;

          // Only trigger if it's a new UID
          if (uid !== lastUID) {
            setLastUID(uid);

            if (onScan) {
              onScan(uid, unassigned);
            }

            // Mark scan as consumed so it isn't picked up again
            await nfcAPI.clearScan();
          }
        }
      } catch (error) {
        console.error('NFC polling error:', error);
      }
    }, 500);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
    setLastUID(null);
  };

  return {
    isPolling,
    stopPolling,
  };
}