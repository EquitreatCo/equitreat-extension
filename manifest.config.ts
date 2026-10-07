import { defineManifest } from '@crxjs/vite-plugin';
import { merchantMatchPatterns } from './src/shared/merchants.js';

/**
 * Two build flavours:
 * - dev / tester (default): pins the extension id with VITE_EXTENSION_PUBLIC_KEY and allows the
 *   localhost rewards page, so "Load unpacked" builds talk to the same site as the store build.
 * - release (EQUITREAT_RELEASE=1, used by `pnpm extension:zip`): no `key` (the Web Store rejects it on
 *   upload and assigns the id itself) and only the production rewards page origin.
 */
const RELEASE = process.env.EQUITREAT_RELEASE === '1';
const NAME = 'equitreat: earn stock when you shop';
const SHORT_NAME = 'equitreat';
const SUMMARY = 'Earn cashback paid in tokenized stock (NVDA, AAPL, TSLA and more) when you shop at supported stores. Orders recorded automatically.';
const VERSION = '0.6.0';
/** MAIN-world content scripts need Chrome 111; 116 also covers the current identity API behaviour. */
const MIN_CHROME = '116';

const DEFAULT_WALLET_CONNECT_URL = 'http://localhost:5178/claim-rewards';
const LOCAL_WALLET_CONNECT_URLS = [DEFAULT_WALLET_CONNECT_URL, 'http://127.0.0.1:5178/claim-rewards'];
/** Content scripts run only on the listed stores (src/shared/merchants.generated.ts). */
const STORE_MATCHES = merchantMatchPatterns();
const ICONS = { 16: 'icons/icon16.png', 32: 'icons/icon32.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' };

/** Origins allowed to message the extension directly by id (the rewards page: ping and link:token only). */
/* Runs inside the manifest factory, after vite.config has copied .env into process.env. */
const externallyConnectable = (): string[] => {
  const env = process.env.VITE_WALLET_CONNECT_URL?.trim();
  if (RELEASE && !env?.startsWith('https://')) {
    throw new Error('Release builds need VITE_WALLET_CONNECT_URL set to the https rewards page; it is the only origin allowed to message the extension');
  }
  const configured = env || DEFAULT_WALLET_CONNECT_URL;
  const urls = RELEASE ? [configured] : [configured, ...LOCAL_WALLET_CONNECT_URLS];
  return [...new Set(urls.map((u) => `${new URL(u).origin}/*`))];
};

/**
 * The service worker calls two Edge Functions (link-token, fx-refresh) whose CORS allows only the website, so it
 * needs host access to the Supabase project. That and the listed stores are the only sites the extension can touch.
 */
const supabaseHost = (): string => {
  const url = process.env.VITE_SUPABASE_URL?.trim();
  if (!url?.startsWith('https://')) throw new Error('VITE_SUPABASE_URL must be the https Supabase project URL');
  return `${new URL(url).origin}/*`;
};

if (SUMMARY.length > 132) throw new Error('Manifest description must be at most 132 characters (Web Store summary limit)');
if (NAME.length > 45) throw new Error('Manifest name must be at most 45 characters (Web Store limit)');

export default defineManifest(() => ({
  manifest_version: 3,
  name: NAME,
  short_name: SHORT_NAME,
  version: VERSION,
  description: SUMMARY,
  minimum_chrome_version: MIN_CHROME,
  homepage_url: "https://www.equitreat.org",
  ...(!RELEASE && process.env.VITE_EXTENSION_PUBLIC_KEY ? { key: process.env.VITE_EXTENSION_PUBLIC_KEY } : {}),
  /* storage: session + order queue + pause flag; alarms: retry uploads; identity: Google sign-in.
     No <all_urls>: content scripts are matched to the listed stores only.
     No `tabs`: chrome.tabs.create needs no permission, and nothing reads tab URLs or titles. */
  permissions: ['storage', 'alarms', 'identity'],
  host_permissions: [supabaseHost()],
  externally_connectable: { matches: externallyConnectable() },
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: SHORT_NAME,
    default_icon: ICONS,
  },
  content_scripts: [
    {
      matches: STORE_MATCHES,
      js: ['src/content/main-world.ts'],
      run_at: 'document_start',
      world: 'MAIN',
      all_frames: false,
    },
    {
      matches: STORE_MATCHES,
      js: ['src/content/detector.ts'],
      run_at: 'document_idle',
      all_frames: false,
    },
  ],
  icons: ICONS,
}));
