# Specs: Add First Batch of Specialist Advisor Personas (green_add-personas-batch1_01)

## Data Model

### Persona Object Structure

All required fields already exist in `Persona` interface (`apps/desktop/src/types/index.ts`):
- Core: `id`, `name`, `description`, `icon`, `systemPrompt`
- LLM Config: `voiceId`, `preferredModelId`, `temperature`, `maxTokens`, `knowledgeBaseIds`
- Privacy: `enable_local_anonymizer`, `preferred_backend`, `anonymization_mode`, `requiresPIIVault`
- Lifecycle: `isBuiltIn`, `createdAt`, `updatedAt`

### 5 New Personas Added to DEFAULT_PERSONAS

**File:** `apps/desktop/src/stores/personas.ts`

1. **tax-navigator** (📊) — Tax planning for Belgian/European freelancers
   - temperature: 0.6 (conservative)
   - preferred_backend: 'hybrid' (local anonymization + cloud)
   - anonymization_mode: 'required'
   - requiresPIIVault: true

2. **health-coach** (🏥) — Nutrition, medications, chronic disease
   - temperature: 0.6 (conservative)
   - preferred_backend: 'local' (ollama-only, no cloud)
   - anonymization_mode: 'required'
   - requiresPIIVault: true

3. **legal-advisor** (⚖️) — Contracts, employment law, compliance
   - temperature: 0.7 (balanced)
   - preferred_backend: 'hybrid'
   - anonymization_mode: 'required'
   - requiresPIIVault: true

4. **financial-advisor** (💰) — Budgeting, investing, retirement
   - temperature: 0.7 (balanced)
   - preferred_backend: 'hybrid'
   - anonymization_mode: 'required'
   - requiresPIIVault: true

5. **negotiation-coach** (🤝) — Salary, deals, conflict resolution
   - temperature: 0.7 (balanced)
   - preferred_backend: 'hybrid'
   - anonymization_mode: 'required'
   - requiresPIIVault: true

### localStorage Migration (v2 → v3)

**Changes to `persist` config in personas.ts:**
- Increment version from 2 to 3
- Migration logic: add new personas only if not present (preserves existing personas)
- No data loss; additive only

## API / Function Changes

**usePersonasStore:** No breaking changes. All 5 new personas initialize via DEFAULT_PERSONAS array.

**No new methods required** for Phase 1.

## UI Component Changes

### 1. Persona Selector (Grouped Dropdown)

**File:** `apps/desktop/src/components/personas/PersonaSelector.tsx`

**Groups:**
- General Advisors (3): Psychologist, Life Coach, Career Coach
- Specialist Advisors (6): Tax Navigator, Health Coach, Legal Advisor, Financial Advisor, Negotiation Coach, Tax Accountant (legacy)
- Custom (user-created)

**Privacy Badges:** 🔒 (local-only) for Health Coach; ⚠️ (hybrid) for others

### 2. Persona Configuration UI

**Privacy Tab** (`PersonaPrivacyTab.tsx`):
- Backend override toggle: "Use recommended (Hybrid)" vs. "Local (Ollama-only)" vs. "Cloud (Nebius)"
- Warning for Health Coach: "Changing to cloud will send medical data to servers"
- Anonymization toggle (forced true for new personas)

**General Tab** (`PersonaConfigPage.tsx`):
- Privacy badge: "🔒 Local-only" or "⚠️ Hybrid with anonymization"

## Testing Requirements

**Golden Path (5 personas × 1 test each):**
- Tax Navigator: Freelancer asking about home office deductions → uses placeholders, recommends accountant
- Health Coach: User asking about diabetes diet → explains research, doesn't prescribe
- Legal Advisor: User asking about IP ownership → flags red flags, recommends lawyer
- Financial Advisor: User asking about emergency fund → explains rationale, suggests index funds
- Negotiation Coach: User preparing for salary negotiation → suggests tactics, builds confidence

**Regression Tests (4 existing personas):** Select, chat, settings persist, no errors

**Privacy Validation:** GLiNER redacts domain-specific PII before cloud processing

## New UI Components (Design-Gate Revisions)

### 3. Prompt Transparency Review Modal

