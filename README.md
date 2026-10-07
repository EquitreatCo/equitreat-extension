<div align="center">

<img src="public/brand/badge.png" alt="equitreat" width="96">

# equitreat: earn stock when you shop

**A Chrome extension that pays you cashback in tokenized stock.**

[![CI](https://github.com/EquitreatCo/equitreat-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/EquitreatCo/equitreat-extension/actions/workflows/ci.yml)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-install-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/dfdpgkoidgfigaenachmeljmdbpfpdcc)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-F59E0B)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev)

[Website](https://www.equitreat.org) · [Supported stores](https://www.equitreat.org/stores) · [Chrome Web Store](https://chromewebstore.google.com/detail/dfdpgkoidgfigaenachmeljmdbpfpdcc)

</div>

---

## What it does

Install it once and shop as usual. When an order-confirmation page appears on a supported store, equitreat records the merchant, order number, total and currency. Nothing else on the page is read, and the extension has no access to any other site.

Each order is checked by a person, usually within a week, and becomes claimable as soon as it is approved. On the rewards page you connect a Solana wallet and pick one of 8 stock tokens, including an S&P 500 fund. It is bought on Meteora the moment you claim and sent straight to your wallet.

The base rate is **0.75% to 1.5%**: it rises with your spend tier, and the first part of each order earns the most. Holding the project token multiplies it, up to **3.0%**. Every payout is stock, never points or coupons.

Tokenized stock can go down as well as up. This is not investment advice.

## How the extension works

```
 confirmation page on a supported store
            │
            ▼
 ┌─────────────────────────┐   page signals (GA4, JSON-LD, Shopify, DOM)
 │ content scripts         │ ─────────────────────────────────────────┐
 │ main-world.ts (start)   │                                          │
 │ detector.ts  (idle)     │ ◀────────────────────────────────────────┘
 └───────────┬─────────────┘   scored order candidate
             │ chrome.runtime message
             ▼
 ┌─────────────────────────┐   insert (user JWT)      ┌──────────────────┐
 │ service worker          │ ───────────────────────▶ │ Supabase         │
 │ queue · retry · session │ ◀─────────────────────── │ orders, profiles │
 └───────────┬─────────────┘   reward summary         └──────────────────┘
             │
             ▼
 ┌─────────────────────────┐
 │ popup (380 px)          │  is tracking on · did my order count · what have I earned
 └─────────────────────────┘
```

- **Detection** combines several independent signals on the page and only records an order when the score is high enough. Supported stores are matched by explicit host patterns generated from the store list, so there is no `<all_urls>` permission.
- **Uploading** happens from the service worker. Orders wait in a local queue and are retried once a minute until the backend accepts them.
- **Permissions** are `storage`, `alarms` and `identity` only. No `tabs`, no browsing history.

## Repository layout

| Path | What it is |
|---|---|
| `src/content/` | Content scripts: the main-world probe and the isolated-world detector |
| `src/detect/` | Order detection: GA4, JSON-LD, Shopify and DOM signals, and the scoring |
| `src/background/` | Service worker: Supabase client, upload queue, message router, reward summary |
| `src/popup/` | React popup: sign-in, wallet, earnings, tier strip, recent orders |
| `src/lib/` | Storage, hashing and messaging helpers |
| `src/shared/` | Order schema, amount parser, FX helpers and the generated store list |
| `test/` | Vitest suites (happy-dom), including the shared helpers |
| `e2e/` | Playwright smoke test that loads the built extension |
| `public/` | Icons and brand assets bundled into the extension |
| `manifest.config.ts` | The Manifest V3 definition, built by CRXJS from environment variables |

## Quick start

Prerequisites: Node.js 22 or newer and pnpm 9.

```bash
git clone https://github.com/EquitreatCo/equitreat-extension.git
cd equitreat-extension
pnpm install
cp .env.example .env            # then fill in the values below
```

```bash
pnpm test && pnpm typecheck     # 154 tests
pnpm build                      # writes dist/
```

Open `chrome://extensions`, turn on Developer mode, choose **Load unpacked** and select the `dist` folder. `pnpm dev` rebuilds on every change.

## Configuration

All build-time settings come from `.env` (see `.env.example` for the full list with comments):

| Variable | What it is for |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL. It is also the only `host_permissions` entry in the manifest |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The project's publishable key |
| `VITE_GOOGLE_CLIENT_ID` | OAuth client id for Google sign-in through `chrome.identity` |
| `VITE_WALLET_CONNECT_URL` | The rewards page that is allowed to message the extension |
| `VITE_EXTENSION_PUBLIC_KEY` | Optional. Pins the extension id of development builds |

Release builds set `EQUITREAT_RELEASE=1`, which drops the `key` field and allows only the production rewards page origin.

The extension talks to the equitreat backend (Supabase Postgres and Edge Functions) and the rewards website. Those live in separate repositories; this one contains the extension only.

## Security and privacy

- Content scripts run only on the listed stores, matched by explicit host patterns. The extension cannot see any other site.
- On a confirmation page it extracts merchant, order number, total and currency, and nothing else.
- Orders are recorded with the signed-in user's own token. Nothing is payable until a person approves it on the backend.
- The service worker keeps the sign-in session, a queue of orders waiting to upload and a pause setting in `chrome.storage`.

Found a vulnerability? Please email **equitreatco@gmail.com** instead of opening a public issue.

## Disclaimer

Tokenized stocks are volatile and can lose value as well as gain it. equitreat gives no investment advice and makes no promises about returns.
