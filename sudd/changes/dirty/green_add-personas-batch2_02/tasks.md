# Tasks: Add Second Batch of Specialist Advisor Personas (green_add-personas-batch2_02)

## Task Summary

9 concrete implementation tasks for batch 2. Tasks T01–T07 are core persona feature work. Tasks T08–T09 are testing & integration.

- **T01** — Add 5 new personas to personas.ts (M effort)
- **T02** — Update localStorage migration v2 → v3 (S effort)
- **T03** — Update persona selector UI (grouped dropdown for 14 personas) (M effort)
- **T04** — Add privacy badges & verify backend overrides (S effort)
- **T05** — Write regression tests (batch 1 + original 4 personas) (M effort)
- **T06** — Write golden path tests (batch 2 personas) (L effort)
- **T07** — Implement privacy validation tests (PII redaction checks) (M effort)
- **T08** — Update documentation (README, CLAUDE.md) (S effort)
- **T09** — Integration testing & bug fixes (M effort)

---

## T01: Add 5 New Personas to personas.ts

**Effort:** M (Medium, copy-paste + domain expertise)  
**Files:** `apps/desktop/src/stores/personas.ts`  
**Dependencies:** None  
**Persona Testing:** Margot (Personal Branding Coach), David (Cybersecurity Advisor), Aisha (Real Estate & Immigration)

**Description:**
Add 5 new `Persona` objects to the `DEFAULT_PERSONAS` array with full system prompts, icons, and privacy settings (following batch 1 pattern).

**Implementation Details:**

For each of the 5 personas, add a complete object to DEFAULT_PERSONAS with:
- `id`: lowercase hyphenated ID (e.g., "personal-branding-coach")
- `name`: display name
- `description`: one-line summary
- `icon`: emoji
- `systemPrompt`: 500–800 word domain-specific guidance (see DESIGN.md per-persona sections)
- `voiceId`: "en_US-lessac-medium" (consistent with batch 1)
- `preferredModelId`: "qwen3-32b-fast" (consistent with batch 1)
- `knowledgeBaseIds`: [] (empty for now, Phase 2)
- `temperature`: 0.6–0.8 per persona (see DESIGN.md)
- `maxTokens`: 4096 (all batch 2)
- `isBuiltIn`: true (all batch 2)
- `createdAt: new Date()`
- `updatedAt: new Date()`
- `preferred_backend`: 'hybrid' or 'local' (see backend table in DESIGN.md)
- `enable_local_anonymizer`: true for 'hybrid' personas, false for 'local'
- `anonymization_mode`: 'optional' or 'required' (see DESIGN.md)
- `requiresPIIVault`: true for Real Estate & Immigration; false for others

**System Prompt Writing Guidance:**

Each system prompt should:
1. **Self-identify role** ("You are a Personal Branding Coach…")
2. **List specialties** (3–5 key areas)
3. **Describe approach** (how to respond, key techniques)
4. **State disclaimers** (not professional advice, verify with licensed expert, etc.)
5. **Define failure modes** (what to decline)
6. **Include privacy note** (if applicable: "Financial data redacted before cloud", etc.)

Reference DESIGN.md sections 1–5 for exact prompt themes and disclaimers.

**Acceptance Criteria:**
1. TypeScript compiles without errors
2. App boots and all 14 personas load (4 original + 5 batch 1 + 5 batch 2)
3. Each batch 2 persona has all required fields set correctly
4. Temperature values: Personal Branding (0.75), Social Media (0.7), Real Estate (0.6), Cybersecurity (0.65), Immigration (0.65)
5. Backend defaults: Personal Branding (hybrid), Social Media (hybrid), Real Estate (hybrid), Cybersecurity (local), Immigration (hybrid)
6. Anonymization mode: Personal Branding (optional), Social Media (optional), Real Estate (required), Cybersecurity (optional), Immigration (required)
7. Icons render correctly in UI (no unicode errors)
8. System prompts are readable (no truncation, proper line breaks)
9. No duplication with batch 1 personas (different IDs, names, prompts)

---

## T02: Update localStorage Migration (v2 → v3)

