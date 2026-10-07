import { useCallback, type ReactElement } from 'react';
import { sendMessage, type SessionSummary } from '../../lib/messages';
import { useAction } from '../hooks/useAsync';
import { Feedback } from './Feedback';

interface Props {
  readonly session: SessionSummary;
  readonly onSignedOut: () => void;
}

const methodLabel = (provider: string): string => (provider === 'google' ? 'Google' : 'Email');

const identity = (session: SessionSummary): string => session.email ?? `User ${session.userId.slice(0, 8)}`;

export const AccountRow = ({ session, onSignedOut }: Props): ReactElement => {
  const signOut = useAction(
    useCallback(async () => {
      await sendMessage({ type: 'auth:sign-out' });
      onSignedOut();
    }, [onSignedOut]),
  );
  const who = identity(session);
  const glyph = session.email ? session.email.slice(0, 1).toUpperCase() : '·';
  return (
    <footer className="stack" style={{ gap: 8 }}>
      <div className="account">
        <div className="who">
          <span className="av" aria-hidden="true">
            {glyph}
          </span>
          <span title={who}>
            {who} · {methodLabel(session.provider)}
          </span>
        </div>
        <span className="meta">
          <span className="faint" title="Extension version">
            v{chrome.runtime.getManifest().version}
          </span>
          <button type="button" className="link" onClick={() => void signOut.run()} disabled={signOut.pending}>
            {signOut.pending ? 'Signing out…' : 'Sign out'}
          </button>
        </span>
      </div>
      {signOut.error && <Feedback kind="error">{signOut.error}</Feedback>}
    </footer>
  );
};
