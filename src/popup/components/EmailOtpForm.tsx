import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { sendMessage, type SessionSummary } from '../../lib/messages';
import { useAction } from '../hooks/useAsync';
import { Feedback } from './Feedback';

interface Props {
  readonly onSignedIn: (session: SessionSummary | null) => void;
  readonly onBack: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_LENGTH = 8;

export const EmailOtpForm = ({ onSignedIn, onBack }: Props): ReactElement => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  const send = useAction(
    useCallback(async () => {
      if (!EMAIL_RE.test(email)) throw new Error('Enter a valid email address.');
      await sendMessage({ type: 'auth:email-send', email });
      setSent(true);
    }, [email]),
  );

  const verify = useAction(
    useCallback(async () => {
      if (code.length !== CODE_LENGTH) throw new Error(`Enter the ${CODE_LENGTH}-digit code from your email.`);
      onSignedIn(await sendMessage<SessionSummary | null>({ type: 'auth:email-verify', email, token: code }));
    }, [email, code, onSignedIn]),
  );

  useEffect(() => {
    if (sent) codeRef.current?.focus();
  }, [sent]);

  useEffect(() => {
    if (sent && code.length === CODE_LENGTH && !verify.pending) void verify.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, sent]);

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    void (sent ? verify.run() : send.run());
  };

  return (
    <form className="card auth-card pop" onSubmit={onSubmit} aria-label="Email sign-in">
      <div className="steps" aria-hidden="true">
        <span className="done" />
        <span className={sent ? 'done' : ''} />
      </div>
      {!sent ? (
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input id="email" className="input" type="email" placeholder="you@example.com" value={email} autoFocus autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
        </div>
      ) : (
        <div className="field">
          <label htmlFor="code">
            Code sent to <strong>{email}</strong>
          </label>
          <div className="code-cells">
            {Array.from({ length: CODE_LENGTH }, (_, i) => (
              <span key={i} className={`cell ${code[i] ? 'filled' : ''} ${i === Math.min(code.length, CODE_LENGTH - 1) ? 'active' : ''}`} aria-hidden="true">
                {code[i] ?? ''}
              </span>
            ))}
            <input
              ref={codeRef}
              id="code"
              className="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              value={code}
              aria-describedby="code-help"
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
            />
          </div>
          <span id="code-help" className="code-help">
            Eight digits. It verifies as soon as you finish typing.
          </span>
        </div>
      )}
      {(send.error ?? verify.error) && <Feedback kind="error">{send.error ?? verify.error}</Feedback>}
      <div className="row">
        <button type="button" className="btn ghost sm" onClick={sent ? () => { setSent(false); setCode(''); } : onBack}>
          {sent ? 'Change email' : 'Back'}
        </button>
        <button type="submit" className="btn primary" disabled={send.pending || verify.pending}>
          {sent ? (verify.pending ? 'Verifying…' : 'Verify') : send.pending ? 'Sending…' : 'Send code'}
        </button>
      </div>
    </form>
  );
};
