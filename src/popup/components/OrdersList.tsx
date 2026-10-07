import type { ReactElement } from 'react';
import { usdEquivalentLabel } from '../../shared/index.js';
import type { OrderSummary, RecentOrders } from '../../lib/messages';
import { formatDate, formatMoney, isRecent, merchantHue, merchantInitials } from '../format';
import { Skeleton } from './Feedback';
import { IconBag, IconCheck, IconClock, IconRefresh } from './icons';

interface Props {
  readonly data: RecentOrders | null;
  readonly loading: boolean;
  readonly onRefresh: () => void;
}

/** The four order states in EQUITREAT_TECHNICAL_DOCUMENT.md §3.2, in the words the popup uses. */
const STATUS_LABEL: Record<OrderSummary['status'], string> = {
  pending: 'In review',
  verified: 'Approved',
  paid: 'Paid',
  rejected: 'Not counted',
};

const AVATAR_SIZE = 40;

/** Avatar tints stay in the brand's warm band: the per-merchant hue folds into a range around amber. */
const WARM_HUE_CENTER = 70;
const WARM_HUE_SPREAD = 0.3;
const warmTint = (hue: number): number => WARM_HUE_CENTER + (hue - 180) * WARM_HUE_SPREAD;

const StatusChip = ({ status }: { readonly status: OrderSummary['status'] }): ReactElement => (
  <span className={`status ${status}`}>
    {status === 'paid' ? <IconCheck size={11} className="static" /> : <IconClock size={11} />}
    {STATUS_LABEL[status]}
  </span>
);

/** Native amounts are what the store showed; rewards count the USD equivalent. */
const UsdLine = ({ order }: { readonly order: OrderSummary }): ReactElement | null => {
  const label = usdEquivalentLabel(order);
  if (!label) return null;
  return <span className={`usd tabular ${order.amount_usd === null ? 'pending' : ''}`}>{label}</span>;
};

const OrderRow = ({ order, index }: { readonly order: OrderSummary; readonly index: number }): ReactElement => {
  const hue = warmTint(merchantHue(order.merchant_domain));
  return (
    <li className="order rise" style={{ '--i': index } as React.CSSProperties}>
      <span className="avatar" style={{ background: `oklch(0.945 0.04 ${hue})`, color: `oklch(0.4 0.09 ${hue})` }} aria-hidden="true">
        {merchantInitials(order.merchant_domain)}
      </span>
      <div className="who">
        <strong>
          <span className="name">{order.merchant_domain}</span>
          {isRecent(order.detected_at) && <span className="new">New</span>}
        </strong>
        <span className="meta">
          {formatDate(order.detected_at)} · #{order.order_id}
        </span>
      </div>
      <div className="right">
        <span className="amt tabular">{formatMoney(order.amount, order.currency)}</span>
        <UsdLine order={order} />
        <StatusChip status={order.status} />
      </div>
    </li>
  );
};

const SkeletonRows = (): ReactElement => (
  <ul className="orders" aria-busy="true">
    {[0, 1, 2].map((i) => (
      <li key={i} className="order">
        <span className="sk" style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: 12 }} aria-hidden="true" />
        <div className="who" style={{ gap: 6 }}>
          <Skeleton width="55%" height={12} />
          <Skeleton width="40%" height={10} />
        </div>
        <div className="right" style={{ gap: 6 }}>
          <Skeleton width="56px" height={12} />
          <Skeleton width="48px" height={18} />
        </div>
      </li>
    ))}
  </ul>
);

const Empty = (): ReactElement => (
  <div className="empty pop">
    <span className="art" aria-hidden="true">
      <IconBag />
    </span>
    <div>
      <strong>No orders yet</strong>
      <p>Order from a supported store and it lands here within a minute.</p>
    </div>
  </div>
);

export const OrdersList = ({ data, loading, onRefresh }: Props): ReactElement => (
  <section className="card orders-card" aria-labelledby="orders-h">
    <div className="section-head">
      <h2 id="orders-h">Recent orders</h2>
      <button type="button" className="link" onClick={onRefresh} disabled={loading} aria-label="Refresh orders">
        <IconRefresh className={loading ? 'spin' : ''} /> Refresh
      </button>
    </div>
    {loading || !data ? (
      <SkeletonRows />
    ) : data.orders.length === 0 ? (
      <Empty />
    ) : (
      <ul className="orders">
        {data.orders.map((o, i) => (
          <OrderRow key={o.id} order={o} index={i} />
        ))}
      </ul>
    )}
  </section>
);
