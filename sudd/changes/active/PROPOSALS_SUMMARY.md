# SUDD Proposals Summary — Generated 2026-06-23

**Source:** Alignment report gaps → Actionable proposals  
**Scope:** Priority 1 & 2 gaps (Priority 3 skipped per guidance)  
**Total proposals:** 9  

---

## Quick Reference Table

| ID | Title | Size | Persona | Priority | Gap | Status |
|:---|:------|:----:|:-------:|:--------:|:----:|:------:|
| green_add-personas-batch1_01 | Add first 5 specialist personas | **L** | All | **1** | GAP001 | 📋 |
| green_add-personas-batch2_02 | Add remaining 5 specialist personas | **L** | All | **1** | GAP001 | 📋 |
| green_telemetry-off-mode_03 | Telemetry-off mode & privacy guarantee | **S** | David | **1** | GAP002+007 | 📋 |
| green_incognito-mode_04 | Implement Incognito Mode | **M** | Margot | **2** | GAP003 | 📋 |
| green_pii-vault-ui_05 | Build PII Vault UI | **M** | Margot | **2** | GAP004 | 📋 |
| green_team-collaboration-basic_06 | Multi-user & shared chats | **L** | Aisha | **2** | GAP005 (part 1) | 📋 |
| green_team-collaboration-audit_07 | Audit trail, export, key control | **L** | Aisha | **2** | GAP005 (part 2) | 📋 |
| green_always-review-mode_08 | Global "Always Review" toggle | **M** | David | **2** | GAP006 | 📋 |
| green_frontend-e2e-tests_09 | Frontend E2E test suite | **L** | All | **2** | GAP011 | 📋 |

**Legend:** 📋 = Proposal phase (awaiting planning)

---

## Effort Summary

| Size | Count | Weeks | Total |
|------|-------|-------|-------|
| **S** (small) | 1 | 0.5 | **0.5 weeks** |
| **M** (medium) | 3 | 1 week each | **3 weeks** |
| **L** (large) | 5 | 3–4 weeks each | **17–20 weeks** |
| **TOTAL** | 9 | — | **20.5–23.5 weeks** |

**Strategic sequencing:**
- **Immediate (Weeks 1–2):** green_telemetry-off-mode_03 (S) — removes David's deal-breaker
- **Quick wins (Weeks 3–5):** green_incognito-mode_04 (M), green_pii-vault-ui_05 (M) — unlock Margot's use case
- **Parallel tracks:**
  - **Track 1 (Weeks 6–10):** green_add-personas-batch1_01 (L) — credibility
  - **Track 2 (Weeks 6–10):** green_frontend-e2e-tests_09 (L) — testing infrastructure
  - **Track 3 (Weeks 6–10):** green_team-collaboration-basic_06 (L) — unlock Aisha's basic use case
- **Follow-ups (Weeks 11+):** green_add-personas-batch2_02 (L), green_team-collaboration-audit_07 (L), green_always-review-mode_08 (M)

---

## Proposals by Persona

### Margot (Freelance Tax Advisor)

| Proposal | Purpose | Priority |
|----------|---------|----------|
| green_add-personas-batch1_01 | Tax Navigator persona | 1 |
| green_incognito-mode_04 | Private contract reviews | 2 |
| green_pii-vault-ui_05 | Store client names, auto-redact | 2 |
| green_telemetry-off-mode_03 | Verify no data collection | 1 |
| green_frontend-e2e-tests_09 | Confidence in privacy features | 2 |

**Margot's path to success:**
1. Telemetry-off mode (eliminates distrust)
2. Incognito Mode + Vault UI (enables contract review workflow)
3. Tax Navigator persona (domain expertise)
4. E2E tests (confidence in reliability)

---

### David (Privacy Retiree)

| Proposal | Purpose | Priority |
|----------|---------|----------|
| green_telemetry-off-mode_03 | Explicit no-telemetry guarantee | 1 |
| green_always-review-mode_08 | Always see what's sent | 2 |
| green_pii-vault-ui_05 | Audit redacted terms | 2 |
| green_add-personas-batch1_01 | Health Coach persona | 1 |
| green_frontend-e2e-tests_09 | Prevent privacy regressions | 2 |

**David's path to success:**
1. Telemetry-off mode (deal-breaker removal)
2. Always Review mode (enforced transparency)
3. Health Coach persona + Vault UI (health management workflow)
4. E2E tests (assurance against silent regressions)

---

### Aisha (Startup Founder)

| Proposal | Purpose | Priority |
|----------|---------|----------|
| green_add-personas-batch1_01 | Legal Advisor, Negotiation Coach personas | 1 |
| green_team-collaboration-basic_06 | Share chats with co-founder | 2 |
| green_team-collaboration-audit_07 | Export, audit trail, key control | 2 |
| green_always-review-mode_08 | Enforce transparency on all sends | 2 |
| green_frontend-e2e-tests_09 | Confidence in security | 2 |