**Effort:** S (Small, ~20 lines)  
**Files:** `apps/desktop/src/stores/personas.ts`  
**Dependencies:** T01  
**Persona Testing:** All (upgrade path verification)

**Description:**
Update Zustand `persist` middleware to increment version to 3 and add migration logic to merge new personas without losing existing data.

**Implementation Details:**

In the `persist` config object (lines ~300–315 of personas.ts):
1. Change `version: 2` to `version: 3`
2. Update the `migrate` function to handle v2 → v3 upgrade:
   - Read old v2 state (personas array + selectedPersonaId)
   - For each existing persona, if `isBuiltIn: true`, replace with fresh DEFAULT_PERSONAS entry (handles bug fixes from batch 1)
   - For custom personas (`isBuiltIn: false`), keep them unchanged
   - Append 5 new batch 2 personas from DEFAULT_PERSONAS
   - Return merged state with all 14 personas

**Pseudo-code:**
```typescript
migrate: (persisted: unknown) => {
  const p = persisted as Partial<{ personas: Persona[]; selectedPersonaId: string | null }>;
  
  // Get all batch 1 + batch 2 personas from DEFAULT_PERSONAS
  const newPersonas = DEFAULT_PERSONAS;
  
  // Keep custom personas from old state
  const customPersonas = (p?.personas ?? []).filter(p => !p.isBuiltIn);
  
  // Merge: all defaults + custom (remove duplicates by ID)
  const merged = [
    ...newPersonas,
    ...customPersonas.filter(c => !newPersonas.find(n => n.id === c.id))
  ];
  
  return { personas: merged, selectedPersonaId: p?.selectedPersonaId ?? null };
}
```

**Acceptance Criteria:**
1. Version set to 3 in persist config
2. Migration function reads v2 state correctly
3. Old batch 1 personas survive migration (still selectable)
4. Original 4 personas updated to latest defaults (bug fixes, etc.)
5. New 5 batch 2 personas appear on upgrade
6. Custom personas preserved (no duplication or data loss)
7. selectedPersonaId preserved (user stays on same persona after upgrade)
8. No console errors during migration
9. Test: create v2 localStorage, upgrade, verify all 14 personas present

---

## T03: Update Persona Selector UI (Grouped Dropdown for 14 Personas)

**Effort:** M (Medium, 2–3 files, UI logic)  
**Files:** `apps/desktop/src/components/personas/PersonaSelector.tsx` (or related selector components)  
**Dependencies:** T01  
**Persona Testing:** All (intuitive navigation for all users)

**Description:**
Update persona selector to display grouped categories with batch 2 personas clearly visible alongside batch 1.

**Current State (Batch 1):**
The selector likely displays personas in 2–3 groups (General, Specialist, Custom). Update to organize 14 personas clearly.

**Implementation Details:**

1. **Define grouping logic in PersonaSelector.tsx:**
   ```typescript
   const personaGroups = {
     general: personas.filter(p => ['psychologist', 'life-coach', 'career-coach'].includes(p.id)),
     specialist: personas.filter(p => 
       ['tax-navigator', 'health-coach', 'legal-advisor', 'financial-advisor', 'negotiation-coach',
        'personal-branding-coach', 'social-media-strategist', 'real-estate-advisor', 
        'cybersecurity-advisor', 'immigration-visa-advisor'].includes(p.id)
     ),
     custom: personas.filter(p => !p.isBuiltIn),
   };
   ```

2. **Render grouped dropdown UI:**
   - Use collapsible group headers (optional: collapse/expand General Advisors by default)
   - Batch 1 personas appear as "Specialist Advisors" subsection (5 personas)
   - Batch 2 personas appear as separate "Batch 2: Emerging Specialists" subsection (5 personas)
   - Or: Flat list within "Specialist Advisors" with visual separator between batch 1 & 2
   - Custom personas in separate "Custom" group

3. **Add privacy badges next to persona names:**
   - 🔐 for Cybersecurity Advisor (local-only)
   - 🛡️ for Real Estate & Immigration (anonymization required)
   - ⚠️ for Personal Branding & Social Media (optional anonymization)

4. **Ensure responsive design:**
   - Dropdown scrollable if many personas
   - Group headers bold/distinct
   - No layout breakage on mobile

