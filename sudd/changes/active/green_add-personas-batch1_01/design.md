# Design: Add First Batch of Specialist Advisor Personas (green_add-personas-batch1_01)

## Executive Summary

This change introduces 5 new specialist advisor personas (Tax Navigator, Health Coach, Legal Advisor, Financial Advisor, Negotiation Coach) to the AILocalMind desktop app, fulfilling the "14 specialist advisors" marketing promise. These personas are designed for privacy-conscious users (Margot, David, Aisha) who need domain expertise without cloud data leakage.

**Key design principles:**
- Each persona has strict, enforceable privacy boundaries (GLiNER-based auto-redaction)
- Persona-specific backend defaults (local/hybrid/cloud) match the sensitivity of each domain
- System prompts include explicit failure modes ("what this persona MUST NOT do")
- Backward compatibility: 4 existing personas (psychologist, life-coach, career-coach, tax-accountant) remain unchanged
- Modular structure: new personas are added to `DEFAULT_PERSONAS` in `personas.ts`

[Full design content truncated for brevity — see separate file for complete system prompts, integration architecture, UI/UX design, testing strategy, and rollout plan]

## Quick Reference: The 5 New Personas

### 1. Tax Navigator
- Domain: Tax planning for Belgian/European freelancers (replaces generic tax-accountant)
- Tone: Cautious, regulation-focused
- Backend: Hybrid (with local anonymization mandatory)
- Key PII: Income, BSN, IBAN, mortgage details (auto-redacted)

### 2. Health Coach
- Domain: Nutrition, medications, chronic disease (especially diabetes management)
- Tone: Warm, empathetic, evidence-based
- Backend: Local-only (most sensitive domain)
- Key PII: Medication names, diagnoses, health metrics (auto-redacted)

### 3. Legal Advisor
- Domain: Contracts, employment law, compliance across EU
- Tone: Precise, accessible, cautious
- Backend: Hybrid (with local anonymization mandatory)
- Key PII: Names, company names, contract terms, salary figures (auto-redacted)

### 4. Financial Advisor
- Domain: Budgeting, investing, retirement planning
- Tone: Educational, judgment-free
- Backend: Hybrid (with local anonymization mandatory)
- Key PII: Income, net worth, investment amounts, accounts (auto-redacted)

### 5. Negotiation Coach
- Domain: Salary negotiation, deal tactics, equity discussion
- Tone: Confident, strategic, supportive
- Backend: Hybrid (with local anonymization mandatory)
- Key PII: Employer names, counterparty names, salary figures, equity details (auto-redacted)

## Integration Points

### Code Changes Required
1. **personas.ts**: Add 5 objects to DEFAULT_PERSONAS with full system prompts, settings
2. **UI Components**: Update persona selector to show grouped dropdowns (General → Specialist → Custom)
3. **localStorage Migration**: Increment version from 2 to 3; migration adds new personas on upgrade
4. **README.md**: Update to reflect "9 specialist advisors" + plan toward 14

### Backward Compatibility
- All 4 existing personas (psychologist, life-coach, career-coach, tax-accountant) remain unchanged
- User custom personas survive
- No breaking changes to chat data structures or settings

## Testing Strategy

**Golden Path Tests** (one per persona):
- Tax Navigator: Freelancer asking about Belgian home office deductions → should reference tax code, avoid specific advice
- Health Coach: User asking about diabetes medication interactions → should discuss evidence, not prescribe
- Legal Advisor: User asking about IP ownership in contract → should flag clauses, recommend lawyer review
- Financial Advisor: User asking about emergency fund → should explain rationale, suggest index funds
- Negotiation Coach: User preparing for salary negotiation → should explain tactics, build confidence

**Regression Tests**: Each of 4 existing personas still selectable, chatty, configurable

**Privacy Validation**: GLiNER detects domain-specific PII and redacts before cloud processing

---

# Design Revisions: Prompt Transparency, Analytics Control, & Chat Export

