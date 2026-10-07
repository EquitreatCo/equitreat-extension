import { useCallback, useEffect, useState } from 'react';
import { sendMessage, type SessionSummary } from '../../lib/messages';

const SIGNED_OUT_POLL_MS = 2000;

export interface SessionState {
  readonly session: SessionSummary | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  readonly setSession: (session: SessionSummary | null) => void;
}

/** Loads the auth session on open and polls every 2 s while signed out (so wallet sign-in shows up). */
export const useSession = (): SessionState => {
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSession(await sendMessage<SessionSummary | null>({ type: 'auth:get-session' }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the extension');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (session) return undefined;
    const id = setInterval(() => void refresh(), SIGNED_OUT_POLL_MS);
    return () => clearInterval(id);
  }, [session, refresh]);

  return { session, loading, error, refresh, setSession };
};