**Acceptance Criteria:**
1. Dropdown renders 3 groups: General (3), Specialist (10), Custom (N)
2. All 14 built-in personas appear in correct groups
3. Batch 2 personas clearly distinguishable from batch 1 (visual separator or explicit subgroup)
4. Clicking a persona switches chat context correctly
5. Icons display correctly (emojis + privacy badges)
6. Group headers visually distinct (bold, larger, different color)
7. No layout broken; responsive design preserved
8. Dropdown opens/closes without errors
9. Selected persona highlighted visually
10. Keyboard navigation works (arrow keys, enter)

---

## T04: Add Privacy Badges & Verify Backend Overrides

**Effort:** S (Small, badge UI + verification)  
**Files:** `apps/desktop/src/components/personas/PersonaSelector.tsx`, `PersonaConfigPage.tsx`, `PersonaPrivacyTab.tsx`  
**Dependencies:** T01, T03  
**Persona Testing:** Aisha (privacy-conscious verification)

**Description:**
Ensure privacy badges render correctly for batch 2 personas and backend override functionality works.

**Implementation Details:**

1. **Privacy badges in selector** (from T03):
   - 🔐 badge for Cybersecurity Advisor (only persona with `preferred_backend: 'local'`)
   - 🛡️ badge for Real Estate & Immigration (personas with `anonymization_mode: 'required'`)
   - ⚠️ badge for Personal Branding & Social Media (personas with `anonymization_mode: 'optional'`)
   - No badge for original 4 personas (no special privacy requirements)

2. **Backend override toggle in Privacy Tab:**
   - Verify PersonaPrivacyTab.tsx renders "Backend Override" dropdown for batch 2
   - Show warning when user tries to override Cybersecurity Advisor to 'cloud' or 'hybrid'
   - Warning text: "This persona is designed for local-only inference. Cloud processing may compromise privacy benefits."
   - Allow override but require explicit confirmation

3. **Anonymization toggle behavior:**
   - For Real Estate & Immigration: "Anonymization" toggle should be pre-checked (disabled unchecking)
   - For Personal Branding & Social Media: "Anonymization" toggle optional (user choice)
   - Tooltip: "Financial/personal data will be redacted before cloud processing"

4. **Privacy badge in General Tab:**
   - Add info icon (ℹ️) next to persona name
   - Hover shows: "🔐 Local-only inference" or "🛡️ Anonymization required" or "⚠️ Hybrid mode (optional anonymization)"

**Acceptance Criteria:**
1. 🔐 badge appears for Cybersecurity Advisor only
2. 🛡️ badges appear for Real Estate & Immigration only
3. ⚠️ badges appear for Personal Branding & Social Media only
4. No badges for batch 1 or original 4 personas
5. Backend selector in Privacy tab works (dropdown shows nebius/ollama/hybrid)
6. Warning shown when overriding Cybersecurity to cloud/hybrid
7. Anonymization toggle disabled (always checked) for Real Estate & Immigration
8. Anonymization toggle optional for Personal Branding & Social Media
9. Settings persist after save
10. No console errors; UI renders cleanly

---

## T05: Write Regression Tests (Batch 1 + Original 4 Personas)

**Effort:** M (Medium, test setup + 9 test cases)  
**Files:** `apps/desktop/src/__tests__/stores/personas.test.ts`  
**Dependencies:** T01, T02  
**Persona Testing:** Automated

**Description:**
Write unit + integration tests ensuring all 9 existing personas (4 original + 5 batch 1) still work after T01/T02 changes.

**Implementation Details:**

Create/update `personas.test.ts` with the following test suites:

1. **localStorage Migration Test (v2 → v3):**
   ```typescript
   it('should migrate v2 personas to v3 without data loss', () => {
     const v2State = { personas: [...], selectedPersonaId: 'tax-navigator' };
     const migrated = personas.ts.migrate(v2State);
     expect(migrated.personas.length).toBe(14); // 4 original + 5 batch 1 + 5 batch 2
     expect(migrated.personas.find(p => p.id === 'tax-navigator')).toBeDefined();
     expect(migrated.selectedPersonaId).toBe('tax-navigator');
   });
   ```

