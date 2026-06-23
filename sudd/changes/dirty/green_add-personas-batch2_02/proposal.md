# Proposal: Add Second Batch of Specialist Advisor Personas (5 of 10 Missing)

**ID:** green_add-personas-batch2_02  
**Title:** Add remaining 5 specialist personas to complete "14 specialist advisors" promise  
**Size:** L (large)  
**Persona:** All three (Margot, David, Aisha)  
**Priority:** 1  

## Why

Continuation of GAP001 closure. This proposal adds the second batch of 5 missing personas to complete the "Sovereign Council" promise. While batch 1 focuses on immediate high-value personas (tax, health, legal, finance, negotiation), batch 2 covers complementary specialists that expand appeal to broader user segments.

Completing all 14 personas removes the credibility gap and allows README to accurately represent the product without overpromising.

## Current State

- **After batch 1 shipped:** 9 personas available (4 original + 5 from batch 1)
- **Still missing:** 5 personas (personal-branding, social-media, real-estate, cybersecurity, immigration, investment, digital-twin, creative)
  - *Note: Listed 8 above, but only 5 needed to reach 14. Prioritize top 5 based on user demand post-batch-1.*

## Desired State

Ship 5 additional persona definitions:

1. **Personal Branding Coach** (LinkedIn strategy, personal brand narrative, visibility in niche)
2. **Social Media Strategist** (content calendar, platform strategy, audience engagement)
3. **Real Estate Advisor** (property valuation, mortgage strategy, rental investment analysis)
4. **Cybersecurity Advisor** (privacy best practices, password strategies, data breach response)
5. **Immigration/Visa Advisor** (visa categories, relocation planning, international tax implications)

Each persona follows the same structure as batch 1 (system prompt, knowledge hooks, backend defaults, privacy stance).

## Acceptance Criteria

1. **All 5 new personas are selectable** — UI dropdown expanded to include all 9 new personas
2. **Personas function correctly in conversations** — Each responds with domain-appropriate guidance
3. **README updated to reflect 14 personas** — "Sovereign Council" section lists all 14 with short descriptions
4. **Batch 1 personas continue to function** — No regressions
5. **Total persona count in UI = 14** (4 original + 5 batch 1 + 5 batch 2)

## Dependencies

- Depends on: green_add-personas-batch1_01 (completed)
- Unblocks: None immediate, but enables more comprehensive "Sovereign Council" marketing

## Effort Justification

**L (Large) — 2–3 weeks**

Same justification as batch 1:
- System prompt engineering: 5 personas × 1–2 days = ~1 week
- Knowledge base integration: Domain sources for each = ~3–4 days
- UI & backend wiring = ~2–3 days
- Testing & QA = ~2–3 days
- Documentation = ~1 day

Note: Batch 2 may be slightly faster if patterns from batch 1 are reusable (templates, testing harnesses), but domain expertise is still required for new fields (real estate, immigration, cybersecurity).

## Alignment Gap

**Reference:** GAP001 (Missing 10 of 14 Personas)

**Report excerpt:**
> "Marketing headlines the 'Sovereign Council' as a core differentiator, but users installing the app will find only 4 generic personas."

This proposal completes the closure, bringing total to 14 personas.

## Sequencing Notes

- **Do not ship batch 2 before batch 1 is complete** — Risk of further credibility gap if batch 1 is delayed
- **Consider user feedback post-batch-1** — Adjust batch 2 lineup based on which personas users actually engage with; may deprioritize less-used personas in favor of more request
- **Marketing alignment** — Coordinate README/vision updates with product completion to avoid new gaps

## Priority Consideration

This is marked **Priority 1** because it closes the same gap as batch 1. However, if resources are constrained:
- **Batch 1 is must-ship** (serves Margot, David, Aisha directly)
- **Batch 2 can be deferred 1 sprint** if batch 1 needs extended QA/refinement
