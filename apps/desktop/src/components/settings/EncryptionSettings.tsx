import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePiiVaultStore } from "@/stores/piiVault";
import { useUserContextStore } from "@/stores/userContext";

interface EncryptionStatus {
  custody: string;
  key_fingerprint: string;
  keychain_service: string | null;
  keychain_account: string | null;
  cipher: string;
}

interface RotationResult {
  old_fingerprint: string;
  new_fingerprint: string;
  records_re_encrypted: number;
  elapsed_ms: number;
}

const HEX_RE = /^[0-9a-fA-F]{64}$/;

// The PII vault and userContext (redaction registry) persist through
// services/encrypted-storage with the same key.
// Rust rotation re-encrypts the SQLite vault and profile, not localStorage,
// so these must be rewritten under the new key from their in-memory state.

/** Make sure in-memory state holds the decrypted data before the key changes. */
async function hydrateEncryptedStores() {
  for (const persist of [usePiiVaultStore.persist, useUserContextStore.persist]) {
    if (!persist.hasHydrated()) await persist.rehydrate();
  }
}

/** Re-persist each store; the write goes through encrypt_string (new key). */
function repersistEncryptedStores() {
  usePiiVaultStore.setState({});
  useUserContextStore.setState({});
}

function fmtFp(fp: string): string {
  return fp.match(/.{1,4}/g)?.join(" ") ?? fp;
}