2. **Original 4 Personas Still Load:**
   ```typescript
   ['psychologist', 'life-coach', 'career-coach', 'tax-accountant'].forEach(id => {
     it(`should load ${id} persona correctly`, () => {
       const persona = getPersonaById(id);
       expect(persona).toBeDefined();
       expect(persona.isBuiltIn).toBe(true);
       expect(persona.systemPrompt.length).toBeGreaterThan(100);
     });
   });
   ```

3. **Batch 1 Personas Still Function:**
   ```typescript
   const batch1Ids = ['tax-audit', ...]; // actual batch 1 persona IDs
   batch1Ids.forEach(id => {
     it(`should load batch 1 persona ${id}`, () => {
       const persona = getPersonaById(id);
       expect(persona.isBuiltIn).toBe(true);
       expect(persona.preferred_backend).toMatch(/nebius|ollama|hybrid/);
     });
   });
   ```

4. **Built-in Personas Cannot Be Deleted:**
   ```typescript
   it('should prevent deletion of built-in personas', () => {
     deletePersona('psychologist');
     expect(getPersonaById('psychologist')).toBeDefined();
   });
   ```

5. **Custom Personas Survive Migration:**
   ```typescript
   it('should preserve custom personas during migration', () => {
     const customPersona = { id: 'my-custom-persona', isBuiltIn: false, ... };
     const v2State = { personas: [...DEFAULT_PERSONAS, customPersona], ... };
     const migrated = personas.ts.migrate(v2State);
     expect(migrated.personas.find(p => p.id === 'my-custom-persona')).toBeDefined();
   });
   ```

6. **Persona Selection Still Works:**
   ```typescript
   it('should switch selected persona', () => {
     selectPersona('health-coach');
     expect(getSelectedPersona().id).toBe('health-coach');
   });
   ```

**Acceptance Criteria:**
1. Test file created with regression suite
2. All 9 existing personas (4 original + 5 batch 1) pass unit tests
3. `isBuiltIn: true` prevents deletion
4. Personas can be selected without errors
5. Migration test verifies old personas survive v2 → v3
6. Test coverage > 80% for personas.ts (existing personas)
7. All regression tests pass in CI

---

## T06: Write Golden Path Tests (Batch 2 Personas)

**Effort:** L (Large, 5 detailed scenarios + manual + LLM verification)  
**Files:** `apps/desktop/src/__tests__/stores/personas.test.ts`, test fixtures, manual test checklist  
**Dependencies:** T01, T05  
**Persona Testing:** Margot, David, Aisha (real users test manually)

**Description:**
Unit + semi-automated + manual tests for each batch 2 persona. Verify domain-appropriate responses, tone, style, and failure modes.

**Implementation Details:**

1. **Unit Tests for Batch 2 Persona Definitions:**
   ```typescript
   const batch2Ids = ['personal-branding-coach', 'social-media-strategist', 'real-estate-advisor', 'cybersecurity-advisor', 'immigration-visa-advisor'];
   
   batch2Ids.forEach(id => {
     it(`should have complete definition for ${id}`, () => {
       const persona = getPersonaById(id);
       expect(persona).toBeDefined();
       expect(persona.isBuiltIn).toBe(true);
       expect(persona.systemPrompt.length).toBeGreaterThan(400);
       expect(persona.temperature).toBeGreaterThanOrEqual(0.6);
       expect(persona.temperature).toBeLessThanOrEqual(0.8);
       expect(persona.maxTokens).toBe(4096);
       expect(persona.preferred_backend).toMatch(/nebius|ollama|hybrid/);
     });
   });
   ```

2. **Semi-Automated Golden Path Tests (using LLM checks):**
   
   For each batch 2 persona, create a test fixture with:
   - User message (domain-specific prompt)
   - Expected keywords/themes in response
   - Keywords to avoid (generic responses, off-topic)
   
   ```typescript
   const goldenPaths = {
     'personal-branding-coach': {
       prompt: 'Help me craft my LinkedIn summary as a data engineer transitioning to PM',
       shouldContain: ['narrative', 'leadership', 'transition', 'value proposition'],
       shouldNotContain: ['I cannot help', 'generic resume'],
     },
     // ... 4 more
   };
   ```

