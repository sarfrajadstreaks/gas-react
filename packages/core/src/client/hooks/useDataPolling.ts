import { useEffect, useRef, useCallback } from 'react';
import { executeFn } from '../lib/execute-fn';

interface UseDataPollingOptions {
  /** Poll interval in milliseconds (default: 30000) */
  interval?: number;
  /** Auth token to pass to the server */
  token: string | null;
  /** Called when specific data types have changed */
  onDataChanged: (changedKeys: string[]) => void;
  /** Whether polling is enabled */
  enabled?: boolean;
}

/**
 * Hook that polls the server for data change timestamps.
 * When it detects a change, it calls `onDataChanged` with the affected keys.
 */
export function useDataPolling(options: UseDataPollingOptions): void {
  const { interval = 30000, token, onDataChanged, enabled = true } = options;
  const lastTimestamps = useRef<Record<string, string>>({});
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const poll = useCallback(async () => {
    if (!token) return;

    try {
      const timestamps = await executeFn<Record<string, string>>(
        'getDataChangeTimestamps',
        [token]
      );

      const changed: string[] = [];
      for (const [key, ts] of Object.entries(timestamps)) {
        if (lastTimestamps.current[key] && lastTimestamps.current[key] !== ts) {
          changed.push(key);
        }
      }

      lastTimestamps.current = timestamps;

      if (changed.length > 0) {
        onDataChanged(changed);
      }
    } catch {
      // Polling failure is non-fatal — retry on next interval
    }
  }, [token, onDataChanged]);

  useEffect(() => {
    if (!enabled || !token) return;

    // Initial fetch to set baseline
    poll();

    timerRef.current = setInterval(poll, interval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, token, interval, poll]);
}