export function EncryptionSettings() {
  const [status, setStatus] = useState<EncryptionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importHex, setImportHex] = useState("");
  const [importErr, setImportErr] = useState<string | null>(null);

  const [exportOpen, setExportOpen] = useState(false);
  const [exportedHex, setExportedHex] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await invoke<EncryptionStatus>("get_encryption_status");
      setStatus(s);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const doRotate = async () => {
    setBusy(true);
    try {
      await hydrateEncryptedStores();
      const r = await invoke<RotationResult>("rotate_encryption_key");
      repersistEncryptedStores();
      showToast(
        `Rotated. Re-encrypted ${r.records_re_encrypted} record(s) in ${r.elapsed_ms} ms.`,
      );
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      setRotateConfirmOpen(false);
    }
  };

  const doImport = async () => {
    setImportErr(null);
    const trimmed = importHex.trim();
    if (!HEX_RE.test(trimmed)) {
      setImportErr("Key must be exactly 64 hex characters (32 bytes).");
      return;
    }
    setBusy(true);
    try {
      await hydrateEncryptedStores();
      const r = await invoke<RotationResult>("import_encryption_key", {
        hexKey: trimmed,
      });
      repersistEncryptedStores();
      showToast(
        `Imported. Re-encrypted ${r.records_re_encrypted} record(s) in ${r.elapsed_ms} ms.`,
      );
      setImportHex("");
      setImportOpen(false);
      await refresh();
    } catch (e) {
      setImportErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const doExport = async () => {
    setBusy(true);
    try {
      const hex = await invoke<string>("export_encryption_key");
      setExportedHex(hex);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    return (
      <div className="rounded-xl border-2 border-[hsl(var(--border))] p-4 text-sm text-[hsl(var(--muted-foreground))]">
        {error
          ? `Failed to load encryption status: ${error}`
          : "Loading encryption status…"}
      </div>
    );
  }

  const custodyLabel =
    status.custody === "keychain"
      ? "OS keychain ✓"
      : status.custody === "file_fallback"
      ? "Dev file fallback ⚠"
      : status.custody;

  return (
    <div className="rounded-xl border-2 border-[hsl(var(--border))] overflow-hidden">
      <div className="p-4 bg-[hsl(var(--muted)/0.3)]">
        <h3 className="font-semibold text-sm">Encryption</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Your local PII vault is encrypted with {status.cipher}. The master
          key lives in your OS keychain — not in a file the app reads.
        </p>
      </div>

      <div className="p-4 space-y-3 text-sm">
        <div className="grid grid-cols-3 gap-2">
          <div className="text-[hsl(var(--muted-foreground))]">Custody</div>
          <div className="col-span-2 font-medium">{custodyLabel}</div>

          <div className="text-[hsl(var(--muted-foreground))]">Cipher</div>
          <div className="col-span-2">{status.cipher}</div>

          <div className="text-[hsl(var(--muted-foreground))]">
            Key fingerprint
          </div>
          <div className="col-span-2 font-mono text-xs">
            {fmtFp(status.key_fingerprint)}
          </div>

          {status.keychain_service && (
            <>
              <div className="text-[hsl(var(--muted-foreground))]">
                Keychain entry
              </div>
              <div className="col-span-2 font-mono text-xs break-all">
                {status.keychain_service} / {status.keychain_account}
              </div>
            </>
          )}
        </div>

        {status.custody === "file_fallback" && (
          <div className="rounded-md border border-[hsl(var(--destructive))] p-2 text-xs text-[hsl(var(--destructive))]">
            ⚠ Running with the dev file fallback
            (AILOCALMIND_DEV_KEY_FILE_FALLBACK=1). Do not use this in
            production — the master key is on disk in plaintext.
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setRotateConfirmOpen(true)}
            className="px-3 py-1.5 rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm hover:opacity-90 disabled:opacity-50"
          >
            Rotate key
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setImportHex("");
              setImportErr(null);
              setImportOpen(true);
            }}
            className="px-3 py-1.5 rounded-md border border-[hsl(var(--border))] text-sm hover:bg-[hsl(var(--muted))] disabled:opacity-50"
          >
            Import key (BYOK)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setExportedHex(null);
              setExportOpen(true);
            }}
            className="px-3 py-1.5 rounded-md border border-[hsl(var(--border))] text-sm hover:bg-[hsl(var(--muted))] disabled:opacity-50"
          >
            Export key
          </button>
        </div>

        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Verify on macOS: open Keychain Access, search for{" "}
          <span className="font-mono">ailocalmind</span>. On Windows: open
          Credential Manager → Generic Credentials. On Linux: run{" "}
          <span className="font-mono">
            secret-tool lookup service ailocalmind account{" "}
            {status.keychain_account ?? "pii_vault_master_key_v1"}
          </span>
          .
        </p>

        {error && (
          <div className="rounded-md border border-[hsl(var(--destructive))] p-2 text-xs text-[hsl(var(--destructive))]">
            {error}
          </div>
        )}

        {toast && (
          <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] p-2 text-xs">
            {toast}
          </div>
        )}
      </div>

      {rotateConfirmOpen && (
        <Modal onClose={() => !busy && setRotateConfirmOpen(false)}>
          <h4 className="font-semibold mb-2">Rotate encryption key?</h4>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3">
            This generates a new master key, re-encrypts every PII record in
            your vault, and stores the new key in your OS keychain. Usually
            takes a few seconds.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setRotateConfirmOpen(false)}
              className="px-3 py-1.5 rounded-md border border-[hsl(var(--border))] text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={doRotate}
              className="px-3 py-1.5 rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm"
            >
              {busy ? "Rotating…" : "Rotate"}
            </button>
          </div>
        </Modal>
      )}

      {importOpen && (
        <Modal onClose={() => !busy && setImportOpen(false)}>
          <h4 className="font-semibold mb-2">Import encryption key (BYOK)</h4>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3">
            Paste your 64-character hex key. The vault will be re-encrypted with
            it and the key stored in your OS keychain.
          </p>
          <textarea
            value={importHex}
            onChange={(e) => setImportHex(e.target.value)}
            rows={3}
            className={`w-full rounded-md border p-2 font-mono text-xs ${
              importErr
                ? "border-[hsl(var(--destructive))]"
                : "border-[hsl(var(--border))]"
            }`}
            placeholder="64 hex characters (e.g. 0123456789abcdef…)"
          />
          {importErr && (
            <div className="text-xs text-[hsl(var(--destructive))] mt-1">
              {importErr}
            </div>
          )}
          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => setImportOpen(false)}
              className="px-3 py-1.5 rounded-md border border-[hsl(var(--border))] text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !importHex.trim()}
              onClick={doImport}
              className="px-3 py-1.5 rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm disabled:opacity-50"
            >
              {busy ? "Importing…" : "Import & re-encrypt"}
            </button>
          </div>
        </Modal>
      )}

      {exportOpen && (
        <Modal onClose={() => !busy && setExportOpen(false)}>
          <h4 className="font-semibold mb-2">Export encryption key</h4>
          <p className="text-sm text-[hsl(var(--destructive))] mb-3">
            ⚠ Anyone with this key can decrypt every PII value in your vault.
            Copy it to an offline password manager. Never email it. Never share
            it.
          </p>
          {!exportedHex ? (
            <button
              type="button"
              disabled={busy}
              onClick={doExport}
              className="px-3 py-1.5 rounded-md border border-[hsl(var(--border))] text-sm"
            >
              Reveal key
            </button>
          ) : (
            <>
              <pre className="w-full rounded-md border border-[hsl(var(--border))] p-2 font-mono text-xs break-all whitespace-pre-wrap">
                {exportedHex}
              </pre>
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(exportedHex)}
                  className="px-3 py-1.5 rounded-md border border-[hsl(var(--border))] text-sm"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportedHex(null);
                    setExportOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[hsl(var(--background))] rounded-lg border border-[hsl(var(--border))] p-4 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