## Design-Gate Feedback Addressed

This revision adds three critical user control surfaces required by key personas:

1. **Margot's "Prompt Transparency Review"** — User approval gate before cloud sends
2. **David's "Analytics/Telemetry Must Be Disable-able"** — Full telemetry visibility and control
3. **Aisha's "Chat Export/Encryption + Audit Trail"** — Data ownership, encryption, and network transparency

---

## 1. Prompt Transparency Review (for Margot)

### 1.1 UI Flow

**Trigger:** Tax Navigator, Legal Advisor, Financial Advisor (any persona using `hybrid` backend) + user message containing potential PII

**When the user sends a message with sensitive data:**

```
User Message:
"My wife Sarah needs medication review for her insulin (20 units/day) and metformin (2000mg)."

[SEND BUTTON] → Internal redaction triggered

→ MODAL OPENS: "PROMPT TRANSPARENCY REVIEW"

├─ ORIGINAL:
│  "My wife Sarah needs medication review for her insulin 
│   (20 units/day) and metformin (2000mg)."
│
├─ REDACTED (will be sent to cloud):
│  "My wife [PERSON_1] needs medication review for her 
│   [MEDICATION_1] ([DOSE_1]) and [MEDICATION_2] ([DOSE_2])."
│
├─ DESTINATION:
│  "Nebius Token Factory (EU-based, Zero Data Retention)"
│
├─ [REVIEW REDACTION] button
│  └─ Opens mapping details:
│     [PERSON_1] = Name (never sent)
│     [DOSE_1] = Numeric dose (never sent)
│
└─ Action Buttons:
   [SEND TO CLOUD] [KEEP LOCAL ONLY] [CANCEL]
```

### 1.2 Where This Goes in the App

**Component Location:** `apps/desktop/src/components/chat/PromptReviewModal.tsx`

**Integration Points:**
1. Chat input handler (InferenceCommand in `inference_commands.rs`)
2. When persona uses `hybrid` backend AND GLiNER detects PII:
   - Send message to frontend → trigger modal
   - Block cloud call until user approves
   - Persist approval choice per conversation

**Settings Toggle:** Margot can configure sensitivity level:
- Settings → Privacy → "Prompt Review Mode"
- `strict` (default for hybrid personas): Always show modal for health/legal/financial content
- `smart`: Only show if PII confidence > 85%
- `off`: Never show (trusts redaction)

### 1.3 UI Implementation Details

**Modal Component (PromptReviewModal.tsx):**
```typescript
interface PromptReviewProps {
  originalMessage: string;
  redactedMessage: string;
  redactionMap: { [token: string]: string }; // e.g., { "[PERSON_1]": "Name" }
  destination: string; // e.g., "Nebius Token Factory"
  personaId: string;
  onApprove: () => void;
  onLocalOnly: () => void;
  onCancel: () => void;
}
```

**"Review Redaction" Expandable Section:**
- Shows mapping table: `[TOKEN] → Field Type`
- User can manually edit mappings (toggle on/off specific redactions)
  - "Don't redact [DOSE_1], I'm comfortable with that" → user can override
  - Confirmation required: "You are sending medication doses to the cloud. Confirm?"
- Saved mapping changes apply only to this message (not conversation-wide)

**"Keep Local Only" Button:**
- Falls back to local-only inference (uses embedded llama.cpp)
- If local model unavailable, show error: "Local inference not available. Download Qwen3-8B first."
- No cloud call made; response stays private

### 1.4 Changes to Personas Configuration

**personas.ts:** Add new field to each persona config:

```typescript
interface PersonaConfig {
  id: string;
  name: string;
  backend: 'local' | 'hybrid' | 'cloud';
  requiresPromptReview?: boolean; // NEW: true for Tax/Legal/Financial
  reviewSensitivity?: 'strict' | 'smart' | 'off'; // NEW: default behavior
  // ... existing fields
}

// Tax Navigator
{
  id: 'tax-navigator',
  name: 'Tax Navigator',
  backend: 'hybrid',
  requiresPromptReview: true,
  reviewSensitivity: 'strict',
  // ...
}

// Legal Advisor
{
  id: 'legal-advisor',
  name: 'Legal Advisor',
  backend: 'hybrid',
  requiresPromptReview: true,
  reviewSensitivity: 'strict',
  // ...
}

// Financial Advisor
{
  id: 'financial-advisor',
  name: 'Financial Advisor',
  backend: 'hybrid',
  requiresPromptReview: true,
  reviewSensitivity: 'strict',
  // ...
}
```

### 1.5 Phase 1 or Phase 2?

**PHASE 1 REVISED SCOPE:**
- ✅ Modal design & layout (high-priority UX)
- ✅ Persona config changes (requiresPromptReview field)
- ✅ Integration with hybrid backend routing
- ⏳ Advanced mapping editor (toggle-off specific redactions) → Phase 2

**Phase 1 MVP:** Users see original → redacted messages and approve before cloud send. No manual editing of redactions yet.

**Phase 2:** Allow users to override specific redactions with confirmation ("I'm okay sending this field").

### 1.6 Example Scenario (Margot's Use Case)

Margot is a legal consultant using Legal Advisor to draft employment contract language.

```
Margot types:
"I'm drafting a contract for John Smith at Acme Corp. 
 Base salary 150k, equity 5% over 4 years. 
 Non-compete clause for 2 years post-exit?"

[SEND]

→ PromptReviewModal opens:

ORIGINAL:
"I'm drafting a contract for John Smith at Acme Corp. 
 Base salary 150k, equity 5% over 4 years. 
 Non-compete clause for 2 years post-exit?"

REDACTED:
"I'm drafting a contract for [PERSON_1] at [COMPANY_1]. 
 Base salary [SALARY_1], equity [EQUITY_1] over [YEARS_1]. 
 Non-compete clause for [YEARS_2] post-exit?"

DESTINATION: Nebius Token Factory (EU-based, Zero Data Retention)

[REVIEW REDACTION]
  [PERSON_1] → Name (never sent)
  [COMPANY_1] → Company (never sent)
  [SALARY_1] → Salary amount (never sent)
  [EQUITY_1] → Percentage (never sent)
  [YEARS_1] → Duration (never sent)
  [YEARS_2] → Duration (never sent)

[SEND TO CLOUD] [KEEP LOCAL ONLY] [CANCEL]

Margot clicks [SEND TO CLOUD]
→ Redacted version sent to Nebius
→ Response rehydrated locally with original values
→ No actual names/salaries ever leave the machine
```

---

## 2. Analytics/Telemetry Disable Controls (for David)

**Note:** Comprehensive design exists in `green_telemetry-off-mode_03/design.md`. This section summarizes integration into Phase 1.

### 2.1 Privacy Settings Design

**Location:** Settings → Privacy & Data Collection

**Current State Display:**

```
┌─────────────────────────────────────────────────────────┐
│ PRIVACY & DATA COLLECTION                               │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ ☐ Collect Analytics & Usage Data                         │
│   Help improve Sovereign AI by sending anonymous data    │
│   (word count, persona selection, features used)         │
│   Status: DISABLED (DEFAULT)                             │
│                                                           │
│ ☐ Collect Crash Reports                                 │
│   Send crash logs to help debug issues                   │
│   Status: DISABLED (DEFAULT)                             │
│                                                           │
│ ☐ Auto-Update Checks                                     │
│   Check for app updates (you choose when to install)     │
│   Status: ENABLED (disable to prevent checks)            │
│                                                           │
│ [What we collect] ← Link to privacy docs                │
│ [Network Monitor] ← Opens audit log (see section 2.4)    │
│                                                           │
├─────────────────────────────────────────────────────────┤
│ VERIFIED: No background processes send data to cloud.   │
│ Your conversations are stored locally and never sent     │
│ unless you explicitly send them to a cloud LLM.          │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Implementation Details

**Backend Changes (Rust):**
- All HTTP calls marked with `// INTENTIONAL` or `// FORBIDDEN` comments
- FORBIDDEN calls guarded by `if settings.telemetryEnabled { ... }`
- No telemetry calls in hot paths (inference, encryption, redaction)

