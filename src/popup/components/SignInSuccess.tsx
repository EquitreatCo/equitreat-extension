import { useEffect, type ReactElement } from 'react';
import type { SessionSummary } from '../../lib/messages';
import type { WelcomeMethod } from '../../lib/welcome';
import { Wordmark } from './TopBar';
import { IconCheck } from './icons';

interface Props {
  readonly session: SessionSummary;
  readonly method: WelcomeMethod;
  readonly onDone: () => void;
}

/** How long the success screen stays before the main view takes over. */
export const SIGN_IN_SUCCESS_MS = 2200;

const METHOD_LABEL: Record<WelcomeMethod, string> = { google: 'Google', email: 'email code' };

/** Short confirmation shown right after sign-in, then hands over to the signed-in view. */
export const SignInSuccess = ({ session, method, onDone }: Props): ReactElement => {
  useEffect(() => {
    const id = setTimeout(onDone, SIGN_IN_SUCCESS_MS);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <header className="topbar">
        <Wordmark />
      </header>
      <section className="card welcome" role="status" aria-live="polite">
        <span className="welcome-mark" aria-hidden="true">
          <IconCheck size={30} />
        </span>
        <h1>You&apos;re signed in.</h1>
        <p className="welcome-who">
          <span className="who-email" title={session.email ?? undefined}>
            {session.email ?? 'Your account'}
          </span>
          <span className="who-method">via {METHOD_LABEL[method]}</span>
        </p>
        <p>Every confirmed order is now recorded to your account and paid out as stock.</p>
        <div className="welcome-bar" aria-hidden="true">
          <span style={{ animationDuration: `${SIGN_IN_SUCCESS_MS}ms` }} />
        </div>
        <button type="button" className="btn block primary" onClick={onDone}>
          Continue
        </button>
      </section>
    </div>
  );
};