3. **Manual Test Checklist:**
   
   For each batch 2 persona, manually test in the app:
   
   **Personal Branding Coach:**
   - [ ] Send: "Help me craft my LinkedIn summary as a data engineer transitioning to PM"
   - [ ] Verify: Response includes career narrative, leadership strategy, unique value prop
   - [ ] Verify: Tone is encouraging but professional (not generic CV tips)
   - [ ] Verify: Mentions authenticity and audience alignment
   - [ ] Verify: No PII redaction visible in chat (brand examples show as user provided)
   
   **Social Media Strategist:**
   - [ ] Send: "I'm starting a tech blog. What should my content calendar look like?"
   - [ ] Verify: Response distinguishes blogging strategy from TikTok/Twitter
   - [ ] Verify: Suggests content pillars, posting frequency, platform choice
   - [ ] Verify: Tone is analytical but creative
   - [ ] Verify: No PII redaction visible (content examples shown as-is)
   
   **Real Estate Advisor:**
   - [ ] Send: "I'm looking at a $500k condo with $2k HOA. Is it a good investment?"
   - [ ] Verify: Response explains needed context (mortgage rate, local market, tax situation)
   - [ ] Verify: Uses placeholders instead of specific recommendations
   - [ ] Verify: Includes disclaimer: "Not investment advice"
   - [ ] Verify: PII redaction active (cloud message shows `[PROPERTY_VALUE]` etc.)
   - [ ] Verify: User chat history shows original message (rehydration works)
   
   **Cybersecurity Advisor:**
   - [ ] Send: "My email was in a data breach. What should I do?"
   - [ ] Verify: Step-by-step response (check breach, change password, 2FA, monitor)
   - [ ] Verify: Tone is calm, educational (not alarming)
   - [ ] Verify: Suggests specific tools/platforms where appropriate
   - [ ] Verify: Backend is local-only (no cloud call)
   
   **Immigration/Visa Advisor:**
   - [ ] Send: "I'm a software engineer in Germany on a work visa. Can I move to the Netherlands?"
   - [ ] Verify: Response explains visa categories (D visa, recognition, sponsorship)
   - [ ] Verify: Mentions timeline and documents needed
   - [ ] Verify: Includes disclaimer: "Not legal advice; consult immigration attorney"
   - [ ] Verify: PII redaction active (passport/visa dates redacted in cloud message)
   - [ ] Verify: User sees original message in chat history

**Acceptance Criteria:**
1. All 5 batch 2 personas pass unit tests (definitions correct)
2. Golden path responses are domain-appropriate (not generic)
3. Responses match tone from DESIGN.md specification
4. Real Estate & Immigration use placeholders instead of specific amounts
5. "Not advice" disclaimers present and appropriate
6. Cybersecurity routes to local backend (no cloud call)
7. Real Estate & Immigration show PII redaction in network audit
8. User sees original (rehydrated) messages in chat history
9. Manual test checklist signed off by Margot, David, Aisha
10. No console errors during conversation

---

## T07: Implement Privacy Validation Tests (PII Redaction)

**Effort:** M (Medium, monitoring + manual PII tests)  
**Files:** Test fixtures, logging/monitoring code (optional Rust backend extensions)  
**Dependencies:** T01–T04, T06  
**Persona Testing:** Margot, David, Aisha (real app usage)

**Description:**
Test privacy pipeline: verify that PII in hybrid personas is redacted before cloud send, and users see original (non-redacted) messages.

**Implementation Details:**

1. **Monitor Network Calls (Browser DevTools):**
   
   For Real Estate Advisor:
   - Enable Network Audit in Settings (built in batch 1 T14)
   - Send: "I'm buying a $550,000 house at 5.5% interest with $110,000 salary"
   - Verify: Network Audit log shows request URL + body (if available)
   - Check: Cloud message contains `[PROPERTY_VALUE]`, `[MORTGAGE_RATE]`, `[ANNUAL_INCOME]` (not original amounts)
   - Verify: User's chat history shows original message (rehydrated)
   
   For Immigration/Visa Advisor:
   - Send: "My passport is US12345678, visa expires 2027-06-15"
   - Verify: Cloud message shows `[PASSPORT]`, `[VISA_DATE]` (not original values)
   - Verify: Chat history shows original passport/date
   
   For Cybersecurity Advisor:
   - Send: "My password is MySecretP@ss123"
   - Verify: No cloud call made (local-only mode)
   - Verify: App handles sensitive input without sending to cloud

