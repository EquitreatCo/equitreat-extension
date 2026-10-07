import { useCallback, useState, type ReactElement } from 'react';
import { sendMessage, type SessionSummary } from '../../lib/messages';
import { useAction } from '../hooks/useAsync';
import { EmailOtpForm } from './EmailOtpForm';
import { Feedback } from './Feedback';
import { IconArrow, IconGoogle, IconMail } from './icons';
import { Wordmark } from './TopBar';

interface Props {
  readonly onSignedIn: (session: SessionSummary | null) => void;
}

const GOOGLE_CONFIGURED = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

type Method = 'google' | 'email';

interface MethodButtonProps {
  readonly icon: ReactElement;
  readonly title: string;
  readonly hint: string;
  readonly disabled?: boolean;
  readonly selected?: boolean;
  readonly onClick: () => void;
}

const MethodButton = ({ icon, title, hint, disabled, selected, onClick }: MethodButtonProps): ReactElement => (
  <button type="button" className={`method ${selected ? 'selected' : ''}`} disabled={disabled} onClick={onClick}>
    <span className="ico" aria-hidden="true">
      {icon}
    </span>
    <span className="t">
      <strong>{title}</strong>
      <span>{hint}</span>
    </span>
    <IconArrow className="arrow" />
  </button>
);

/**
 * The extension only identifies the account that orders belong to. Wallets are linked and rewards
 * are claimed on the rewards page, so nothing wallet-related ever runs here.
 */
export const SignedOut = ({ onSignedIn }: Props): ReactElement => {
  const [method, setMethod] = useState<Method | null>(null);

  const google = useAction(
    useCallback(async () => {
      onSignedIn(await sendMessage<SessionSummary | null>({ type: 'auth:google' }));
    }, [onSignedIn]),
  );

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="stack" style={{ gap: 8 }}>
        <header className="topbar">
          <Wordmark />
        </header>
        <p className="strapline">An extension that pays you in stock every time you shop.</p>
      </div>

      <div className="hero rise">
        <h1>Own what you buy into.</h1>
        <p>Sign in once. Orders at supported stores are recorded to your account and paid out as stock.</p>
      </div>

      {method !== 'email' && (
        <div className="steps" aria-hidden="true">
          <span className={method ? 'done' : ''} />
          <span />
        </div>
      )}

      {method !== 'email' && (
        <div className="methods">
          <MethodButton
            icon={<IconGoogle />}
            title={google.pending ? 'Waiting for Google…' : 'Continue with Google'}
            hint={GOOGLE_CONFIGURED ? 'Fastest. Link a wallet after.' : 'Not configured for this build'}
            disabled={!GOOGLE_CONFIGURED || google.pending}
            selected={method === 'google'}
            onClick={() => {
              setMethod('google');
              void google.run();
            }}
          />
          <MethodButton icon={<IconMail />} title="Use email" hint="We send an 8-digit code." onClick={() => setMethod('email')} />
        </div>
      )}

      {method === 'email' && <EmailOtpForm onSignedIn={onSignedIn} onBack={() => setMethod(null)} />}
      {google.error && <Feedback kind="error">{google.error}</Feedback>}
    </div>
  );
};
