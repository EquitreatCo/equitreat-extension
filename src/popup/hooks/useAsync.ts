import { useCallback, useEffect, useState } from 'react';

export interface AsyncState<T> {
  readonly data: T | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export const toMessage = (err: unknown): string => (err instanceof Error ? err.message : 'Something went wrong');

/** Run an async loader on mount (and when `deps` change); expose data/loading/error plus a reload. */
export const useAsync = <T>(loader: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> & { reload: () => void } => {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    loader()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ data: null, loading: false, error: toMessage(err) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
};

export interface ActionState<A extends unknown[]> {
  readonly run: (...args: A) => Promise<void>;
  readonly pending: boolean;
  readonly error: string | null;
}

/** Wrap an action with pending/error state for buttons and forms. */
export const useAction = <A extends unknown[]>(action: (...args: A) => Promise<void>): ActionState<A> => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async (...args: A) => {
      setPending(true);
      setError(null);
      try {
        await action(...args);
      } catch (err) {
        setError(toMessage(err));
      } finally {
        setPending(false);
      }
    },
    [action],
  );
  return { run, pending, error };
};
