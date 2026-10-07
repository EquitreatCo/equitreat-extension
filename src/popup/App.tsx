import { useCallback, useEffect, useState, type ReactElement } from 'react';
import type { SessionSummary } from '../lib/messages';
import { takeWelcome, type WelcomeFlag } from '../lib/welcome';
import { Feedback, Skeleton } from './components/Feedback';
import { SignedIn } from './components/SignedIn';
import { SignedOut } from './components/SignedOut';
import { SignInSuccess } from './components/SignInSuccess';
import { useSession } from './hooks/useSession';

const SOCIAL_URL = 'https://x.com/Equitrt';
const SOCIAL_HANDLE = '@Equitrt';

/** Opens in a new tab; the popup itself never navigates away. */
const SocialFooter = (): ReactElement => (
  <footer className="app-foot">
    <a className="link" href={SOCIAL_URL} target="_blank" rel="noopener noreferrer">
      {SOCIAL_HANDLE} on X
    </a>
  </footer>
);

const Booting = (): ReactElement => (
  <div className="stack" aria-busy="true" aria-label="Loading">
    <Skeleton width="60%" height={32} />
    <Skeleton width="100%" height={220} />
    <Skeleton width="100%" height={64} />
  </div>
);

export const App = (): ReactElement => {
  const { session, loading, error, setSession } = useSession();
  const [welcome, setWelcome] = useState<WelcomeFlag | null>(null);
  const [welcomeChecked, setWelcomeChecked] = useState(false);

  /* A sign-in that finished while the popup was closed (Google) left a flag for us. */
  useEffect(() => {
    takeWelcome()
      .then(setWelcome)
      .catch(() => setWelcome(null))
      .finally(() => setWelcomeChecked(true));
  }, []);

  /* A sign-in that finished inside the popup (email code) sets the flag just before replying. */
  const onSignedIn = useCallback(
    (next: SessionSummary | null): void => {
      setSession(next);
      if (next) void takeWelcome().then((flag) => setWelcome(flag));
    },
    [setSession],
  );

  const ready = !loading && welcomeChecked;
  return (
    <main className="app">
      {!ready && <Booting />}
      {ready && error && <Feedback kind="error">{error}</Feedback>}
      {ready && !error && session === null && <SignedOut onSignedIn={onSignedIn} />}
      {ready && !error && session !== null && welcome && <SignInSuccess session={session} method={welcome.method} onDone={() => setWelcome(null)} />}
      {ready && !error && session !== null && !welcome && <SignedIn session={session} onSignedOut={() => setSession(null)} />}
      {ready && !welcome && <SocialFooter />}
    </main>
  );
};
