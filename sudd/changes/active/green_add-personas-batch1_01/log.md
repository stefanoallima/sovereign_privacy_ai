# Log: Add First Batch of Specialist Advisor Personas

**Created:** 2026-06-23 (task-discoverer)  
**Last Updated:** 2026-06-23 (brown planning phase)  
**Status:** Planning Complete → Ready for Build

## Discovery Summary

Alignment report (GAP001) identifies critical credibility gap: README claims "14 specialist advisor personas" but only 4 ship with the product. This change addresses the first 5 (Tax Navigator, Health Coach, Legal Advisor, Financial Advisor, Negotiation Coach), moving from 4 to 9 total personas.

## Planning Phase (2026-06-23)

### Design Complete ✓
- **Architect dispatch:** Full system prompt design for all 5 personas with domain focus, tone, privacy stance, backend routing, failure modes
- **Integration points:** Update `personas.ts` (add to DEFAULT_PERSONAS), UI grouped selector, localStorage migration v2→v3
- **Privacy architecture:** Per-persona PII redaction via GLiNER (design phase; Phase 2 implementation)
- **Rollout:** Phase 1 (5 personas, 9 total); Phase 2 (4-5 more, reach 14)

### Specs & Tasks ✓
- **Specifications:** Data model (Persona interface), API changes (none breaking), UI components, configuration per persona, testing requirements
- **10 Implementation Tasks Defined:**
  - T01: Add 5 personas to personas.ts (M)
  - T02: localStorage migration v2→v3 (S)
  - T03: Grouped selector UI (M)
  - T04: Privacy badges & backend override (S)
  - T05: GLiNER configuration (L, design phase)
  - T06: Documentation updates (S)
  - T07: Regression tests (M)
  - T08: Golden path tests (L)
  - T09: Privacy validation (L)
  - T10: Integration testing (M)
- **Dependency graph:** Linear chain with Phase 2 parallelization opportunities
- **Effort estimation:** ~17 days serial, ~10 days optimized

### Personas & Consumer Alignment ✓
- **Three primary consumers:** Margot (freelancer), David (retiree), Aisha (founder)
- **Persona-specific needs identified:**
  - Margot: Tax Navigator, Legal Advisor, Financial Advisor
  - David: Health Coach (medical data privacy critical)
  - Aisha: Legal Advisor, Negotiation Coach, Financial Advisor (equity/contracts)
- **Privacy validation:** Each persona has defined PII redaction categories

## Design-Gate Revision (2026-06-23)

**Feedback:** Design PASSED on personas but FAILED on user control surfaces. Three deal-breaker gaps identified:

1. **Margot's Gap:** No approval checkpoint before cloud send (needs to see original → redacted)
2. **David's Gap:** No telemetry/analytics controls documented (needs verification it can be disabled)
3. **Aisha's Gap:** No chat export, encryption, or network audit UI (needs data ownership + transparency)

**Revisions Applied to design.md:**

- **Section 1: Prompt Transparency Review (for Margot)**
  - PromptReviewModal component design (original → redacted → approve/deny)
  - Persona config changes (requiresPromptReview field)
  - Integration with hybrid backend routing
  - Phase 1: MVP without redaction editing; Phase 2: Custom override support

- **Section 2: Analytics/Telemetry Controls (for David)**
  - Privacy Settings design (toggle OFF by default)
  - Console logging via RequestLogger utility
  - Cross-reference to `green_telemetry-off-mode_03` design
  - Phase 1: Settings panel + console audit trail

- **Section 3: Chat Export/Encryption + Network Audit (for Aisha)**
  - ChatExportPanel component (encrypted JSON export with user password)
  - NetworkAuditPanel showing all outbound requests + approval status
  - Integration with Prompt Review modal (show "Approved by User" for each request)
  - Phase 1: JSON export + in-memory audit log (50 requests, 2 hours)

**Phase 1 Scope Updated:**
- Core: 5 specialist personas (unchanged)
- New: Prompt Transparency Modal (Margot)
- New: Analytics Controls Panel (David)
- New: Chat Export + Network Audit (Aisha)

**Success Criteria Added:**
- Margot can approve redactions before cloud send
- David can verify analytics are OFF via Settings + console
- Aisha can export encrypted conversations + see network audit trail

## Ready for Build Phase

- [x] Architecture review (design comprehensive)
- [x] Design-gate validation (all 3 personas' deal-breakers addressed)
- [ ] Proceed to T01 implementation

## Known Risks & Phase 2 Deferred

**Design Phase 1 (This Change):**
- Full system prompts shipped (copy-paste ready)
- UI grouped selector + privacy badges
- localStorage migration with backward compatibility

**Implementation Phase 2 (green_add-personas-batch2_02):**
- Knowledge base integration per persona (tax code, clinical guidelines, EU employment law)
- Per-persona GLiNER entity mapping (currently assumes generic GLiNER)
- Setup wizard persona recommendation
- Persona marketplace / community personas

**No blocking issues. Ready to proceed to build phase.**
