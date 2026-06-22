# Tasks: Add First Batch of Specialist Advisor Personas (green_add-personas-batch1_01)

## Task Summary

15 concrete implementation tasks breaking down the full feature:

**Core Personas (T01–T10):**
1. **T01** — Add 5 new personas to personas.ts (M effort)
2. **T02** — Update localStorage migration v2 → v3 (S effort)
3. **T03** — Update persona selector UI (grouped dropdown) (M effort)
4. **T04** — Add privacy badges & backend override UI (S effort)
5. **T05** — Configure GLiNER for domain-specific redaction (L effort, design phase)
6. **T06** — Update documentation (README, CLAUDE.md) (S effort)
7. **T07** — Write regression tests (4 existing personas) (M effort)
8. **T08** — Write golden path tests (5 new personas) (L effort)
9. **T09** — Implement privacy validation & manual testing (L effort)
10. **T10** — Integration testing & bug fixes (M effort)

**User Control Features (T11–T15, addresses design-gate gaps):**
11. **T11** — Build Prompt Transparency Review Modal (M effort, for Margot)
12. **T12** — Build Telemetry Consent Panel + Console Logging (M effort, for David)
13. **T13** — Build Chat Export Panel (Encrypted JSON) (M effort, for Aisha)
14. **T14** — Build Network Audit Panel + Logging Backend (L effort, for Aisha)
15. **T15** — Documentation + Testing (Privacy FAQ, Telemetry Audit, Export Guide) (M effort)

---

## T01: Add 5 New Personas to personas.ts

**Effort:** M (Medium, copy-paste + configuration)  
**Files:** `apps/desktop/src/stores/personas.ts`  
**Dependencies:** None  
**Persona Testing:** Margot (Tax Navigator), David (Health Coach), Aisha (Legal Advisor + Negotiation Coach)

**Description:**
Add 5 new `Persona` objects to the `DEFAULT_PERSONAS` array with full system prompts, icons (📊 🏥 ⚖️ 💰 🤝), and privacy settings.

**Acceptance Criteria:**
1. TypeScript compiles without errors
2. App boots and all 9 personas load
3. Each persona has correct settings (temperature, backend, anonymization_mode)
4. Health Coach: `preferred_backend: 'local'`; others: `preferred_backend: 'hybrid'`
5. Temperatures: 0.6 for tax/health/legal; 0.7 for financial/negotiation

---

## T02: Update localStorage Migration (v2 → v3)

**Effort:** S (Small, ~15 lines)  
**Files:** `apps/desktop/src/stores/personas.ts`  
**Dependencies:** T01  
**Persona Testing:** All (upgrade path verification)

**Description:**
Update Zustand `persist` middleware to increment version to 3 and add migration logic to merge new personas without losing existing data.

**Acceptance Criteria:**
1. Version set to 3 in persist config
2. Migration function reads v2 state correctly
3. Old personas survive migration
4. New personas appear on upgrade
5. No duplication or data loss
6. No console errors during migration

---

## T03: Update Persona Selector UI (Grouped Dropdown)

**Effort:** M (Medium, 2–3 files, UI components)  
**Files:** `apps/desktop/src/components/personas/PersonaSelector.tsx` (or update existing)  
**Dependencies:** T01  
**Persona Testing:** All (intuitive for everyone)

**Description:**
Update persona selector to display grouped categories:
- General Advisors (3): Psychologist, Life Coach, Career Coach
- Specialist Advisors (6): Tax Navigator, Health Coach, Legal Advisor, Financial Advisor, Negotiation Coach, Tax Accountant
- Custom (user-created)

**Acceptance Criteria:**
1. Three groups appear in dropdown
2. All 9 personas in correct groups
3. Clicking a persona switches chat context
4. Icons display correctly (emojis)
5. Group headers visually distinct
6. No layout broken; responsive design

---

## T04: Add Privacy Badges & Backend Override UI

**Effort:** S (Small, 1–2 files, UI text/toggles)  
**Files:** `apps/desktop/src/components/personas/PersonaPrivacyTab.tsx`, `PersonaConfigPage.tsx`  
**Dependencies:** T01, T03  
**Persona Testing:** Aisha (privacy-conscious user)

