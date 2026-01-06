# Project Context

## Purpose

**Private Personal AI Assistant** - A voice-enabled conversational AI assistant prioritizing privacy and low cost.

### Core Goals
1. **Voice Conversation**: Natural push-to-talk voice interaction while working in other Windows applications
2. **Complete Privacy**: Voice processing (STT/TTS) runs locally; documents and chat history never leave the user's machine
3. **Ultra-Low Cost**: Target < 50 EUR/month, currently ~3-5 EUR/month using Nebius API
4. **Intelligent Agents**: Multiple persona-based agents (psychologist, life coach, career coach) with RAG-powered knowledge bases
5. **Context Control**: User controls which contexts, personas, and projects are active to optimize token usage
6. **Future SaaS**: Potential to offer as a privacy-focused service to other users

### Key Features
- Global hotkey (Ctrl+Space) for push-to-talk from any Windows application
- System tray presence - always running, minimal footprint
- Project-based chat organization
- Multiple selectable personas with custom knowledge bases
- Shareable personal context across personas
- Custom persona creation
- Document upload (PDF, EPUB, MD) for RAG knowledge bases
- PWA for mobile access (future)
- Android app via Play Store (future)

## Tech Stack

### Desktop Application
- **Framework**: Tauri v2 (Rust backend + React frontend)
- **UI Framework**: React 18+ with TypeScript
- **Styling**: TailwindCSS
- **Chat UI**: @chatscope/chat-ui-kit-react or @nlux/react
- **Build Tool**: Vite
- **State Management**: Zustand (lightweight) or Redux Toolkit

### Local AI Pipeline (runs on user's machine)
- **Voice Activity Detection**: Silero VAD (Rust/ONNX)
- **Speech-to-Text**: whisper.cpp or whisper-rs (Whisper small model, ~2GB VRAM)
- **Text-to-Speech**: Piper TTS (CPU-based, low latency)
- **Vector Database**: Qdrant embedded (for RAG)
- **Local Database**: SQLite (chat history, settings, persona configs)

### Cloud LLM (Nebius AI Studio)
- **Integration**: REST API with streaming (OpenAI-compatible)
- **Model Selection**: User can choose based on speed/intelligence/context needs

#### Available Models (configurable)
| Model | Context | Speed | Intelligence | Cost/1M tokens | Best For |
|-------|---------|-------|--------------|----------------|----------|
| Qwen/Qwen3-32B-fast | 32K | Fast | High | ~$0.20 | Daily conversations |
| Qwen/Qwen3-14B | 128K | Very Fast | Good | ~$0.10 | Quick responses, large docs |
| Qwen/Qwen3-30B-A3B | 32K | Fast | High | ~$0.15 | Balanced |
| DeepSeek-V3 | 64K | Medium | Very High | ~$0.30 | Complex reasoning |
| Llama-3.1-70B | 128K | Medium | Very High | ~$0.35 | Large context analysis |
| Llama-3.1-8B | 128K | Very Fast | Good | ~$0.05 | Budget, simple tasks |
| Mistral-Nemo | 128K | Very Fast | Good | ~$0.08 | Fast + large context |

*Note: Prices are estimates - check Nebius AI Studio for current pricing*

### Authentication (for future SaaS)
- **Provider**: Clerk.com (free tier for development)
- **Features**: Email/password, Google, GitHub OAuth, MFA

### Mobile (Future)
- **PWA**: Same React components, hosted on Vercel/Cloudflare
- **Android**: Capacitor or React Native wrapper

## Project Conventions

### Code Style
- **Language**: TypeScript strict mode for frontend, Rust for Tauri backend
- **Formatting**: Prettier for TS/TSX, rustfmt for Rust
- **Linting**: ESLint with recommended + React hooks rules
- **Naming**:
  - React components: PascalCase (`ChatWindow.tsx`)
  - Hooks: camelCase with `use` prefix (`useVoiceChat.ts`)
  - Rust modules: snake_case (`audio_capture.rs`)
  - Constants: SCREAMING_SNAKE_CASE
