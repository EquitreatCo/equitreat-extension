/** Minimal in-memory chrome.storage.local mock for unit tests. */
export const installChromeMock = (): { store: Record<string, unknown>; accessLevel: () => string | undefined } => {
  const store: Record<string, unknown> = {};
  let level: string | undefined;
  const local = {
    get: async (keys?: string | string[] | null) => {
      const list = keys == null ? Object.keys(store) : Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((k) => k in store).map((k) => [k, store[k]]));
    },
    set: async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    },
    setAccessLevel: async (options: { accessLevel: string }) => {
      level = options.accessLevel;
    },
    remove: async (keys: string | string[]) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
    },
  };
  (globalThis as unknown as { chrome: unknown }).chrome = { storage: { local } };
  return { store, accessLevel: () => level };
};
