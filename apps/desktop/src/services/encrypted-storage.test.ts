import { describe, it, expect, beforeEach, vi } from "vitest";
import { createEncryptedStorage } from "./encrypted-storage";

// Controllable crypto mock (overrides the global test-helpers/setup.ts mock here),
// so we can exercise both the success and the encryption-failure paths.
const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => invokeMock(cmd, args),
}));

// vitest runs in a node env (no DOM) — provide a minimal in-memory localStorage.
function installLocalStorage(): Map<string, string> {
  const map = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  return map;
}

describe("encrypted storage adapter (#2 encrypt-at-rest)", () => {
  let map: Map<string, string>;

  beforeEach(() => {
    map = installLocalStorage();
    invokeMock.mockReset();
    // Reversible test crypto (UTF-8 bytes). Real ChaCha20 is tested in Rust.
    invokeMock.mockImplementation(
      async (cmd: string, args: { plaintext?: string; ciphertext?: number[] }) => {
        if (cmd === "encrypt_string")
          return Array.from(new TextEncoder().encode(args.plaintext ?? ""));
        if (cmd === "decrypt_string")
          return new TextDecoder().decode(Uint8Array.from(args.ciphertext ?? []));
        return null;
      }
    );
  });

  it("does not write plaintext at rest and round-trips on read", async () => {
    const s = createEncryptedStorage();
    const value = JSON.stringify({ secret: "Mario Rossi — IBAN IT60X0..." });
    await s.setItem("pii-vault", value);

    const raw = map.get("pii-vault")!;
    expect(raw).not.toContain("Mario Rossi");
    expect(raw.startsWith("enc:v1:")).toBe(true);
    expect(await s.getItem("pii-vault")).toBe(value);
  });

  it("reads legacy plaintext as-is (zero-data-loss migration)", async () => {
    const legacy = JSON.stringify({ legacy: "plain" });
    map.set("pii-vault", legacy);
    const s = createEncryptedStorage();
    expect(await s.getItem("pii-vault")).toBe(legacy);
  });

  it("returns null for undecryptable ciphertext instead of leaking it", async () => {
    map.set("pii-vault", "enc:v1:@@not-base64@@");
    const s = createEncryptedStorage();
    expect(await s.getItem("pii-vault")).toBeNull();
  });

  it("#1: does NOT persist plaintext when encryption fails", async () => {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "encrypt_string") throw new Error("crypto unavailable");
      return null;
    });
    const s = createEncryptedStorage();
    await s.setItem("pii-vault", JSON.stringify({ secret: "Mario Rossi" }));

    // Nothing persisted (in-memory only) — crucially, NO plaintext PII at rest.
    expect(map.get("pii-vault")).toBeUndefined();
    expect(JSON.stringify([...map.values()])).not.toContain("Mario Rossi");
  });
});
