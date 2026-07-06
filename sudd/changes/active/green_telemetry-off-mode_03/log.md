# Log: Telemetry-Off Mode & Privacy Guarantee

**Created:** 2026-06-23 (task-discoverer)  
**Status:** Planning → Ready for Build  

## Discovery Summary

Priority 1 privacy gap: David's deal-breaker is "If the app collects any analytics or telemetry, he'll uninstall immediately." Currently no explicit telemetry-off mode or documentation. This proposal adds Settings panel and verifiable privacy guarantee.

## Key Point

Bundled GAP002 + GAP007 because both address the same underlying concern: David needs proof that telemetry is off and code is auditable.

---

## Persona Early Validation (2026-06-23)

### David (Privacy-Conscious Retiree): **PASS**
- **Status:** Validated and ready for acceptance testing
- **Strengths:** 
  - 5 highly specific, measurable objectives with actionable verification steps
  - Coherent identity anchored in engineering background (precision, transparency)
  - Deal-breakers directly testable (undocumented telemetry, buried UI)
  - Validation checklist with 12 concrete criteria (grep patterns, Wireshark, pre-commit hooks)
- **Role in gate:** Technical auditor — verifies code comments, console logging, enforcement mechanisms, network traffic

### Margot (Power-User Designer): **PASS**
- **Status:** Validated and ready for acceptance testing
- **Strengths:**
  - 5 concrete objectives with measurable outcomes (LinkedIn post, peer feedback, localStorage tests)
  - Clear differentiation from David (documentation advocate vs. code auditor)
  - Deal-breakers tied to non-technical user needs (clarity, UI prominence)
  - Validation checklist with 12 criteria (toggle behavior, persistence, PRIVACY_FAQ.md comprehension, community engagement)
- **Role in gate:** Community advocate — verifies UI clarity, documentation quality, toggle ease-of-use, peer trust

### Overall: **Ready for Design-Gate**
- Both personas pass all required structural sections
- Both have measurable, testable acceptance criteria
- Both directly address proposal core acceptance criteria
- No placeholders or missing sections
- Next step: Design-gate phase (verify design serves both personas)

---

## Architecture Review (2026-06-23)

### Verdict: **APPROVED** (10/10 checklist items PASS)

**Key findings:**
1. **Acceptance Criteria Alignment:** ✓ All 5 acceptance criteria explicitly implemented (Settings panel, OFF default, auditable code, documentation, David's confidence)
2. **Persona Alignment:** ✓ Both David (code auditor) and Margot (design advocate) objectives directly addressed
3. **Technical Soundness:** ✓ Feasible approaches using existing patterns (Zustand, React, ESLint, pre-commit hooks)
4. **Risk Mitigation:** ✓ All 5 identified risks mitigated with HIGH confidence; two NEW mitigations added (T4a ESLint enforcement, T5 RequestLogger console logging)
5. **Scope Creep:** ✓ Well-bounded S-size (9.5-10.5 hours); v0.2 enhancements deferred (Network Monitor UI)
6. **Dependencies:** ✓ Zero new external dependencies; all tools (Zustand, React, ESLint) already in project
7. **Backwards Compatibility:** ✓ Fully compatible; Zustand migration (v16→v17) with safe defaults
8. **Testing Strategy:** ✓ Comprehensive testing maps to both personas (UI, code audit, persistence, DevTools, Wireshark, persona sign-off)
9. **Success Criteria Verifiability:** ✓ All acceptance criteria objectively verifiable (screenshot, localStorage, grep, persona review)
10. **Architecture Decisions Justified:** ✓ All key decisions (OFF default, simple toggle, Zustand, opt-in, no dark patterns) well-reasoned

**Strengths:**
- Proactive risk identification: ESLint rule + pre-commit hook prevents future unenforced comments
- Transparency tools: RequestLogger utility makes console logging impossible to bypass
- Persona-driven validation: David and Margot have explicit, measurable validation checklists (12 items each)
- Conservative scope: Design defers non-essential features (Network Monitor UI) to v0.2

**Status:** Planning → Build (design-gate passed)

---

## Design-Gate Results (2026-06-23)

### David's Design-Gate: 92/100 — **APPROVED**
- **Objective 1 (Verify OFF Default):** ✓ READY — Settings panel fully designed, task T1-T3 clear
- **Objective 2 (Code Audit Comments):** ✓ READY — INTENTIONAL/FORBIDDEN strategy designed, T4 + T4a specified
- **Objective 3 (DevTools Console):** ⚠️ READY (with gap) — RequestLogger designed (design.md §5.2, T5), but task decomposition unclear
- **Objective 4 (ESLint Enforcement):** ⚠️ READY (with gap) — Enforcement designed (design.md T4a), but T4a not in tasks.md list
- **Objective 5 (Wireshark Audit):** ❌ NOT DESIGNED — No Wireshark test plan in design or tasks
- **Deal-breakers:** Both addressed (toggle visible, code auditable)

**Gaps flagged:**
- T4a (ESLint rule) designed but not decomposed in tasks.md
- RequestLogger task not explicit in tasks.md T5 (definition is ambiguous)
- Wireshark testing out of scope for v0.1 (no test plan provided)

### Margot's Design-Gate: 88/100 — **APPROVED**
- **Objective 1 (Understand Model):** ✓ READY (with gap) — PRIVACY_FAQ.md structure designed, content not drafted
- **Objective 2 (Toggle Analytics):** ✓ READY — TelemetryConsentPanel fully designed, all tasks T1-7 specified
- **Objective 3 (Verify Persistence):** ✓ READY — localStorage architecture documented, persistence tests planned
- **Objective 4 (Classify Audit):** ✓ READY — TELEMETRY_AUDIT.md categories clear, classification task measurable
- **Objective 5 (Community Recommendation):** ✓ READY — Documentation, honest messaging, UI all specified
- **Deal-breakers:** Both addressed (clear docs, prominent toggle)

**Gaps flagged:**
- PRIVACY_FAQ.md content not drafted (only structure provided) — can be filled in during T6.2

### Overall Design-Gate: **PASSED** (90/100 minimum)
- Both personas score ≥88/100
- All acceptance criteria addressed in design
- Key features (Settings panel, code audit, console logging) fully specified
- Gaps are task decomposition and documentation drafting (not blocker-level)
- **Proceed to build with noted gaps to address during implementation**

### Noted Implementation Gaps (to address during build)
1. T4a (ESLint enforcement) — designed but not in tasks.md; include in build
2. T5 (RequestLogger) — designed but task scope in tasks.md is ambiguous; clarify during T5 implementation
3. Wireshark testing — out of scope for v0.1; document for v0.2 roadmap
4. PRIVACY_FAQ.md content — draft actual plain-language text during T6.2
