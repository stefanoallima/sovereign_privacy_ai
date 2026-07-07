import { invoke } from "@tauri-apps/api/core";

/**
 * Zustand `persist` storage backed by localStorage, but with VALUES encrypted at
 * rest via the OS-keychain-backed key (Rust `crypto.rs`, ChaCha20-Poly1305), so
 * sensitive stores (PII vault, redaction registry) are never plaintext on disk.
 *
 * Zero-data-loss migration: a legacy plaintext value is read as-is and
 * re-encrypted on the next write. If platform crypto is unavailable (non-Tauri /
 * dev / tests), it degrades to plaintext so the app still works and migrates once
 * encryption becomes available. An undecryptable value (corrupt / rotated key) is
 * treated as absent rather than surfaced as ciphertext.
 */

const ENC_PREFIX = "enc:v1:";

const ls = (): Storage | null =>
  typeof localStorage !== "undefined" ? localStorage : null;

function bytesToBase64(bytes: number[]): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b & 0xff);
  return btoa(bin);
}

function base64ToBytes(b64: string): number[] {
  const bin = atob(b64);
  const out = new Array<number>(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function createEncryptedStorage() {
  return {
    async getItem(name: string): Promise<string | null> {
      const store = ls();
      if (!store) return null;
      const raw = store.getItem(name);
      if (raw == null) return null;
      // Legacy plaintext (pre-encryption) — return as-is; re-encrypted on next write.
      if (!raw.startsWith(ENC_PREFIX)) return raw;
      try {
        const bytes = base64ToBytes(raw.slice(ENC_PREFIX.length));
        return await invoke<string>("decrypt_string", { ciphertext: bytes });
      } catch {
        // Undecryptable — treat as absent rather than surface ciphertext.
        return null;
      }
    },
    async setItem(name: string, value: string): Promise<void> {
      const store = ls();
      if (!store) return;
      try {
        const bytes = await invoke<number[]>("encrypt_string", { plaintext: value });
        store.setItem(name, ENC_PREFIX + bytesToBase64(bytes));
      } catch (e) {
        // NEVER persist raw PII as plaintext. If encryption is unavailable, SKIP the
        // write — the in-memory store still works and the next change retries. Better
        // to not persist than to leak plaintext at rest. (In the real Tauri app the
        // command is always present, so this only affects dev / non-Tauri.)
        console.warn(
          "[encrypted-storage] encryption unavailable — not persisting, to avoid plaintext PII at rest",
          e
        );
      }
    },
    async removeItem(name: string): Promise<void> {
      ls()?.removeItem(name);
    },
  };
}