- **Imports**: Absolute imports using `@/` alias for src directory

### Architecture Patterns
- **Frontend**: Feature-based folder structure
- **State**: Local state first, lift to global only when needed
- **API**: OpenAPI/typed clients for Nebius integration
- **Audio**: Stream-based processing (no loading full audio into memory)
- **Error Handling**: Result types in Rust, try-catch with typed errors in TS

### Project Structure
```
private-assistant/
├── apps/
│   └── desktop/                    # Tauri desktop application
│       ├── src-tauri/              # Rust backend
│       │   ├── src/
│       │   │   ├── main.rs         # App entry point
│       │   │   ├── commands/       # Tauri commands (IPC)
│       │   │   ├── audio/          # Mic capture, playback
│       │   │   ├── stt/            # Whisper integration
│       │   │   ├── tts/            # Piper integration
│       │   │   ├── vad/            # Voice activity detection
│       │   │   ├── db/             # SQLite operations
│       │   │   └── rag/            # Qdrant embedded
│       │   └── Cargo.toml
│       └── src/                    # React frontend
│           ├── components/
│           │   ├── chat/           # Chat UI components
│           │   ├── personas/       # Persona management
│           │   ├── projects/       # Project organization
│           │   ├── contexts/       # Context selection
│           │   └── settings/       # App settings
│           ├── hooks/
│           ├── stores/             # Zustand stores
│           ├── services/           # API clients
│           └── types/
│
├── packages/                       # Shared code (for future PWA)
│   ├── ui/                         # Shared React components
│   └── api-client/                 # Nebius API client
│
├── knowledge/                      # User's local knowledge bases
│   ├── personas/                   # Persona-specific knowledge
│   │   ├── psychologist/
│   │   ├── life-coach/
│   │   └── career-coach/
│   ├── shared/                     # Cross-persona personal context
│   └── projects/                   # Project-specific context
│
└── openspec/                       # Project specifications
```

### Testing Strategy
- **Unit Tests**: Vitest for frontend, cargo test for Rust
- **Integration Tests**: Test Tauri commands with mock audio
- **E2E Tests**: Playwright for full app flows (future)
- **Coverage Target**: 70% for core logic, less for UI

### Git Workflow
- **Main Branch**: `main` (protected, requires PR)
- **Feature Branches**: `feature/short-description`
- **Bug Fixes**: `fix/short-description`
- **Commits**: Conventional commits (`feat:`, `fix:`, `chore:`, etc.)
- **PRs**: Squash merge with descriptive message

## Domain Context

### Persona System
Personas are AI agent configurations that define:
- **System Prompt**: Personality, expertise, communication style
- **Knowledge Bases**: Which document collections to use for RAG
- **Voice**: Which Piper voice to use for TTS
- **Behavior Settings**: Temperature, max tokens, etc.

Built-in personas:
- **Psychologist**: CBT-focused, empathetic, uses Socratic questioning
- **Life Coach**: Goal-oriented, motivational, habit-focused
- **Career Coach**: Professional development, negotiation, leadership

Users can create custom personas with their own system prompts and knowledge bases.

### Context Management System
To optimize token usage and relevance, users control what context is included:

```
┌─────────────────────────────────────────────────────────────┐
│                 CONTEXT SELECTION UI                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PERSONA (select one):                                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ Psychologist │ │  Life Coach  │ │ Career Coach │        │
│  │     ✓        │ │              │ │              │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│  [+ Create New Persona]                                      │
│                                                              │
│  PROJECT/TOPIC (select one):                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │   Personal   │ │   Startup    │ │  Side Project│        │
│  │     ✓        │ │              │ │              │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│  [+ Create New Project]                                      │
│                                                              │
│  PERSONAL CONTEXT (multi-select):                            │
│  ☑ My Background & Values                                   │
│  ☑ Current Life Goals                                       │
│  ☐ Health & Fitness Notes                                   │
│  ☐ Relationship Context                                     │
│  ☑ Work Situation                                           │
│  [+ Add Context Document]                                    │
│                                                              │
│  KNOWLEDGE BASES (multi-select, per persona):                │
│  ☑ CBT Techniques (auto-selected for Psychologist)          │
│  ☑ Emotional Regulation                                     │
│  ☐ Career Development Books                                 │
│  [+ Upload Document]                                         │
│                                                              │
│  MODEL (select one):                                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ● Qwen3-32B-fast    - Fast, 32K context     [Default]  │ │
│  │ ○ Qwen3-14B         - Very fast, 128K context          │ │
│  │ ○ DeepSeek-V3       - Smartest, 64K context            │ │
│  │ ○ Llama-3.1-8B      - Cheapest, 128K context           │ │
│  │ ○ Mistral-Nemo      - Fast + large context             │ │
│  └────────────────────────────────────────────────────────┘ │
│  [Manage Models in Settings]                                 │
│                                                              │
│  ────────────────────────────────────────────────────────── │
│  Estimated context: 2,400 tokens                             │
│  Model: Qwen3-32B-fast @ $0.20/1M = ~$0.0005 per message    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Chat Organization
- **Projects**: High-level containers (e.g., "Personal Growth", "Startup Ideas")
- **Topics**: Sub-categories within projects
- **Conversations**: Individual chat threads with full history
- **Quick Chat**: Ephemeral chats not saved to any project

### Voice Pipeline Flow
```
1. User presses Ctrl+Space (or clicks push-to-talk)
2. Silero VAD starts monitoring microphone
3. Audio chunks stream to Whisper buffer
4. User releases key → VAD confirms speech end
5. Whisper transcribes locally (~2s)
6. App builds prompt: system prompt + selected contexts + RAG results + history + user message
7. Nebius API streams response tokens
8. Tokens buffer into sentences → Piper TTS speaks each sentence
9. User hears response, can interrupt anytime
```

## Important Constraints

### Privacy Requirements
- Voice audio MUST be processed locally only (Whisper on user's GPU)
- Documents MUST stay on user's machine (Qdrant embedded)
- Chat history MUST be stored locally (SQLite, optionally encrypted)
- Only text prompts go to Nebius API (acceptable trade-off for cost)

### Hardware Constraints
- Target: MSI GF65 with 6GB GPU (GTX 1660 Ti or similar)
- Whisper small model (~2GB VRAM) - fits comfortably
- Cannot run LLM locally (would need 16GB+ VRAM for good model)

### Cost Constraints
- Monthly budget: < 50 EUR (target: < 10 EUR)
- Nebius API: ~3-5 EUR/month for typical usage
- No always-on cloud infrastructure
- Leverage free tiers: Clerk, Vercel, Neon (if needed)

### Performance Targets
- Time to first audio response: < 5 seconds (acceptable for thoughtful conversation)
- Whisper transcription: < 3 seconds for 10s audio
- No cold starts (Nebius API is always warm)
- App memory footprint: < 500MB RAM

### Regulatory (Future SaaS)
- GDPR compliance for EU users
- Clear privacy policy
- Right to delete data
- No training on user data

## External Dependencies

### APIs
| Service | Purpose | Pricing |
|---------|---------|---------|
| Nebius AI Studio | LLM inference (Qwen3-32B-fast) | ~$0.001-0.002/1K tokens |
| Clerk.com | Authentication (future) | Free tier up to 10K MAU |

### Local Models (bundled or downloaded on first run)
| Model | Size | Purpose |
|-------|------|---------|
| Whisper small | ~500MB | Speech-to-text |
| Silero VAD | ~2MB | Voice activity detection |
| Piper voices | ~50MB each | Text-to-speech |
| BGE-small-en | ~130MB | Document embeddings for RAG |

### Development Tools
- Node.js 20+
- Rust 1.75+
- pnpm (package manager)
- Docker (optional, for testing)

## Data Models

### LLMModel
```typescript
interface LLMModel {
  id: string;                   // e.g., "qwen3-32b-fast"
  provider: 'nebius';           // Extensible for future providers
  apiModelId: string;           // e.g., "Qwen/Qwen3-32B-fast"
  name: string;                 // Display name
  contextWindow: number;        // Max tokens (e.g., 32000, 128000)
  speedTier: 'very-fast' | 'fast' | 'medium' | 'slow';
  intelligenceTier: 'good' | 'high' | 'very-high';
  inputCostPer1M: number;       // USD per 1M input tokens
  outputCostPer1M: number;      // USD per 1M output tokens
  isEnabled: boolean;           // User can disable models they don't want
  isDefault: boolean;           // One model is the default
}
```

### AppSettings
```typescript
interface AppSettings {
  // API Configuration
  nebiusApiKey: string;
  nebiusApiEndpoint: string;    // Default: https://api.studio.nebius.ai/v1