**Aisha's path to success:**
1. Team collaboration basic (multi-user, shared chats)
2. Team collaboration audit (export, key control — data ownership)
3. Always Review mode (transparency for legal review)
4. Legal Advisor persona (domain expertise)
5. E2E tests (security confidence for enterprise use)

---

## Dependency Graph

```
green_add-personas-batch1_01
  └─ (no dependencies)

green_add-personas-batch2_02
  └─ depends on: green_add-personas-batch1_01

green_telemetry-off-mode_03
  └─ (no dependencies)

green_incognito-mode_04
  └─ (no dependencies)
     unblocks: green_pii-vault-ui_05 (Margot uses both together)

green_pii-vault-ui_05
  └─ (no dependencies)

green_team-collaboration-basic_06
  └─ (no dependencies)
     unblocks: green_team-collaboration-audit_07

green_team-collaboration-audit_07
  └─ depends on: green_team-collaboration-basic_06

green_always-review-mode_08
  └─ (no dependencies)
     builds on: existing PromptReviewPanel

green_frontend-e2e-tests_09
  └─ depends on: green_incognito-mode_04, green_pii-vault-ui_05, green_always-review-mode_08
     (these features must exist to test)
```

---

## Priority 1 Gaps (Critical)

### GAP001: Missing 10 of 14 Personas
- **Proposals:** green_add-personas-batch1_01, green_add-personas-batch2_02
- **Combined effort:** L + L = 4–6 weeks
- **Credibility impact:** Highest — users expect "14 specialist advisors," find 4
- **Per-persona impact:**
  - Margot: Tax Navigator needed for VAT/deduction expertise
  - David: Health Coach needed for nutrition/medication guidance
  - Aisha: Legal Advisor + Negotiation Coach needed for startup legal/contracts

### GAP002: No Explicit "No Telemetry" Mode
- **Proposal:** green_telemetry-off-mode_03
- **Effort:** S = 0.5 weeks
- **Deal-breaker for:** David (will uninstall if any telemetry detected)
- **Action:** Ship FIRST (removes deal-breaker before others)

---

## Priority 2 Gaps (Important)

### GAP003: Incognito Mode Not Fully Implemented
- **Proposal:** green_incognito-mode_04
- **Effort:** M = 1 week
- **Unlocks:** Margot's contract review workflow
- **Pairs with:** green_pii-vault-ui_05 (Vault + Incognito together)

### GAP004: PII Vault UI Missing
- **Proposal:** green_pii-vault-ui_05
- **Effort:** M = 1 week
- **Unlocks:** Margot and David can manage redacted terms
- **Pairs with:** green_incognito-mode_04

### GAP005: Team Collaboration Missing (2 proposals)
- **Proposal 1 (basic):** green_team-collaboration-basic_06 (L = 3–4 weeks)
- **Proposal 2 (audit):** green_team-collaboration-audit_07 (L = 3–4 weeks)
- **Deal-breaker for:** Aisha (will reject if no team access)
- **Sequencing:** Ship basic first, audit/export as follow-up

