# Proposal: Add First Batch of Specialist Advisor Personas (5 of 10 Missing)

**ID:** green_add-personas-batch1_01  
**Title:** Add first 5 specialist personas to close credibility gap on "14 specialist advisors"  
**Size:** L (large)  
**Persona:** All three (Margot, David, Aisha)  
**Priority:** 1  

## Why

The alignment report identifies **GAP001**: README and vision claim "14 specialist advisor personas" in the Sovereign Council, but only 4 built-in personas ship (psychologist, life-coach, career-coach, tax-accountant). Users installing the app expect a rich set of specialists across tax, health, legal, finance, career, and more—but find only generic coaches.

**Credibility impact:** This is a marketing claim that the product doesn't meet. New users comparing Sovereign AI to alternatives will see "14 advisors" in the README and feel misled when they get 4. This directly undermines trust, especially for privacy-conscious users (David, Margot) who are already skeptical of tech products.

**Persona-specific gaps:**
- Margot expects a tax-navigator specifically (not generic tax-accountant)
- David expects health-coach and nutrition expert personalization
- Aisha expects legal-advisor and negotiation-coach for startup contracts

## Current State

- **Shipped personas:** 4 (psychologist, life-coach, career-coach, tax-accountant in `apps/desktop/src/stores/personas.ts`)
- **Claimed personas:** 14 (@tax-navigator, @legal-advisor, @financial-advisor, @career-coach, @health-coach, @personal-branding, @social-media, @real-estate, @cybersecurity, @immigration, @investment, @negotiation, @digital-twin, @creative)
- **Gap:** 10 missing (9 if career-coach is listed correctly)

## Desired State

Ship 5 high-impact persona definitions that serve Margot, David, and Aisha's stated objectives:

1. **Tax Navigator** (replaces tax-accountant, enhanced for Belgian/European freelancers)
2. **Health Coach** (expert on nutrition, medication interactions, chronic disease management)
3. **Legal Advisor** (contracts, employment law, compliance across jurisdictions)
4. **Financial Advisor** (budgeting, investment strategy, personal finance)
5. **Negotiation Coach** (deal tactics, salary negotiation, vendor contract strategy)

Each persona will have:
- Domain-specific system prompt (~300-500 tokens)
- Curated knowledge base hooks (reference domain-specific facts via RAG if available)
- Recommended backend (local vs. hybrid, based on sensitivity)
- Privacy stance (what PII gets auto-redacted)

## Acceptance Criteria

1. **All 5 personas are selectable in the UI** — Dropdown in chat selector shows "Tax Navigator," "Health Coach," "Legal Advisor," "Financial Advisor," "Negotiation Coach"
2. **System prompts are deployed and functional** — Each persona responds with domain-appropriate guidance when selected (manual test: ask each about a sample scenario)
3. **Personas are documented in README** — "Sovereign Council" section lists all 9 personas (4 original + 5 new)
4. **Persona-specific behavior is testable** — E.g., Tax Navigator refers to VAT/deduction rules; Health Coach asks about medications/conditions; Legal Advisor discusses contract clauses
5. **No regressions** — Existing 4 personas still function; backward compatibility preserved

## Dependencies

- Depends on: None (independent feature)
- Unblocks: GAP008 (Dutch Tax Knowledge base can leverage Tax Navigator persona)

## Effort Justification

**L (Large) — 2–3 weeks**

- **System prompt engineering:** 5 personas × 1–2 days per prompt (research domain, craft guidelines, test) = ~1 week
- **Knowledge base integration:** Hook personas to RAG pipelines (Dutch tax, health, legal) = ~3–4 days
- **UI & backend wiring:** Persona selector, store updates, persona config = ~2–3 days
- **Testing & QA:** Manual tests for each persona, edge cases, tone/accuracy checks = ~2–3 days
- **Documentation & README updates** = ~1 day

**Why it's L and not M:**
- High cognitive load: requires domain expertise (tax law, health/pharma, contracts) or extensive research
- Quality bar is high: bad advice on health/legal from a poor system prompt is worse than no advice
- Testing surface is large: 5 personas × multiple conversation flows = significant QA

## Alignment Gap

**Reference:** GAP001 (Missing 10 of 14 Personas)

**Report excerpt:**
> "Marketing headlines the 'Sovereign Council' as a core differentiator, but users installing the app will find only 4 generic personas. This is a credibility gap: users read '14 specialist advisors' and get 4 generic coaches."

This proposal closes half the gap (5 of 10) in the first sprint. A follow-up proposal (green_add-personas-batch2_02) will address the remaining 5 (personal-branding, social-media, real-estate, cybersecurity, immigration, investment, digital-twin, creative).

## Implementation Notes

- Use modular system prompt structure (templates in `personas.ts` or new `personas/` directory)
- Consider storing persona knowledge base URLs (e.g., links to GLiNER medical datasets, Dutch tax docs) for future RAG hookup
- Default recommendation: Tax Navigator, Health Coach, Legal Advisor use hybrid backend (local preprocessing + cloud for quality); Negotiation Coach uses local-only by default (sensitive startup data)