2. **Automated Privacy Validation (Optional Rust Helper):**
   
   If infrastructure supports, add Rust logging to log all cloud-bound messages before send:
   - Log timestamp, persona ID, anonymized message
   - Verify: No raw PII in logs (no unredacted SSN, passport, amounts)
   - Report: Redaction success rate (X% of PII entities redacted)

3. **Manual Privacy Checklist:**
   
   For each PII-sensitive persona, test:
   ```
   [ ] Real Estate Advisor:
       [ ] Financial amounts redacted
       [ ] Property addresses redacted
       [ ] Mortgage rates redacted
       [ ] Income brackets redacted
       [ ] User sees original in chat history
   
   [ ] Immigration/Visa Advisor:
       [ ] Passport numbers redacted
       [ ] Visa dates redacted
       [ ] Country of residence redacted
       [ ] User sees original in chat history
   
   [ ] Cybersecurity Advisor:
       [ ] No cloud calls made
       [ ] Responses fully local
       [ ] No PII sent anywhere
   ```

**Acceptance Criteria:**
1. GLiNER redaction active for Real Estate, Immigration, and all hybrid personas
2. Cloud-bound messages contain no raw PII (verified via Network Audit)
3. User sees rehydrated (original) message in chat history (not redacted)
4. Manual checklist all pass (3 PII-sensitive personas × 3 test cases)
5. No PII leakage detected in network logs
6. Anonymization mode `required` enforced for Real Estate & Immigration
7. Anonymization mode `optional` respected for Personal Branding & Social Media
8. Cybersecurity Advisor never sends to cloud (local-only enforced)

---

## T08: Update Documentation (README & CLAUDE.md)

**Effort:** S (Small, 2–3 files, ~500 words)  
**Files:** `README.md`, `CLAUDE.md`, `apps/desktop/README.md`  
**Dependencies:** T01, T03  
**Persona Testing:** None (documentation clarity)

**Description:**
Update project documentation to reflect batch 2 completion and the full 14-persona "Sovereign Council" vision.

**Implementation Details:**

1. **README.md** — Add "14 Specialist Advisors" Section:
   
   ```markdown
   ## 14 Specialist Advisors (Sovereign Council)
   
   AILocalMind comes with 14 pre-configured personas covering life, work, and security:
   
   ### General Advisors (3)
   - 🧠 **Psychologist** — Cognitive behavioral therapy & emotional regulation
   - 🎯 **Life Coach** — Goal-setting, habits, and personal development
   - 💼 **Career Coach** — Professional development, interviews, leadership
   
   ### Specialist Advisors (10)
   
   **Batch 1 (Privacy-First):**
   - 🧾 **Tax Navigator** — Dutch tax guidance (local-only, anonymized)
   - 🏥 **Health Coach** — Nutrition & wellness (local-only)
   - ⚖️ **Legal Advisor** — Contract & dispute guidance (anonymized)
   - 💰 **Financial Advisor** — Investment & budgeting (anonymized)
   - 🤝 **Negotiation Coach** — Salary & deal negotiation
   
   **Batch 2 (Complete Vision):**
   - 🎨 **Personal Branding Coach** — LinkedIn strategy & thought leadership
   - 📱 **Social Media Strategist** — Content calendars & platform optimization
   - 🏠 **Real Estate Advisor** — Property valuation & investment analysis (anonymized)
   - 🔐 **Cybersecurity Advisor** — Privacy & threat response (local-only)
   - 🌍 **Immigration/Visa Advisor** — Visa pathways & relocation (anonymized)
   
   Each persona is privacy-first: personal data stays local, cloud-bound messages are anonymized.
   ```