### GAP006: Prompt Transparency Not Guaranteed Globally
- **Proposal:** green_always-review-mode_08
- **Effort:** M = 1 week
- **Deal-breaker for:** David (needs 100% visibility on what's sent)
- **Pairs with:** green_telemetry-off-mode_03 (complete transparency picture)

### GAP011: Frontend Testing Absent
- **Proposal:** green_frontend-e2e-tests_09
- **Effort:** L = 3–4 weeks
- **Risk:** Privacy features can regress silently
- **Tests:** Chat→Redaction→Review→Approval, Vault, Incognito, Always Review, Prompt Transparency

---

## Gaps Skipped (Priority 3)

### GAP008: Dutch Tax Knowledge Base Is Skeletal
- **Reason:** Lower ROI than persona creation; can leverage existing local RAG pipeline
- **Future:** Incorporate into green_add-personas-batch1_01 (Tax Navigator) as a follow-up

### GAP009: Custom Redaction Rules Not Exposed
- **Reason:** Nice-to-have for Aisha; she can achieve similar control via team collaboration + audit
- **Future:** Post-v1 enhancement for technical users

### GAP010: Form Fill Feature Not Marketed
- **Reason:** Marketing gap, not code gap; simple README update (1–2 days)
- **Action:** Update README to include Form Fill in features table

### GAP012: No Network Verification Feature
- **Reason:** David can use external tools (tcpdump); lower priority than telemetry-off + always-review
- **Future:** Post-v1 enhancement if David provides more feedback

---

## Success Criteria by Persona

### Margot (3-month horizon)
- [ ] Stops manually copying questions into plain-text files before asking Sovereign AI
- [ ] Switches from "I can't ask the cloud about this" to "I can ask the Tax Advisor"
- [ ] Uses Incognito Mode for contract reviews (zero discomfort)
- [ ] Uses PII Vault to store client/partner names
- [ ] Completes tax season using Sovereign AI as trusted advisor

### David (1-month horizon)
- [ ] Stops using ChatGPT for health questions entirely
- [ ] Shows wife the app's privacy features; they both agree "this is what we should have been using"
- [ ] Runs privacy audit (network monitoring) and confirms zero unexpected outbound calls
- [ ] Recommends app to 2 friends in chess club or cycling group

### Aisha (2–3 month horizon)
- [ ] Moves 100% of sensitive contract/legal questions from ChatGPT to Sovereign AI
- [ ] Pitches Sovereign AI to co-founder; they adopt it as official legal/financial advisor
- [ ] Exports full encrypted backup and presents to lawyer as "confidential work product"
- [ ] Evaluates self-hosting backend (if open-source) or enterprise tier for scaling

---

## Proposal Directory Structure

Each proposal directory contains:
- **proposal.md** — Full proposal with Why, Current State, Desired State, Acceptance Criteria, Alignment Gap, Effort Justification
- **specs.md** — (Empty, to be filled during planning phase)
- **design.md** — (Empty, to be filled during design phase)
- **tasks.md** — (Empty, to be filled during task breakdown)
- **log.md** — Discovery metadata and progress notes

---

## Next Steps

### For Task Planning (Week 1)
1. Review all 9 proposals for clarity and feasibility
2. Identify cross-cutting concerns (e.g., E2E tests depend on features existing)
3. Prioritize sequencing: Telemetry-off (S) → Quick wins (M×2) → Parallel L tracks
4. Assign to teams/individuals with expertise:
   - **Personas:** Domain research (tax, health, law)
   - **Telemetry:** Backend audit (network calls)
   - **Incognito + Vault:** React/Zustand (frontend state)
   - **Team collab:** Database schema + permissions model
   - **Always Review:** Prompt send refactoring (high-risk)
   - **E2E Tests:** Playwright + privacy workflow knowledge

### For Implementation (Weeks 2–25)
1. Execute proposals in sequenced order (see "Effort Summary" above)
2. Track progress in SUDD logs
3. Verify acceptance criteria before marking complete
4. Update README + vision.md as features ship

### For Quality Gates
1. **All proposals require:**
   - Code review by 2+ reviewers
   - E2E test coverage (once E2E infrastructure ships)
   - Persona acceptance testing (Margot, David, Aisha actual usage or recorded feedback)
2. **Privacy-critical proposals (telemetry, redaction, encryption, audit) require:**
   - Security review (cryptography, access control, audit trail immutability)
   - External audit optional (if targeting enterprises like Aisha)

---

## Metrics & Validation

Post-implementation, measure success:

### Margot
- Track: Does she continue using the app daily during tax season?
- Metric: "Zero business files uploaded to cloud during tax filing" (observes via network monitoring)
- Signal: Recommends to 1–2 other freelancers

### David
- Track: Does he uninstall? (deal-breaker risk)
- Metric: Privacy audit shows zero unexpected outbound calls
- Signal: Recommends to 2+ friends in age-group cohort

### Aisha
- Track: Does she adopt as official advisor?
- Metric: Team uses Sovereign AI for 100% of legal/financial questions
- Signal: Pitches to investors/partners; evaluates long-term adoption (self-hosting, enterprise)

---

## Risk Assessment

| Proposal | Risk | Mitigation |
|----------|------|-----------|
| Personas | Domain expertise gaps (tax, health, law) | Hire subject-matter experts; test with real users |
| Telemetry-off | Undiscovered telemetry in codebase | Audit all HTTP/IPC calls before ship |
| Incognito | Data leaks via IndexedDB persistence | E2E test: close app, reopen, verify chat gone |
| Vault | Encryption key management | Use existing ChaCha20-Poly1305 library; security review |
| Team collab | Permission model bugs | Fuzz testing: grant/revoke access, verify isolation |
| Audit trail | Tamper-proof logging | Sign logs with HMAC; immutable store |
| Always Review | User frustration if too much friction | Test approval latency; optimize UX |
| E2E Tests | Flaky Playwright tests | Parallel runs, screenshot/video on failure, clear logs |

---

## Document Metadata

- **Generated:** 2026-06-23
- **By:** Task-discoverer agent
- **Source:** Alignment report (2026-06-23, SHA: d7f4a8c1d641...)
- **Personas:** Margot, David, Aisha (per sudd/personas/)
- **Codebase:** Tauri 2 + React 19 + Rust
- **Stack:** Desktop app, local-first, privacy-by-default

For questions, see individual proposal.md files in `sudd/changes/active/`.
