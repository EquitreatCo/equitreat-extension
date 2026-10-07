/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_EXTENSION_PUBLIC_KEY: string;
  readonly VITE_WALLET_CONNECT_URL: string;
  /** EVM chain id rewards are paid on; the wallet page switches the wallet to it. */
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
