# AILocalMind Codebase Manifest Summary

**Generated:** 2026-06-23T00:00:50Z  
**Git SHA:** d7f4a8c1d641d24a267e42a61b225376c4483860  
**Branch:** main

## Quick Reference

### Project
- **Name:** AILocalMind / Sovereign AI
- **Version:** 0.2.0
- **Stack:** Tauri 2 (desktop) + React 19 (frontend) + Rust (backend)
- **Platforms:** Windows (x64), macOS (Intel + Apple Silicon)
- **Core Principle:** PII never leaves the machine. Cloud receives only categorical attributes.

### Code Metrics
- **Rust Backend:** 48 modules, ~14.3k LOC (privacy pipeline focused)
- **React Frontend:** 113 files, ~29.5k LOC (UI components + state management)
- **Test Coverage:** 27 Rust test modules, 0 React tests (manual E2E only)
- **Total:** ~43.8k LOC (excluding node_modules)

### Key Technologies
| Layer | Tech |
|-------|------|
| **Desktop Shell** | Tauri 2 |
| **Frontend** | React 19 + TypeScript + TailwindCSS + Zustand |
| **Backend** | Rust + tokio |
| **Local AI** | llama.cpp (embedded, CPU/GPU) |
| **Fallback AI** | Ollama (opt-in via env var) |
| **Cloud AI** | Nebius Token Factory (default, EU, zero-retention) |
| **PII Detection** | GLiNER (ONNX Runtime) |
| **Encryption** | ChaCha20-Poly1305 |
| **Persistence** | SQLite + Dexie (IndexedDB) |
| **Audio** | Piper TTS, Whisper STT, LiveKit voice |

### Directory Structure Highlights
```
apps/desktop/
├── src/                          # 113 React files, ~29.5k LOC
│   ├── components/               # Chat, personas, settings, dialogs, wizards
│   ├── stores/                   # Zustand state (chat, personas, settings, piiVault, etc.)
│   └── hooks/                    # Custom hooks (usePrivacyChat, useVoice, etc.)
├── src-tauri/
│   ├── src/                      # 48 Rust modules, ~14.3k LOC
│   │   ├── inference.rs          # Local inference trait (llama.cpp + Ollama)
│   │   ├── llama_backend.rs      # Embedded llama.cpp implementation
│   │   ├── anonymization.rs      # PII detection & replacement
│   │   ├── backend_routing.rs    # Per-persona backend selection logic
│   │   ├── redaction.rs          # Centralized redaction chokepoint (privacy invariant)
│   │   ├── rehydration.rs        # Template-fill with real values (post-cloud)
│   │   ├── attribute_extraction.rs  # Extract categorical attributes (no full text to cloud)
│   │   ├── gliner.rs             # GLiNER NER backend (PII entity extraction)
│   │   ├── form_fill.rs          # Form automation with safety review
│   │   ├── tax_knowledge.rs      # Dutch tax domain knowledge
│   │   └── [more modules...]
│   ├── .cargo/config.toml        # Windows MSVC CRT static linking fix
│   ├── Cargo.toml                # Rust dependencies (tauri, llama-cpp-2, gline-rs, ort, etc.)
│   └── tauri.conf.json           # Tauri config (updater, security CSP, tray icon)
├── package.json                  # Node.js dependencies
├── vite.config.ts                # Vite bundler config
└── tsconfig.json

sudd/
├── codebase-manifest.json        # This comprehensive manifest
├── state.json                    # Current SUDD workflow state
├── CURRENT_STATE.md              # Human-readable state summary
├── vision.md                     # Product vision (realigned 2026-06-12)
└── changes/
    ├── active/                   # In-flight work
    └── archive/                  # Shipped changes (form-fill, local-rag, perf-privacy-opt, etc.)

website/                          # Static Netlify landing page
.github/workflows/
├── release.yml                   # CI/CD: builds on v* tag (Windows + macOS, CPU-only default)
└── claude.yml
```

### Privacy Pipeline (Core Innovation)
```
User Message
    ↓
Backend Router (persona's LLM backend selection)
    ↓
Attribute Extraction (extract categorical attributes: income bracket, employment type)
    ↓
Anonymization (replace PII with tokens: "Alice" → "PERSON_1")
    ↓
Redaction (centralized chokepoint: ensure no raw PII path to cloud)
    ↓
Cloud LLM Call (receives only safe attributes + anonymized text)
    ↓
Rehydration (replace tokens with real values locally: "PERSON_1" → "Alice")
    ↓
Response to User (all processing happened locally, cloud never saw real PII)
```