  // Model Preferences
  defaultModelId: string;
  enabledModelIds: string[];

  // Voice Settings
  defaultVoiceId: string;
  speechRate: number;           // 0.5 - 2.0

  // Hotkeys
  pushToTalkKey: string;        // Default: "Ctrl+Space"

  // Privacy
  saveAudioRecordings: boolean; // Default: false
  encryptLocalData: boolean;    // Default: true

  // UI
  theme: 'light' | 'dark' | 'system';
  showTokenCounts: boolean;     // Show cost estimates
  showModelSelector: boolean;   // Quick model switch in chat
}
```

### Persona
```typescript
interface Persona {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  voiceId: string;              // Piper voice identifier
  preferredModelId?: string;    // Override default model for this persona
  knowledgeBaseIds: string[];   // Which KB collections to include
  temperature: number;
  maxTokens: number;
  isBuiltIn: boolean;           // Can't delete built-in personas
  createdAt: Date;
  updatedAt: Date;
}
```

### Project
```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  color: string;                // For UI
  defaultPersonaId?: string;
  defaultContextIds: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### PersonalContext
```typescript
interface PersonalContext {
  id: string;
  name: string;
  content: string;              // Markdown content
  tokenCount: number;           // Pre-calculated for UI
  isActive: boolean;            // Include in current session
  createdAt: Date;
  updatedAt: Date;
}
```

### Conversation
```typescript
interface Conversation {
  id: string;
  projectId?: string;           // null for quick chats
  personaId: string;
  modelId: string;              // Model used for this conversation
  title: string;
  activeContextIds: string[];   // Contexts used in this conversation
  messages: Message[];
  totalTokensUsed: number;      // Running total for cost tracking
  createdAt: Date;
  updatedAt: Date;
}
```

### Message
```typescript
interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  audioPath?: string;           // Path to saved audio (optional)
  modelId?: string;             // Model used (for assistant messages)
  inputTokens?: number;         // Tokens in prompt (for assistant messages)
  outputTokens?: number;        // Tokens generated (for assistant messages)
  latencyMs?: number;           // Response time (for analytics)
  createdAt: Date;
}
```

### KnowledgeBase
```typescript
interface KnowledgeBase {
  id: string;
  personaId?: string;           // null for shared KBs
  name: string;
  description: string;
  documentCount: number;
  totalChunks: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### UsageStats
```typescript
interface UsageStats {
  // Daily aggregates
  date: string;                 // YYYY-MM-DD
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
  totalLatencyMs: number;
  estimatedCostUsd: number;
}

// Computed views for UI:
// - Today's usage & cost
// - This month's usage & cost
// - Usage by model breakdown
// - Usage by persona breakdown
```
