import type { ReactElement, ReactNode } from 'react';
import { IconAlert, IconCheck } from './icons';

interface Props {
  readonly kind: 'error' | 'ok' | 'info';
  readonly children: ReactNode;
}

/** Inline status message. Never color-only: each kind carries an icon. */
export const Feedback = ({ kind, children }: Props): ReactElement => (
  <p className={`msg ${kind} pop`} role={kind === 'error' ? 'alert' : 'status'}>
    {kind === 'error' ? <IconAlert /> : kind === 'ok' ? <IconCheck size={14} /> : null}
    <span>{children}</span>
  </p>
);

interface SkeletonProps {
  readonly width?: string;
  readonly height?: number;
}

export const Skeleton = ({ width = '100%', height = 12 }: SkeletonProps): ReactElement => (
  <span className="sk" style={{ display: 'block', width, height }} aria-hidden="true" />
);
