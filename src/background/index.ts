import { fail, ok, type RuntimeMessage } from '../lib/messages';
import { restrictStorageToExtension } from '../lib/storage';
import { createExtensionSupabase } from '../lib/supabase';
import { handleMessage } from './handlers';
import { requestLinkToken } from './link';
import { flush } from './queue';

const FLUSH_ALARM = 'era-flush';
const FLUSH_PERIOD_MINUTES = 1;

const supabase = createExtensionSupabase();

// Runs on every service-worker start; the setting is cheap to reapply.
restrictStorageToExtension().catch((err: unknown) => console.warn('[equitreat] could not restrict storage access:', err));

const isRuntimeMessage = (value: unknown): value is RuntimeMessage =>
  typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: FLUSH_PERIOD_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== FLUSH_ALARM) return;
  flush(supabase).catch((err: unknown) => console.warn('[equitreat] scheduled flush failed:', err));
});

/**
 * The rewards page may message the extension directly by id (externally_connectable, which Chrome
 * limits to the rewards site) for two things only: detecting the extension, and a single-use link
 * token after the user pressed "Link wallet" in the popup. The Supabase session never leaves the
 * extension, and no signatures or wallet data pass through here.
 */
const EXTERNAL_TYPES = new Set(['ping', 'link:token']);

/** Content scripts run inside arbitrary web pages, so they may only report order candidates. */
const CONTENT_SCRIPT_TYPES: ReadonlySet<RuntimeMessage['type']> = new Set(['order:candidate']);

/**
 * Our own pages carry a chrome-extension://<id>/ URL; a content script carries the web page's. Both
 * arrive with a tab when the page is a tab rather than the toolbar popup, so the URL is what
 * separates them. Web pages cannot reach this listener at all — they go to onMessageExternal.
 */
const fromOwnPage = (sender: chrome.runtime.MessageSender): boolean => (sender.url ?? '').startsWith(chrome.runtime.getURL(''));

chrome.runtime.onMessageExternal.addListener((message: unknown, _sender, sendResponse) => {
  const type = (message as { type?: unknown } | null)?.type;
  if (typeof type !== 'string' || !EXTERNAL_TYPES.has(type)) {
    sendResponse(fail('Unsupported external message'));
    return false;
  }
  if (type === 'ping') {
    sendResponse(ok({ version: chrome.runtime.getManifest().version }));
    return false;
  }
  requestLinkToken(supabase)
    .then((data) => sendResponse(ok(data)))
    .catch((err: unknown) => sendResponse(fail(err)));
  return true;
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) {
    sendResponse(fail('Unknown sender'));
    return false;
  }
  if (!isRuntimeMessage(message)) {
    sendResponse(fail('Malformed message'));
    return false;
  }
  if (sender.tab && !fromOwnPage(sender) && !CONTENT_SCRIPT_TYPES.has(message.type)) {
    sendResponse(fail('Not allowed from a web page'));
    return false;
  }
  handleMessage(supabase, message)
    .then((data) => sendResponse(ok(data)))
    .catch((err: unknown) => {
      console.warn(`[equitreat] ${message.type} failed:`, err);
      sendResponse(fail(err));
    });
  return true;
});