**Frontend Changes (React):**
- Zustand settings store: `telemetryEnabled: boolean` (default false)
- TelemetryConsentPanel component in PrivacySettings
- All fetch() calls logged via RequestLogger utility

**Console Audit Trail (Real-Time Verification):**

With DevTools open, David sees:
```
[Privacy] Network call: POST https://api.tokenfactory.nebius.com/v1/chat (INTENTIONAL: Cloud LLM inference)
[Privacy] Network call: GET https://huggingface.co/models/Qwen/... (INTENTIONAL: Model download)
[Privacy] Skipped: POST https://analytics.local (telemetryEnabled: false)
```

### 2.3 Network Monitor / Verification (Phase 1 MVP)

**Phase 1:** Console logging + "What we collect" documentation

**Phase 2:** Dedicated Network Audit panel (see section 3b for design)

**How David Verifies (Phase 1):**

1. Open Settings → Privacy & Data Collection
2. Verify toggle is OFF (disabled)
3. Click [Network Monitor] → instructions to open DevTools Console
4. Start a conversation
5. Look at console output:
   - Only [Privacy] messages with "INTENTIONAL" should appear
   - Any unexpected calls = bug (file an issue)
6. Success: David sees only intentional cloud calls (LLM, model download), no analytics

### 2.4 Phase 1 or Phase 2?

**PHASE 1:**
- ✅ Privacy Settings panel with telemetry toggle (OFF by default)
- ✅ All network calls marked and commented
- ✅ Console logging via RequestLogger utility
- ✅ Documentation: "What we collect" and "How to verify"

**PHASE 2:**
- Network Audit panel (dedicated UI, not just console)
- Detailed request/response breakdown
- Export audit logs

### 2.5 Deal-Breaker Resolution for David

**His ask:** "I won't use the app if analytics can't be fully disabled."

**Our answer:**
1. Analytics are OFF by default (not opt-out, true opt-in)
2. David can verify in Settings → [Network Monitor] → open DevTools Console
3. Console shows real-time audit trail of all network calls
4. Only INTENTIONAL calls (LLM, model download) appear when analytics are OFF
5. Documentation: "PRIVACY_FAQ.md" with step-by-step screenshots for non-technical users

**Success Criteria:** David opens the app, goes to Settings, sees "Analytics: DISABLED", opens Console, runs a test message, sees only LLM calls, feels confident.

---

## 3. Chat Export/Encryption + Network Audit (for Aisha)

### 3.1 Chat Export & Encryption Feature

**Location:** Settings → Data Management → Export Conversations

**UI Design:**

```
┌─────────────────────────────────────────────────────────┐
│ EXPORT CONVERSATIONS                                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ Export Format:                                           │
│   [v] JSON (encrypted)  [ ] PDF  [ ] Plaintext          │
│                                                           │
│ Encryption:                                             │
│   [v] User Password     [ ] Company-Controlled Key      │
│                                                           │
│ Date Range:    [All ▼]                                  │
│ Conversations: [All ▼]  [or select specific ones]       │
│                                                           │
│ [Export 23 conversations (45 MB)]                        │
│                                                           │
│ DOWNLOAD WILL START AUTOMATICALLY                        │
│ File: sovereign-ai-chats-2026-06-23-encrypted.json      │
│                                                           │
├─────────────────────────────────────────────────────────┤
│ [Test Decryption] [View Sample] [?]                     │
└─────────────────────────────────────────────────────────┘
```

**Encryption Flow:**

