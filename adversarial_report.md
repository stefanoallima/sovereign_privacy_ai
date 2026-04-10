# Adversarial Security Report — Sovereign AI (AILocalMind)

**Date**: 2026-03-31
**Scope**: Full codebase review — `apps/desktop/src-tauri/src/`, `apps/desktop/src/`
**Threat Model**: Local attacker (file system access), remote attacker (network interception), insider threat, supply chain

---

## Executive Summary

Sovereign AI is a privacy-first AI desktop assistant that promises "PII never leaves the machine." While the architecture is sound and core Rust modules have good test coverage, **four high-severity findings** undermine this privacy guarantee. The encryption key is stored as a plaintext file on disk, PII values in anonymization mappings are unencrypted, the Content Security Policy is disabled, and API key fragments leak in debug logging. A local attacker with file system access can extract all user PII without needing to break any cryptographic primitives.

**Overall Risk Rating: HIGH**

---

## Findings

### F-01: Plaintext Encryption Key on Disk [HIGH]

**File**: `src-tauri/src/crypto.rs:69-91`

**Description**: The `get_encryption_key()` function stores the ChaCha20-Poly1305 encryption key as a plaintext file at `{data_dir}/.encryption.key`. The codebase imports `winapi::um::wincred` and contains comments about using Windows Credential Manager "in production," but this is never implemented — the credential manager path is unreachable dead code.

**Impact**: Any local attacker (malware, malicious script, physical access) can read the key from disk and decrypt all PII stored in the database.

**Proof of Concept**:
```
// Read the key directly from disk — no privilege escalation needed
cat "$APPDATA/com.sovereign.ai/.encryption.key"
// Use key to decrypt PII from assistant.db
```

**Recommendation**: Implement Windows Credential Manager storage. The API calls are already imported (`winapi::um::wincred::CredWrite` / `CredRead`). On macOS, use Keychain Services via `security-framework` crate. On Linux, use Secret Service via `keyring` crate.

```rust
// Target implementation
pub fn get_encryption_key() -> Result<Vec<u8>> {
    let key = keyring::Entry::new("sovereign-ai", "encryption-key")
        .get_password()
        .map_err(|e| anyhow::anyhow!("Failed to retrieve key: {}", e))?;
    Ok(key.as_bytes().to_vec())
}
```

---

### F-02: Unencrypted PII in Anonymization Mappings [HIGH]

**File**: `src-tauri/src/anonymization.rs:328`

**Description**: The `AnonymizedMessage` struct stores PII values in plaintext:
```rust
pii_value_encrypted: Vec::new(),  // Always empty
is_encrypted: false,               // Always false
```
Comments explicitly state "would be encrypted in production." This means every email, BSN, phone number, address, and financial detail the user shares is stored as cleartext in the anonymization mapping that persists through the session.

**Impact**: Memory dumps, crash reports, or any process that can read the app's memory space will expose all user PII in the clear. If anonymization mappings are ever serialized to disk or logs, PII leaks entirely.

**Recommendation**: Encrypt PII values using the same ChaCha20-Poly1305 key at the point of extraction:
```rust
let encrypted = encrypt_data(pii_value.as_bytes(), &key)?;
pii_value_encrypted: encrypted,
is_encrypted: true,
```

---

### F-03: Content Security Policy Disabled [HIGH]

**File**: `apps/desktop/src-tauri/tauri.conf.json:25`

**Description**: The Content Security Policy is set to `null`:
```json
"csp": null
```
This disables all CSP protections for the Tauri WebView, allowing arbitrary script injection, inline script execution, and uncontrolled resource loading.

**Impact**: If any input (chat message, knowledge base document, RAG result) is rendered in the WebView without proper sanitization, XSS becomes trivial. An attacker who can inject HTML into a RAG document or chat response can execute arbitrary JavaScript with access to all Tauri IPC commands — including database operations and encryption key access.

**Recommendation**: Set a strict CSP:
```json
"csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.nvidia.com https://api.openai.com; font-src 'self'"
```

---

### F-04: API Key Prefix Leaked in Console [MEDIUM]

**File**: `apps/desktop/src/services/nebius.ts:87`

**Description**: Debug logging exposes the first several characters of the Nebius API key:
```typescript
console.log(`[Nebius] Using API key: ${apiKey.substring(0, 8)}...`);
```