### Critical Modules
- **`backend_routing.rs`:** Selects which backend (Nebius/Ollama/Hybrid) based on persona config
- **`redaction.rs`:** Single chokepoint ensuring no raw PII reaches cloud LLMs
- **`anonymization.rs` + `gliner.rs`:** PII detection and replacement to categorical attributes
- **`rehydration.rs`:** Template-fill with real values (post-cloud response)
- **`attribute_extraction.rs`:** Extract attributes without full text (maximum privacy mode)
- **`llama_backend.rs`:** Embedded llama.cpp (local-only inference, zero cloud calls)

### Build & Test

**Development:**
```bash
cd apps/desktop
pnpm install
pnpm tauri dev
```

**Production (Windows):**
```powershell
$env:CARGO_TARGET_DIR = "C:\tmp\tb"
$env:CMAKE = "C:\Program Files\CMake\bin\cmake.exe"
pnpm tauri build
# Output: C:\tmp\tb\release\bundle\nsis\AILocalMind_*.exe
```

**With GPU (CUDA):**
```bash
pnpm tauri build -- --features cuda
```

**Tests:**
```bash
cd apps/desktop/src-tauri
cargo test                              # All tests
cargo test crypto::tests                # Encryption
cargo test anonymization::tests         # PII handling
cargo test backend_routing::tests       # Routing logic
```

### Known Issues & Warnings
- **`pnpm lint` is broken** (missing @eslint/js devDep). Use `pnpm exec eslint <files>` instead.
- **~56 pre-existing ESLint errors** in codebase (low-priority, non-blocking).
- **No automated React tests** (0 Jest/Vitest files). Relying on manual + E2E testing.
- **Auto-updater was broken v0.1.8–v0.3.0** (3 stacked bugs). Fixed in v0.3.2 with keypair rotation. Pre-v0.3.0 installs need manual reinstall.
- **Windows MAX_PATH issue:** Set `CARGO_TARGET_DIR=C:/tmp/tb` to avoid compilation failures.
- **sudd/vision.md was stale** but was realigned 2026-06-12 to describe Sovereign AI product.

### Dependencies Overview
- **Key Rust:** tauri, llama-cpp-2, gline-rs, ort (load-dynamic), chacha20poly1305, tokio, rusqlite
- **Key Node:** react, zustand, dexie, @tauri-apps/api, tailwindcss, typescript, vite
- **Deprecated:** mem0ai (2.2.0) → replaced by local_memory.rs (eliminated cloud dependency)

### Maturity & Status
- **Maturity Level:** BETA
- **Privacy Core:** Stable (redaction, anonymization, backend routing shipped and hardened)
- **Peripheral Features:** Active (form-fill, voice, tax knowledge, local RAG)
- **CI/Release:** Fixed in v0.3.x (was broken in v0.2.x due to updater + CUDA bundling)
- **Suitable For:** Early adopters, privacy-conscious individuals; not production-grade yet

### Recent Activity (Last 20 commits)
- **Latest:** d7f4a8c1 — SUDD cleanup after normattiva-phase0-hardening_01
- **Main focus:** Privacy invariants (redaction chokepoint, canonical pseudonymization, zero raw-PII cloud paths)
- **Shipping cadence:** ~5 major features shipped in past 4 months (form-fill, local-rag, perf-privacy-opt, pii-pipeline-v2, redaction-completeness)

### For Contributors
1. Read `CLAUDE.md` for build setup (Node 22+, Rust 1.75+, CMake, LLVM in PATH)
2. Review privacy modules in `src-tauri/src/` (backend_routing, anonymization, redaction, rehydration)
3. Check `sudd/CURRENT_STATE.md` for active work queue
4. Frontend contributions go in `src/components/` and `src/stores/`
5. Rust tests go in module-level `#[cfg(test)]` sections; see `crypto.rs`, `anonymization.rs` for examples

### Full Manifest
For detailed metadata, dependency versions, build artifacts, test coverage, and quality signals, see:
**`sudd/codebase-manifest.json`** (725 lines, comprehensive)

---
*Generated by codebase-explorer agent on 2026-06-23*