1. User enters password (or generates random key)
2. Frontend derives encryption key from password via PBKDF2 (same as local encryption)
3. Conversations serialized to JSON
4. JSON encrypted with ChaCha20-Poly1305 (same cipher as local storage)
5. Encrypted file downloaded locally
6. Password NEVER sent to server

**Decryption Flow (Aisha can do this on any machine):**

```
File: sovereign-ai-chats-2026-06-23-encrypted.json

→ Load file into Decryption Tool (standalone web/desktop app or same app)
→ Enter password
→ App derives key locally
→ Decrypts locally
→ Shows plaintext conversations
→ Never touches any server
```

### 3.2 Network Audit / Debug Panel

**Location:** Settings → Privacy & Data Collection → [Network Monitor]

**Design:**

```
┌─────────────────────────────────────────────────────────┐
│ NETWORK AUDIT LOG                                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ [Enable Network Logging] (for this session)              │
│ [⚙️ Settings] [Export Log] [Clear]                       │
│                                                           │
│ OUTBOUND CONNECTIONS (Last 2 hours)                     │
│                                                           │
│ 2026-06-23 10:45:23 → nebius-api.com POST /v1/messages  │
│ ├─ Status: ✓ SUCCESS (200)                              │
│ ├─ Size: 612 bytes sent, 2847 bytes received            │
│ ├─ Approval: [Approved by User] ← (Margot's prompt     │
│ │                                    review modal)       │
│ ├─ Content: [Show Anonymized Prompt]                    │
│ │                                                        │
│ 2026-06-23 10:46:15 → nebius-api.com POST /v1/messages  │
│ ├─ Status: ⊘ BLOCKED (User selected "Keep Local Only")  │
│ ├─ Content: [Show Anonymized Prompt]                    │
│ │                                                        │
│ 2026-06-23 10:47:01 → huggingface.co GET /models/...    │
│ ├─ Status: ✓ SUCCESS (200)                              │
│ ├─ Size: ~5.2 GB (model download)                        │
│ ├─ Purpose: [INTENTIONAL: Model download (cached)]      │
│ │                                                        │
│ SUMMARY:                                                │
│   Total requests: 3                                      │
│   Approved: 2                                            │
│   Blocked: 1                                             │
│   Failed: 0                                              │
│                                                           │
│ LOCAL STORAGE:                                          │
│   All conversations: Encrypted at rest (SQLite)          │
│   Encryption: ChaCha20-Poly1305 (derived from device    │
│              passphrase)                                │
│   Key storage: System keychain                           │
│                                                           │
│ [Export Audit Log as JSON] [Print for Legal Review]     │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Detailed Features

**3.3.1 Chat Export Options:**

| Format | Encryption | Use Case |
|--------|-----------|----------|
| JSON | User Password | Aisha exports for local archive, retains full searchability, can import back |
| PDF | Company-Controlled Key | Print for legal review, read-only, audit trail |
| Plaintext | None | Quick share (not recommended for sensitive data) |

**3.3.2 Network Audit Log Details:**

Each logged request shows:
- **Timestamp** (precise to millisecond)
- **Destination** (domain, endpoint)
- **Method & Status** (GET/POST, 200/400/500)
- **Size** (bytes sent/received)
- **Approval Status**:
  - "Approved by User" (Margot's modal approval)
  - "Auto-approved (hybrid mode)" (background inference)
  - "Blocked (Local Only)" (user selected fallback)
- **Content Preview** (anonymized prompt or error message)
- **Expand Button** → shows full request (if permitted)

**3.3.3 "Show Full Request" Permissions:**

For security, showing raw request/response requires:
- Password confirmation ("This shows unencrypted data. Enter password to proceed.")
- Or: Require local authentication (biometric, PIN)
- Logged in audit trail: "Full request viewed by User at 10:45:23"

### 3.4 Implementation Details

**Chat Export:**

**File:** `apps/desktop/src/components/settings/ChatExportPanel.tsx`

**Backend changes (Rust):**
- New Tauri command: `export_conversations`
  - Input: `{ format: 'json' | 'pdf' | 'plaintext', dateRange, encryption: 'password' | 'key', password?: string }`
  - Output: Encrypted blob ready for download
  - No server call; all processing local

**Frontend:**
- Zustand store tracks all network calls: `{ timestamp, method, url, status, size, approval, content }`
- TauriEvent listener captures outbound calls (hook into http::Client in Rust)

**Network Audit:**

**File:** `apps/desktop/src/components/settings/NetworkAuditPanel.tsx`

**Logging Mechanism:**
1. Create `apps/desktop/src-tauri/src/network_monitor.rs` — module to intercept & log HTTP calls
2. Hook into all `http::Client` instances
3. Store logs in Zustand: `{ requests: NetworkCall[] }`
4. Display in panel with filtering & export

### 3.5 Phase 1 or Phase 2?

**PHASE 1 REVISED SCOPE:**

**MVP (Ship in Phase 1):**
- ✅ Chat Export as JSON (encrypted with user password)
- ✅ Network Audit log (real-time view, last 2 hours, 50 requests max)
- ✅ Integration with Prompt Review modal (show "Approved by User" in audit)
- ✅ Local storage encryption status visible in Settings

**Phase 2 (Deferred):**
- ⏳ PDF export with company-controlled keys
- ⏳ Persistent audit log storage (beyond session)
- ⏳ Advanced filtering & search in audit log
- ⏳ Legal-grade audit report generation

### 3.6 Data Ownership & Security (Aisha's Requirements)

**How This Protects Aisha:**

1. **Export Ownership:** Aisha downloads encrypted JSON to her own device. No server copy. She controls the backup, archival, and deletion.

2. **Encryption:** ChaCha20-Poly1305 (same cipher as device encryption). Encrypted file is useless without password. Even if stolen, no plaintext recovery.

3. **Audit Trail:** Network Audit panel shows exactly what left the device and when. Aisha can screenshot/export for legal review.

4. **No Server Logs:** Conversations are stored locally in SQLite. No cloud backend retains copies (unless user explicitly sent to cloud LLM).

5. **Decryption Without Server:** Exported file can be decrypted on any machine (standalone decryption tool) without touching any server.

**Legal Compliance (Example: EU DPA):**
- Aisha is a legal consultant. She has DPA client data.
- She exports chats → encrypted file → stores in her secure archive
- Audit log proves no data left device except what she approved
- She can produce audit log for DPA audits: "See? Only 3 cloud calls, all reviewed and approved by operator"

---

## Summary of Revisions

### Deal-Breaker Resolution

| Persona | Need | Our Solution | Phase 1? |
|---------|------|--------------|----------|
| **Margot** | Approve redactions before cloud send | Prompt Transparency Modal (original → redacted → approve/deny) | ✅ YES |
| **David** | Verify analytics fully disabled | Settings toggle OFF by default + Console audit trail | ✅ YES |
| **Aisha** | Export, encrypt, and audit data | Chat export (encrypted JSON) + Network audit log | ✅ YES (MVP) |

### Phase 1 Scope (Revised)

**Core Feature (Unchanged):**
- 5 specialist personas (Tax, Health, Legal, Financial, Negotiation)

**New User Controls (Phase 1):**

1. **Prompt Transparency Review** (Margot)
   - Modal showing original → redacted messages
   - "Send to Cloud" vs. "Keep Local Only" choices
   - Per-persona configuration (requiresPromptReview field)

2. **Analytics/Telemetry Controls** (David)
   - Privacy Settings with toggle (OFF by default)
   - Console logging of all network calls
   - "What we collect" documentation

3. **Chat Export & Network Audit** (Aisha)
   - Export conversations as encrypted JSON (user password)
   - Network audit log showing all outbound requests
   - Approval status for each request (linked to Margot's review modal)

### Risk Assessment

**Risk 1: Prompt Review Modal Delays User Interaction**

**Mitigation:**
- Modal appears only for sensitive personas (Tax/Legal/Financial) and sensitive content
- Fast approval path: One click [SEND TO CLOUD]
- "Keep Local Only" fallback always available
- **Confidence: HIGH** (Users expect friction here; they chose these personas for a reason)

**Risk 2: Console Logging Not Sufficient for Non-Technical Users (David)**

**Mitigation:**
- PRIVACY_FAQ.md with step-by-step screenshots
- In-app help: Settings → Privacy → [?] → console logging tutorial
- Non-technical option: Trust toggle + clear documentation
- **Confidence: MEDIUM** (Depends on documentation quality; Phase 2 adds Network Audit UI)

**Risk 3: Encrypted Export / Decryption Complexity**

**Mitigation:**
- Phase 1: Simple password-based encryption (familiar UX)
- Decryption tool built into same app (Settings → [Decrypt File])
- **Confidence: HIGH** (PBKDF2 + ChaCha20-Poly1305 are industry-standard)

**Risk 4: Network Audit Log Storage/Performance**

**Mitigation:**
- Phase 1: Store in-memory (last 2 hours, ~50 requests)
- Clear on app restart
- Phase 2: Optional persistent storage
- **Confidence: HIGH** (Small dataset, no performance impact)

**Risk 5: Prompt Review Modal Not Enforced (David/Aisha Trust)**

**Mitigation:**
- Modal is **always** shown for sensitive personas (not optional)
- Tauri backend prevents cloud call until frontend confirms
- Audit log shows "Approved by User" for each request
- **Confidence: HIGH** (Backend enforcement, not client-side)

### Files Manifest (Revised)

**New Components:**
- `apps/desktop/src/components/chat/PromptReviewModal.tsx`
- `apps/desktop/src/components/settings/TelemetryConsentPanel.tsx`
- `apps/desktop/src/components/settings/ChatExportPanel.tsx`
- `apps/desktop/src/components/settings/NetworkAuditPanel.tsx`

**New Backend:**
- `apps/desktop/src-tauri/src/network_monitor.rs` (HTTP call logging)

**New Utilities:**
- `apps/desktop/src/utils/RequestLogger.ts` (console logging)
- `apps/desktop/src/utils/ChatExporter.ts` (encryption & export)

**Modified Files:**
- `apps/desktop/src/stores/settings.ts` (add telemetryEnabled, requiresPromptReview)
- `apps/desktop/src/types/personas.ts` (add requiresPromptReview, reviewSensitivity)
- `apps/desktop/src/components/settings/PrivacySettings.tsx` (integrate panels)
- `sudd/changes/active/green_add-personas-batch1_01/personas.ts` (5 new persona configs)
- `src-tauri/src/inference.rs` or similar (backend routing for prompt review)

**Documentation:**
- Update `CLAUDE.md` with "Privacy & User Controls" section
- Create `PRIVACY_FAQ.md` (what we collect, how to verify)
- Create `TELEMETRY_AUDIT.md` (all network calls documented)
- Create `EXPORT_GUIDE.md` (how to export/decrypt)

### Implementation Sequence (Phase 1)

1. Add persona configs + requiresPromptReview field
2. Build PromptReviewModal (UI + approval flow)
3. Integrate with backend routing (block cloud call until approved)
4. Add TelemetryConsentPanel + console logging
5. Build ChatExportPanel (JSON encryption + download)
6. Build NetworkAuditPanel (log HTTP calls)
7. Documentation (privacy FAQ, audit manifest)
8. Testing (golden path tests for each persona, export/decrypt verify, console audit trail)

### Success Criteria

- [ ] Margot can see original → redacted before cloud send and approve/deny
- [ ] David can verify analytics are OFF via Settings + console
- [ ] Aisha can export encrypted conversations and see network audit trail
- [ ] All three personas say "I'd trust using this app with my data"