2. **CLAUDE.md** — Add Batch 2 Section:
   
   ```markdown
   ## Batch 2 Personas (Emerging Specialists)
   
   **Shipped:** 2026-06-23
   
   Completes the "Sovereign Council" with 5 complementary specialists:
   
   - Personal Branding Coach (hybrid, optional anonymization)
   - Social Media Strategist (hybrid, optional anonymization)
   - Real Estate Advisor (hybrid, required anonymization + PII vault)
   - Cybersecurity Advisor (local-only, max privacy)
   - Immigration/Visa Advisor (hybrid, required anonymization + PII vault)
   
   All personas follow batch 1 architecture:
   - Zustand store (personas.ts)
   - localStorage v3 migration
   - Grouped UI selector
   - Privacy badges & backend overrides
   - GLiNER anonymization (hybrid personas)
   - Prompt Review Modal (batch 1 T11 infrastructure)
   
   **Phase 2 Enhancements:**
   - Custom GLiNER redaction rules (domain-specific PII entities)
   - Knowledge base integration (domain sources for each persona)
   ```

3. **apps/desktop/README.md** — Backend Defaults:
   
   ```markdown
   ### Persona Backend Configuration
   
   | Persona | Backend | Anonymization | PII Vault |
   |---------|---------|---------------|-----------|
   | Personal Branding Coach | hybrid | optional | no |
   | Social Media Strategist | hybrid | optional | no |
   | Real Estate Advisor | hybrid | **required** | **yes** |
   | Cybersecurity Advisor | **local** | optional | no |
   | Immigration/Visa Advisor | hybrid | **required** | **yes** |
   
   **Note:** Cybersecurity Advisor is the only batch 2 persona with local-only inference.
   Override at your own risk (reduces privacy benefits).
   ```

**Acceptance Criteria:**
1. README lists all 14 personas with icons and one-line descriptions
2. Personas grouped (General Advisors + Specialist Advisors Batch 1 & 2 + Custom)
3. Privacy-first language used consistently ("anonymized", "local-only", "PII vault")
4. CLAUDE.md updated with batch 2 details and architecture notes
5. Backend defaults table clear and accurate
6. No broken links or markdown formatting errors
7. All file changes validated (no typos, emoji render correctly)

---

## T09: Integration Testing & Bug Fixes

**Effort:** M (Medium, end-to-end + fixes)  
**Files:** All (integration test coverage)  
**Dependencies:** T01–T08  
**Persona Testing:** All (Margot, David, Aisha in real app)

**Description:**
End-to-end testing and bug fixes. Verify the full app workflow with all 14 personas, including persona switching, settings persistence, and privacy pipeline.

**Implementation Details:**

1. **App Boot & Persona Loading:**
   - [ ] App starts without errors
   - [ ] All 14 personas load in store
   - [ ] PersonaSelector renders all 14 (3 groups)
   - [ ] No console errors/warnings

2. **Persona Switching:**
   - [ ] Select original 4 personas → chat context switches correctly
   - [ ] Select batch 1 personas → responses are domain-appropriate
   - [ ] Select batch 2 personas → responses are domain-appropriate
   - [ ] Can switch mid-conversation without errors
   - [ ] Conversation history preserved after switch (via projectId)

3. **Settings Persistence:**
   - [ ] Select a persona → customize backend/temperature/etc.
   - [ ] Close app
   - [ ] Reopen app → selected persona and settings persist
   - [ ] Verify localStorage v3 migration runs once

4. **Privacy Pipeline End-to-End:**
   - [ ] Real Estate Advisor + PII → Prompt Review Modal appears
   - [ ] User approves → message redacted before cloud → rehydrated in history
   - [ ] User denies → message routes to local inference
   - [ ] Cybersecurity Advisor → No Prompt Review Modal (always local)
   - [ ] Network Audit log shows redacted message (no raw PII)

5. **UI/UX:**
   - [ ] Grouped dropdown renders cleanly (3 groups visible)
   - [ ] Privacy badges display (🔐, 🛡️, ⚠️)
   - [ ] PersonaConfigPage opens without errors
   - [ ] Privacy Tab shows backend override + warning for Cybersecurity
   - [ ] General Tab shows privacy badge

6. **Regression Testing:**
   - [ ] Batch 1 personas still work (no regressions)
   - [ ] Original 4 personas still work (no regressions)
   - [ ] Custom personas still functional
   - [ ] Knowledge bases still work (if integrated)