**Impact**: While not the full key, partial key exposure narrows brute-force search space. More critically, if console output is captured (browser devtools screenshots, screen recording, accessibility tools), the prefix is permanently exposed.

**Recommendation**: Remove the API key prefix from all logging. Use a boolean flag to indicate key presence:
```typescript
console.log(`[Nebius] API key configured: ${!!apiKey}`);
```

---

### F-05: Three Overlapping Persistence Layers [MEDIUM]

**Files**: `src-tauri/src/db.rs`, `apps/desktop/src/lib/db.ts` (Dexie), `apps/desktop/src/stores/*.ts` (Zustand persist)

**Description**: The application persists data across three independent systems:
1. **Rust SQLite** (`assistant.db`, `memories.db`, `knowledge.db`) — 12 tables
2. **Dexie/IndexedDB** (frontend) — chat messages, settings
3. **Zustand with `persist` middleware** (localStorage) — settings, chat state

Data can become inconsistent between layers. For example, deleting a conversation in SQLite does not guarantee Dexie removes it, and vice versa.

**Impact**: Data leakage — deleted PII may persist in one store after being removed from another. State desynchronization can cause bugs that expose data through unintended code paths.

**Recommendation**: Adopt a single source of truth. Move all persistent storage to Rust SQLite (via Tauri commands). Use Zustand only as an in-memory session cache, not a persistence layer. Remove Dexie or limit it to temporary offline-only caching.

---

### F-06: SQL Injection Surface in Knowledge Store [MEDIUM]

**File**: `src-tauri/src/knowledge_store.rs`

**Description**: Several functions build SQL queries using `format!()` with user-provided input:
```rust
format!("INSERT INTO documents ... VALUES ('{}', '{}', ...)", title, source)
format!("SELECT * FROM documents WHERE title LIKE '%{}%'", search_term)
```
While `rusqlite::params!()` is used in some queries, `format!()` string interpolation is used in others.

**Impact**: A crafted document title or search query containing SQL metacharacters (`'`, `;`, `--`) could manipulate query behavior. With SQLite, this is limited to data exfiltration or modification within the same database.

**Recommendation**: Use parameterized queries exclusively via `rusqlite::params![]` or `rusqlite::params_from_iter()`. Audit all `format!()` SQL construction in `db.rs`, `knowledge_store.rs`, and `local_memory.rs`.

---

### F-07: `unsafe impl Send/Sync` for Loaded Models [MEDIUM]

**File**: `src-tauri/src/llama_backend.rs`

**Description**: The `LoadedModel` struct wraps a `llama_cpp::LlamaModel` and is marked with `unsafe impl Send + Sync` to share it across threads via `Arc<Mutex<>>`. This bypasses Rust's borrow checker guarantees.

**Impact**: If `llama_cpp::LlamaModel` has interior mutability or thread-unsafe state (common in C FFI bindings), concurrent access could cause undefined behavior — memory corruption, crashes, or silent data corruption in inference results.

**Recommendation**: Verify with the `llama-cpp-2` crate maintainers whether `LlamaModel` is actually thread-safe. If not, use a single-threaded channel pattern (mpsc) to serialize model access instead of wrapping in a mutex with unsafe traits.

---

### F-08: Hardcoded Fallback Model [LOW]

**File**: `src-tauri/src/backend_routing.rs`

**Description**: The Ollama backend defaults to `mistral:7b-instruct-q5_K_M` as a hardcoded fallback model name.

**Impact**: If this model is not available on the user's system, inference silently fails. If a malicious or compromised model with this exact name is present, it will be used without verification.

**Recommendation**: Make the fallback configurable and add model verification (checksum or manifest check) before loading any local model.

---

### F-09: Unused Dependencies Increase Attack Surface [LOW]

**Files**: `apps/desktop/package.json`, `apps/desktop/src-tauri/Cargo.toml`

**Description**:
- `@chatscope/chat-ui-kit-react` — imported but chat UI is custom-built
- `@capacitor/core` + plugins (8+) — Android support is incomplete and non-functional
- `winapi` crate — `wincred` feature declared but never called
- `ollama-rs` — behind `#[cfg(feature = "ollama")]` gate that may or may not be enabled

