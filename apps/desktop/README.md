# AILocalMind Desktop App

Privacy-first AI desktop assistant built with Tauri 2, React 19, and Rust.

## Build & Development

See [CLAUDE.md](../../CLAUDE.md) in the repo root for build instructions, architecture details, and batch persona documentation.

## Quick Start

```bash
# Install dependencies
pnpm install

# Development
pnpm tauri dev

# Production build (see CLAUDE.md for full instructions)
export CARGO_TARGET_DIR="C:/tmp/tb"
export CMAKE="C:/Program Files/CMake/bin/cmake.exe"
pnpm tauri build
```

## Project Structure

```
src/                         # React frontend (TypeScript)
  components/
    chat/                    #   Chat window, messages, prompt review
    personas/                #   Persona config & selection
    pii/                     #   PII Vault, privacy indicators
    settings/                #   App & privacy settings
  hooks/                     #   useChat, usePrivacyChat
  stores/                    #   Zustand (chat, personas, profiles)
  types/                     #   TypeScript definitions

src-tauri/                   # Rust backend
  src/
    lib.rs                   #   Tauri app setup
    inference.rs             #   Local inference trait
    llama_backend.rs         #   Embedded llama.cpp
    gliner.rs                #   GLiNER PII detection
    anonymization.rs         #   PII handling
    attribute_extraction.rs  #   Attribute extraction
    rehydration.rs           #   Template filling
    backend_routing.rs       #   Per-persona backend selection
```

## Persona Backend Configuration

| Persona | Backend | Anonymization | PII Vault | Batch |
|---------|---------|---|---|---|
| Psychologist | hybrid | optional | no | Original |
| Life Coach | hybrid | optional | no | Original |
| Career Coach | hybrid | optional | no | Original |
| Tax Navigator | **local** | optional | no | Batch 1 |
| Health Coach | **local** | optional | no | Batch 1 |
| Legal Advisor | hybrid | **required** | **yes** | Batch 1 |
| Financial Advisor | hybrid | **required** | **yes** | Batch 1 |
| Negotiation Coach | hybrid | optional | no | Batch 1 |
| Personal Branding Coach | hybrid | optional | no | Batch 2 |
| Social Media Strategist | hybrid | optional | no | Batch 2 |
| Real Estate Advisor | hybrid | **required** | **yes** | Batch 2 |
| Cybersecurity Advisor | **local** | optional | no | Batch 2 |
| Immigration/Visa Advisor | hybrid | **required** | **yes** | Batch 2 |

**Note:** Cybersecurity Advisor and Tax Navigator are the only personas with local-only backend. Override at your own risk (reduces privacy benefits). Real Estate and Immigration advisors require anonymization due to PII intensity.

## Testing

```bash
cd src-tauri

# All tests
cargo test

# Specific modules
cargo test crypto::tests              # Encryption
cargo test anonymization::tests       # PII handling
cargo test attribute_extraction::tests  # Attribute extraction
cargo test backend_routing::tests     # Routing logic
```

## AI Models

### Local Mode (default privacy)
- **Qwen3 1.7B** — Fast local inference, ~1.5 GB (recommended)
- Qwen3 4B — Better quality, ~3 GB
- Qwen3 8B — High quality, ~5 GB
- Qwen3 0.6B — Ultra-light, ~600 MB

### Cloud Mode (Nebius Token Factory)
- **MiniMax M2.1** — Balanced speed & quality
- Kimi K2.5 — Strong reasoning
- Qwen3 32B — Fast, high quality

[See README.md](../../README.md) for full model details and Nebius setup instructions.

## Privacy Features

- **GLiNER PII Detection** — On-device neural NER, detects names, emails, phone numbers, addresses, SSNs
- **Prompt Review Modal** — See, edit, or cancel sanitized prompts before cloud submission
- **PII Vault** — Save detected PII for automatic substitution in future messages
- **Per-Persona Anonymization** — Choose local-only, cloud, or hybrid backend per persona
- **ChaCha20-Poly1305 Encryption** — Sensitive data encrypted at rest

## Contributing

See [README.md](../../README.md) for contribution guidelines.
