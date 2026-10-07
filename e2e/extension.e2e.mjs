/**
 * Real-browser end-to-end test: loads the built extension into Chromium, signs in with an email
 * code minted through the Supabase admin API (the extension never touches a wallet), visits fixture
 * confirmation pages, and verifies rows in the live Supabase project. Requires:
 *   pnpm --filter @equitreat/extension build   (dev build: pinned id + localhost origin)
 *   pnpm --filter @equitreat/web dev            (rewards page on :5178)
 *   SUPABASE_URL, SUPABASE_SECRET_KEY     (service role; the test user is deleted at the end)
 * The fixture shop is served on localhost but reached as www.target.com (listed) and www.etsy.com (not listed)
 * through Chromium's host resolver, so the content scripts see real store hostnames.
 * Run: pnpm --filter @equitreat/extension test:e2e
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { startFixtureServer } from './fixture-server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const EXT_DIST = join(here, '..', 'dist');
const REWARDS_PAGE = process.env.WALLET_CONNECT_URL ?? 'http://localhost:5178/claim-rewards';
const SHOP_PORT = 5179;
const SHOP = `https://www.target.com:${SHOP_PORT}`;
const UNLISTED_SHOP = `https://www.etsy.com:${SHOP_PORT}`;
const HOST_RULES = '--host-resolver-rules=MAP www.target.com 127.0.0.1, MAP www.etsy.com 127.0.0.1';
const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;

test('extension records confirmed orders for an email-signed-in user', { skip: !SUPABASE_URL || !SUPABASE_SECRET_KEY ? 'set SUPABASE_URL and SUPABASE_SECRET_KEY' : false }, async () => {
  const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  const shopServer = await startFixtureServer(SHOP_PORT);
  const profileDir = mkdtempSync(join(tmpdir(), 'era-e2e-'));
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chromium',
    headless: true,
    ignoreHTTPSErrors: true,
    args: [`--disable-extensions-except=${EXT_DIST}`, `--load-extension=${EXT_DIST}`, HOST_RULES],
  });
  let userId;
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 15000 }));
    const extId = new URL(worker.url()).host;

    // Email-code sign-in: the popup verifies a one-time code; the code is minted with the admin API.
    const email = `e2e-${randomBytes(6).toString('hex')}@example.com`;
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    assert.ok(created.data.user, `createUser failed: ${created.error?.message}`);
    userId = created.data.user.id;
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    const code = link.data?.properties?.email_otp;
    assert.ok(code, `generateLink returned no email_otp: ${link.error?.message}`);

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extId}/src/popup/index.html`);
    await popup.waitForTimeout(1500);
    const rpc = (msg) => popup.evaluate((m) => new Promise((r) => chrome.runtime.sendMessage(m, r)), msg);
    // The rewards page may only ask the extension for a ping and the account token; nothing else from outside.
    const site = await context.newPage();
    await site.goto(REWARDS_PAGE);
    const external = (msg) => site.evaluate(({ id, m }) => new Promise((resolve) => { try { chrome.runtime.sendMessage(id, m, (r) => resolve(r ?? null)); } catch { resolve(null); } setTimeout(() => resolve(null), 2000); }), { id: extId, m: msg });
    const ping = await external({ type: 'ping' });
    assert.equal(ping?.ok, true, 'extension answers external ping from the rewards page');
    const relay = await external({ type: 'siwe:relay', payload: {} });
    assert.equal(relay?.ok, false, 'signature relay is not an accepted external message');
    const verified = await rpc({ type: 'auth:email-verify', email, token: code });
    assert.equal(verified.ok, true, `email verify failed: ${verified.error}`);
    const session = await rpc({ type: 'auth:get-session' });
    assert.equal(session?.data?.userId, userId, 'session present after email code');
    assert.ok(!('walletAddress' in session.data), 'the session carries no wallet address at all: wallets live on the rewards page');

    // Confirmation page with a dataLayer purchase event.
    const shop = await context.newPage();
    await shop.goto(`${SHOP}/checkout/thank-you`);
    await shop.waitForTimeout(2500);
    const first = await admin.from('orders').select('merchant_domain, order_id, amount, currency, detection_method, confidence').eq('user_id', userId);
    assert.deepEqual(first.data, [{ merchant_domain: 'target.com', order_id: 'E2E-1001', amount: 129.99, currency: 'USD', detection_method: 'mixed', confidence: 100 }]);

    // Page text alone is not trusted on a generic path, so a bare /order-received records nothing.
    await shop.goto(`${SHOP}/order-received`);
    await shop.waitForTimeout(2500);
    const generic = await admin.from('orders').select('id').eq('user_id', userId);
    assert.equal(generic.data.length, 1, 'a generic confirmation URL needs a structured signal');

    // DOM-only confirmation (EUR) on a known platform URL is recorded; a cart page is not.
    await shop.goto(`${SHOP}/checkout/order-received/7788/`);
    await shop.waitForTimeout(2500);
    await shop.goto(`${SHOP}/cart`);
    await shop.waitForTimeout(1500);
    const all = await admin.from('orders').select('order_id, amount, currency').eq('user_id', userId).order('detected_at');
    assert.deepEqual(all.data.map((r) => r.order_id), ['E2E-1001', '7788']);
    assert.deepEqual(all.data[1], { order_id: '7788', amount: 45, currency: 'EUR' });

    // Revisiting the same confirmation must not create a second row.
    await shop.goto(`${SHOP}/checkout/thank-you`);
    await shop.waitForTimeout(1500);
    const again = await admin.from('orders').select('id').eq('user_id', userId).eq('order_id', 'E2E-1001');
    assert.equal(again.data.length, 1);

    // The same confirmation page on a store that is not on the allowlist records nothing.
    await shop.goto(`${UNLISTED_SHOP}/checkout/thank-you`);
    await shop.waitForTimeout(2500);
    const afterUnlisted = await admin.from('orders').select('merchant_domain').eq('user_id', userId);
    assert.equal(afterUnlisted.data.length, 2, 'an unlisted store records nothing');
    assert.ok(afterUnlisted.data.every((r) => r.merchant_domain === 'target.com'));

    // Manual console test on a refreshed, neutral page (the flow a user follows from EQUITREAT_TECHNICAL_DOCUMENT.md §17).
    await shop.goto(`${SHOP}/plain`);
    await shop.reload();
    await shop.waitForTimeout(800);
    // A purchase event alone scores 50 against a threshold of 60, so the snippet stands up the same
    // evidence a real confirmation page carries: a headline and a total. This is the flow in TESTING.md.
    await shop.evaluate(() => {
      document.body.insertAdjacentHTML('afterbegin', '<h1>Thank you! Your order has been received.</h1><p>Order total: $42.50</p>');
      window.postMessage(
        { channel: 'era:signal', kind: 'datalayer', payload: { event: 'purchase', ecommerce: { transaction_id: 'TEST-1', value: 42.5, currency: 'USD' } } },
        location.origin,
      );
    });
    await shop.waitForTimeout(2000);
    const manual = await admin.from('orders').select('order_id, amount, currency, raw_signals').eq('user_id', userId).eq('order_id', 'TEST-1').maybeSingle();
    assert.ok(manual.data, 'manual dataLayer snippet on a reloaded page is recorded');
    assert.equal(manual.data.raw_signals.navigationType, 'reload');

    // Wallets are linked on the rewards page only; the extension exposes no wallet-setting message.
    const noWallet = await rpc({ type: 'profile:set-wallet', wallet: '6dxKpWvTq4NVjmA7bTfuYRTqLKPnV6uZ3sMxWvTq4Nb' });
    assert.equal(noWallet.ok, false, 'profile:set-wallet is gone from the extension');
    const noIntent = await external({ type: 'link:token' });
    assert.equal(noIntent?.ok, false, 'no link token before the user presses Link wallet');
    await rpc({ type: 'link:begin' });
    const token = await external({ type: 'link:token' });
    assert.ok(token?.data?.linkToken, 'after Link wallet the rewards page gets one link token');
    const reused = await external({ type: 'link:token' });
    assert.equal(reused?.ok, false, 'the link intent is single-use');

    const recent = await rpc({ type: 'orders:recent' });
    assert.equal(recent.data.orders.length, 3);
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
    await context.close();
    shopServer.close();
    rmSync(profileDir, { recursive: true, force: true });
  }
});