**Impact**: Each dependency is a potential supply chain attack vector. Unused dependencies add binary size and compile time. Dead code can mask real vulnerabilities in dependency audits.

**Recommendation**: Remove `@chatscope/chat-ui-kit-react`, all Capacitor packages, and the unused `winapi::um::wincred` feature. Audit `ollama-rs` usage and either commit to it or remove it.

---

### F-10: No Frontend Tests [LOW]

**File**: N/A (absence of `*.test.ts`, `*.test.tsx`, `__tests__/`)

**Description**: The React frontend has zero test files. There is no test runner configured (no vitest, jest, or testing-library setup in `package.json`).

**Impact**: Regression bugs in PII display, chat rendering, and settings logic cannot be caught automatically. The privacy UI (PII vault, anonymization display) is untested — bugs here could silently leak data.

**Recommendation**: Add Vitest + React Testing Library. Prioritize tests for:
- PII vault component (no PII rendered in clear)
- Chat message sanitization
- Settings import/export (no key leakage)
- Form fill component (profile data handling)

---

## Privacy Pipeline Attack Analysis

### Attack 1: Local File System Extraction
**Difficulty**: Low | **Impact**: Complete PII compromise

1. Read `.encryption.key` from `%APPDATA%/com.sovereign.ai/`
2. Read `assistant.db` from same directory
3. Decrypt all stored PII using the key
4. **Result**: All user profiles, tax data, financial data, health data exposed

### Attack 2: Memory Dump During Session
**Difficulty**: Low | **Impact**: Real-time PII interception

1. Attach a debugger or use `procdump` on the Tauri process
2. Scan memory for anonymization mapping structures
3. PII values are stored unencrypted in `AnonymizedMessage.pii_value_encrypted` (always empty, values in separate plaintext field)
4. **Result**: All PII from current conversation session

### Attack 3: RAG Document XSS → IPC Abuse
**Difficulty**: Medium | **Impact**: Full app control

1. Inject a crafted PDF/document into the knowledge base containing `<script>` tags or HTML
2. If RAG rendering in WebView processes HTML without sanitization (CSP is null), script executes
3. Script calls `window.__TAURI__.invoke()` to execute any Tauri command
4. **Result**: Database exfiltration, key extraction, arbitrary file access

### Attack 4: Network Interception
**Difficulty**: Medium (requires MITM) | **Impact**: Cloud prompt exfiltration

1. Intercept HTTPS traffic to Nebius API (requires custom CA or compromised root cert)
2. Read cloud prompts — anonymized data is sent as categorical attributes (designed to be safe)
3. However, if rehydration fails or sends partial data, raw PII may leak in the prompt
4. **Result**: Potentially partial PII exposure to cloud provider

---

## Remediation Priority Matrix

| # | Finding | Severity | Effort | Priority |
|---|---------|----------|--------|----------|
| F-01 | Plaintext encryption key | HIGH | Medium | **P0 — Immediate** |
| F-02 | Unencrypted PII in mappings | HIGH | Low | **P0 — Immediate** |
| F-03 | CSP disabled | HIGH | Low | **P0 — Immediate** |
| F-04 | API key prefix in logs | MEDIUM | Trivial | P1 — This sprint |
| F-05 | Overlapping persistence | MEDIUM | High | P1 — This sprint |
| F-06 | SQL injection surface | MEDIUM | Low | P1 — This sprint |
| F-07 | unsafe Send/Sync | MEDIUM | Medium | P2 — Next sprint |
| F-08 | Hardcoded fallback model | LOW | Low | P2 — Next sprint |
| F-09 | Unused dependencies | LOW | Low | P3 — Backlog |
| F-10 | No frontend tests | LOW | High | P3 — Backlog |

---

## Conclusion

The architectural design of Sovereign AI is privacy-conscious — the anonymization pipeline, categorical attribute extraction, and local inference options demonstrate serious thought. However, the implementation has critical gaps between the design intent and actual code. The plaintext encryption key (F-01) and unencrypted PII mappings (F-02) together mean that **the core privacy promise ("PII never leaves the machine") can be trivially violated by any local attacker**. These two findings should be addressed before any public release.

The disabled CSP (F-03) creates an additional vector through the WebView that could allow remote compromise if combined with a malicious RAG document. Addressing F-01, F-02, and F-03 would raise the overall risk rating from HIGH to MEDIUM.
