import type { ReactElement } from 'react';
import { shortAddress } from '../format';
import { IconArrow, IconWallet } from './icons';

interface Props {
  readonly wallet: string | null;
  readonly loading: boolean;
  /** Opens the rewards page in link mode: the user signs once there to attach a wallet to this account. */
  readonly onLink: () => void;
  /** Opens the rewards page to view balances, change the wallet, or claim. */
  readonly onManage: () => void;
}

/**
 * Payout wallet, read-only. The extension never asks for an address or a signature; the rewards
 * page (which talks to the wallet) links it, and this row just reflects the result.
 */
export const WalletSetup = ({ wallet, loading, onLink, onManage }: Props): ReactElement => {
  if (loading) {
    return (
      <div className="wallet-row" aria-busy="true">
        <span className="ico" aria-hidden="true" />
        <div className="t" style={{ gap: 6 }}>
          <span className="sk" style={{ display: 'block', width: '40%', height: 10 }} aria-hidden="true" />
          <span className="sk" style={{ display: 'block', width: '70%', height: 12 }} aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (!wallet) {
    return (
      <section className="wallet-setup pop" aria-labelledby="wallet-setup-h">
        <div className="steps" aria-hidden="true">
          <span className="done" />
          <span />
        </div>
        <div className="label" style={{ marginTop: 12 }}>
          Step 2 of 2
        </div>
        <h3 id="wallet-setup-h">Say where your shares land.</h3>
        <p>Opens the rewards page in a new tab. Connect Phantom or any Solana wallet there and sign once; no transaction, no network fee.</p>
        <button type="button" className="btn primary block" onClick={onLink}>
          <IconWallet /> Link wallet on the rewards page
        </button>
        <p className="cap">Orders are already being recorded; the wallet only decides where rewards go.</p>
      </section>
    );
  }

  return (
    <button type="button" className="wallet-row" onClick={onManage} title="Open the rewards page">
      <span className="ico" aria-hidden="true">
        <IconWallet />
      </span>
      <span className="t">
        <span className="label">Rewards go to</span>
        <strong title={wallet}>{shortAddress(wallet)}</strong>
      </span>
      <IconArrow className="arrow" />
    </button>
  );
};
