'use client';

// Small data hooks so pages don't hand-roll loading and error state.
//   const { data, loading, error, reload } = useApi(() => lms.listMyEnrollments(), []);
//   const enrol = useMutation(lms.enrol);  await enrol.run({ params: { courseId } });

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './http';

export interface ApiState<T> {
  data: T | undefined;
  error: ApiError | Error | null;
  loading: boolean;
  reload: () => void;
  setData: React.Dispatch<React.SetStateAction<T | undefined>>;
}

export function useApi<T>(fn: (signal: AbortSignal) => Promise<T>, deps: React.DependencyList, opts: { enabled?: boolean } = {}): ApiState<T> {
  const enabled = opts.enabled ?? true;
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fnRef.current(ctrl.signal)
      .then(d => { if (!ctrl.signal.aborted) setData(d); })
      .catch(e => { if (!ctrl.signal.aborted && e?.name !== 'AbortError') setError(e); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, enabled]);

  const reload = useCallback(() => setTick(t => t + 1), []);
  return { data, error, loading, reload, setData };
}

export function useMutation<A, R>(fn: (args: A) => Promise<R>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const run = useCallback(async (args: A) => {
    setLoading(true);
    setError(null);
    try {
      return await fn(args);
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [fn]);
  return { run, loading, error };
}

export const errorMessage = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Something went wrong';