**Description:**
1. Add privacy badges in persona selector: 🔒 (Health Coach local-only), ⚠️ (others hybrid)
2. Add backend override toggle in Privacy tab with warnings
3. Add privacy badge in General tab (informational)

**Acceptance Criteria:**
1. 🔒 badge appears for Health Coach only
2. ⚠️ badges for other 4 specialists
3. Backend selector in Privacy tab works
4. Warning shown when overriding Health Coach to cloud
5. Anonymization toggle disabled (always checked)
6. Settings persist after save

---

## T05: Configure GLiNER for Domain-Specific Redaction (Phase 1 Design, Phase 2 Implementation)

**Effort:** L (Large, design only for Phase 1)  
**Files:** `apps/desktop/src-tauri/src/anonymization.rs` (config document)  
**Dependencies:** T01  
**Persona Testing:** David (Health Coach), Margot (Tax Navigator)

**Description:**
**Phase 1 (Design):** Document which PII categories each persona should redact:
- Health Coach: medication, diagnosis, healthcare_provider, health_metric, person_name, family_member
- Tax Navigator: income, bsn, iban, address, person_name, institution_name
- Legal Advisor: person_name, company_name, email, contract_terms, salary_range
- Financial Advisor: financial_amount, account_number, institution_name, employment_details
- Negotiation Coach: person_name, company_name, financial_term, salary_range

**Acceptance Criteria (Phase 1):**
1. Entity mapping document created and linked in CLAUDE.md
2. Each persona has defined PII categories
3. Mappings reasonable for domain

---

## T06: Update Documentation (README & CLAUDE.md)

**Effort:** S (Small, 2 files)  
**Files:** `README.md`, `CLAUDE.md`, `apps/desktop/README.md`  
**Dependencies:** T01  
**Persona Testing:** None (documentation clarity)

**Description:**
1. Add "Specialist Advisors (9 personas)" section to README
2. List all 9 personas with icons and one-line descriptions
3. Update CLAUDE.md with personas and Phase 2 roadmap
4. Mention privacy-first approach (local-only, anonymization)

**Acceptance Criteria:**
1. README lists all 9 personas with icons
2. Personas grouped (General vs. Specialist)
3. Privacy-first language used
4. CLAUDE.md updated
5. No broken links
6. Markdown formatting correct

---

## T07: Write Regression Tests (4 Existing Personas)

**Effort:** M (Medium, test setup + 4 test cases)  
**Files:** `apps/desktop/src/__tests__/stores/personas.test.ts`  
**Dependencies:** T01  
**Persona Testing:** Automated

**Description:**
Write unit + integration tests ensuring 4 existing personas still work:
- Select & chat with each
- System prompt unchanged
- Settings persist
- Knowledge bases still work
- Custom personas still function

**Acceptance Criteria:**
1. Test file created
2. All 4 existing personas pass unit tests
3. `isBuiltIn: true` prevents deletion
4. Personas can be selected without errors
5. Migration test verifies old personas survive v2 → v3
6. Test coverage > 80% for personas.ts

---

## T08: Write Golden Path Tests (5 New Personas)

**Effort:** L (Large, 5 detailed scenarios + manual)  
**Files:** `apps/desktop/src/__tests__/stores/personas.test.ts`, test fixtures  
**Dependencies:** T01, T05 (partial)  
**Persona Testing:** Margot, David, Aisha (real users)

**Description:**
Unit + manual tests for each new persona:
- Verify all fields set correctly
- Golden path scenario: send message, verify domain-appropriate response
- Verify tone & style match design
- Verify failure mode handling (persona declines inappropriate requests)

**Golden Path Scenarios:**
- Tax Navigator: Home office deductions → uses placeholders, recommends accountant
- Health Coach: Diabetes nutrition → explains research, doesn't prescribe
- Legal Advisor: IP ownership → flags red flags, recommends lawyer
- Financial Advisor: Emergency fund → explains rationale, suggests index funds
- Negotiation Coach: Salary negotiation → suggests tactics, builds confidence

**Acceptance Criteria:**
1. All 5 personas pass unit tests
2. Golden path responses are domain-appropriate (not generic)
3. Responses match tone from design
4. Placeholders used instead of real amounts
5. "Not advice" disclaimers present
6. Failure modes handled correctly
7. Privacy check: anonymized messages reach cloud

---

## T09: Implement Privacy Validation & Manual Testing

