# AILocalMind - Architecture & Design Document

**Version:** 1.0  
**Last Updated:** 2026-06-23  
**Status:** Production (Batch 2 Complete)

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Component Hierarchy](#component-hierarchy)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Zustand Store Architecture](#zustand-store-architecture)
5. [Privacy Architecture](#privacy-architecture)
6. [Backend Selection Flowchart](#backend-selection-flowchart)
7. [UI/UX Patterns](#uiux-patterns)
8. [Encryption & Key Management](#encryption--key-management)
9. [Persona Taxonomy & Grouping](#persona-taxonomy--grouping)
10. [Phase 2 Enhancement Vision](#phase-2-enhancement-vision)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     User (Desktop Machine)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
      ┌───▼────────┐    ┌────▼─────┐      ┌─────▼───────┐
      │   React    │    │  Tauri   │      │   Windows   │
      │  Frontend  │    │   2.0    │      │ Credential  │
      │  (TypeScript│   │  (IPC)   │      │  Manager    │
      │   + Zustand)   │          │      │ (Keys)      │
      └───┬────────┘    └────┬─────┘      └─────────────┘
          │                  │
          │    Tauri Commands (IPC)
          │                  │
      ┌───▼──────────────────▼────────────────┐
      │                                       │
      │      Rust Backend (src-tauri)         │
      │                                       │
      │  ┌─────────────────────────────────┐  │
      │  │  Backend Router                 │  │
      │  │  (local/cloud/hybrid decision)  │  │
      │  └────────────┬────────────────────┘  │
      │               │                       │
      │    ┌──────────┴──────────┬──────────┐ │
      │    │                     │          │ │
      │ ┌──▼──────┐  ┌────────┐ │ ┌──────┐ │ │
      │ │ Ollama  │  │ llama  │ │ │Nebius│ │ │
      │ │ Client  │  │.cpp    │ │ │ API  │ │ │
      │ │(Fallback)  │Embedded│ │ │Client│ │ │
      │ └─────────┘  └────────┘ │ └──────┘ │ │
      │                         │          │ │
      │  ┌──────────┬─────────────────────┐  │
      │  │ Privacy  │ Attribute │ GLiNER  │  │
      │  │ Pipeline │Extraction │ Models  │  │
      │  └──────────┴───────────┴────────┘   │
      │                                       │
      │  ┌─────────────────────────────────┐  │
      │  │  Database (SQLite)              │  │
      │  │  - Conversations                │  │
      │  │  - Messages                     │  │
      │  │  - PII Vault                    │  │
      │  │  - User Profile                 │  │
      │  └─────────────────────────────────┘  │
      │                                       │
      └───────────────────────────────────────┘
          │                  │
          │    IPC Response  │
          │                  │
      ┌───┴──────────────────▼────────┐
      │    IndexedDB (Browser Store)   │
      │    - Chat State                │
      │    - Personas (v3)             │
      │    - Settings                  │
      │    - PII Vault (encrypted)     │
      └────────────────────────────────┘


      ┌─────────────────────────────────┐
      │   Nebius Token Factory API       │
      │   (Optional Cloud LLM)           │
      │   - MiniMax M2.1, Qwen3, Kimi   │
      │   - OpenAI-compatible format    │
      │   - Zero Data Retention (opt-in)│
      └─────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Desktop Shell** | Tauri 2 | Native window, IPC, system tray |
| **Frontend** | React 19 + TypeScript | Chat UI, persona config, settings |
| **State Management** | Zustand + Dexie (IndexedDB) | App state, persistent storage |
| **Styling** | TailwindCSS v4 | Responsive utility-first design |
| **Backend** | Rust | Encryption, PII, inference routing |
| **Local Inference** | llama.cpp (embedded) | On-device model execution |
| **Cloud Inference** | Nebius Token Factory | Pay-per-token cloud API |
| **PII Detection** | GLiNER + ONNX Runtime | Neural NER, fully local |
| **Encryption** | ChaCha20-Poly1305 | AEAD encryption at-rest |
| **Database** | SQLite | Persistent local storage |
| **Testing** | Vitest | Unit/integration tests |

---

## Component Hierarchy

### Frontend Component Tree

```
App
├── ChatWindow
│   ├── MessageList
│   │   ├── MessageBubble (user)
│   │   └── MessageBubble (assistant)
│   └── ChatInput
│       ├── PromptInput (textarea)
│       ├── ModelSelector (dropdown)
│       ├── VoiceButton (push-to-talk)
│       └── SendButton
│
├── Sidebar
│   ├── PersonaSelector
│   │   ├── PersonaCard (multiple)
│   │   │   ├── Icon + Name
│   │   │   ├── PrivacyBadge (Batch 2 only)
│   │   │   └── Backend Indicator
│   │   └── CreatePersonaButton
│   │
│   ├── ContextPanel
│   │   ├── ContextList
│   │   │   ├── ContextItem (drag-to-order)
│   │   │   └── AddContextButton
│   │   └── ContextPreview
│   │
│   └── ConversationHistory
│       ├── ConversationItem (multiple)
│       ├── ArchiveButton
│       └── DeleteButton
│
├── PromptReviewModal
│   ├── OriginalMessageTab
│   ├── SanitizedMessageTab (editable)
│   ├── PrivacyBadges
│   │   ├── AttributesCount
│   │   ├── PIIStatus
│   │   └── ReductionPercentage
│   ├── ApproveButton
│   └── CancelButton
│
├── GLiNERConfirmationPanel
│   ├── PII Entity List
│   │   ├── DetectedEntity (with checkbox)
│   │   └── ConfirmButton
│   ├── SaveToVault (toggle)
│   └── ProceedButton
│
├── PII Vault Panel
│   ├── VaultEntryList
│   │   ├── VaultEntry (with delete)
│   │   └── PlaceholderPreview
│   └── ImportVaultButton
│
├── Settings Panel
│   ├── APIKeyInput (Nebius, Mem0)
│   ├── PrivacyModeSelector
│   │   ├── LocalMode option
│   │   ├── HybridMode option
│   │   └── CloudMode option
│   ├── ModelSelector (checkboxes)
│   ├── GLiNERSettings
│   │   ├── Enable toggle
│   │   ├── ModelDownload
│   │   └── ConfidenceThreshold slider
│   ├── VoiceSettings
│   ├── EncryptionSettings
│   └── AboutPanel
│
└── PersonaEditor (for custom personas)
    ├── GeneralTab
    │   ├── NameInput
    │   ├── DescriptionInput
    │   ├── IconSelector
    │   └── SystemPromptEditor (textarea)
    │
    └── PrivacyTab
        ├── BackendSelector (local/cloud/hybrid)
        ├── AnonymizationModeSelector
        ├── LocalOllamaModelSelector
        └── PII VaultRequirement toggle
```

### Rust Module Structure

```
src-tauri/src/
├── lib.rs
│   ├── Tauri setup
│   ├── Command registration
│   └── Error handling
│
├── db.rs
│   ├── Database initialization
│   ├── Schema creation
│   └── Connection pooling
│
├── crypto.rs
│   ├── ChaCha20-Poly1305 encryption
│   ├── Key derivation (PBKDF2)
│   └── Windows Credential Manager integration
│
├── inference.rs
│   ├── LocalInference trait (abstraction)
│   ├── Request/response types
│   └── Error handling
│
├── llama_backend.rs
│   ├── llama.cpp wrapper
│   ├── Model loading
│   ├── Inference execution
│   └── Token counting
│
├── ollama.rs
│   ├── Ollama HTTP client
│   ├── Fallback implementation
│   └── Connection pooling
│
├── inference_commands.rs
│   ├── send_message command
│   ├── Privacy pipeline orchestration
│   └── Response formatting
│
├── gliner.rs
│   ├── GLiNER model management
│   ├── ONNX Runtime inference
│   ├── Entity extraction
│   └── Confidence scoring
│
├── gliner_commands.rs
│   ├── detect_pii command
│   ├── Model download
│   └── Async processing
│
├── anonymization.rs
│   ├── PII detection coordination
│   ├── Placeholder generation
│   ├── PII Vault integration
│   └── Redaction logic
│
├── attribute_extraction.rs
│   ├── User profile loading
│   ├── Attribute categorization
│   ├── Context filtering
│   └── Safe attribute JSON building
│
├── rehydration.rs
│   ├── Placeholder parsing
│   ├── PII Vault lookups
│   ├── Safe value substitution
│   └── Response formatting
│
├── backend_routing.rs
│   ├── Backend selection logic
│   ├── Persona configuration reading
│   ├── Global privacy mode handling
│   └── Fallback strategies
│
├── profiles.rs
│   ├── User profile CRUD
│   ├── Profile persistence
│   └── Attribute queries
│
└── tax_knowledge.rs
    ├── Dutch tax concepts
    ├── Box 1/2/3 logic
    ├── BSN validation
    └── Tax-specific NER
```

---

## Data Flow Diagrams

### Message Processing Flow (Hybrid Mode)

```
┌─────────────────────┐
│  User Input        │
│  "Ik verdien €45k" │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────┐
│ Backend Router                  │
│ - Read persona config           │
│ - Decide: local/cloud/hybrid    │
│ Result: HYBRID (nebius + anon)  │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ GLiNER PII Detection            │
│ Input: "Ik verdien €45k"        │
│ Output: [€45k as MONEY entity]  │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ Attribute Extraction            │
│ €45k → income_bracket: "40k-50k"│
│ + stored employment_type etc.   │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ Anonymization / Redaction       │
│ Original:                       │
│   "Ik verdien €45k"             │
│ Redacted:                       │
│   "Ik verdien [INCOME_1]"       │
│                                 │
│ Build safe prompt with attrs:   │
│ "User income_bracket: 40k-50k"  │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ Prompt Review Modal             │
│ [Show Original / Sanitized]     │
│ [Edit] [Approve] [Cancel]       │
│                                 │
│ User clicks: [Approve]          │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ Send to Nebius API              │
│ {                               │
│   "model": "qwen3-32b-fast",    │
│   "messages": [{                │
│     "role": "system",           │
│     "content": "You are a Tax..│
│       User income_bracket: ...  │
│     "role": "user",             │
│     "content": "Ik verdien..."  │
│   }]                            │
│ }                               │
└──────────┬──────────────────────┘
           │
           ▼
    ┌──────────────────┐
    │ Nebius.com       │
    │ LLM Processing   │
    │ (No real PII)    │
    │                  │
    │ Response:        │
    │ "Your [INCOME]   │
    │  bracket...[DED]"│
    └────────┬─────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Rehydration (Local)             │
│ Input: "Your [INCOME_1]..."     │
│ Lookup: [INCOME_1] → "€45k"     │
│ Output: "Your €45k bracket..."  │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ Display to User                 │
│ "Your €45k bracket..."          │
│ (Real PII never left device)    │
└─────────────────────────────────┘
```

### Local Mode (Ollama)

```
User Input
    ↓
Backend Router → Decision: LOCAL
    ↓
Message directly to llama.cpp
    (No PII detection, no redaction, no rehydration)
    ↓
llama.cpp Response
    ↓
Display to User
```

### Cloud Mode (Direct)

```
User Input
    ↓
Backend Router → Decision: CLOUD
    ↓
Send to Nebius API (raw message, no redaction)
    ↓
Nebius LLM Response
    ↓
Display to User
```

---

## Zustand Store Architecture

### Chat Store

```typescript
interface ChatStore {
  // State
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createConversation: (personaId: string, modelId: string) => string;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  clearMessages: () => void;
  
  // Selectors
  getSelectedConversation: () => Conversation | undefined;
  getSelectedMessages: () => Message[];
  isConversationIncognito: () => boolean;
}
```

### Personas Store (v3)

```typescript
interface PersonasStore {
  // State
  personas: Persona[];
  selectedPersonaId: string | null;
  
  // Actions
  selectPersona: (id: string | null) => void;
  createPersona: (data: PersonaData) => string;
  updatePersona: (id: string, updates: Partial<Persona>) => void;
  deletePersona: (id: string) => void;
  duplicatePersona: (id: string) => string | null;
  
  // Selectors
  getPersonaById: (id: string) => Persona | undefined;
  getSelectedPersona: () => Persona | undefined;
  getCustomPersonas: () => Persona[];
  
  // Persistence
  // Stored in IndexedDB as "assistant-personas" with version: 3
  // Migration: v2 → v3 merges batch 2 personas
}
```

**localStorage v3 Migration:**

```typescript
persist(..., {
  name: "assistant-personas",
  version: 3,
  migrate: (persisted: unknown) => {
    // Extract old custom personas
    // Merge with new DEFAULT_PERSONAS (includes batch 2)
    // Dedup by ID
    // Return merged state
  },
  partialize: (state) => ({
    personas: state.personas,
    selectedPersonaId: state.selectedPersonaId,
  })
})
```

### Settings Store

```typescript
interface SettingsStore {
  // State
  settings: AppSettings;
  
  // Actions
  updateSetting: (key: keyof AppSettings, value: any) => void;
  updatePrivacyMode: (mode: 'local' | 'hybrid' | 'cloud') => void;
  updateNebiusKey: (key: string) => void;
  enableGLiNER: (enabled: boolean) => void;
  
  // Selectors
  getPrivacyMode: () => 'local' | 'hybrid' | 'cloud';
  isGLiNEREnabled: () => boolean;
  
  // Persistence: IndexedDB "app-settings"
}
```

### PII Vault Store

```typescript
interface PiiVaultStore {
  // State
  entries: PiiVaultEntry[];
  isLoading: boolean;
  
  // Actions
  addEntry: (entry: PiiVaultEntry) => void;
  removeEntry: (id: string) => void;
  getSubstitution: (text: string, category: string) => string | null;
  
  // Selectors
  findByText: (text: string) => PiiVaultEntry | undefined;
  
  // Persistence: IndexedDB "pii-vault-store" (encrypted)
}
```

### Profiles Store

```typescript
interface ProfilesStore {
  // State
  profiles: UserProfile[];
  selectedProfileId: string | null;
  
  // Actions
  createProfile: (attributes: UserAttributes) => string;
  updateProfile: (id: string, attrs: Partial<UserAttributes>) => void;
  selectProfile: (id: string) => void;
  
  // Selectors
  getSelectedProfile: () => UserProfile | undefined;
  getAttributesForExtraction: () => UserAttributes;
  
  // Persistence: SQLite + IndexedDB
}
```

---

## Privacy Architecture

### Privacy Pipeline Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Privacy Pipeline                        │
│                                                            │
│  [1] Backend Router ────────────────────────────────────┐  │
│      ↓                                                  ↓  │
│  Persona config: preferred_backend                 Decision │
│  Global mode: privacyMode                          Tree    │
│  Decision: local/cloud/hybrid                       (see   │
│                                                      below) │
│  [2] GLiNER Privacy Shield (if enabled) ─────────────────┐ │
│      ↓                                                     ↓ │
│  NER on user message                             Detected  │
│  Identify PII entities                          Entities   │
│  Show confirmation modal                                  │
│  Save to PII Vault (optional)                           │
│                                                          │
│  [3] Attribute Extraction ────────────────────────────────┐│
│      ↓                                                    ││
│  Load user profile                          Categorical  ││
│  Build attributes JSON                     Attributes    ││
│  Filter by persona needs                   (safe for    ││
│                                            cloud LLM)   ││
│                                                          │
│  [4] PII Redaction ───────────────────────────────────────┐│
│      ↓                                                     ││
│  Replace PII with placeholders                           ││
│  [NAME] → "[PERSON_1]"                                   ││
│  €45k → "[INCOME_1]"                                     ││
│                                                          │
│  [5] Prompt Review Modal (if hybrid/attributes_only) ───┐││
│      ↓                                                   │││
│  Show original (collapsed) + sanitized (editable)      │││
│  User can edit before sending                          │││
│  Privacy badges: entity count, PII status,             │││
│                reduction percentage                    │││
│  [Approve] [Cancel]                                    │││
│                                                        ││
│  [6] Cloud Inference ──────────────────────────────────┐│││
│      ↓                                                  │││
│  Send to Nebius (sanitized only)             Cloud LLM││
│  Request headers: Authorization: Bearer {key}         ││
│  Response: Placeholders + attributes                  ││
│                                                        │
│  [7] Rehydration (Local Only) ────────────────────────┐││
│      ↓                                                  ││
│  Extract placeholders from response                    ││
│  Look up real values in PII Vault                      ││
│  Fill in actual data                    Final Response  ││
│                                                        │
│  Final response to user (real values)   with Real PII ││
│                                                        │
└────────────────────────────────────────────────────────────┘
```

### Encryption Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Encryption at Rest                       │
│                                                             │
│  Master Key                                                │
│  ├── Source: User master password (PBKDF2 derived)       │
│  ├── Storage: Windows Credential Manager / Keychain      │
│  ├── Access: Only while app is running                   │
│  └── Lifecycle: Wiped on app exit                        │
│                                                             │
│  Data Encrypted:                                           │
│  ├── Original messages (before redaction)                │
│  │   └── ChaCha20-Poly1305(plaintext, nonce, master_key)│
│  │       → Store {ciphertext, nonce, tag} in SQLite      │
│  │                                                         │
│  ├── PII Vault entries                                    │
│  │   └── Each entry encrypted separately                 │
│  │       → Search via placeholder (plaintext)             │
│  │                                                         │
│  └── User profile (optional)                             │
│      └── Can be encrypted for extra privacy              │
│                                                             │
│  Decryption (On Demand):                                  │
│  ├── Fetch {ciphertext, nonce} from SQLite              │
│  ├── Load master key from Credential Manager             │
│  ├── plaintext = Decrypt(ciphertext, nonce, master_key) │
│  └── Use plaintext for rehydration                       │
│                                                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │ NETWORK SECURITY                                   │  │
│  │ ├── Nebius API: HTTPS/TLS 1.3                      │  │
│  │ ├── API Key: In Credential Manager, never logged  │  │
│  │ ├── PII: Never sent to Nebius (redacted)          │  │
│  │ └── ZDR: Optional server-side setting             │  │
│  └────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Backend Selection Flowchart

```
┌────────────────────────────────────┐
│    User Action (send message)      │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│  Get Persona Config                │
│  Read: preferred_backend           │
│  Read: Global privacyMode          │
└────────────┬───────────────────────┘
             │
             ▼
       ┌─────────────┐
       │ preferred   │
       │ _backend?   │
       └─┬───────┬───┘
         │       │
    "ollama"    "nebius"
    (always)   (always)
         │       │
         ▼       ▼
      Local    Cloud
      Mode     Mode
         │       │
         └────┬──┘
              │
         ┌────▼──────┐
         │"hybrid" or│
         │  global   │
         │ privMode? │
         └─┬──────┬──┐
           │      │  │
        "local" "hybrid" "cloud"
           │      │      │
           ▼      ▼      ▼
       Local   HybridRouter  Cloud
       (skip     (logic)     (direct
        review)  below       to
              │              API)
              │
         ┌────▼─────────┐
         │ HybridRouter │
         │  (decision)  │
         └─┬──────────┬─┘
           │          │
     Network OK    Offline
        + Key        or
           │       No Key
           │          │
           ▼          ▼
        Nebius      Ollama
        (cloud)     (local)
           │          │
           └────┬─────┘
                │
            ┌───▼────┐
            │ Privacy│
            │Pipeline│
            │ (next) │
            └────────┘
```

---

## UI/UX Patterns

### Privacy Badge System

**Location:** Persona selector cards (ContextPanel.tsx)

**Badge Types:**

| Badge | Emoji | Color | Persona | Meaning |
|-------|-------|-------|---------|---------|
| Local | 🔐 | Green | Cybersecurity | Local-only inference |
| Required | 🛡️ | Blue | Real Estate, Immigration | Required anonymization |
| Optional | ⚠️ | Amber | Personal Branding, Social Media | Optional anonymization |
| (None) | — | — | Original 4, Batch 1 others | No special privacy mode |

**Visual:**
```
┌─────────────────────────────────┐
│ [🎨] Personal Branding Coach ⚠️ │  ← Emoji badge right-aligned
│ "LinkedIn strategy & branding"  │
└─────────────────────────────────┘
```

### Prompt Review Modal

**When it appears:**
- User selects persona with `preferred_backend: 'hybrid'`
- User selects mode: 'hybrid' or 'attributes_only'
- User clicks Send

**Layout:**

```
┌───────────────────────────────────────────────────┐
│ PROMPT REVIEW                              [X]    │
├───────────────────────────────────────────────────┤
│                                                   │
│ [▼ Your Original Message] (collapsed tab)        │
│   "Ik ben zelfstandig en verdien €45k per jaar" │
│                                                   │
│ [▶ What Cloud Will See] (expanded, editable)    │
│   You are self-employed earning 40k-50k bracket  │
│   [EDIT: You can modify this before sending]    │
│   ┌─────────────────────────────────────────┐   │
│   │ You are self-employed earning 40k-50k.. │   │
│   │ [text editable]                         │   │
│   └─────────────────────────────────────────┘   │
│                                                   │
│ Privacy Badges:                                  │
│  📊 2 attributes extracted                       │
│  ✓ No PII detected (safe to send)               │
│  ↓ 96% content reduction                        │
│                                                   │
│         [Cancel (ESC)]  [Send (Ctrl+Enter)]     │
└───────────────────────────────────────────────────┘
```

### Vault Entry Modal & Detection Confidence

**Location:** PII Vault Panel → VaultEntry component

**Details Tab displays:**
- **Name/Value:** Original PII text and its placeholder
- **Type:** Entity category with icon:
  - 🔍 Auto-detected by GLiNER (if detected automatically)
  - ✏️ Manually added (if user-entered)
- **Detection Confidence:** 
  - For auto-detected: "GLiNER confidence: 92%"
  - For manual entries: "—" (not applicable)
- **Count:** "Substituted 7 times across conversations"
- **Date Added:** Timestamp

**Visual:**
```
┌──────────────────────────────────────────────────┐
│ Vault Entry: John Smith              [Delete]   │
├──────────────────────────────────────────────────┤
│                                                  │
│ Name:              John Smith                    │
│ Placeholder:       [PERSON_1]                    │
│ Type:              PERSON 🔍 Auto-detected      │
│ Confidence:        GLiNER: 92%                   │
│ Count:             Substituted 7 times           │
│ Date Added:        2026-06-23 14:32              │
│                                                  │
│ [Close]                                          │
└──────────────────────────────────────────────────┘
```

### GLiNER Confirmation Panel

**When it appears:**
- GLiNER detects PII in user message
- User not yet sent to cloud

**Layout:**

```
┌──────────────────────────────────────────────┐
│ PRIVACY SHIELD - PII DETECTED        [dismiss]│
├──────────────────────────────────────────────┤
│                                              │
│ Found 2 potential sensitive items:          │
│                                              │
│  ☑ "John Smith" (PERSON, 92% confidence)   │
│  ☑ "555-1234" (PHONE_NUMBER, 88%)         │
│  ☐ "Amsterdam" (LOCATION, 45% skip)       │
│                                              │
│ [Learned aliases help improve detection]   │
│                                              │
│ ☑ Save to PII Vault [?]                    │
│    (auto-substitute in future messages)    │
│                                              │
│    [Cancel]  [Proceed with Privacy Shield] │
└──────────────────────────────────────────────┘
```

### Backend Override Warning (Cybersecurity Advisor)

**When it appears:**
- User selects Cybersecurity Advisor
- User tries to change backend from 'ollama' to 'nebius' or 'hybrid'

**Modal:**

```
┌──────────────────────────────────────────────────┐
│ PRIVACY WARNING                            [X]   │
├──────────────────────────────────────────────────┤
│                                                  │
│ ⚠️  This persona is designed for local-only    │
│     inference. Cloud processing may compromise  │
│     privacy benefits.                           │
│                                                  │
│ The Cybersecurity Advisor runs entirely on your │
│ device with zero network requests. Switching to  │
│ cloud mode would send your security concerns    │
│ outside your machine.                           │
│                                                  │
│  [Keep Local-Only]  [Override & Proceed →]     │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Persona General Tab (Privacy Info Cards)

**Location:** Persona editor, General tab

**Card Styling (for Batch 2 personas):**

```
┌─────────────────────────────────────────────────┐
│ 🔐 Local-Only Inference                    [i] │
├─────────────────────────────────────────────────┤
│ This persona runs exclusively on your device    │
│ with zero network requests. Maximum privacy,    │
│ but may be slower than cloud.                   │
└─────────────────────────────────────────────────┘

Hover over [i]:
┌──────────────────────────────────────────────────┐
│ No PII leaves your machine. Cybersecurity data  │
│ never touches the internet. Fully autonomous.   │
└──────────────────────────────────────────────────┘
```

---

## Encryption & Key Management

### Key Derivation

```
User Master Password
    ↓
PBKDF2(password, salt=16 random bytes, iterations=100000)
    ↓
256-bit Master Key
    ├── Stored in: Windows Credential Manager
    ├── Accessed by: Rust crypto module
    └── Lifetime: App session only
```

### Decryption & Memory Safety

Vault entries are decrypted from localStorage/SQLite only when needed during the redaction phase. Decrypted plaintext values are held in memory exclusively during the redaction loop and cleared immediately after rehydration. No vault entries are logged, stored in a debugger, or persisted in process memory after the operation completes. This ensures that even if the app process is suspended or analyzed, original PII cannot be recovered from memory state.

### Encryption Scheme: ChaCha20-Poly1305

```
plaintext (e.g., original message)
    ↓
Nonce = Random 12 bytes
Key = Master Key (256 bits)
AAD = Persona ID + "encryption_context"
    ↓
ChaCha20Poly1305::encrypt(plaintext, nonce, key, aad)
    ↓
(ciphertext, auth_tag) — 16 byte Poly1305 tag
    ↓
Store in SQLite:
{
  "ciphertext": base64(ciphertext),
  "nonce": base64(nonce),
  "tag": base64(auth_tag)
}
```

### Decryption Flow

```
Read from SQLite: {ciphertext, nonce, tag}
    ↓
Master Key = Load from Credential Manager
    ↓
ChaCha20Poly1305::decrypt(ciphertext, nonce, key, aad)
    ↓
plaintext (original unredacted message)
    ↓
Use for rehydration (fill placeholders)
```

### File Export/Import Policy

**Export Format:** Plaintext JSON for transparency and auditability

When users export the PII Vault or chat history, the exported file contains **plaintext (decrypted) values** so they can inspect and verify what has been stored. This design prioritizes user control and transparency over convenience — users can see exactly what PII is in the vault before sharing, backing up, or archiving.

**Export Workflow:**
1. User clicks "Export Vault" or "Export Conversation"
2. App decrypts all selected entries using the master key
3. JSON file is generated with plaintext values
4. File is saved to user's chosen location (Downloads, etc.)

**Security Warning Shown to User:**
```
⚠️ Your vault export contains plaintext PII. 
This file includes decrypted sensitive data (names, amounts, IDs).
Store securely: 
- Do not email unencrypted
- Do not commit to version control
- Consider encrypting before cloud backup
- Delete after merging into secure system
```

**Import Policy:**
- Imports accept plaintext JSON only
- Each entry is re-encrypted before storing in IndexedDB/SQLite
- Original unencrypted import file should be deleted by user
- Import verification: Show user a preview of entries before confirming

**Audit Trail:**
- Export events logged: timestamp, user, entry count, file destination
- Import events logged: timestamp, user, entry count, re-encryption success
- No plaintext values in logs (only entry count and types)

---

## Persona Taxonomy & Grouping

### Grouping in UI

**Category 1: Life & Work (Original 4)**
```
🧠 Psychologist       (CBT, emotional regulation)
🎯 Life Coach         (goals, habits, development)
💼 Career Coach       (professional development)
🧾 Tax Accountant     (Dutch tax, privacy-first)
```

**Category 2: Specialized Advisors (Batch 1)**
```
🧾 Tax Navigator      (Dutch tax, local-only)
💪 Health Coach       (nutrition, wellness)
⚖️ Legal Advisor      (contracts, general law)
💰 Financial Advisor  (investing, budgeting)
🤝 Negotiation Coach  (salary, deals)
📋 Tax Audit          (document analysis, preparation)
```

**Category 3: Growth & Visibility (Batch 2)**
```
🎨 Personal Branding  (LinkedIn, thought leadership)
📱 Social Media       (content calendar, analytics)
```

**Category 4: Transactions & Compliance (Batch 2)**
```
🏠 Real Estate        (valuation, investment)
🌍 Immigration/Visa   (visa pathways, relocation)
```

**Category 5: Security & Privacy (Batch 2)**
```
🔐 Cybersecurity      (threat response, privacy posture)
```

### Backend Configuration by Category

| Category | Backend | Anonymization | Vault |
|----------|---------|---------------|-------|
| Life & Work | Global | Optional | Original 4 no, Tax Accountant yes |
| Specialized | Hybrid/Local per persona | As configured | Some required |
| Growth | Hybrid | Optional | No |
| Transactions | Hybrid | Required | Yes |
| Security | Local-only | None | No |

---

## Phase 2 Enhancement Vision

### Custom GLiNER Redaction Rules

**Goal:** Domain-specific PII detection per persona

**Example (Tax Navigator):**
```typescript
// Custom NER entities for tax domain
const TAX_DOMAIN_RULES = {
  "TAX_ID": { pattern: /\b\d{3}-\d{2}-\d{4}\b/, replacement: "[TAX_ID]" },
  "BSN": { pattern: /\b\d{9}\b/, replacement: "[BSN]" },
  "IBAN": { pattern: /[A-Z]{2}\d{2}[A-Z0-9]{1,30}/, replacement: "[IBAN]" },
  "AMOUNT": { pattern: /€[\d,]+/, replacement: "[AMOUNT]" },
};

// Applied during attribute extraction
// Only for personas with `custom_redaction_rules` defined
```

### Knowledge Base Integration

**Goal:** Inject domain-specific context into persona prompts

**Architecture:**
```
┌─────────────────────────────────┐
│  Persona Configuration          │
│  knowledge_base_ids: [          │
│    "kb/dutch-tax-2026",        │
│    "kb/dutch-tax-deductions"   │
│  ]                              │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Knowledge Base Store (Dexie)   │
│                                 │
│  Each KB document:              │
│  - id, title, content           │
│  - embedding (vector search)    │
│  - metadata (source, updated)   │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Semantic Search                │
│  Query: user message            │
│  Return: Top 3 relevant chunks  │
│  Max tokens: 2000               │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Prompt Augmentation            │
│  System Prompt + KB Context     │
│  + Anonymized User Question     │
│  → Sent to Cloud LLM            │
└─────────────────────────────────┘
```

### Persona-Specific Prompt Templates

**Goal:** Domain-optimized prompts per persona

**Example (Real Estate Advisor):**
```
System Prompt Template:
  "You are a Real Estate Advisor specializing in property valuation.
   User's financial context: {income_bracket}, {property_type}.
   
   Follow this analysis framework:
   1. Market Analysis (comparable sales)
   2. Property Valuation (3 approaches)
   3. Investment Metrics (cap rate, cash-on-cash)
   4. Tax Implications (depreciation, 1031 exchange)
   5. Financing Options (mortgage strategies)
   
   Knowledge base context: {kb_real_estate_2026}
   
   Disclaimer: This is educational guidance, not investment advice."
   
Variables interpolated:
  - {income_bracket} from user profile
  - {property_type} from context
  - {kb_real_estate_2026} from knowledge base search
```

### Smart Cloud Delegation

**Goal:** Automatically route complex queries to cloud, simple ones to local

**Algorithm:**
```typescript
function shouldDelegateToCloud(message: string, complexity_threshold: number = 0.6): boolean {
  // 1. Calculate message complexity
  const wordCount = message.split(/\s+/).length;
  const hasNumericalQueries = /[\d]+%|[\d]+k|€[\d]+/.test(message);
  const hasMultipleQuestions = (message.match(/\?/g) || []).length > 1;
  
  const complexity_score = 
    (wordCount > 50 ? 0.3 : 0) +
    (hasNumericalQueries ? 0.3 : 0) +
    (hasMultipleQuestions ? 0.4 : 0);
  
  // 2. Compare to threshold
  return complexity_score > complexity_threshold;
}

// If local model latency > 3 seconds, retry with cloud
// If cloud rate-limited, fallback to local
```

---

## Appendix: Key Design Principles

1. **Privacy First** — PII never leaves the machine by default
2. **User Control** — Explicit approval for cloud processing via modal
3. **Offline Capable** — Full functionality without internet (local mode)
4. **Extensible** — Custom personas, knowledge bases, redaction rules
5. **Transparent** — Users see what's being sent to cloud
6. **Auditable** — All interactions logged and reviewable
7. **Secure** — ChaCha20-Poly1305 encryption, Credential Manager integration
8. **Performant** — Embedded inference (no external dependencies)
9. **Accessible** — Keyboard shortcuts, high contrast, screen reader friendly
10. **Portable** — No cloud account required, all data on device

---

**End of Design Document**
