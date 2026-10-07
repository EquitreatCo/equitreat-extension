import type { ReactElement } from 'react';
import { formatUsd } from '../../shared/index.js';
import type { RecentOrders, RewardSummary } from '../../lib/messages';
import { formatMultiplier, formatTokens } from '../format';

interface Props {
  readonly data: RecentOrders | null;
}

const DEFAULT_WINDOW_DAYS = 90;

const nextTierCaption = (s: RewardSummary): string =>
  s.next_tier && s.spend_to_next_tier_usd !== null ? `${formatUsd(s.spend_to_next_tier_usd)} more to ${s.next_tier}` : 'Top tier';

/** Only when the wallet's token balance is known; an unknown balance is never shown as zero. */
const tokensCaption = (s: RewardSummary): string | null =>
  s.holder_balance !== null && s.next_level && s.tokens_to_next_level !== null ? `${formatTokens(s.tokens_to_next_level)} tokens to ${s.next_level}` : null;

/** What sets the rate on the next order: spend tier (rolling spend) and holder level (EQUITREAT_TECHNICAL_DOCUMENT.md §10.5). */
export const TierStrip = ({ data }: Props): ReactElement | null => {
  if (!data) return null;
  const { summary, config } = data;
  const days = config?.tier_window_days || DEFAULT_WINDOW_DAYS;
  const tokens = tokensCaption(summary);
  return (
    <section className="card tiers rise" aria-label="Cashback rate">
      <div className="tier">
        <div className="label">Spend tier</div>
        <div className="figure">{summary.spend_tier}</div>
        <div className="cap tabular">
          {formatUsd(summary.spend_90d_usd)} in {days} days
        </div>
        <div className="cap tabular">{nextTierCaption(summary)}</div>
      </div>
      <div className="tier">
        <div className="label">Holder level</div>
        <div className="figure">
          {summary.holder_level} · {formatMultiplier(summary.holder_multiplier_bps)}
        </div>
        {summary.holder_cap_usd > 0 && <div className="cap tabular">up to {formatUsd(summary.holder_cap_usd)} per order</div>}
        {tokens && <div className="cap tabular">{tokens}</div>}
      </div>
    </section>
  );
};
