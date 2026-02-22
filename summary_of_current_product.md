# Sovereign AI — Product Summary

## What It Is

**Sovereign AI** (codebase: AILocalMind) is a free, open-source, privacy-first desktop AI assistant built with Tauri 2 + React 19 + Rust. It runs a "Multidisciplinary AI Council" of 14 specialized personas — each with independent privacy routing — inspired by Andrej Karpathy's AI Council concept.

**Tagline**: *"Run Your Own Multidisciplinary AI Council"*

**License**: MIT | **Platforms**: Windows, macOS | **Website**: sovereign-ai-app.netlify.app

---

## Core Differentiator: The Privacy Pipeline

Unlike ChatGPT or Claude where your data goes straight to the cloud, Sovereign AI has a 5-stage pipeline:

```
User Message → Local PII Detection (GLiNER NER) → Redaction Dashboard (user approves)
→ Cloud LLM receives only anonymized data → Re-hydration (placeholders filled back locally)
```

**What the cloud sees**: `"User in 50k-75k income bracket, has_mortgage: true, employment: full_time"`
**What stays on your machine**: `"Jan de Vries, Keizersgracht 42, Amsterdam, BSN: 123456789, Salary: €62,500"`

---

## 3 Privacy Modes

| Mode | How it works | Best for |
|------|-------------|----------|
| **Local** | Embedded llama.cpp (Qwen3), zero network traffic | Maximum privacy, offline use |
| **Hybrid** | GLiNER redacts PII locally → sanitized prompt to cloud LLM | Balance of privacy + quality |
| **Cloud** | Direct to Nebius API (EU-based, Finland/France) | Fastest, best model quality |

Each persona can also override to a custom backend configuration. Users switch modes via 3 pill buttons directly in the chat input area.

---

## The AI Council (14 Personas)

Each persona has its own expertise, system prompt, privacy level, and model routing:

| Persona | Domain | Default Privacy |
|---------|--------|-----------------|
| @psychologist | CBT, emotional regulation, Socratic questioning | Cloud |
| @life-coach | Goals, habits, accountability, SMART goals | Cloud |
| @career-coach | Resume, interviews, salary negotiation, leadership | Cloud |
| @tax-navigator | Dutch tax (Box 1/2/3, belastingaangifte, deductions) | Hybrid (required) |
| @tax-audit | Document analysis, accountant prep, Dutch tax docs | Hybrid (required) |
| @legal-advisor | Contract review, clause analysis, risk flagging | Hybrid |
| @financial-advisor | Budgeting, debt strategy, financial planning | Hybrid |
| @health-coach | Wellness, nutrition, fitness | Local |
| @personal-branding | Professional identity, narrative | Cloud |
| @social-media | Content strategy, post crafting | Cloud |
| @real-estate | Property analysis, mortgage, market research | Hybrid |
| @cybersecurity | Personal security audits, breach monitoring | Local |
| @immigration | Visa guidance, residency docs, passport data | Hybrid |
| @investment | Portfolio analysis, market insights, risk assessment | Hybrid |

Users can also create, edit, duplicate, and delete custom personas. Built-in personas cannot be deleted.

---

## Feature Inventory

### Privacy & Security

- **GLiNER NER** — 3 downloadable ONNX models (small 611 MB / multi 1.16 GB / large 1.78 GB) for PII detection
- **Dutch-specific regex** — BSN (9-digit), IBAN (NL), Dutch postcodes (4 digits + 2 letters), phone (+31/06-), euro amounts
- **PII Vault (Privacy Shield)** — structured local store organized by category (personal, contact, financial, tax, third parties) with field masking, Dutch BSN/IBAN/postcode validation, multiple named profiles, import/export
- **Custom Redaction Terms** — user-defined strings to always redact before cloud sends, with same-length replacement generation, CSV bulk import
- **Attribute-Only Mode** — strips full text entirely, sends only categorical buckets (income bracket, employment type, housing situation) to cloud
- **Redaction Dashboard** — side-by-side review panel where users approve/modify what gets sent before cloud submission
- **Unsafe Fallback Blocking** — backend routing hard-fails if anonymization is set to `required` and PII stripping cannot be verified
- **ChaCha20-Poly1305 encryption** at rest (256-bit key, 96-bit nonce, 128-bit tag; key stored in Windows Credential Manager)
- **Incognito Mode** — disappearing chats that exist only in memory, never written to disk
- **Re-hydration** — cloud responses with `[PLACEHOLDER]` tokens filled back with real PII values locally (23 standard placeholder types, exact-length matching)

