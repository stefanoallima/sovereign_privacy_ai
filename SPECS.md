# AILocalMind - Comprehensive Specification

**Version:** 1.0  
**Last Updated:** 2026-06-23  
**Status:** Production (Batch 2 Complete)

## Table of Contents

1. [Overview](#overview)
2. [Data Models](#data-models)
3. [API Specifications](#api-specifications)
4. [Privacy Pipeline Specification](#privacy-pipeline-specification)
5. [Backend Routing Logic](#backend-routing-logic)
6. [Database Schema](#database-schema)
7. [Encryption & Security](#encryption--security)
8. [Nebius API Integration](#nebius-api-integration)
9. [Error Handling](#error-handling)
10. [Version Migration Strategy](#version-migration-strategy)
11. [Configuration Specification](#configuration-specification)

---

## Overview

**AILocalMind** (also known as "Sovereign AI") is a privacy-first desktop AI assistant that runs 14 specialist personas. The system is built with:

- **Frontend**: React 19 + TypeScript + Zustand state management
- **Desktop Shell**: Tauri 2 (native window management, IPC)
- **Backend**: Rust (encryption, PII processing, inference delegation)
- **Inference**: Nebius Token Factory (cloud, optional Zero Data Retention) or embedded llama.cpp (local)
- **PII Detection**: GLiNER (neural NER, on-device)

### Core Principle

**Real PII values never leave the user's machine.** The cloud LLM receives only:
- Categorical attributes (e.g., "income_bracket: 50k-75k")
- Placeholder tokens (e.g., "[INCOME_1]", "[LOCATION_2]")

The user's machine fills in real values on the response.

### Personas (14 Total)

**Original 4 (v0.1):**
- Psychologist (🧠)
- Life Coach (🎯)
- Career Coach (💼)
- Tax Accountant (🧾)

**Batch 1 (v0.2, Privacy-First):**
- Tax Navigator (🧾, local-only)
- Health Coach (💪, local-only)
- Legal Advisor (⚖️, hybrid)
- Financial Advisor (💰, hybrid)
- Negotiation Coach (🤝, hybrid)
- Tax Audit Assistant (📋, hybrid with required PII vault)

**Batch 2 (v1.0, Complete Vision):**
- Personal Branding Coach (🎨, hybrid, optional anonymization)
- Social Media Strategist (📱, hybrid, optional anonymization)
- Real Estate Advisor (🏠, hybrid, required anonymization + PII vault)
- Cybersecurity Advisor (🔐, local-only)
- Immigration/Visa Advisor (🌍, hybrid, required anonymization + PII vault)

---

## Data Models

### Persona Model

```typescript
interface Persona {
  id: string;                          // Unique identifier (kebab-case)
  name: string;                        // Display name
  description: string;                 // One-line description
  icon: string;                        // Emoji icon
  systemPrompt: string;                // Full system prompt (300-2000 chars)
  voiceId: string;                     // TTS voice ID (e.g., "en_US-lessac-medium")
  preferredModelId?: string;           // Preferred LLM model ID
  knowledgeBaseIds: string[];          // References to knowledge base documents
  temperature: number;                 // 0.0-1.0 (creativity vs. determinism)
  maxTokens: number;                   // Response length limit (typically 4096)
  isBuiltIn: boolean;                  // Cannot be deleted
  createdAt: Date;                     // Creation timestamp
  updatedAt: Date;                     // Last modification timestamp
  
  // Privacy-First LLM Backend Configuration
  enable_local_anonymizer?: boolean;   // Use GLiNER to detect PII before cloud
  preferred_backend?: 'nebius' | 'ollama' | 'hybrid';
  anonymization_mode?: 'none' | 'optional' | 'required';
  local_ollama_model?: string;         // Fallback Ollama model ID
  
  // Smart Cloud Delegation (Future)
  enable_cloud_delegation?: boolean;   // Orchestrate between local/cloud
  cloud_delegation_threshold?: number; // Complexity threshold for delegation
  
  // PII Vault Requirement
  requiresPIIVault?: boolean;          // Persona MUST use PII vault for sensitive data
}
```

### AppSettings Model

```typescript
interface AppSettings {
  // API Configuration
  nebiusApiKey: string;                // API key for Nebius Token Factory
  nebiusApiEndpoint: string;           // Endpoint (default: https://api.tokenfactory.nebius.com/v1)
  mem0ApiKey: string;                  // Mem0 memory service API key
  enableMemory: boolean;               // Use Mem0 for persistent memory
  useLocalMemory: boolean;             // Fallback: SQLite local memory
  
  // Model Preferences
  defaultModelId: string;              // Default cloud model (e.g., "qwen3-32b")
  enabledModelIds: string[];           // List of available models
  
  // Voice Settings
  defaultVoiceId: string;              // Default TTS voice
  speechRate: number;                  // 0.5-2.0 (playback speed)
  inputDeviceId?: string;              // Microphone device ID
  outputDeviceId?: string;             // Speaker device ID
  
  // Hotkeys
  pushToTalkKey: string;               // Keyboard shortcut for voice input
  
  // Privacy Settings
  saveAudioRecordings: boolean;        // Persist audio files to disk
  encryptLocalData: boolean;           // Encrypt chat history in SQLite
  
  // Privacy Mode (Unified Control)
  privacyMode: 'local' | 'hybrid' | 'cloud';
  localModeModel: string;              // Model to use in local-only mode
  hybridModeModel: string;             // Model to use in hybrid mode
  cloudModeModel: string;              // Model to use in cloud mode
  
  // Cloud Trust Settings
  cloudTrustLevel: "trusted" | "partial" | "minimal" | null;
  skipCloudReview: boolean;            // Skip prompt review modal if trusted
  
  // UI Preferences
  theme: "light" | "dark" | "system";
  showTokenCounts: boolean;            // Display token usage in UI
  showModelSelector: boolean;          // Show model dropdown in chat
  
  // GLiNER Privacy Shield Configuration
  glinerEnabled: boolean;              // Enable on-device PII detection
  glinerModelId: string | null;        // Loaded GLiNER model ID
  glinerConfidenceThreshold: number;   // 0.0-1.0 (default 0.4)
  
  // Auto-Redaction Policy
  autoRedactAllContent: boolean;       // Automatically redact all cloud-bound content
}
```

### Message Model

```typescript
interface Message {
  id: string;                          // UUID
  conversationId: string;              // Reference to conversation
  role: "user" | "assistant";          // Sender type
  content: string;                     // Plain text message
  sanitizedContent?: string;           // After PII redaction (if applicable)
  originalContent?: string;            // Before redaction (stored encrypted)
  piiDetected?: {
    entities: PiiEntity[];             // Detected PII entities
    reduction_percent: number;         // How much content was redacted
  };
  tokensUsed?: number;                 // Approximate token count
  model?: string;                      // Which LLM generated this message
  createdAt: Date;
  updatedAt: Date;
  isIncognito?: boolean;               // Marked for incognito mode (expires on close)
}
```

### PII Vault Model

```typescript
interface PiiVaultEntry {
  id: string;                          // UUID
  text: string;                        // Original PII text (e.g., "John Smith")
  category: string;                    // NER category (e.g., "PERSON", "PHONE_NUMBER")
  placeholder: string;                 // Safe replacement token (e.g., "[PERSON_1]")
  confirmedAt: string;                 // ISO timestamp when user confirmed
  useCount: number;                    // How many times substituted
}
```

### Conversation Model

```typescript
interface Conversation {
  id: string;                          // UUID
  projectId?: string;                  // Reference to project (optional grouping)
  personaId: string;                   // Selected persona for this conversation
  modelId: string;                     // LLM model used
  title: string;                       // Auto-generated or user-set title
  activeContextIds: string[];          // Loaded context documents
  totalTokensUsed: number;             // Cumulative token count
  isIncognito?: boolean;               // Memory-only (expires on close)
  summary?: string;                    // Rolling summary for long contexts
  createdAt: Date;
  updatedAt: Date;
}
```

### LLMModel Configuration

```typescript
interface LLMModel {
  id: string;                          // Unique ID (e.g., "qwen3-32b-fast")
  provider: "nebius" | "ollama";       // Provider
  apiModelId: string;                  // API model name for requests
  name: string;                        // Display name
  contextWindow: number;               // Max input tokens (e.g., 128000)
  speedTier: "very-fast" | "fast" | "medium" | "slow";
  intelligenceTier: "good" | "high" | "very-high";
  inputCostPer1M: number;              // USD per 1M input tokens
  outputCostPer1M: number;             // USD per 1M output tokens
  isEnabled: boolean;                  // Available in UI
  isDefault: boolean;                  // Preselected for new conversations
}
```

---

## API Specifications

### Tauri Command API

All commands use async request-response pattern via IPC.

#### inference::send_message

**Purpose:** Send user message through privacy pipeline and get response

**Request:**
```json
{
  "message": "What are my tax deductions for Box 1?",
  "conversation_id": "uuid-123",
  "persona_id": "tax-navigator",
  "model_id": "qwen3-32b-fast",
  "context_ids": ["ctx-1", "ctx-2"],
  "privacy_mode": "hybrid",
  "include_redaction": true
}
```

**Processing Flow:**
1. Backend Router reads persona config → decides backend (local/cloud/hybrid)
2. If cloud: Attribute Extraction → redact PII → build safe prompt
3. If local: Forward message directly to llama.cpp
4. If hybrid: Local anonymization → cloud inference → local rehydration
5. Return response with usage stats

**Response:**
```json
{
  "message_id": "msg-456",
  "content": "Your [INCOME] bracket is 50k-75k. Deductions for [SELF_EMPLOYED] may include...",
  "model": "qwen3-32b-fast",
  "tokens_used": {
    "input": 250,
    "output": 180
  },
  "pii_stats": {
    "detected": 2,
    "redacted": 2,
    "vaulted": 0
  }
}
```

**Error Cases:**
- `InvalidModelError`: Model not found or not enabled
- `QuotaExceededError`: API rate limit or token quota
- `OfflineError`: No network and local model not available
- `PersonaNotFoundError`: Persona ID doesn't exist

---

#### gliner::detect_pii

**Purpose:** Run GLiNER on text to identify PII entities

**Request:**
```json
{
  "text": "My name is John Smith and my phone is 555-1234",
  "confidence_threshold": 0.4,
  "language": "en"
}
```

**Response:**
```json
{
  "entities": [
    {
      "text": "John Smith",
      "category": "PERSON",
      "start": 11,
      "end": 22,
      "confidence": 0.92
    },
    {
      "text": "555-1234",
      "category": "PHONE_NUMBER",
      "start": 37,
      "end": 45,
      "confidence": 0.88
    }
  ],
  "processing_time_ms": 145
}
```

**Error Cases:**
- `ModelNotLoadedError`: GLiNER model not downloaded yet
- `InvalidTextError`: Text is empty or not UTF-8
- `GPUMemoryError`: Insufficient VRAM for inference

---

#### crypto::encrypt

**Purpose:** Encrypt data using ChaCha20-Poly1305

**Request:**
```json
{
  "plaintext": "12345-6789",
  "associated_data": "pii_vault_entry",
  "password": "user_master_password"
}
```

**Response:**
```json
{
  "ciphertext": "base64_encoded_ciphertext",
  "nonce": "base64_encoded_nonce",
  "tag": "base64_encoded_auth_tag"
}
```

---

#### profiles::set_user_profile

**Purpose:** Store user attributes for attribute extraction

**Request:**
```json
{
  "employment_type": "self-employed",
  "income_bracket": "50k-75k",
  "industry": "technology",
  "country": "netherlands",
  "tax_box": "1",
  "has_mortgage": true
}
```

**Response:**
```json
{
  "profile_id": "profile-123",
  "updated_at": "2026-06-23T10:30:00Z"
}
```

---

### REST API (Cloud - Nebius Token Factory)

Sovereign AI proxies through standard OpenAI-compatible API.

#### POST /v1/chat/completions

**Request:**
```json
{
  "model": "qwen3-32b-fast",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful tax advisor. User is in [INCOME_BRACKET] income bracket..."
    },
    {
      "role": "user",
      "content": "What deductions apply to [EMPLOYMENT_TYPE]?"
    }
  ],
  "temperature": 0.6,
  "max_tokens": 4096,
  "stream": false
}
```

**Response:**
```json
{
  "id": "chatcmpl-123456",
  "object": "chat.completion",
  "created": 1687882411,
  "model": "qwen3-32b-fast",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Your [INCOME_BRACKET] falls into... [DEDUCTION_1] may apply to..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 250,
    "completion_tokens": 180,
    "total_tokens": 430
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid API key
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Nebius service error

---

## Privacy Pipeline Specification

### Step-by-Step Execution

```
User Input
    ↓
[1] Backend Router
    • Read persona.preferred_backend
    • Decide: local vs. cloud vs. hybrid
    ↓
IF local: [DONE - skip to 6]
    
IF cloud or hybrid: [CONTINUE]
    ↓
[2] GLiNER Privacy Shield (if enabled)
    • Run NER on user message
    • Identify PII entities
    • Show confirmation modal (optional)
    • Save confirmed entries to PII Vault
    ↓
[3] Attribute Extraction
    • Load user profile (employment_type, income_bracket, etc.)
    • Build categorical attributes JSON
    • Filter attributes based on persona.anonymization_mode
    ↓
[4] PII Redaction
    • For hybrid mode: Replace all PII with placeholders
    • Build sanitized prompt with attributes
    • Original message stored encrypted locally
    ↓
[5] Prompt Review Modal
    • Show user: original message (collapsed) + sanitized version
    • User can edit before sending
    • User must approve/cancel
    ↓
[6] Cloud Inference (if approved)
    • Send sanitized prompt to Nebius API
    • Cloud LLM never sees real PII
    • Response contains placeholders [INCOME_1], [LOCATION_2], etc.
    ↓
[7] Rehydration (Local Only)
    • Extract placeholders from response
    • Fill in real values from PII Vault / user profile
    • Return final response with user's actual data
    ↓
Final Response to User
```

### Redaction Rules

**For `anonymization_mode: 'required'` personas:**
- ALL PII entities are replaced with placeholders
- Attributes extracted and sent instead of raw values
- Examples: Real Estate Advisor, Immigration Advisor

**For `anonymization_mode: 'optional'` personas:**
- User chooses whether to redact in prompt review modal
- Default: redact (safe default)
- User can "Send as-is" to skip redaction
- Examples: Personal Branding Coach, Social Media Strategist

**For `anonymization_mode: 'none'` personas:**
- No redaction (message sent as-is)
- Used for personas with no sensitive data handling
- Examples: Life Coach, Career Coach

### Attribute Extraction Rules

When redacting for cloud, extract these categories:

```typescript
type UserAttributes = {
  // Financial
  income_bracket?: string;          // "0-25k" | "25k-50k" | "50k-75k" | etc.
  employment_type?: string;         // "employed" | "self-employed" | "freelancer"
  
  // Location
  country?: string;                 // "netherlands" | "usa" | etc.
  region?: string;                  // "amsterdam" | "silicon-valley" | etc.
  
  // Personal
  age_range?: string;               // "18-25" | "25-35" | etc.
  family_status?: string;           // "single" | "married" | "divorced"
  
  // Tax (Dutch-specific)
  tax_box?: string;                 // "1" | "2" | "3"
  has_mortgage?: boolean;
  has_savings?: boolean;
  
  // Real Estate (if applicable)
  property_location?: string;
  property_type?: string;           // "apartment" | "house" | etc.
  
  // Professional
  industry?: string;                // "technology" | "finance" | etc.
  years_experience?: string;        // "1-3" | "3-5" | "5-10" | "10+" 
};
```

**Extraction Algorithm:**
1. Load user profile from `profiles` store
2. Filter attributes by persona requirements
3. Redact actual values from message
4. Replace with safe attribute descriptions in prompt

---

## Backend Routing Logic

### Decision Tree

```typescript
function selectBackend(persona: Persona, globalMode: 'local' | 'hybrid' | 'cloud'): Backend {
  // 1. Check persona-level override
  if (persona.preferred_backend === 'ollama') {
    return Ollama;  // Local-only, always
  }
  
  if (persona.preferred_backend === 'nebius') {
    return Nebius;  // Cloud-only, always
  }
  
  // 2. Hybrid personas respect global setting
  if (persona.preferred_backend === 'hybrid') {
    switch (globalMode) {
      case 'local': return Ollama;
      case 'hybrid': return HybridRouter(persona);
      case 'cloud': return Nebius;
    }
  }
  
  // 3. Default to global setting
  return selectBackendByMode(globalMode);
}

function HybridRouter(persona: Persona): Backend {
  // Heuristic: Route complex queries to cloud, simple ones local
  // (Future: LLM-based complexity detection)
  
  // For now: Use cloud if enabled, fallback to local
  if (hasNetworkConnection() && nebiusApiKey) {
    return Nebius;
  } else {
    return Ollama;
  }
}
```

### Per-Persona Backend Configuration

| Persona | Preferred Backend | Anonymization | Can Override? | Requires PII Vault? |
|---------|------------------|---------------|---------------|-------------------|
| Psychologist | Global setting | None | Yes | No |
| Life Coach | Global setting | None | Yes | No |
| Career Coach | Global setting | None | Yes | No |
| Tax Accountant | Global setting | Required | Yes | Yes |
| Tax Navigator | Ollama | Required | No | Yes |
| Health Coach | Ollama | Optional | No | No |
| Legal Advisor | Hybrid | Optional | Yes | No |
| Financial Advisor | Hybrid | Optional | Yes | No |
| Negotiation Coach | Hybrid | Optional | Yes | No |
| Tax Audit | Hybrid | Required | Yes | Yes |
| Personal Branding | Hybrid | Optional | Yes | No |
| Social Media | Hybrid | Optional | Yes | No |
| Real Estate | Hybrid | Required | Yes | Yes |
| Cybersecurity | Ollama | None | No | No |
| Immigration/Visa | Hybrid | Required | Yes | Yes |

---

## Database Schema

### SQLite (Local Storage)

**Table: conversations**
```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  persona_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  title TEXT NOT NULL,
  is_incognito BOOLEAN DEFAULT 0,
  summary TEXT,
  total_tokens_used INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (persona_id) REFERENCES personas(id)
);
```

**Table: messages**
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,  -- 'user' or 'assistant'
  content TEXT NOT NULL,
  sanitized_content TEXT,
  original_content TEXT,  -- encrypted
  pii_detected_json TEXT,  -- JSON serialized PiiEntity[]
  tokens_used INTEGER,
  model TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
```

**Table: pii_vault**
```sql
CREATE TABLE pii_vault (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  category TEXT NOT NULL,
  placeholder TEXT NOT NULL,
  confirmed_at TEXT NOT NULL,
  use_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  UNIQUE(text, category)
);
```

**Table: user_profiles**
```sql
CREATE TABLE user_profiles (
  id TEXT PRIMARY KEY,
  employment_type TEXT,
  income_bracket TEXT,
  industry TEXT,
  country TEXT,
  tax_box TEXT,
  has_mortgage BOOLEAN,
  has_savings BOOLEAN,
  property_location TEXT,
  property_type TEXT,
  age_range TEXT,
  family_status TEXT,
  years_experience TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### IndexedDB (Browser Storage v3)

**Store: chat-store**
- Key: `conversation-{conversationId}`
- Value: Conversation object + messages array

**Store: personas-store** (v3 migration)
- Key: `assistant-personas`
- Value: `{ personas: Persona[], selectedPersonaId: string }`
- Versioned: `version: 3` (with migration function)

**Store: pii-vault-store**
- Key: `pii-vault-entries`
- Value: `PiiVaultEntry[]`

**Store: settings-store**
- Key: `app-settings`
- Value: `AppSettings`

---

## Encryption & Security

### ChaCha20-Poly1305 AEAD

All sensitive data at-rest is encrypted using ChaCha20-Poly1305 (256-bit, AEAD).

**Key Management:**
- Master key stored in **Windows Credential Manager** (Windows) or **Keychain** (macOS)
- Never written to disk
- Derived from user master password (PBKDF2)

**Protected Data:**
- Original messages (before redaction)
- PII vault entries
- User profile data (optional)

**Encryption at Rest:**
```rust
// Pseudocode
fn encrypt_message(plaintext: &str, master_key: &[u8; 32]) -> (String, String) {
    let nonce = ChaCha20Poly1305::generate_nonce();
    let cipher = ChaCha20Poly1305::new(key.into());
    
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .expect("encryption failure!");
    
    return (
        base64_encode(ciphertext),
        base64_encode(nonce)
    );
}

// Storage: { ciphertext, nonce, tag } in SQLite as JSON
```

### Network Security

- All Nebius API calls use HTTPS/TLS 1.3
- API key stored encrypted in Windows Credential Manager
- No cleartext PII transmitted to Nebius
- Optional: Enable Nebius "Zero Data Retention" (ZDR) mode

### PII Vault Substitution

When storing in vault:
```
Original text: "John Smith"
→ Placeholder: "[PERSON_NAME_1]"
→ Stored: { text: "John Smith", placeholder: "[PERSON_NAME_1]", category: "PERSON" }
→ On rehydration: Replace "[PERSON_NAME_1]" with "John Smith" in response
```

---

## Nebius API Integration

### Authentication

**Request Header:**
```
Authorization: Bearer {api_key}
```

**Configuration:**
```typescript
const NEBIUS_ENDPOINT = "https://api.tokenfactory.nebius.com/v1";
const NEBIUS_TIMEOUT_MS = 30000;
const NEBIUS_RETRY_MAX = 3;
```

### Supported Models

| Model | Context | Speed | Intelligence | Cost (1M tokens) |
|-------|---------|-------|--------------|-----------------|
| MiniMax M2.1 | 128k | ⚡⚡ | ⚠️⚠️⚠️ | $0.50/$1.50 |
| Qwen3 32B | 128k | ⚡ | ⚠️⚠️⚠️⚠️ | $0.30/$0.90 |
| Kimi K2.5 | 128k | ⚡ | ⚠️⚠️⚠️⚠️ | $0.40/$1.20 |

### Zero Data Retention (ZDR) Mode

When enabled in Nebius account:
- Prompts NOT stored
- Outputs NOT stored
- NOT used for model training
- Disables speculative decoding (slight latency penalty)

**User Configuration:**
1. Go to https://tokenfactory.nebius.com
2. Account Profile → Zero Data Retention → Toggle ON
3. No API changes needed (server-side setting)

---

## Error Handling

### Error Codes

| Code | Category | Recovery |
|------|----------|----------|
| 1001 | InvalidPersona | Fallback to Psychologist |
| 1002 | ModelNotFound | Show available models, let user choose |
| 1003 | QuotaExceeded | Rate-limit backoff, notify user |
| 1004 | OfflineError | Fallback to local model if available |
| 1005 | InvalidInput | Show validation error, don't send |
| 2001 | NebiusAuthError | Prompt user for API key |
| 2002 | NebiusRateLimit | Backoff 30s-5min |
| 2003 | NebiusServerError | Retry with exponential backoff |
| 3001 | GLiNERNotLoaded | Trigger download, wait, retry |
| 3002 | EncryptionError | Log error, show "Security issue" message |
| 4001 | DatabaseError | Show "Storage error", suggest restart |

### User-Facing Error Messages

```typescript
const ERROR_MESSAGES: Record<string, string> = {
  "OfflineError": "No internet connection. Switched to local mode.",
  "ModelNotFound": "Model not available. Choose a different one.",
  "QuotaExceeded": "API quota exceeded. Try again in a few minutes.",
  "NebiusAuthError": "Invalid API key. Check your Nebius settings.",
  "GLiNERDownloadFailed": "Privacy Shield download failed. Skipping PII detection.",
  "EncryptionError": "Encryption failed. Data may be corrupted.",
  "DatabaseError": "Storage error. Please restart the app.",
};
```

### Logging & Debugging

All errors logged to:
- `%APPDATA%/AILocalMind/logs/error.log` (Windows)
- `~/Library/Application Support/AILocalMind/logs/error.log` (macOS)

Log format:
```
[2026-06-23T10:30:45Z] ERROR [backend_routing] QuotaExceeded: Nebius rate limit
{
  "error_code": 1003,
  "persona_id": "tax-navigator",
  "backend": "nebius",
  "retry_count": 2,
  "next_retry_ms": 60000
}
```

---

## Version Migration Strategy

### localStorage v2 → v3 (Batch 2 Personas)

**Migration Trigger:** On app launch, if `version: 2` in localStorage

**Migration Function:**
```typescript
function migrateV2toV3(oldState: unknown): PersonasStore {
  const old = oldState as Partial<{ personas: Persona[]; selectedPersonaId: string | null }>;
  
  // 1. Extract custom personas from v2 state
  const customPersonas = old.personas?.filter(p => !p.isBuiltIn) ?? [];
  
  // 2. Start with all v3 default personas (includes batch 2)
  const merged = [...DEFAULT_PERSONAS];
  
  // 3. Add custom personas back (dedup by ID)
  for (const custom of customPersonas) {
    const existingIdx = merged.findIndex(p => p.id === custom.id);
    if (existingIdx !== -1) {
      merged[existingIdx] = custom;  // Custom override
    } else {
      merged.push(custom);            // New custom
    }
  }
  
  // 4. Preserve selectedPersonaId
  const selectedId = old.selectedPersonaId ?? "psychologist";
  
  return {
    personas: merged,
    selectedPersonaId: selectedId,
    version: 3
  };
}
```

**New Personas Added:**
- personal-branding-coach
- social-media-strategist
- real-estate-advisor
- cybersecurity-advisor
- immigration-visa-advisor

**Backward Compatibility:**
- v2 custom personas preserved
- Selected persona ID preserved
- No personas deleted

---

## Configuration Specification

### System Prompt Template Variables

Personas can use placeholder variables in system prompts:

```
{user_name}       → User's name (from profile)
{income_bracket}  → Income range (from profile)
{country}         → Country (from profile)
{industry}        → Industry (from profile)
{language}        → Interface language
{datetime}        → Current date/time
```

Example:
```
You are a financial advisor helping {user_name} with investment planning.
{user_name} is based in {country} with industry experience in {industry}.
```

### Persona Configuration File (Future)

```yaml
# personas.yaml - Persona bundle configuration
version: "1.0"
personas:
  - id: tax-navigator
    name: Tax Navigator
    icon: "🧾"
    system_prompt: "You are a Dutch tax specialist..."
    
    # Backend Configuration
    preferred_backend: ollama
    anonymization_mode: required
    require_pii_vault: true
    
    # LLM Configuration
    temperature: 0.6
    max_tokens: 4096
    preferred_models:
      - qwen3-8b
      - qwen3-4b
    
    # Knowledge Base (Future)
    knowledge_base_ids:
      - kb/dutch-tax-law
      - kb/2026-tax-changes
    
    # Privacy Rules (Future)
    pii_redaction_rules:
      - entity: BSN
        placeholder: "[BSN]"
      - entity: IBAN
        placeholder: "[IBAN]"
```

---

## Appendix: Glossary

| Term | Definition |
|------|-----------|
| **PII** | Personally Identifiable Information (name, email, address, SSN, etc.) |
| **GLiNER** | Neural Named Entity Recognition model (ONNX Runtime, on-device) |
| **AEAD** | Authenticated Encryption with Associated Data (ChaCha20-Poly1305) |
| **Anonymization** | Replacing PII with categorical attributes before sending to cloud |
| **Redaction** | Replacing sensitive text with placeholders |
| **Rehydration** | Filling placeholders with real values after cloud response |
| **Prompt Review Modal** | UI modal showing sanitized prompt before sending |
| **PII Vault** | Encrypted local storage of detected PII for substitution |
| **Backend Router** | Logic that decides local vs. cloud vs. hybrid |
| **Attribute Extraction** | Converting raw values to categorical attributes |
| **Zero Data Retention** | Nebius setting to prevent storage/training on your data |
| **Incognito Mode** | Memory-only conversation that expires on close |

---

**End of Specification Document**
