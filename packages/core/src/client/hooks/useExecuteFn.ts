import { useState, useEffect, useCallback, useRef } from 'react';
import { executeFn } from '../lib/execute-fn';

interface UseExecuteFnOptions {
  /** Skip automatic execution on mount */
  manual?: boolean;
  /** Dependencies — re-fetch when these change */
  deps?: unknown[];
}

interface UseExecuteFnResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: (...args: unknown[]) => Promise<T>;
}

/**
 * Hook that calls a GAS server function and manages loading/error state.
 *
 * @example
 * const { data, loading, error, refetch } = useExecuteFn<Order[]>('getOrders', [token]);
 */
export function useExecuteFn<T = unknown>(
  funcName: string,
  args: unknown[] = [],
  options: UseExecuteFnOptions = {}
): UseExecuteFnResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!options.manual);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const execute = useCallback(
    async (...overrideArgs: unknown[]): Promise<T> => {
      setLoading(true);
      setError(null);
      try {
        const finalArgs = overrideArgs.length > 0 ? overrideArgs : args;
        const result = await executeFn<T>(funcName, finalArgs);
        if (mountedRef.current) {
          setData(result);
          setLoading(false);
        }
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (mountedRef.current) {
          setError(error);
          setLoading(false);
        }
        throw error;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [funcName, JSON.stringify(args)]
  );

  useEffect(() => {
    mountedRef.current = true;
    if (!options.manual) {
      execute().catch(() => {});
    }
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execute, ...(options.deps ?? [])]);

  return { data, loading, error, refetch: execute };
}