**Effort:** L (Large, real LLM calls + PII monitoring)  
**Files:** Test data, logging/monitoring code  
**Dependencies:** T01–T04, T05  
**Persona Testing:** Margot, David, Aisha (manual real app testing)

**Description:**
1. **Automated Privacy Validation:** Log cloud-bound messages, verify no raw PII
2. **Manual Testing Checklist:** For each persona, test PII redaction:
   - Health Coach: medication names, diagnoses, family member names redacted
   - Tax Navigator: income, BSN, IBAN, addresses redacted
   - Legal Advisor: company names, contract terms, personal names redacted
   - Financial Advisor: investment amounts, net worth redacted
   - Negotiation Coach: employer names, salary figures, counterparty names redacted
3. **Rehydration Test:** Verify user sees original (non-redacted) message in chat history

**Acceptance Criteria:**
1. GLiNER redaction active for each persona
2. Cloud-bound messages contain no raw PII
3. User sees rehydrated (original) message in history
4. Manual checklist all pass (5 personas × 3 test cases)
5. No PII leakage detected
6. Anonymization mode `required` enforced for all

---

## T10: Integration Testing & Bug Fixes

**Effort:** M (Medium, end-to-end + bug fixes)  
**Files:** All (integration test coverage)  
**Dependencies:** T01–T09  
**Persona Testing:** All

**Description:**
1. **End-to-End Tests:**
   - App boot: all 9 personas load
   - Persona selection: switch personas, send message, get response
   - Settings persistence: customize → close → reopen → settings saved
   - Privacy pipeline: send PII → redaction → cloud → rehydration
2. **Regression Tests:** Existing personas, knowledge bases, custom personas still work
3. **UI/UX Tests:** Grouped dropdown, privacy badges, configuration UI all functional
4. **Bug Fixes:** Fix any issues found during testing

**Acceptance Criteria:**
1. App boots without errors; all 9 personas loaded
2. Full chat flow works (select → send → response)
3. Persona switching works
4. Settings persist after close/reopen
5. Privacy pipeline end-to-end success
6. Grouped dropdown displays correctly
7. Regression tests pass
8. localStorage migration (v2 → v3) succeeds
9. No console errors/warnings
10. Performance acceptable

---

## T11: Build Prompt Transparency Review Modal

**Effort:** M (Medium, React component + Rust integration)  
**Files:** `apps/desktop/src/components/chat/PromptReviewModal.tsx`, `src-tauri/src/backend_routing.rs`  
**Dependencies:** T01 (personas need `requiresPromptReview` field), GLiNER running  
**Persona Testing:** Margot (Tax Navigator, Legal Advisor, Financial Advisor)

**Description:**
Build modal that appears before cloud send for hybrid personas with PII-containing messages:
1. Display original message
2. Display redacted message (from GLiNER)
3. Display redaction mapping (what was redacted)
4. Show destination (Nebius Token Factory)
5. Provide actions: [SEND TO CLOUD], [KEEP LOCAL ONLY], [CANCEL]
6. [REVIEW REDACTION] expands mapping details (Phase 1: read-only; Phase 2: editable)

**Acceptance Criteria:**
1. Modal appears for hybrid personas + PII detected
2. Original/redacted messages display correctly
3. Redaction mapping is accurate and readable
4. [SEND TO CLOUD] unblocks Rust backend and sends redacted message
5. [KEEP LOCAL ONLY] routes to local inference (llama.cpp)
6. [CANCEL] aborts send entirely
7. Modal has clean, professional appearance
8. No PII leakage in modal UI

**Integration Points:**
- Update `PersonaConfig` interface to add `requiresPromptReview: boolean`
- Update `personas.ts` to set `requiresPromptReview: true` for Tax/Legal/Financial
- Hook into `InferenceCommand` in `inference_commands.rs` — block cloud call until approval
- Wire redaction map from GLiNER to modal

---

## T12: Build Telemetry Consent Panel + Console Logging

**Effort:** M (Medium, React component + RequestLogger utility)  
**Files:** `apps/desktop/src/components/settings/TelemetryConsentPanel.tsx`, `apps/desktop/src/utils/RequestLogger.ts`, `apps/desktop/src/stores/settings.ts`  
**Dependencies:** None (independent feature)  
**Persona Testing:** David (privacy-conscious verification)