7. **Bug Fixes:**
   - Fix any issues found during integration testing
   - Document and track in GitHub issues

**Acceptance Criteria:**
1. App boots without errors; all 14 personas loaded
2. Full chat flow works (select → send → response) for all personas
3. Persona switching works mid-conversation
4. Settings persist after close/reopen
5. Privacy pipeline end-to-end success (redaction + rehydration)
6. Grouped dropdown displays correctly (3 groups, 14 personas)
7. Privacy badges display correctly (🔐, 🛡️, ⚠️)
8. Regression tests pass (batch 1 + original personas still work)
9. localStorage migration (v2 → v3) succeeds
10. No console errors/warnings
11. Network Audit logs show redacted messages (no raw PII)
12. Performance acceptable (app responsive, no lag)
13. All 3 personas (Margot, David, Aisha) sign off on real app testing

---

## Task Dependency Graph

```
T01 (Add 5 personas to personas.ts)
  ↓
T02 (localStorage v2 → v3 migration)
  ↓
T03 (Persona selector UI for 14 personas)
  ↓
T04 (Privacy badges & backend override UI)
  ↓
T05 (Regression tests for batch 1 + original 4)
  ↓
T06 (Golden path tests for batch 2)
  ↓
T07 (Privacy validation tests)
  ↓
T08 (Documentation updates)
  ↓
T09 (Integration testing & bug fixes)
```

**Critical Path:** T01 → T02 → T03 → T05 → T06 → T07 → T09

---

## Recommended Task Sequencing

### Wave 1: Core Persona Definitions (Day 1)
- **T01** (Add 5 personas): 1 day
  - Write system prompts for all 5 personas
  - Add to DEFAULT_PERSONAS array
  - Verify TypeScript compilation

### Wave 2: Store & Migration (Day 2)
- **T02** (localStorage v3 migration): 0.5 day
  - Implement migrate function
  - Test with mock v2 state
  
- **T03** (UI selector grouping): 1 day
  - Update PersonaSelector logic
  - Test grouping renders correctly

### Wave 3: UI & Privacy (Day 3)
- **T04** (Privacy badges & overrides): 0.5 day
  - Add badge rendering
  - Verify backend override UI

- **T08** (Documentation updates): 0.5 day
  - Update README, CLAUDE.md
  - Verify links and formatting

### Wave 4: Testing (Days 4–6)
- **T05** (Regression tests): 1 day
  - Set up test file
  - Write 9 regression test cases
  - Run tests

- **T06** (Golden path tests): 1.5 days
  - Write semi-automated tests
  - Manual golden path scenarios (Margot, David, Aisha)

- **T07** (Privacy validation): 0.5 day
  - Monitor network calls
  - Verify PII redaction
  - Manual privacy checklist

### Wave 5: Integration & Release (Day 7)
- **T09** (Integration testing & bugs): 1 day
  - End-to-end app flow
  - Fix any issues
  - Final regression

---

## Parallelization Opportunities

**Can run in parallel (no dependencies):**
- T08 (Documentation) can start during T01 (persona writing)

**Can overlap:**
- T03 (UI grouping) while T01 completes (start after personas.ts compiles)
- T05 (Regression tests) while T02/T03 complete
- T06 (Golden path) while T05 runs

**Recommended Parallel Execution:**
1. **Wave 1 only:** T01 (serial, ~1 day)
2. **Wave 2:** T02, T03 in parallel after T01 (~1 day)
3. **Wave 3:** T04, T08 in parallel (~0.5 day)
4. **Wave 4:** T05, T06, T07 mostly serial with some overlap (~2 days)
5. **Wave 5:** T09 (~1 day)

**Total Estimate:** ~5–6 days with parallelization (vs. ~9 days serial)

---

## Success Metrics

By end of all tasks:
- ✅ All 5 batch 2 personas loaded and selectable
- ✅ All 14 personas functional (no regressions)
- ✅ Privacy pipeline verified (PII redaction working)
- ✅ localStorage v2→v3 migration smooth
- ✅ UI updated (grouped selector, badges)
- ✅ Documentation complete
- ✅ Margot, David, Aisha tested in real app
- ✅ Zero console errors
- ✅ Performance acceptable