### AI Models

**Local (embedded llama.cpp, no Ollama required):**
| Model | Size | Speed | Quality |
|-------|------|-------|---------|
| Qwen3 0.6B (Ultra-Light) | ~400 MB | Very fast | Good |
| Qwen3 1.7B (Light) | ~1.1 GB | Fast | High |
| Qwen3 4B (Medium) | ~2.5 GB | Medium | High |
| Qwen3 8B (Full) | ~5 GB | Slow | Very high |

**Cloud (Nebius AI Studio):**
| Model | Context | Cost/1M tokens |
|-------|---------|----------------|
| Qwen3 32B Fast (default) | 32k | $0.20 |
| DeepSeek V3 | 64k | $0.30 |
| Qwen3 235B MoE | 128k | $0.35 |
| Llama 3.3 70B Fast | 128k | $0.35 |

Custom OpenAI-compatible endpoint support for any provider.

### Voice

- **Local TTS** — Piper neural voice engine (auto-downloads binary + voice models), configurable speech rate, per-persona voice selection
- **Local STT** — whisper.cpp (auto-downloads binary + model), base64 audio transfer
- **LiveKit Voice Agent** — real-time WebRTC streaming conversation mode (separate Python service with faster-whisper, Piper, Silero VAD)
- **Hands-free conversation mode** — speak → AI responds via TTS → auto-listens again (8-second recording windows)
- **Push-to-Talk** — configurable shortcut (default: Ctrl+Space)

### UX & Onboarding

- **Setup Wizard** — 5-step first-launch onboarding (Welcome → Privacy Mode → API Key → Persona → Review) with AI-generated commentary on each choice
- **Guided Tour** — driver.js product walkthrough triggered after wizard completion
- **@ Mentions** — type `@persona` to route messages to specific agents, `@here` for thread participants, `@all` for full council mode
- **Projects** — organize conversations under named projects with default persona/context settings
- **Personal Contexts** — attach reusable context documents to conversations (with token count tracking)
- **Markdown rendering** with `react-markdown`, `remark-gfm`, and `highlight.js` code syntax highlighting
- **Streaming responses** with optional token count display
- **Mobile layout** — responsive design with bottom sheets and drawers, Capacitor Android build in progress

### Infrastructure

- **Supabase auth** (optional) — email/password sign-in, sign-up, password reset; works fully offline without an account
- **mem0 memory** (optional, off by default) — persistent cross-conversation memory layer via mem0ai
- **Document ingestion** — PDF upload with automatic PII extraction into the Privacy Vault
- **System tray** — background presence with global Ctrl+Space shortcut
- **SQLite database** — rusqlite (bundled) for local persistence with encryption at rest

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri 2 (with system tray, global shortcuts) |
| Frontend | React 19, TypeScript 5.8, Vite 7, Tailwind CSS v4 |
| State management | Zustand v5 (7 stores: chat, settings, personas, voice, user context, profiles, wizard) |
| Rust backend | llama-cpp-2, gline-rs (GLiNER/ONNX), chacha20poly1305, rusqlite, rodio, reqwest, regex |
| Voice | Piper TTS, whisper.cpp STT, LiveKit (optional WebRTC) |
| Auth | Supabase (optional) |
| Cloud LLM | Nebius AI Studio (OpenAI-compatible, EU-based) |
| Chat UI | @chatscope/chat-ui-kit-react, lucide-react icons |
| Memory | mem0ai (optional) |
| Mobile | Capacitor 8 (Android, in progress) |

### Key Rust Modules