**Description:**
1. Add `telemetryEnabled: boolean` to Zustand settings store (default: false)
2. Create TelemetryConsentPanel component (toggle + description + link)
3. Create RequestLogger utility for console logging ([Privacy] prefix)
4. Integrate panel into PrivacySettings.tsx
5. Wire console logging into all fetch() calls (via RequestLogger)
6. Update CLAUDE.md & create PRIVACY_FAQ.md

**Acceptance Criteria:**
1. Settings store has `telemetryEnabled` field (default false)
2. TelemetryConsentPanel renders in Settings → Privacy
3. Toggle controls `telemetryEnabled` + persists to localStorage
4. Console shows [Privacy] messages for each network call
5. All fetch() calls use RequestLogger (add comments marking INTENTIONAL vs FORBIDDEN)
6. With `telemetryEnabled: false`, only INTENTIONAL calls appear
7. Documentation clear for non-technical users

**Integration Points:**
- Zustand settings migration (increment version if needed)
- All fetch() calls in TypeScript + http::Client calls in Rust
- Pre-commit hook (optional, Phase 2): enforce INTENTIONAL/FORBIDDEN comments

---

## T13: Build Chat Export Panel (Encrypted JSON)

**Effort:** M (Medium, React component + Tauri command)  
**Files:** `apps/desktop/src/components/settings/ChatExportPanel.tsx`, `apps/desktop/src-tauri/src/chat_export.rs`, `apps/desktop/src/utils/ChatExporter.ts`  
**Dependencies:** None (independent feature)  
**Persona Testing:** Aisha (data ownership verification)

**Description:**
1. Create ChatExportPanel component (export format + encryption options + date range selector)
2. Add Tauri command `export_conversations` (Rust backend, local processing)
3. Implement PBKDF2 key derivation from user password
4. Implement ChaCha20-Poly1305 encryption (use existing crypto crate)
5. Generate encrypted JSON file (ready for download)
6. Create ChatExporter utility (encryption logic, decryption helper)
7. Add [Test Decryption] button to verify password works

**Acceptance Criteria:**
1. ChatExportPanel renders in Settings → Data Management
2. User can select export format (JSON, PDF, plaintext)
3. User can choose encryption (password or company key)
4. User can filter by date range
5. [Export] button triggers download
6. Encrypted file has standard naming: `sovereign-ai-chats-YYYY-MM-DD-encrypted.json`
7. [Test Decryption] verifies password correctness
8. No server call made; all processing local
9. Password never sent anywhere; only used locally to derive encryption key

**Integration Points:**
- Zustand conversation store (access to chat history)
- Tauri Fs module (filesystem access for downloads)
- Crypto crate for PBKDF2 + ChaCha20-Poly1305

---

## T14: Build Network Audit Panel + Logging Backend

**Effort:** L (Large, React component + Rust HTTP monitoring)  
**Files:** `apps/desktop/src/components/settings/NetworkAuditPanel.tsx`, `apps/desktop/src-tauri/src/network_monitor.rs`, `apps/desktop/src/stores/audit.ts`  
**Dependencies:** T11 (needs Prompt Review approval status integration)  
**Persona Testing:** Aisha (network transparency verification)

**Description:**
1. Create NetworkMonitor module in Rust (`network_monitor.rs`) to intercept HTTP calls
2. Store intercepted calls in Zustand audit store (timestamp, method, URL, status, size, approval)
3. Hook into all http::Client calls to log before sending
4. Create NetworkAuditPanel component (list recent requests, timestamps, statuses, approval)
5. Add [Enable Network Logging] toggle (for session)
6. Add [Export Log] to download audit trail as JSON
7. Integrate approval status from Prompt Review modal ("Approved by User", "Auto-approved", "Blocked")
8. Add [Show Anonymized Prompt] to view what was sent (expandable per request)

**Acceptance Criteria:**
1. NetworkAuditPanel renders in Settings → Privacy & Data Collection
2. Network monitor logs all outbound HTTP calls
3. Each log entry shows: timestamp, destination, method, status, size
4. Approval status linked to Prompt Review modal
5. List displays last 2 hours, max 50 requests (session-scoped in Phase 1)
6. [Export Log] generates JSON file with all logged requests
7. [Show Anonymized Prompt] works for each request
8. Toggle [Enable Network Logging] turns logging on/off
9. Clear history doesn't affect app functionality

