# Log: Always Review Mode

**Created:** 2026-06-23 (task-discoverer)  
**Status:** Planning Complete  
**Phase Transition:** inception → planning ✓  

## Discovery Summary

Priority 2 privacy gap: Prompt Transparency Review exists but is optional (persona-dependent). David needs a global "Always Review Before Send" toggle to enforce complete transparency.

## Design Completion (2026-06-23)

**Architecture Designed**: Complete 5-layer bypass prevention architecture
- Settings toggle (appSettings.ts)
- Review gate check (useInference.ts)
- Modal enforcement (PromptReviewPanel.tsx)
- Audit logging (analytics.ts)
- Visual indicator (ChatWindow.tsx badge)

**Files to Change**: 7 files, ~145 LOC total
**Implementation Tasks**: 18 tasks across 4 phases
**Testability**: 100+ test cases defined

### Design Sections

- ✓ Architecture Overview (data flows, decisions)
- ✓ Components & Integration (7 component interactions)
- ✓ File Changes Required (7 files, breakdown per phase)
- ✓ Edge Cases & Handling (8 scenarios covered)
- ✓ Implementation Order (4-phase breakdown)
- ✓ Testability Notes (unit + integration + E2E)
- ✓ Bypass Prevention (5-layer defense)
- ✓ Security & Privacy (no prompt logging)

### Specs Completed

- ✓ Feature Specification (settings, review enforcement, audit, visual indicator)
- ✓ Data Model (AppSettings, ChatStore, ReferencingHook changes)
- ✓ Component APIs (SettingsPage, ChatWindow, PromptReviewPanel, useInference)
- ✓ Testability Matrix (7 AC × 3 test layers)
- ✓ Edge Cases (8 scenarios)
- ✓ Constraints & Assumptions

### Tasks Defined

**Phase 1 (Foundation)**: T01-T05 (5 tasks)
- Settings storage, modal state, badge, toggle UI, button disable
- Verify AC1, AC4, AC5

**Phase 2 (Review Logic)**: T06-T08 (3 tasks)
- Review gate, modal buttons, non-dismissible config
- Verify AC2, AC3

**Phase 3 (Logging)**: T09-T11 (3 tasks)
- confirmSendMessage, logging function, wire logging
- Verify AC6

**Phase 4 (Testing & Docs)**: T12-T18 (7 tasks)
- Unit tests, integration tests, E2E tests, edge cases, performance, a11y, docs
- Verify AC7 + all above

## Micro-Personas Completed (2026-06-23T03:47:00Z)

✓ Created 18 micro-personas (one per task):
- T01-T05: Foundation tasks (appSettings, modal state, badge, settings UI, button disable)
- T06-T08: Review logic (review gate, modal buttons, non-dismissible config)
- T09-T11: Logging (confirmSendMessage, audit logging, wiring)
- T12-T18: Testing & docs (unit, integration, E2E, edge cases, perf, a11y, docs)

Each persona includes:
- Role description (who benefits from this task)
- Success criteria (what done well looks like)
- Risk analysis (what breaks if done wrong)
- Testing requirements (what must pass)

## Phase Transition: planning → build ✓

**Status Update**:
- active_change: green_always-review-mode_08 ✓
- phase: build ✓
- architecture_reviewed: true ✓
- personas_validated: true ✓

## Ready for Implementation

All planning complete. Ready to begin Phase 1 (Foundation tasks):
→ Execute T01-T05 in batch 1 (day 1)
→ Run validation squad after each task
→ Continue to Phase 2 upon batch 1 completion
