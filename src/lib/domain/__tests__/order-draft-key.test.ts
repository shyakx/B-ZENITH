import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ORDER_DRAFT_KEY_STORAGE,
  clearDraftOrderKey,
  getOrCreateDraftOrderKey,
  readDraftOrderKey,
  writeDraftOrderKey,
  type DraftKeyStore,
} from "@/lib/domain/order-draft-key";

function memoryStore(initial?: Record<string, string>): DraftKeyStore {
  const data = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

describe("waiter draft order idempotency key", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("A generates and stores a UUID when no draft key exists", () => {
    const storage = memoryStore();
    const created = vi.fn(() => "draft-key-a");

    const key = getOrCreateDraftOrderKey(storage, created);

    expect(key).toBe("draft-key-a");
    expect(created).toHaveBeenCalledTimes(1);
    expect(readDraftOrderKey(storage)).toBe("draft-key-a");
  });

  it("B reuses the stored key on remount/refresh and does not create a replacement", () => {
    const storage = memoryStore({ [ORDER_DRAFT_KEY_STORAGE]: "draft-key-a" });
    const created = vi.fn(() => "draft-key-b");

    const first = getOrCreateDraftOrderKey(storage, created);
    const second = getOrCreateDraftOrderKey(storage, created);

    expect(first).toBe("draft-key-a");
    expect(second).toBe("draft-key-a");
    expect(created).not.toHaveBeenCalled();
    expect(readDraftOrderKey(storage)).toBe("draft-key-a");
  });

  it("C keeps the same key after a failed submit (no clear)", () => {
    const storage = memoryStore();
    const key = getOrCreateDraftOrderKey(storage, () => "draft-key-retry");

    expect(readDraftOrderKey(storage)).toBe(key);
    expect(getOrCreateDraftOrderKey(storage, () => "should-not-replace")).toBe(key);
  });

  it("D clears the stored key after a successful submit", () => {
    const storage = memoryStore();
    getOrCreateDraftOrderKey(storage, () => "draft-key-done");

    clearDraftOrderKey(storage);

    expect(readDraftOrderKey(storage)).toBeNull();
  });

  it("E issues a new UUID for the next draft after success", () => {
    const storage = memoryStore();
    const first = getOrCreateDraftOrderKey(storage, () => "draft-key-first");
    clearDraftOrderKey(storage);
    const next = getOrCreateDraftOrderKey(storage, () => "draft-key-next");

    expect(first).toBe("draft-key-first");
    expect(next).toBe("draft-key-next");
    expect(readDraftOrderKey(storage)).toBe("draft-key-next");
  });

  it("F writes only to the provided session store, never a shared local store", () => {
    const session = memoryStore();
    const local = memoryStore();

    writeDraftOrderKey("tab-only-key", session);

    expect(readDraftOrderKey(session)).toBe("tab-only-key");
    expect(readDraftOrderKey(local)).toBeNull();
  });

  it("treats a blank stored value as missing and stores a new key", () => {
    const storage = memoryStore({ [ORDER_DRAFT_KEY_STORAGE]: "   " });
    const key = getOrCreateDraftOrderKey(storage, () => "draft-key-blank");
    expect(key).toBe("draft-key-blank");
    expect(readDraftOrderKey(storage)).toBe("draft-key-blank");
  });

  it("stays usable when storage throws", () => {
    const storage: DraftKeyStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };

    expect(readDraftOrderKey(storage)).toBeNull();
    expect(getOrCreateDraftOrderKey(storage, () => "memory-only")).toBe("memory-only");
    expect(() => clearDraftOrderKey(storage)).not.toThrow();
  });
});
