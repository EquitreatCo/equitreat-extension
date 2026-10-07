import { useCallback, type ReactElement } from 'react';
import { sendMessage } from '../../lib/messages';
import { useAction } from '../hooks/useAsync';

interface Props {
  readonly paused: boolean | null;
  readonly onToggled: () => void;
}

const BADGE_SRC = '/brand/badge.png';

/** Badge plus lowercase wordmark; the signed-out view shows it alone, signed in it sits beside the tracking chip. */
export const Wordmark = (): ReactElement => (
  <div className="wordmark" title="equitreat">
    <img className="badge" src={BADGE_SRC} width={32} height={32} alt="" aria-hidden="true" />
    <span className="name">equitreat</span>
  </div>
);

/** The tracking chip doubles as the pause/resume control. */
export const TopBar = ({ paused, onToggled }: Props): ReactElement => {
  const toggle = useAction(
    useCallback(async () => {
      await sendMessage({ type: 'settings:set', paused: !paused });
      onToggled();
    }, [paused, onToggled]),
  );
  const on = paused === false;
  return (
    <header className="topbar">
      <Wordmark />
      <button
        type="button"
        className={`pill ${on ? 'on' : ''}`}
        role="switch"
        aria-checked={on}
        aria-label={on ? 'Active. Click to pause' : 'Paused. Click to resume'}
        disabled={paused === null || toggle.pending}
        onClick={() => void toggle.run()}
      >
        <span className="dot" aria-hidden="true" />
        {paused === null ? 'Loading' : on ? 'Active' : 'Paused'}
      </button>
    </header>
  );
};
