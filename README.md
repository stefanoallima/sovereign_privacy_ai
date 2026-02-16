# AILocalMind

> Your privacy-first AI coach that keeps your data local

AILocalMind is a desktop AI assistant that puts privacy first. Your personal data -- tax records, health information, financial details -- never leaves your machine unless you explicitly allow it. When cloud AI is needed, only anonymized categorical attributes are sent, and real values are filled back in locally.

## Features

- **Privacy-First PII Management** -- ChaCha20-Poly1305 encryption for all sensitive data, stored locally via Windows Credential Manager
- **Local LLM via Ollama** -- Run AI models entirely on your machine with zero cloud dependency
- **Multi-Persona System** -- Tax Navigator, Psychologist, Career Coach and more, each with independent privacy settings
- **Hybrid Routing** -- Per-persona choice of local-only, cloud-only, or hybrid (anonymize locally, process in cloud)
- **Dutch Tax Knowledge Base** -- Built-in understanding of Dutch tax concepts (Box 1/2/3, deductions, BSN validation)
- **Voice Assistant** -- LiveKit integration for hands-free interaction
- **Document Parsing** -- PDF/DOCX ingestion with automatic PII detection and masking
- **Attribute Extraction** -- Sends only categorical data (income bracket, employment type) to cloud LLMs, never raw values
- **Re-hydration Templates** -- Cloud generates responses with placeholders; local system fills in your real data

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Tauri 2 + React 19 + TypeScript |
| Backend | Rust (encryption, PII processing, Ollama client) |
| State | Zustand + Dexie (IndexedDB) |
| Styling | TailwindCSS v4 |
| AI (local) | Ollama (Mistral 7B default) |
| AI (cloud) | Nebius API (with privacy pipeline) |
| Voice | LiveKit |

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 22+ and [pnpm](https://pnpm.io/) 10+
- [Rust](https://rustup.rs/) 1.75+
- [Ollama](https://ollama.ai/) (for local LLM features)

### Install & Run

```bash
# Clone the repository
git clone https://github.com/your-username/AILocalMind.git
cd AILocalMind

# Install dependencies
cd apps/desktop
pnpm install

# Copy environment config
cp ../../.env.example ../../.env
# Edit .env with your API keys

# Run in development mode
pnpm tauri dev
```

### First Run

1. Ollama will auto-pull `mistral:7b-instruct-q5_K_M` (~5GB) on first use
2. An encryption key is generated and stored in your system credential manager
3. Choose a persona and start chatting

## Architecture

```
User Message
     |
     v
+-------------------+
| Backend Router    |  Decides: local, cloud, or hybrid
+-------------------+
     |
     v
+-------------------+
| Attribute Extract |  Extracts: income_bracket, employment_type, etc.
+-------------------+
     |
     v
+-------------------+
| Privacy-Safe      |  "User earns 50k-75k, employed, asking about Box 1"
| Prompt            |
+-------------------+
     |
     v
+-------------------+
| Cloud LLM         |  Returns: "Your [INCOME] falls in bracket..."
+-------------------+
     |
     v
+-------------------+
| Re-hydration      |  Fills [INCOME] with real value locally
+-------------------+
     |
     v
  Final Response
```

**Key principle**: Real PII values never leave your machine. The cloud only sees categorical attributes and placeholders.

## Project Structure

```
apps/desktop/
  src/                    # React frontend
    components/           # UI components (chat, personas, privacy, settings)
    hooks/                # React hooks (useChat, usePrivacyChat)
    services/             # TypeScript service layer
    stores/               # Zustand stores (chat, settings, personas, profiles)
    types/                # TypeScript type definitions
  src-tauri/              # Rust backend
    src/
      lib.rs              # Tauri app setup & command registration
      db.rs               # SQLite database
      ollama.rs           # Ollama HTTP client
      crypto.rs           # ChaCha20-Poly1305 encryption
      anonymization.rs    # PII detection & replacement
      attribute_extraction.rs  # Categorical attribute extraction
      rehydration.rs      # Template filling with real values
      backend_routing.rs  # Per-persona backend selection
      profiles.rs         # User profile management
      tax_knowledge.rs    # Dutch tax domain knowledge
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests: `cd apps/desktop/src-tauri && cargo test`
5. Commit and push
6. Open a Pull Request

## License

[MIT](LICENSE)
