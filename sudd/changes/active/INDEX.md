# Proposal Index — SUDD Changes (Active)

**Discovery date:** 2026-06-23  
**Total proposals:** 9  
**Status:** All in proposal phase (awaiting planning)

## Proposals at a Glance

### Priority 1 (Deal-Breakers)

1. **green_add-personas-batch1_01** — Add first 5 specialist personas (Tax Navigator, Health Coach, Legal Advisor, Financial Advisor, Negotiation Coach)
   - Size: L | Serves: All | Gap: GAP001
   - Why: README claims "14 specialist advisors" but only 4 ship; credibility gap
   - [Read proposal](green_add-personas-batch1_01/proposal.md)

2. **green_add-personas-batch2_02** — Add remaining 5 specialist personas
   - Size: L | Serves: All | Gap: GAP001
   - Why: Complete the "Sovereign Council" promise
   - [Read proposal](green_add-personas-batch2_02/proposal.md)
   - Depends on: green_add-personas-batch1_01

3. **green_telemetry-off-mode_03** — Implement telemetry-off mode with Settings panel
   - Size: S | Serves: David (primary), Margot (secondary) | Gap: GAP002 + GAP007
   - Why: David's deal-breaker: "If the app collects any analytics, he'll uninstall immediately"
   - [Read proposal](green_telemetry-off-mode_03/proposal.md)
   - **SHIP FIRST** (removes deal-breaker)

### Priority 2 (Important Features)

4. **green_incognito-mode_04** — Implement Incognito Mode (memory-only chats)
   - Size: M | Serves: Margot | Gap: GAP003
   - Why: README advertises feature; Margot needs for contract reviews
   - [Read proposal](green_incognito-mode_04/proposal.md)

5. **green_pii-vault-ui_05** — Build PII Vault UI (browse, manage, export entries)
   - Size: M | Serves: Margot, David | Gap: GAP004
   - Why: Backend store exists; frontend is missing; users cannot manage vault
   - [Read proposal](green_pii-vault-ui_05/proposal.md)

6. **green_team-collaboration-basic_06** — Multi-user access and shared chats
   - Size: L | Serves: Aisha | Gap: GAP005 (part 1)
   - Why: Aisha's deal-breaker: needs to share chats with co-founder for legal review
   - [Read proposal](green_team-collaboration-basic_06/proposal.md)

7. **green_team-collaboration-audit_07** — Audit trail, export/import, encryption key control
   - Size: L | Serves: Aisha | Gap: GAP005 (part 2)
   - Why: Aisha needs data ownership: export, audit, company-controlled keys
   - [Read proposal](green_team-collaboration-audit_07/proposal.md)
   - Depends on: green_team-collaboration-basic_06

8. **green_always-review-mode_08** — Global "Always Review Before Send" toggle
   - Size: M | Serves: David (primary), Aisha (secondary) | Gap: GAP006
   - Why: David needs blanket guarantee that 100% of cloud sends are reviewed
   - [Read proposal](green_always-review-mode_08/proposal.md)

9. **green_frontend-e2e-tests_09** — Frontend E2E test suite for privacy workflows
   - Size: L | Serves: All | Gap: GAP011
   - Why: Zero frontend tests; privacy-critical components have no regression detection
   - [Read proposal](green_frontend-e2e-tests_09/proposal.md)
   - Depends on: green_incognito-mode_04, green_pii-vault-ui_05, green_always-review-mode_08

## Effort Estimate

| Size | Count | Effort |
|------|-------|--------|
| S | 1 | 0.5 weeks |
| M | 3 | 3 weeks |
| L | 5 | 17–20 weeks |
| **TOTAL** | 9 | **20.5–23.5 weeks** |

## Proposed Execution Order

### Phase 1: Deal-Breaker Removal (Weeks 1–2)
- [ ] green_telemetry-off-mode_03 (S)

### Phase 2: Quick Wins (Weeks 3–5)
- [ ] green_incognito-mode_04 (M)
- [ ] green_pii-vault-ui_05 (M)
- [ ] green_always-review-mode_08 (M) — can start parallel with Phase 1 if resources allow

### Phase 3: Parallel Large Work (Weeks 6–10)
- [ ] green_add-personas-batch1_01 (L) — **Track 1: Domain expertise**
- [ ] green_frontend-e2e-tests_09 (L) — **Track 2: Testing infra** (starts after Phase 2 features exist)
- [ ] green_team-collaboration-basic_06 (L) — **Track 3: Aisha's core use case**

### Phase 4: Follow-Ups (Weeks 11+)
- [ ] green_add-personas-batch2_02 (L) — depends on batch 1
- [ ] green_team-collaboration-audit_07 (L) — depends on basic collab

## Gaps Addressed

| Gap ID | Title | Proposals |
|--------|-------|-----------|
| GAP001 | Missing 10 of 14 Personas | batch1_01, batch2_02 |
| GAP002 | No Explicit "No Telemetry" Mode | telemetry-off-mode_03 |
| GAP003 | Incognito Mode Not Fully Implemented | incognito-mode_04 |
| GAP004 | PII Vault UI Missing | pii-vault-ui_05 |
| GAP005 | Team Collaboration & Export Features | team-collaboration-basic_06, team-collaboration-audit_07 |
| GAP006 | Prompt Transparency Not Guaranteed | always-review-mode_08 |
| GAP011 | Frontend Testing Absent | frontend-e2e-tests_09 |

## How to Read a Proposal

Each proposal directory contains:

- **proposal.md** — The main document (read this first)
  - Why the gap matters
  - Current state vs. desired state
  - Acceptance criteria (how to verify done)
  - Alignment gap reference
  - Effort justification
  - Design decisions

- **specs.md** — Technical specifications (filled during planning)
- **design.md** — UX/architecture design (filled during design phase)
- **tasks.md** — Detailed task breakdown (filled during task planning)
- **log.md** — Discovery notes and progress tracking

## Key Documents

- **PROPOSALS_SUMMARY.md** — Full overview of all 9 proposals, dependencies, success metrics, and risk assessment
- **INDEX.md** (this file) — Quick reference and navigation

## For Teams

### Product Manager
- Start with PROPOSALS_SUMMARY.md (full context on all gaps)
- Use this INDEX to navigate individual proposals
- Validate priority ordering and sequencing with stakeholders

### Engineering Leads
- Read each proposal.md to understand scope
- Use dependency graph to plan parallel work
- Assign proposals to teams based on expertise

### Designers
- Each proposal has UX considerations section
- design.md files are placeholder; fill with wireframes/prototypes during design phase

### QA/Testing
- Priority: green_frontend-e2e-tests_09 (testing infrastructure)
- Use green_frontend-e2e-tests_09/proposal.md to plan test strategy

## Questions?

Each proposal.md has:
- **Alignment Gap:** Reference back to alignment-report.md for full context
- **Effort Justification:** Detailed breakdown of why size is S/M/L
- **Design Decisions:** Rationale for technical choices
- **Future Enhancement:** Post-v1 ideas for each feature

---

Generated: 2026-06-23 (task-discoverer agent)  
Source: sudd/alignment-report.md + sudd/personas/ + sudd/vision.md