**Integration Points:**
- Hook into http::Client in Rust backend (wrap all calls with logging)
- Zustand audit store (new store for audit logs)
- Prompt Review modal (query approval status per request)
- Inference commands (correlate network log with conversation history)

---

## T15: Documentation + Testing (Privacy FAQ, Telemetry Audit, Export Guide)

**Effort:** M (Medium, docs + test scenarios)  
**Files:** `PRIVACY_FAQ.md`, `TELEMETRY_AUDIT.md`, `EXPORT_GUIDE.md`, test scenarios  
**Dependencies:** T11–T14  
**Persona Testing:** Margot, David, Aisha (verify docs answer their questions)

**Description:**
1. **PRIVACY_FAQ.md** — Non-technical guide for David & Aisha:
   - What is telemetry? What is NOT collected?
   - How to verify telemetry is OFF (DevTools Console screenshots)
   - Export & encryption safety (passwords never sent)
   - Network audit trail explanation
2. **TELEMETRY_AUDIT.md** — Technical reference:
   - All network calls documented (INTENTIONAL vs FORBIDDEN)
   - Console logging verification steps
   - Checklist for code review
3. **EXPORT_GUIDE.md** — Step-by-step for Aisha:
   - How to export conversations
   - Encryption & password safety
   - How to decrypt exported file
   - Data retention policies
4. **Test Scenarios** (golden path):
   - Margot: Approve/deny prompt review for Tax Navigator message
   - David: Verify console shows no telemetry calls
   - Aisha: Export conversation, decrypt, verify data integrity

**Acceptance Criteria:**
1. PRIVACY_FAQ.md answers key questions (David-relevant)
2. TELEMETRY_AUDIT.md provides technical transparency
3. EXPORT_GUIDE.md guides non-technical users (Aisha-relevant)
4. All documentation links work
5. Screenshots/examples included where helpful
6. Markdown formatting correct
7. Golden path test scenarios all pass
8. Personas (Margot, David, Aisha) review docs and sign off

---

## Task Dependency Graph (Updated)

### Core Personas (T01–T10)

```
T01 (Add personas)
  ↓
T02 (localStorage migration)  ← depends on T01
  ↓
T03 (Grouped selector)        ← depends on T01
  ↓
T04 (Privacy badges)          ← depends on T01, T03
  ↓
T05 (GLiNER design)           ← depends on T01
  ↓
T06 (Documentation)           ← depends on T01
  ↓
T07 (Regression tests)        ← depends on T01
  ↓
T08 (Golden path tests)       ← depends on T01, T05
  ↓
T09 (Privacy validation)      ← depends on T01–T04, T05
  ↓
T10 (Integration & bugs)      ← depends on T01–T09
```

### User Control Features (T11–T15, Design-Gate Revisions)

```
T01 (Add personas with requiresPromptReview field)
  ↓
T11 (Prompt Transparency Modal)     ← depends on T01
  ↓
T12 (Telemetry Consent Panel)       ← independent
  ↓
T13 (Chat Export Panel)             ← independent
  ↓
T14 (Network Audit Panel)           ← depends on T11 (approval status integration)
  ↓
T15 (Documentation + Testing)       ← depends on T11–T14
```

**Recommended Parallelization:**

**Wave 1 (Core Personas Setup):**
- T01, T06 in parallel (core persona config + documentation)

**Wave 2 (Store + UI):**
- T02, T03, T04 in parallel (localStorage, selector, badges)

**Wave 3 (User Controls — can run parallel to core testing):**
- T12, T13 in parallel (telemetry, export — independent)
- T11 in parallel with Wave 2 (needs T01 complete)

**Wave 4 (Advanced Features):**
- T05 (GLiNER design phase)
- T14 (Network audit — needs T11 for approval integration)

**Wave 5 (Testing & Integration):**
- T07, T08, T09, T10, T15 (sequential with testing)

**Timeline:**
- Core personas (T01–T10): ~17 days serial, ~10 days optimized
- User controls (T11–T15): ~7 days serial, ~5 days optimized (can overlap with core testing)
- **Total (all 15 tasks): ~20 days serial, ~12 days with parallelization**

**Critical Path:** T01 → T02 → T03 → T04 → T07 → T08 → T09 → T10 → T15
