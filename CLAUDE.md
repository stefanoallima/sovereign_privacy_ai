# AILocalMind - Development Guide

## Build Commands

```bash
cd apps/desktop

# Development
pnpm install
pnpm tauri dev

# Production build (Windows — short CARGO_TARGET_DIR to avoid MAX_PATH)
# PowerShell:
$env:CARGO_TARGET_DIR = "C:\tmp\tb"
$env:CMAKE = "C:\Program Files\CMake\bin\cmake.exe"
pnpm tauri build
# Installer output: C:\tmp\tb\release\bundle\nsis\AILocalMind_*.exe
# Portable exe:     C:\tmp\tb\release\ailocalmind.exe

# Production build (bash / Git Bash):
export CARGO_TARGET_DIR="C:/tmp/tb"
export CMAKE="C:/Program Files/CMake/bin/cmake.exe"
pnpm tauri build

# GPU build is OPT-IN (default is CPU so CI/any machine can build).
# On a host with the CUDA Toolkit, add the cuda feature:
pnpm tauri build -- --features cuda
# (CPU-only is the default and is what the CI release workflow ships.)

# Run Rust tests
cd src-tauri && cargo test
```

## Prerequisites

- Node.js 22+, pnpm 10+
- Rust 1.75+ (via rustup)
- CMake (must be in PATH)
- LLVM/libclang (for bindgen)
- Visual Studio Build Tools 2022 with C++ workload

## Architecture

Privacy-first AI desktop assistant built with Tauri 2 + React 19 + Rust.

### Key modules (Rust backend)

| Module | Purpose |
|--------|---------|
| `ollama.rs` | Ollama HTTP client |
| `crypto.rs` | ChaCha20-Poly1305 encryption |
| `anonymization.rs` | PII detection & replacement |
| `attribute_extraction.rs` | Categorical attribute extraction |
| `rehydration.rs` | Template filling with real values |
| `backend_routing.rs` | Per-persona backend selection |
| `profiles.rs` | User profile management |
| `tax_knowledge.rs` | Dutch tax domain knowledge |

### Privacy pipeline

```
User Message -> Backend Router -> Attribute Extraction -> Cloud LLM (safe prompt) -> Re-hydration -> Response
```

PII never leaves the machine. Cloud receives only categorical attributes (income bracket, employment type).

### Backend options per persona

- `nebius` - Direct cloud API (fastest)
- `ollama` - Local inference (maximum privacy)
- `hybrid` - Local anonymization + cloud API (balanced)

## Testing

```bash
cd apps/desktop/src-tauri
cargo test                              # All tests
cargo test crypto::tests                # Encryption
cargo test anonymization::tests         # PII handling
cargo test attribute_extraction::tests  # Attribute extraction
cargo test rehydration::tests           # Template filling
cargo test backend_routing::tests       # Routing logic
```

## Batch 1 Personas (Privacy-First)

**Status:** Shipped 2026-Q2

Five core specialists with strict anonymization and local-only options:
- Tax Navigator (Dutch tax, local-only backend)
- Health Coach (nutrition & wellness, local-only backend)
- Legal Advisor (contracts & disputes, hybrid + GLiNER anonymization)
- Financial Advisor (investing & budgeting, hybrid + GLiNER anonymization)
- Negotiation Coach (salary & deal negotiation, hybrid)

Architecture:
- Zustand store (personas.ts)
- localStorage v3 migration
- GLiNER neural PII detection (on-device)
- Prompt Review Modal (batch 1 T11 infrastructure)
- PII Vault (optional save-and-substitute for future messages)
- Per-persona backend routing (local / cloud / hybrid)

## Batch 2 Personas (Complete Vision)

**Status:** Shipped 2026-06-23

Completes the "Sovereign Council" with 5 complementary specialists:
- Personal Branding Coach (hybrid, optional anonymization)
- Social Media Strategist (hybrid, optional anonymization)
- Real Estate Advisor (hybrid, required anonymization + PII vault)
- Cybersecurity Advisor (local-only, maximum privacy)
- Immigration/Visa Advisor (hybrid, required anonymization + PII vault)

Architecture (reuses batch 1):
- Zustand store (personas.ts)
- localStorage v3 migration
- Grouped UI selector (14 personas total)
- Privacy badges & backend overrides
- GLiNER anonymization (hybrid personas)
- Prompt Review Modal (batch 1 T11 infrastructure)

**Phase 2 Enhancements (planned):**
- Custom GLiNER redaction rules (domain-specific PII entities per persona)
- Knowledge base integration (domain sources: tax law, real estate comps, visa pathways)
- Persona-specific prompt templates (optimized for domain-specific tasks)

## CUDA Build Environment

For GPU-accelerated builds with CUDA:
```bash
export CUDA_PATH="C:/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v13.2"
export CUDACXX="C:/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v13.2/bin/nvcc.exe"
export CudaToolkitDir="C:/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v13.2/"
```
