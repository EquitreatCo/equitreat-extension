/**
 * Loads the built extension into a real Chromium and checks what a user actually sees, with no
 * backend of any kind. The other e2e file proves the recording pipeline against live Supabase and
 * skips without credentials; this one always runs, so "does the popup render, on brand, without
 * errors" is never left to a screenshot of a mock.
 *
 * Requires only: pnpm --filter @equitreat/extension build
 * Run: pnpm --filter @equitreat/extension test:e2e
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const EXT_DIST = join(here, '..', 'dist');
const SETTLE_MS = 1200;

const PAPER = 'rgb(255, 255, 255)';
/** The CSS minifier shortens #FFFFFF to #FFF, so hex is compared in one canonical form. */
const hex6 = (value) => {
  const v = value.trim().toUpperCase();
  return /^#[0-9A-F]{3}$/.test(v) ? '#' + [...v.slice(1)].map((c) => c + c).join('') : v;
};
/** The Cash Green palette must not survive anywhere in the popup. */
const GREENS = ['rgb(0, 214, 50)', 'rgb(0, 168, 39)', 'rgb(76, 240, 107)', 'rgb(232, 251, 236)'];

const withPopup = async (run) => {
  const profileDir = mkdtempSync(join(tmpdir(), 'era-popup-'));
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${EXT_DIST}`, `--load-extension=${EXT_DIST}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 15000 }));
    const extId = new URL(worker.url()).host;
    const popup = await context.newPage();
    const errors = [];
    popup.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    popup.on('pageerror', (e) => errors.push(String(e)));
    await popup.goto(`chrome-extension://${extId}/src/popup/index.html`);
    await popup.waitForTimeout(SETTLE_MS);
    return await run({ popup, errors, extId, context });
  } finally {
    await context.close();
    rmSync(profileDir, { recursive: true, force: true });
  }
};

test('the built extension loads and its popup renders without errors', async () => {
  await withPopup(async ({ popup, errors }) => {
    const body = await popup.textContent('body');
    assert.ok(body && body.trim().length > 0, 'the popup rendered something');
    assert.ok(/equitreat/i.test(body), 'the popup carries the wordmark');
    // A sign-in surface is what a fresh install shows; the exact wording lives in the components.
    assert.ok(/sign in|continue with|email/i.test(body), `expected a sign-in surface, got: ${body.slice(0, 200)}`);
    assert.deepEqual(errors, [], 'no console or page errors while the popup renders');
  });
});

test('the popup is on brand: amber, ink and Fredoka, with no Cash Green anywhere', async () => {
  await withPopup(async ({ popup }) => {
    const tokens = await popup.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const read = (name) => root.getPropertyValue(name).trim();
      return {
        amber: read('--amber'), ink: read('--ink'), paper: read('--paper'),
        wordmarkFace: read('--font-wordmark'), green: read('--green'), mint: read('--mint'),
      };
    });
    assert.equal(hex6(tokens.amber), '#F59E0B');
    assert.equal(hex6(tokens.ink), '#17150F');
    assert.equal(hex6(tokens.paper), '#FFFFFF');
    assert.ok(/Fredoka/i.test(tokens.wordmarkFace), `the wordmark face is Fredoka, got ${tokens.wordmarkFace}`);
    assert.equal(tokens.green, '', 'the --green token is gone');
    assert.equal(tokens.mint, '', 'the --mint token is gone');

    // The wordmark must actually resolve to Fredoka, not silently fall back to system-ui.
    const wordmark = await popup.evaluate(() => {
      const el = document.querySelector('.wordmark .name');
      return el ? getComputedStyle(el).fontFamily : null;
    });
    assert.ok(wordmark && /Fredoka/i.test(wordmark), `the wordmark renders in Fredoka, got ${wordmark}`);

    // Nothing painted anywhere in the popup may be a Cash Green.
    const painted = await popup.evaluate(() =>
      [...document.querySelectorAll('*')].flatMap((el) => {
        const s = getComputedStyle(el);
        return [s.backgroundColor, s.color, s.borderTopColor];
      }),
    );
    for (const green of GREENS) {
      assert.ok(!painted.includes(green), `${green} is still painted in the popup`);
    }
    assert.ok(painted.includes(PAPER), 'the popup is a white surface');
  });
});

test('the popup never does wallet work itself, and carries no pre-Solana wording', async () => {
  await withPopup(async ({ popup }) => {
    const body = (await popup.textContent('body')) ?? '';
    assert.ok(!/connect wallet|seed phrase|private key/i.test(body), 'the popup never asks to connect a wallet');
    assert.ok(!/metamask|ethereum|robinhood|usdg|uniswap/i.test(body), `no pre-Solana wording: ${body.slice(0, 200)}`);
  });
});

test('the built manifest is what the Web Store expects', () => {
  const m = JSON.parse(readFileSync(join(EXT_DIST, 'manifest.json'), 'utf8'));
  assert.equal(m.manifest_version, 3);
  assert.match(m.version, /^\d+\.\d+\.\d+$/);
  assert.ok(m.description.length <= 132, 'the Web Store summary limit is 132 characters');
  assert.ok(m.name.length <= 45, 'the Web Store name limit is 45 characters');
  assert.deepEqual([...m.permissions].sort(), ['alarms', 'identity', 'storage'], 'no permission has crept in');
  assert.ok(!JSON.stringify(m).includes('<all_urls>'), 'content scripts are matched to listed stores only');
  assert.ok(m.host_permissions.every((h) => h.startsWith('https://')), 'host permissions are https only');
  for (const size of ['16', '32', '48', '128']) assert.ok(m.icons[size], `icon ${size} is declared`);
});

test('no screen can be Cash Green: the built stylesheet carries none of it', async () => {
  // The signed-in screens (earnings, orders, wallet setup) need a session to render, so the built
  // stylesheet is scanned directly — that covers every screen, not just the ones a test can reach.
  const { readdirSync } = await import('node:fs');
  const assets = join(EXT_DIST, 'assets');
  const sheets = readdirSync(assets).filter((f) => f.endsWith('.css'));
  assert.ok(sheets.length > 0, 'the build produced a stylesheet');
  const css = sheets.map((f) => readFileSync(join(assets, f), 'utf8')).join('\n').toUpperCase();
  for (const green of ['#00D632', '#00A827', '#4CF06B', '#E8FBEC']) {
    assert.ok(!css.includes(green), `${green} is still in the built stylesheet`);
  }
  for (const token of ['--GREEN:', '--MINT:', '--GREEN-DK', '--GREEN-LT']) {
    assert.ok(!css.includes(token), `${token} is still declared`);
  }
  assert.ok(css.includes('#F59E0B'), 'amber is present');
  assert.ok(css.includes('#B45309'), 'bronze is present');
  // The earnings card is the product's one ink ground, carrying a light-amber figure.
  assert.ok(/\.EARNINGS\s*\{[^}]*BACKGROUND:\s*VAR\(--INK\)/.test(css), 'the earnings card is an ink ground');
  assert.ok(/\.EARNINGS\s+\.AMOUNT\s*\{[^}]*COLOR:\s*VAR\(--AMBER-LT\)/.test(css), 'the claimable figure is light amber');
});
