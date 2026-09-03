export const ORDER_DRAFT_KEY_STORAGE = "b-zenith:order-draft-idempotency-key";

export type DraftKeyStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** sessionStorage only — per tab, survives refresh, unavailable during SSR. */
export function browserDraftOrderStorage(): DraftKeyStore | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function usableKey(value: string | null | undefined) {
  const key = value?.trim() ?? "";
  return key || null;
}

export function readDraftOrderKey(storage: DraftKeyStore | null = browserDraftOrderStorage()) {
  try {
    return usableKey(storage?.getItem(ORDER_DRAFT_KEY_STORAGE));
  } catch {
    return null;
  }
}

export function writeDraftOrderKey(
  key: string,
  storage: DraftKeyStore | null = browserDraftOrderStorage(),
) {
  const usable = usableKey(key);
  if (!usable || !storage) return;
  try {
    storage.setItem(ORDER_DRAFT_KEY_STORAGE, usable);
  } catch {
    // Storage can be blocked by browser settings; fall back to in-memory usage.
  }
}

export function clearDraftOrderKey(storage: DraftKeyStore | null = browserDraftOrderStorage()) {
  try {
    storage?.removeItem(ORDER_DRAFT_KEY_STORAGE);
  } catch {
    // ignore
  }
}

/** Reuse stored draft key or generate exactly one new UUID for this draft. */
export function getOrCreateDraftOrderKey(
  storage: DraftKeyStore | null = browserDraftOrderStorage(),
  createKey: () => string = () => crypto.randomUUID(),
) {
  const existing = readDraftOrderKey(storage);
  if (existing) return existing;
  const next = createKey().trim();
  writeDraftOrderKey(next, storage);
  return next;
}
