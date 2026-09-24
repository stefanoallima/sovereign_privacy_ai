# AGENTS.md — Sovereign AI Project

**Project:** AILocalMind / Sovereign AI  
**Purpose:** Privacy-first Tauri 2 + React 19 + Rust desktop AI assistant that keeps sensitive personal data on-device. Users get high-quality AI advice on tax, legal, financial, health, career, and personal matters through 14 specialist personas (Sovereign Council) while maintaining full control over when and how data is anonymized before reaching cloud LLMs.  
**For:** Privacy-conscious individuals who refuse to trade personal data for AI intelligence.

## Repo Conventions

- **Architecture**: Desktop app (Tauri IPC boundary). Frontend (React/TS) talks to Rust backend via `@tauri-apps/api`. Core privacy logic lives in Rust.
- **Directory taboos**: 
  - `website/` is live: Netlify deploys it on every push to `main`, and it hosts the macOS installer (`install.sh`). Change it deliberately and follow the contract in **Distribution** below.
  - Do NOT add llama.cpp/ONNX model files to git (they're 500MB–5GB; downloaded at runtime)
  - Do NOT commit API keys or Nebius credentials to `.env` (use secure stores: Windows Credential Manager on Windows, Keychain on macOS)
- **Testing approach**: Rust tests via `cargo test` (in `apps/desktop/src-tauri`), frontend unit tests via `pnpm test`, and a Playwright E2E suite via `pnpm test:e2e` (runs against the Vite dev server with a stubbed Tauri IPC; CI runs it on Windows).
- **Privacy invariant**: Every cloud-bound prompt MUST go through `redactForCloud()` in `anonymization.rs`. PII never leaves the machine in raw form.
- **Model tier selection**: Free tier for small changes (component tweaks, small bug fixes). Use Sonnet/Opus for architecture-level decisions or cross-cutting privacy logic.
- **Build environment**: Short `CARGO_TARGET_DIR` to avoid Windows MAX_PATH (260 char limit). CMake and LLVM/libclang required. See `CLAUDE.md` for build commands.

## Key Files

| File | Purpose |
|------|---------|
| `apps/desktop/src-tauri/src/lib.rs` | Tauri app setup, command registration |
| `apps/desktop/src-tauri/src/anonymization.rs` | PII detection & redaction pipeline |
| `apps/desktop/src-tauri/src/attribute_extraction.rs` | Extract categorical attributes (income bracket, employment type, etc.) |
| `apps/desktop/src-tauri/src/rehydration.rs` | Fill cloud placeholders with real values locally |
| `apps/desktop/src-tauri/src/backend_routing.rs` | Per-persona backend selection (local, cloud, hybrid) |
| `apps/desktop/src-tauri/src/gliner.rs` | GLiNER model management & PII detection |
| `apps/desktop/src-tauri/src/llama_backend.rs` | Embedded llama.cpp inference engine |
| `apps/desktop/src/components/` | React chat UI, persona config, settings |
| `apps/desktop/src/stores/` | Zustand state (chat, settings, personas, PII vault) |

## Building & Testing

```bash
cd apps/desktop

# Development
pnpm install
pnpm tauri dev

# Tests (Rust backend only)
cd src-tauri
cargo test

# Production
export CARGO_TARGET_DIR="C:/tmp/tb"  # Windows MAX_PATH workaround
export CMAKE="C:/Program Files/CMake/bin/cmake.exe"
pnpm tauri build

# GPU-accelerated build (opt-in, requires CUDA Toolkit)
pnpm tauri build -- --features cuda
```

## Privacy-First Guardrails

1. **Redaction chokepoint**: Every cloud-bound prompt MUST pass through `redactForCloud()`. Same PII value → same token everywhere (via `customRedactTerms` registry).
2. **PII never transmitted raw**: If a field might contain PII, it goes through GLiNER → anonymization → categorical attribute extraction → cloud, with re-hydration only on the client.
3. **Persona-level controls**: Each of 14 personas has independent backend selection (local-only, cloud-only, hybrid) and privacy settings.
4. **Local-first default**: Cloud mode is opt-in. New installs default to local inference (Qwen3 1.7B).
5. **Transparency**: Prompt Review panel shows exactly what the cloud will see before anything is sent.

## Common Workflows

**Adding a new persona**: Create profile in `apps/desktop/src/stores/`, add to `profiles.rs` backend, wire up in Chat component and persona config UI.

**Changing PII detection**: Modify `gliner.rs` model selection or `anonymization.rs` replacement logic. Re-test against real user inputs (see `cargo test anonymization::tests`).

**Adding cloud backend**: Wire in `backend_routing.rs`. Update settings UI to expose the API endpoint and auth token fields. Default to Nebius; allow OpenAI-compatible alternatives.

**Local model updates**: Qwen3 GGUF files auto-download from HuggingFace on first use. To use a different model, update the download URL and context-size expectations in `llama_backend.rs`.

## Distribution (releases, website, macOS installer)

**Pipeline — nothing version-specific to edit:**
- Push a `v*` tag → `.github/workflows/release.yml` builds Windows + macOS (arm64, x64) and publishes a GitHub Release.
- `website/` is deployed by Netlify automatically on every push to `main` (https://sovereign-ai-app.netlify.app).
- The website's Download button and `website/install.sh` both query the GitHub API for the **latest** release at runtime, so a new tag is picked up with no website change.

**macOS is ad-hoc signed, not notarized** (decision: no Apple Developer Program). A DMG downloaded in a browser is quarantined, so Gatekeeper blocks the first launch (users must use Privacy & Security → Open Anyway). The recommended Mac install path is therefore:

```bash
curl -fsSL https://sovereign-ai-app.netlify.app/install.sh | bash
```

`install.sh` downloads with curl (no quarantine flag), verifies the asset's SHA-256 against GitHub's published digest plus the code signature, and installs to `/Applications`. The in-app updater also downloads outside the browser, so updates are not blocked.

**Contract — do not break without updating `install.sh` and `website/index.html`:**
- `productName` stays **"Sovereign AI"** → bundle `Sovereign AI.app`, release assets `Sovereign.AI_aarch64.app.tar.gz` / `Sovereign.AI_x64.app.tar.gz` (installer), `*aarch64*.dmg` / `*x64*.dmg` / `*.exe` (Download button).
- `bundle.createUpdaterArtifacts` stays `true` — it produces the `.app.tar.gz` files the installer uses.
- `signingIdentity: "-"` stays in `tauri.macos.conf.json` — without it the bundle is unsealed and macOS reports the download as "damaged".
- Binary name `ailocalmind` (the installer checks it isn't running).

**After changing `website/install.sh`:** test without touching `/Applications`:
`mkdir -p /tmp/sa-test && INSTALL_DIR=/tmp/sa-test bash website/install.sh`

**Release checklist (after the workflow finishes):**
1. Download both DMGs and run `codesign --verify --deep --strict` on the app inside (CI also runs this).
2. `curl -s https://api.github.com/repos/stefanoallima/sovereign_privacy_ai/releases/latest` shows the new tag with `.dmg`, `.exe` and `.app.tar.gz` assets.
3. Run the live installer with `INSTALL_DIR` pointing to a temp folder.

**Public repo:** this repository is public. Internal tooling directories that are listed in `.gitignore` must never be committed, and must not be referenced in commit messages, PR titles/descriptions, or release notes.

## Agent Guidance by Role

**Frontend (React/TS)**: Design and debug chat UI, persona config, settings panels, privacy indicators. Mock the Rust backend with test data if needed. Test responsive layout across Windows/macOS resolutions.

**Backend (Rust)**: Implement encryption, PII detection, attribute extraction, redaction, re-hydration, local inference, and Tauri command handlers. Write tests. Prioritize correctness and privacy over convenience.

**DevOps/Release**: Build releases (short CARGO_TARGET_DIR), manage CI/CD (v*-tagged releases trigger public builds), keep macOS builds ad-hoc signed (no notarization — see **Distribution**), run the release checklist, verify auto-updater works (fixed and live in v0.3.2+).

**Security/Privacy**: Audit the redaction pipeline, validate that PII never escapes in logs or crash reports, review GLiNER confidence thresholds, ensure ChaCha20-Poly1305 key storage is secure.

