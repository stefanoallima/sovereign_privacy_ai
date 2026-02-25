<p align="center">
  <img src="assets/banner.svg" alt="Sovereign AI Banner" width="100%">
</p>

<p align="center">
  <strong>Your data is yours. Not theirs.</strong><br>
  <em>What you type stays on your machine. No training. No ads. No one else&rsquo;s roadmap funded by your questions.</em>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> &nbsp;&bull;&nbsp;
  <a href="#-features">Features</a> &nbsp;&bull;&nbsp;
  <a href="#-how-it-works">How It Works</a> &nbsp;&bull;&nbsp;
  <a href="#-ai-models--providers">AI Models</a> &nbsp;&bull;&nbsp;
  <a href="#-contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-6c63ff?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/platform-Windows-0078D4?style=flat-square&logo=windows" alt="Windows">
  <img src="https://img.shields.io/badge/platform-macOS_Apple_Silicon-000000?style=flat-square&logo=apple" alt="macOS Apple Silicon">
  <img src="https://img.shields.io/badge/tauri-v2-24C8DB?style=flat-square&logo=tauri" alt="Tauri v2">
  <img src="https://img.shields.io/badge/react-v19-61DAFB?style=flat-square&logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/rust-1.75+-DEA584?style=flat-square&logo=rust" alt="Rust">
</p>

---

### Why Sovereign AI?

You tell AI things you wouldn't tell your doctor. Your health worries. Your financial anxiety. Your family situation. Every one of those questions leaves your device permanently — and what happens to it next is their decision, not yours.

**Three things worth knowing before you use cloud AI for the personal stuff:**

