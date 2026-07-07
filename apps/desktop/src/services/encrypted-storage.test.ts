import { describe, it, expect, beforeEach } from "vitest";
import { createEncryptedStorage } from "./encrypted-storage";

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
  });

  it("does not write plaintext at rest and round-trips on read", async () => {
    const s = createEncryptedStorage();
    const value = JSON.stringify({ secret: "Mario Rossi — IBAN IT60X0..." });

    await s.setItem("pii-vault", value);

    const raw = map.get("pii-vault")!;
    expect(raw).not.toContain("Mario Rossi"); // not plaintext on disk
    expect(raw.startsWith("enc:v1:")).toBe(true);
    expect(await s.getItem("pii-vault")).toBe(value); // decrypts back exactly
  });

  it("reads legacy plaintext as-is (zero-data-loss migration)", async () => {
    const legacy = JSON.stringify({ legacy: "plain" });
    map.set("pii-vault", legacy); // pre-encryption value
    const s = createEncryptedStorage();
    expect(await s.getItem("pii-vault")).toBe(legacy);
  });

  it("returns null for undecryptable ciphertext instead of leaking it", async () => {
    map.set("pii-vault", "enc:v1:@@not-base64@@");
    const s = createEncryptedStorage();
    expect(await s.getItem("pii-vault")).toBeNull();
  });
});
