import type { ReactElement } from 'react';
import type { RecentOrders, RewardSummary } from '../../lib/messages';
import { useCountUp } from '../hooks/useCountUp';
import { describeCurrencyMix, formatCashbackUsd, formatUsd } from '../../shared/index.js';
import { Skeleton } from './Feedback';

interface Props {
  readonly data: RecentOrders | null;
  readonly loading: boolean;
  readonly onClaim: () => void;
}

const DEFAULT_MIN_CLAIM_USD = 1;

/** Counts up in cents, then settles on the exact cashback, which can carry fractions of a cent. */
const Amount = ({ value }: { readonly value: number }): ReactElement => {
  const shown = useCountUp(value);
  return (
    <div className="amount tabular" aria-live="polite">
      {shown === value ? formatCashbackUsd(value) : formatUsd(shown)}
    </div>
  );
};

/** Fine print has room for a few tickers, so the rest of the list is counted rather than named. */
const NAMED_CHOICES = 3;

const joinChoices = (choices: readonly string[]): string => {
  if (choices.length <= 1) return choices[0] ?? '';
  if (choices.length <= NAMED_CHOICES) return `${choices.slice(0, -1).join(', ')} or ${choices[choices.length - 1]}`;
  return `${choices.slice(0, NAMED_CHOICES).join(', ')} or ${choices.length - NAMED_CHOICES} more`;
};

/** "US$3.5532 balance": everything not yet paid. */
const balanceLine = (s: RewardSummary): string => `${formatCashbackUsd(s.balance_usd)} balance`;

interface StatBoxProps {
  readonly label: string;
  readonly value: number;
  readonly caption: string;
  readonly mint?: boolean;
}

const StatBox = ({ label, value, caption, mint }: StatBoxProps): ReactElement => (
  <div className={`box ${mint ? 'mint' : ''}`}>
    <div className="label">{label}</div>
    <div className="figure tabular">{formatCashbackUsd(value)}</div>
    <div className="cap">{caption}</div>
  </div>
);

const Loading = (): ReactElement => (
  <section className="earnings quiet" aria-busy="true">
    <Skeleton width="40%" height={12} />
    <div style={{ height: 10 }} />
    <Skeleton width="55%" height={40} />
    <div style={{ height: 16 }} />
    <Skeleton width="100%" height={72} />
    <div style={{ height: 14 }} />
    <Skeleton width="100%" height={46} />
  </section>
);

/** The one committed-colour surface: what can be claimed now, what is in review, what has been paid. */
export const EarningsPanel = ({ data, loading, onClaim }: Props): ReactElement => {
  if (loading || !data) return <Loading />;
  const { summary, config, currencies, payoutTokens } = data;
  const mix = describeCurrencyMix(currencies.map((c) => c.currency));
  const choiceList = joinChoices(payoutTokens.map((t) => t.symbol));
  const minClaim = config?.min_claim_usd ?? DEFAULT_MIN_CLAIM_USD;
  const canClaim = summary.claimable_usd > 0 && summary.claimable_usd >= minClaim;
  /* Approved orders are claimable at once; everything else unpaid is waiting on review. */
  const inReview = summary.locked_usd + summary.review_usd;
  const hasAnything = summary.balance_usd > 0 || summary.paid_usd > 0;
  const tokenLine = config && choiceList ? `Paid as ${choiceList} on ${config.chain_name}. ` : config ? `Paid in stock on ${config.chain_name}. ` : '';
  /* The button always opens the claim page; it only says "Claim $X" when a claim can go through. */
  const claimLabel = canClaim ? `Claim ${formatCashbackUsd(summary.claimable_usd)}` : 'Open claim page';
  const toMinimum = summary.to_minimum_usd > 0 ? summary.to_minimum_usd : Math.max(0, minClaim - summary.claimable_usd);
  const belowMinimum = !canClaim && summary.claimable_usd > 0 ? ` ${formatCashbackUsd(toMinimum)} more to reach the ${formatUsd(minClaim)} minimum.` : '';
  const awaiting = summary.unconverted_count > 0 ? ` ${summary.unconverted_count} awaiting an exchange rate.` : '';
  const notCounted =
    summary.rejected_count > 0 ? ` ${summary.rejected_count} order${summary.rejected_count === 1 ? ' was' : 's were'} over our limits and not counted.` : '';
  return (
    <section className={`earnings ${hasAnything ? '' : 'quiet'} rise`} aria-label="Earnings">
      <div className="label">Claimable now</div>
      <Amount value={summary.claimable_usd} />
      <div className="note tabular">{balanceLine(summary)}</div>
      <div className="boxes">
        <StatBox label="In review" value={inReview} caption={inReview > 0 ? 'approved within a week' : 'nothing waiting'} mint />
        <StatBox label="Paid out" value={summary.paid_usd} caption={summary.paid_usd > 0 ? 'sent as stock' : 'nothing yet'} />
      </div>
      <button type="button" className="btn block primary" onClick={onClaim}>
        {claimLabel}
      </button>
      <div className="fine">
        {tokenLine}Orders are approved within a week and can be claimed as soon as they are. Shares can go down.{belowMinimum}{awaiting}{notCounted}
      </div>
      {mix && <div className="fine">Totalled in US dollars from {mix} orders at the rate on the day.</div>}
    </section>
  );
};