- **Your data trains their models.** When you describe a health symptom or share a family situation, that text can become training material. Researchers at Google DeepMind demonstrated that prompts fed into large language models can be extracted verbatim — including personal data people thought they were asking in confidence. ([Carlini et al., 2021](https://arxiv.org/abs/2012.07805))
- **Your questions are a profile of who you are.** Every question you ask tells a cloud AI company what you worry about, what you're going through, and what you need. OpenAI's Terms explicitly reserve the right to use your interactions. ([The Atlantic, 2024](https://www.theatlantic.com/technology/archive/2024/06/openai-startup-competition/678857/))
- **Free AI has a business model. You're in it.** The most valuable ad targeting is built on what you've confided. You asked about a health scare — now an ad knows you're worried. OpenAI has discussed advertising. Microsoft already added ads to Copilot. ([WSJ](https://www.wsj.com/tech/ai/openai-considers-adding-advertising-to-its-business-5c0f4862), [The Verge](https://www.theverge.com/2024/4/24/24139361/microsoft-copilot-ads-bing-chat))

**Sovereign AI doesn't ask you to stop using AI. It gives you a version you can use without wondering whether you should.**

- **14 private advisors for your life**: @tax-navigator, @legal-advisor, @financial-advisor, @career-coach, @health-coach, @personal-branding, @social-media, @real-estate, @cybersecurity, @immigration, @investment, @negotiation, @digital-twin, @creative -- each with independent privacy rules.
- Your sensitive data **never leaves your machine** unless you explicitly approve it through the Redaction Dashboard.
- When cloud AI is needed, only anonymized categorical attributes are sent (e.g., "income bracket: 50k-75k") -- never your actual details.
- Enable **Local Mode** and everything runs on-device via embedded llama.cpp. Zero network requests. Zero trust required.

<br>

> [!WARNING]
> **Privacy Notice:** **Cloud mode** is designed for when you need a more powerful AI model that would be impractical to run locally. You can configure any OpenAI-compatible API endpoint in Settings. We default to [Nebius Token Factory](https://tokenfactory.nebius.com) because it is **EU-based** (data centers in Finland and France) and offers a **Zero Data Retention (ZDR)** option. However, **ZDR is NOT enabled by default** -- you must manually activate it in your Nebius account settings. Without ZDR, Nebius stores your prompts and outputs to power speculative decoding (performance optimization). With ZDR enabled, your data is never stored and never used for model training. See the [Nebius Account Setup](#nebius-account-setup) section below. For maximum privacy, use **Local Mode** (fully on-device, zero network requests).

<br>

## &#9889; Quick Start

### For users (download the app)

1. Download the latest installer from [Releases](https://github.com/stefanoallima/sovereign-ai/releases) — `.exe` for Windows, `.dmg` for macOS Apple Silicon
2. Install and open Sovereign AI
3. **Cloud mode**: Set up your Nebius account ([see instructions below](#nebius-account-setup)), then enter your API key in Settings
4. **Local mode**: Go to Settings → Privacy → download a Qwen3 model (built-in, no extra installs needed)
5. Choose a persona and start chatting

### For developers (build from source)

**Prerequisites:** [Node.js](https://nodejs.org/) 22+, [pnpm](https://pnpm.io/) 10+, [Rust](https://rustup.rs/) 1.75+, [CMake](https://cmake.org/) 3.15+

```bash
git clone https://github.com/stefanoallima/sovereign-ai.git
cd sovereign-ai/apps/desktop

pnpm install
pnpm tauri dev
```

<br>

## &#128736; Features

<table>
<tr>
<td width="50%">

### &#128274; Local PII Encryption
ChaCha20-Poly1305 (256-bit AEAD) encryption for all sensitive data. Keys stored in Windows Credential Manager, never in files.

</td>
<td width="50%">

### &#128081; Sovereign Council (14 Agents)
Tax Navigator, Legal Advisor, Financial Advisor, Career Coach, Health &amp; Wellness Coach, Personal Branding, Social Media Expert, Real Estate Advisor, Cybersecurity Advisor, Immigration Advisor, Investment Strategist, Negotiation Coach, Digital Twin, and Creative -- your private board of directors. Each council member has independent privacy settings and LLM backend configuration.

</td>
</tr>
<tr>
<td>

### &#9889; Hybrid Cloud Routing
Per-persona choice of **local-only**, **cloud-only**, or **hybrid** (anonymize locally, process in cloud).

</td>
<td>

### &#128260; Re-hydration Templates
Cloud generates responses with `[PLACEHOLDERS]`. Your local system fills in real values -- PII never touches the network.

</td>
</tr>
<tr>
<td>

### &#128065; Prompt Transparency Review
See the exact sanitized prompt before it's sent to cloud. Edit, approve, or cancel -- full control over what leaves your machine.

</td>
<td>

### &#128196; Document Parsing
Ingest PDF and DOCX files with automatic PII detection. Sensitive fields are masked before any processing.

</td>
</tr>
<tr>
<td>

### &#128737; GLiNER Privacy Shield
On-device neural PII detection powered by [GLiNER](https://github.com/urchade/GLiNER). Automatically identifies names, phone numbers, emails, addresses, SSNs, and more in your messages before they leave the app. Runs entirely locally via ONNX Runtime -- no cloud required.

</td>
<td>

### &#128179; PII Vault
Detected personal data can be saved to your encrypted local vault. Vault entries are automatically substituted with safe placeholders in future messages, so you never accidentally leak the same information twice.

</td>
</tr>
<tr>
<td>

### &#127758; Dutch Tax Knowledge
Built-in understanding of Dutch tax concepts: Box 1/2/3, deductions, BSN validation, and more.

</td>
<td>

### &#128373; Incognito Mode
Disappearing chats that leave zero trace. Messages exist only in memory and vanish when the conversation ends or the app closes -- like browser incognito, but for AI.

</td>
</tr>
</table>

<br>

## &#128736; How It Works

The privacy pipeline ensures your sensitive data never reaches cloud LLMs:

```
                    +-----------------------+
  Your message ---> |  1. Privacy Shield    |  GLiNER detects PII on-device
                    |     (GLiNER)         |  Offers to save to PII Vault
                    +-----------------------+
                              |
                              v
                    +-----------------------+
                    |  2. Backend Router    |  Decides: local, cloud, or hybrid
                    +-----------------------+
                              |
                              v
                    +-----------------------+
                    |  3. Attribute Extract  |  Extracts categories only:
                    |                       |  income_bracket: "50k-75k"
                    |                       |  employment_type: "employed"
                    +-----------------------+
                              |
                              v
                    +-----------------------+
                    |  4. Prompt Review     |  YOU see the sanitized prompt
                    |                      |  Edit, approve, or cancel
                    +-----------------------+  before anything is sent
                          |           |
                    [Approve]    [Cancel -> stop, nothing sent]
                          |
                          v
                    +-----------------------+
                    |  5. Cloud LLM         |  Sees: "User in 50k-75k bracket,
                    |     (Nebius API)      |   employed, asking about Box 1"
                    +-----------------------+  Returns: "Your [INCOME] falls in..."
                              |
                              v
                    +-----------------------+
                    |  6. Re-hydration      |  Fills [INCOME] -> "62,500"
                    |     (local only)      |  Fills [BSN] -> "123456789"
                    +-----------------------+
                              |
                              v
                      Final response with
                      your real values
```

> **Key principle:** Real PII values **never leave your machine**. The cloud only sees categorical attributes and placeholders.

### Prompt Transparency Review

When using **hybrid** or **attributes-only** personas, Sovereign AI pauses before sending anything to the cloud and shows you the exact sanitized prompt in an interactive review panel:

<p align="center">
  <img src="assets/privacy-review-flow.svg" alt="Privacy pipeline with prompt review step" width="100%">
</p>

You can:
- **See** the sanitized prompt the cloud will receive (no PII, only categorical attributes)
- **Edit** the prompt before it's sent -- add context, remove details, refine the question
- **Approve & Send** (or press `Ctrl+Enter`) to send the reviewed prompt to the cloud
- **Cancel** (or press `Esc`) to discard -- **zero data leaves your machine**

<p align="center">
  <img src="assets/prompt-review-panel.svg" alt="Prompt Review Panel UI" width="90%">
</p>

The review panel shows:
- **Your original message** (collapsed by default) -- what you typed
- **What the cloud will see** (editable) -- the sanitized, attribute-only version
- **Privacy badges** -- number of attributes extracted, PII status, reduction percentage

> **When does review trigger?** Only for personas configured with `attributes_only` content mode or `hybrid` backend. Direct cloud and local-only modes skip the review (no cloud exposure to review for local; user chose speed for direct).

### Content Modes

| Mode | What's Sent | Use Case |
|------|-------------|----------|
| `full_text` | Complete message | General chat, no PII detected |
| `attributes_only` | Categorical attributes only | Tax questions with sensitive data |
| `blocked` | Nothing | Requests for raw BSN/IBAN export |

<br>

## &#129302; AI Models & Providers

Sovereign AI supports two modes of operation. You can switch between them at any time from the model selector in the chat input area.

### Cloud Mode (default) -- Nebius Token Factory

The default mode uses [Nebius Token Factory](https://tokenfactory.nebius.com) as the cloud LLM provider. **Why Nebius?**

- **Zero Data Retention (opt-in)** -- When enabled, your prompts and outputs are **never stored and never used for model training**
- **SOC 2 Type II, HIPAA, ISO 27001** certified data centers
- **EU & US data residency** -- Data centers in Finland, France, and the US
- **Open-source models only** -- No proprietary black-box models; you know exactly what's running
- **OpenAI-compatible API** -- Standard API format, easy to migrate if needed
- **You retain full ownership** of all input data and generated content

> [!CAUTION]
> **Zero Data Retention is NOT on by default.** Without it, Nebius stores your prompts and outputs to accelerate inference via speculative decoding. If you are using Sovereign AI with sensitive data, **you must enable ZDR** in your Nebius account settings before use. See setup instructions below.

#### Nebius Account Setup

1. **Create an account** at [tokenfactory.nebius.com](https://tokenfactory.nebius.com)
   - Sign in with your Google or GitHub account
2. **Enable Zero Data Retention**
   - Go to your **Account Profile** page
   - Find the **Zero Data Retention** toggle and **enable it**
   - Note: This may slightly reduce inference speed (disables speculative decoding) but ensures maximum privacy
3. **Get your API key**
   - Navigate to the API keys section in your account
   - Create a new API key and copy it
4. **Configure Sovereign AI**
   - Open Sovereign AI Settings
   - Paste your API key in the **Nebius API Key** field
   - Set the **API Endpoint** to:
     ```
     https://api.tokenfactory.nebius.com/v1
     ```
   - Save and you're ready to chat

**Available cloud models:**

| Model | Strengths | Context |
|-------|----------|---------|
| **MiniMax M2.1** (default) | Best balance of speed & quality | 128k |
| Kimi K2.5 | Strong reasoning, long context | 128k |
| Qwen3 32B | Fast, high quality | 128k |

> [!NOTE]
> Model availability may change as Nebius updates their catalog. Check [Nebius Token Factory](https://tokenfactory.nebius.com) for the latest list. You can also add any OpenAI-compatible model via Settings → Custom Models.

### Local Mode (fully offline) -- Embedded llama.cpp

For maximum privacy, switch to **Local Mode** in Settings. This routes all AI requests through the **embedded llama.cpp engine** -- running entirely on your machine with **zero network requests and no extra installs**.

**Setup (one-time):**

1. Open Sovereign AI → Settings → Privacy
2. Select a Qwen3 model to download (~1–5 GB depending on size)
3. Switch to **Local Mode** in the model selector

**Available local models:**

| Model | Size | RAM needed | Best for |
|-------|------|-----------|----------|
| **Qwen3 1.7B** (default) | ~1.5 GB | 4 GB+ | Fast local chat, privacy pipeline |
| Qwen3 4B | ~3 GB | 6 GB+ | Better quality, still fast |
| Qwen3 8B | ~5 GB | 8 GB+ | High quality local inference |
| Qwen3 0.6B | ~600 MB | 2 GB+ | Ultra-light, older hardware |

> [!IMPORTANT]
> Local models are downloaded on demand from HuggingFace. No models are bundled in the installer. The download happens once and models are stored locally in your app data directory.

### When to use which mode

| Scenario | Recommended Mode |
|----------|-----------------|
| General questions, no sensitive data | Cloud (faster, smarter) |
| Tax questions with personal financial data | Hybrid (anonymize + cloud) |
| Sensitive personal/health topics | Local (fully on-device) |
| No internet connection | Local |
| Maximum speed, large documents | Cloud |

<br>

## &#128295; Tech Stack

<table>
<tr>
<td align="center" width="120">
<br>
<img src="https://img.shields.io/badge/-Tauri_2-24C8DB?style=for-the-badge&logo=tauri&logoColor=white" alt="Tauri"><br>
<sub><b>Desktop</b></sub>
<br><br>
</td>
<td align="center" width="120">
<br>
<img src="https://img.shields.io/badge/-React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React"><br>
<sub><b>Frontend</b></sub>
<br><br>
</td>
<td align="center" width="120">
<br>
<img src="https://img.shields.io/badge/-Rust-DEA584?style=for-the-badge&logo=rust&logoColor=black" alt="Rust"><br>
<sub><b>Backend</b></sub>
<br><br>
</td>
<td align="center" width="120">
<br>
<img src="https://img.shields.io/badge/-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"><br>
<sub><b>Language</b></sub>
<br><br>
</td>
<td align="center" width="120">
<br>
<img src="https://img.shields.io/badge/-Tailwind-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind"><br>
<sub><b>Styling</b></sub>
<br><br>
</td>
</tr>
</table>

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Desktop Shell | **Tauri 2** | Native window, IPC, system integration |
| Frontend | **React 19** + TypeScript | Chat UI, persona config, privacy controls |
| Backend | **Rust** | Encryption, PII processing, local inference |
| State | **Zustand** + **Dexie** (IndexedDB) | App state, persistent chat history |
| Styling | **TailwindCSS v4** | Utility-first responsive design |
| AI (cloud) | **Nebius Token Factory** | Cloud inference (zero data retention, pay-per-token) |
| AI (local) | **llama.cpp** (embedded) | On-device inference, no extra install |
| PII Detection | **GLiNER** via ONNX Runtime | Neural named-entity recognition, fully local |
| Encryption | **ChaCha20-Poly1305** | AEAD encryption for all PII |

<br>

## &#128193; Project Structure

```
apps/desktop/
  src/                         # React frontend
    components/
      chat/                    #   Chat window, message bubbles, prompt review, sidebar
      personas/                #   Persona config, LLM backend editor
      pii/                     #   PII Vault, GLiNER confirmation panel, privacy indicator
      privacy/                 #   PII profile editor, privacy status
      settings/                #   App & privacy settings
    hooks/                     #   useChat, usePrivacyChat
    services/                  #   TypeScript service layer
    stores/                    #   Zustand (chat, settings, personas, profiles, piiVault)
    types/                     #   TypeScript type definitions
  src-tauri/                   # Rust backend
    src/
      lib.rs                   #   Tauri app setup & command registration
      db.rs                    #   SQLite database
      crypto.rs                #   ChaCha20-Poly1305 encryption
      ollama.rs                #   Ollama HTTP client (fallback)
      inference.rs             #   LocalInference trait (backend abstraction)
      llama_backend.rs         #   Embedded llama.cpp backend
      inference_commands.rs    #   Tauri commands for local inference
      gliner.rs                #   GLiNER model management & inference
      gliner_commands.rs       #   Tauri commands for PII detection
      anonymization.rs         #   PII detection & replacement
      attribute_extraction.rs  #   Categorical attribute extraction
      rehydration.rs           #   Template filling with real values
      backend_routing.rs       #   Per-persona backend selection
      profiles.rs              #   User profile management
      tax_knowledge.rs         #   Dutch tax domain knowledge
website/                       # Netlify landing page
```

<br>

## &#129309; Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Code** your changes
4. **Test**: `cd apps/desktop/src-tauri && cargo test`
5. **Commit** and **push**
6. Open a **Pull Request**

<br>

## &#128220; License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  <sub>Built with &#128156; for people who refuse to trade their data for intelligence</sub>
</p>