| Module | Purpose |
|--------|---------|
| `crypto.rs` | ChaCha20-Poly1305 encryption; Windows Credential Manager key storage |
| `anonymization.rs` | PII detection with Dutch regex patterns (BSN, IBAN, phone, postcode, euro) |
| `attribute_extraction.rs` | Converts user context to privacy-safe categorical attributes |
| `backend_routing.rs` | Routes to Nebius/Local/Hybrid per persona; blocks unsafe fallbacks |
| `rehydration.rs` | Fills `[PLACEHOLDER]` tokens in cloud responses with real PII locally |
| `gliner.rs` | ONNX GLiNER model registry, download management, entity detection |
| `gliner_commands.rs` | Tauri commands for GLiNER operations |
| `inference.rs` | `LocalInference` trait abstraction over backends |
| `llama_backend.rs` | `LlamaCppBackend` implementing embedded llama.cpp |
| `profiles.rs` | Multi-person household model (primary + family members) |
| `tax_knowledge.rs` | Dutch tax terminology knowledge base (BSN, Jaaropgaaf, Box 1/2/3) |
| `tts.rs` | Piper binary + voice model management; rodio audio playback |
| `stt.rs` | whisper.cpp binary + model management |
| `file_parsers.rs` | PDF and document ingestion |
| `entity_resolver.rs` | Fuzzy matching to resolve entity references across documents |
| `db.rs` | SQLite schema and ORM layer |

---

## Target Audience

- **Primary**: Privacy-conscious professionals in the Netherlands — accountants, lawyers, financial advisors handling client data (deep Dutch tax/IBAN/BSN integration)
- **Secondary**: Anyone in sensitive professional domains (legal, health, immigration, finance) who wants AI assistance without cloud data exposure
- **Tertiary**: AI/ML enthusiasts following the Karpathy "AI Council" trend who want a local-first multi-agent setup

---

## Competitive Positioning

| Feature | ChatGPT / Claude | Sovereign AI |
|---------|------------------|-------------|
| PII redaction before cloud | None | GLiNER NER + Dutch regex + custom terms |
| User reviews what's sent | No | Yes (Redaction Dashboard with approve/edit) |
| Fully offline mode | No | Yes (embedded llama.cpp, no install needed) |
| Per-agent privacy rules | No | Yes (14 agents, independent routing) |
| Encryption at rest | Platform-dependent | ChaCha20-Poly1305 with secure key storage |
| Open source | No | MIT licensed |
| Multi-agent council | No (single assistant) | 14 specialized personas with @mentions |
| Incognito mode | No | Yes (disappearing chats, never persisted) |
| Voice (local) | Cloud-only | Local Piper TTS + whisper.cpp STT |
| Cost | $20/mo+ | Free (bring your own API key) |

---

## Marketing Positioning

**Hero**: *"Run Your Own Multidisciplinary AI Council — Deploy a team of expert agents that collaborate on your hardware — with a local Privacy Guard that redacts your secrets before they ever reach the cloud."*

**Badge**: *"Open Source · Inspired by Karpathy · 100% Sovereign"*

**Trust signals**: Sovereign Council · ChaCha20 Encryption · Built-in Local LLM · Incognito Mode · EU-Grade Privacy

**Key message**: *"Other AI tools are powerful, but they require you to trust a corporation with your most sensitive data. With Sovereign AI, you run a full council of experts without sending five different cloud companies your secrets."*

**CTA**: *"Sovereign AI is free, open source, and built for people who refuse to trade privacy for intelligence."*

**EU-Grade Security note**: *"Need a more powerful model than what runs locally? Configure any OpenAI-compatible API endpoint. We default to EU-based Nebius (Finland & France) — but you must enable Zero Data Retention (ZDR) in your Nebius account settings for maximum privacy."*

---

## Distribution

- **GitHub Releases**: Windows `.exe` installer, macOS `.dmg` (Apple Silicon + Intel)
- **Website**: Landing page with smart download buttons (OS detection)
- **CI/CD**: Release pipeline for automated builds
- **Android**: Capacitor build in progress (not yet released)