**File:** `apps/desktop/src/components/chat/PromptReviewModal.tsx`

**Purpose:** Show user original → redacted message before cloud send; user approves, edits, or cancels.

**Props:**
```typescript
interface PromptReviewProps {
  originalMessage: string;
  redactedMessage: string;
  redactionMap: { [token: string]: string }; // e.g., { "[PERSON_1]": "Name" }
  destination: string;
  personaId: string;
  onApprove: () => void;
  onLocalOnly: () => void;
  onCancel: () => void;
}
```

**Trigger:** When persona uses `hybrid` backend AND GLiNER detects PII in message.

**Actions:**
- [SEND TO CLOUD] — Sends redacted message to Nebius
- [KEEP LOCAL ONLY] — Falls back to embedded llama.cpp (local inference)
- [CANCEL] — Aborts send
- [REVIEW REDACTION] — Expands mapping table (Phase 1: read-only; Phase 2: editable)

**State Integration:** Connect to Zustand inference store; block cloud call until user confirms.

### 4. Telemetry Consent Panel

**File:** `apps/desktop/src/components/settings/TelemetryConsentPanel.tsx`

**Purpose:** Toggle telemetry ON/OFF; display audit trail instructions.

**Parent:** PrivacySettings.tsx

**Content:**
- Toggle: "Collect Analytics & Usage Data" (OFF by default)
- Description: Explain what telemetry is, what is NOT collected
- Link: "What we collect" → opens PRIVACY_FAQ.md or in-app help
- Status badge: "DISABLED" or "ENABLED"
- Debug link: "Open DevTools Console to verify network activity"

**State Integration:** Zustand `appSettings.telemetryEnabled` (persisted to localStorage)

**Enforcement:** All fetch() calls respect `telemetryEnabled` flag; guarded by RequestLogger utility.

### 5. Chat Export Panel

**File:** `apps/desktop/src/components/settings/ChatExportPanel.tsx`

**Purpose:** Export conversations as encrypted JSON with user-provided password.

**Parent:** Settings → Data Management → Export Conversations

**Options:**
- Format: JSON (default), PDF, Plaintext
- Encryption: User Password (default) or Company-Controlled Key
- Date Range: All (default) or custom date range
- Conversations: All (default) or selected conversations

**Actions:**
- [Export] → Triggers encryption & download
- [Test Decryption] → Verify password decrypts exported file
- [View Sample] → Show sample exported conversation

**Encryption:** PBKDF2 (key derivation from password) + ChaCha20-Poly1305 (same as local encryption)

**Backend:** New Tauri command `export_conversations` (no server call; local processing only)

### 6. Network Audit Panel

**File:** `apps/desktop/src/components/settings/NetworkAuditPanel.tsx`

**Purpose:** Display all outbound network requests with approval status, timestamps, sizes.

**Parent:** Settings → Privacy & Data Collection → Network Audit

**Display:**
- List of recent requests (last 2 hours, max 50)
- Each request shows:
  - Timestamp (HH:MM:SS)
  - Destination (domain + endpoint)
  - Method (GET/POST) + Status (200/400/500)
  - Size (bytes sent/received)
  - Approval: "Approved by User" | "Auto-approved" | "Blocked"
  - Content: [Show Anonymized Prompt] (expandable)

**Actions:**
- [Enable Network Logging] (toggle for current session)
- [Export Log] (download as JSON)
- [Clear] (clear displayed requests)

**State Integration:** Zustand store tracks HTTP calls from Rust backend (via NetworkMonitor module)

**Backend:** New module `apps/desktop/src-tauri/src/network_monitor.rs` intercepts & logs HTTP calls

## Dependencies (Updated)

**No new npm packages required** (Phase 1). Uses existing:
- Zustand (persist middleware)
- React, TypeScript
- Lucide React (icons)
- crypto-js or TweetNaCl.js (for PBKDF2 + ChaCha20) — verify availability

**Rust backend additions:**
- Extend `backend_routing.rs` for prompt review flow (approval gate before cloud call)
- New `network_monitor.rs` module for HTTP call logging
- Crypto crate: `chacha20poly1305` (already used for local encryption)
