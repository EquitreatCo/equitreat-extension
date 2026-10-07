import type { ReactElement } from 'react';
import { openRewardsPage } from '../../lib/links';
import { sendMessage, type ProfileRow, type RecentOrders, type SessionSummary, type Settings } from '../../lib/messages';
import { useAsync } from '../hooks/useAsync';
import { AccountRow } from './AccountRow';
import { EarningsPanel } from './EarningsPanel';
import { Feedback } from './Feedback';
import { OrdersList } from './OrdersList';
import { TierStrip } from './TierStrip';
import { TopBar } from './TopBar';
import { WalletSetup } from './WalletSetup';

interface Props {
  readonly session: SessionSummary;
  readonly onSignedOut: () => void;
}

export const SignedIn = ({ session, onSignedOut }: Props): ReactElement => {
  const profile = useAsync(() => sendMessage<ProfileRow | null>({ type: 'profile:get' }), []);
  const settings = useAsync(() => sendMessage<Settings>({ type: 'settings:get' }), []);
  const orders = useAsync(() => sendMessage<RecentOrders>({ type: 'orders:recent' }), []);
  const firstError = profile.error ?? settings.error ?? orders.error;

  return (
    <>
      <TopBar paused={settings.data?.paused ?? null} onToggled={settings.reload} />
      {firstError && <Feedback kind="error">{firstError}</Feedback>}
      <EarningsPanel data={orders.data} loading={orders.loading} onClaim={() => openRewardsPage('view')} />
      <TierStrip data={orders.loading ? null : orders.data} />
      <WalletSetup wallet={profile.data?.payout_wallet ?? null} loading={profile.loading} onLink={() => openRewardsPage('link')} onManage={() => openRewardsPage('view')} />
      <OrdersList data={orders.data} loading={orders.loading} onRefresh={orders.reload} />
      <AccountRow session={session} onSignedOut={onSignedOut} />
    </>
  );
};
