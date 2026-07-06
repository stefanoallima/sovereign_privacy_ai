# Design: Add Second Batch of Specialist Advisor Personas (batch2_02)

**Change ID:** green_add-personas-batch2_02  
**Architecture Architect:** Claude Haiku 4.5  
**Date:** 2026-06-23  
**Scope:** 5 new specialist personas, following batch 1 patterns  

---

## Overview

Batch 2 completes the "Sovereign Council" promise by adding 5 complementary specialist personas to the 9 existing personas (4 original + 5 from batch 1). This brings the total to 14 personas as marketed.

**Batch 2 personas:**
1. **Personal Branding Coach** — LinkedIn strategy, personal narrative, thought leadership
2. **Social Media Strategist** — Content calendars, platform strategy, audience building
3. **Real Estate Advisor** — Property valuation, investment analysis, mortgage strategy
4. **Cybersecurity Advisor** — Privacy best practices, threat response, security posture
5. **Immigration/Visa Advisor** — Visa pathways, relocation planning, international compliance

Unlike batch 1 (which focused on high-sensitivity domains like tax, health, legal), batch 2 personas have lower PII exposure requirements but still need privacy-first design where applicable.

---

## Architecture

### Code Organization & File Changes

Batch 2 follows the exact same pattern as batch 1. No new files or subsystems needed; only modifications to existing files:

| File | Change | Effort |
|------|--------|--------|
| `apps/desktop/src/stores/personas.ts` | Add 5 persona objects to DEFAULT_PERSONAS array | S |
| `apps/desktop/src/stores/personas.ts` | Increment localStorage version 2→3 | S |
| `apps/desktop/src/components/personas/PersonaSelector.tsx` | Update grouping logic (5 new personas in "Specialist Advisors" group) | S |
| `apps/desktop/src/__tests__/stores/personas.test.ts` | Add regression + golden path tests | M |
| `README.md` | Update "14 Specialist Advisors" section with full list | S |
| `apps/desktop/README.md` | Backend defaults and privacy stance for batch 2 | S |
| `CLAUDE.md` | Batch 2 roadmap and persona definitions | S |

### Persona Object Schema (Reuse from Batch 1)

Each persona in batch 2 extends the `Persona` TypeScript interface (from `apps/desktop/src/types/index.ts`):

```typescript
interface Persona {
  id: string;                           // unique ID: "personal-branding-coach"
  name: string;                         // display name: "Personal Branding Coach"
  description: string;                  // one-line: "LinkedIn strategy and personal brand narrative"
  icon: string;                         // emoji icon: "🎨"
  systemPrompt: string;                 // domain-specific guidance (500–800 words)
  voiceId: string;                      // TTS voice: "en_US-lessac-medium"
  preferredModelId?: string;            // model preference (e.g., "qwen3-32b-fast")
  knowledgeBaseIds: string[];           // domain sources (future phase)
  temperature: number;                  // 0.5–0.8 depending on creativity vs precision
  maxTokens: number;                    // 4096 for all batch 2
  isBuiltIn: boolean;                   // true for all batch 2
  createdAt: Date;                      // new Date()
  updatedAt: Date;                      // new Date()
  
  // Privacy & backend configuration
  preferred_backend?: 'nebius' | 'ollama' | 'hybrid';  // default choice
  enable_local_anonymizer?: boolean;     // GLiNER redaction enabled?
  anonymization_mode?: 'none' | 'optional' | 'required';
  local_ollama_model?: string;           // fallback local model
  requiresPIIVault?: boolean;            // PII vault for sensitive data?
}
```

---

## Per-Persona Specification

### 1. Personal Branding Coach

**ID:** `personal-branding-coach`  
**Icon:** 🎨  
**Temperature:** 0.75 (creative, but grounded)  
**Max Tokens:** 4096  

**Privacy Stance:**
- Handles non-sensitive data: LinkedIn profile tips, career narrative, portfolio strategy
- No PII vault required (user provides intentional branding material)
- **Preferred Backend:** `hybrid` (cloud inference for creative suggestions; local for privacy-sensitive edits)
- **Anonymization:** `optional` (user decides if brand examples are redacted)

**System Prompt Themes:**
- Personal brand clarity and narrative crafting
- LinkedIn profile optimization and thought leadership strategy
- Career story and unique value proposition
- Portfolio and resume guidance
- Networking and visibility in niche
- Authenticity, consistency, and audience alignment

**Key Disclaimers:**
- "This is strategic guidance, not professional branding advice from a certified coach"
- "Your personal brand is yours to own; reflect authentically before sharing online"

**Failure Modes:**
- Declines requests to impersonate others or create false credentials
- Refuses to help hide professional failures or mislead audiences

---

### 2. Social Media Strategist

**ID:** `social-media-strategist`  
**Icon:** 📱  
**Temperature:** 0.7 (balanced creativity and analytics)  
**Max Tokens:** 4096  

**Privacy Stance:**
- Handles content strategy, not personal accounts directly
- No PII vault required (user provides intentional examples)
- **Preferred Backend:** `hybrid` (cloud for trend analysis; local for sensitive content)
- **Anonymization:** `optional` (user decides if examples are platform-specific)

**System Prompt Themes:**
- Content calendar and posting schedule optimization
- Platform-specific strategy (LinkedIn vs TikTok vs Twitter/X)
- Audience engagement tactics and community building
- Hashtag strategy and SEO for social discovery
- Analytics interpretation and performance optimization
- Crisis management and reputation monitoring
- Video, image, and copy optimization

**Key Disclaimers:**
- "This is strategic guidance for content planning, not engagement guarantees"
- "Platform algorithms change; regularly review performance metrics"

**Failure Modes:**
- Declines requests to create spam, clickbait, or manipulative content
- Refuses to help game algorithms or artificially inflate engagement

---

### 3. Real Estate Advisor

**ID:** `real-estate-advisor`  
**Icon:** 🏠  
**Temperature:** 0.6 (precision over creativity)  
**Max Tokens:** 4096  

**Privacy Stance:**
- Handles financial analysis of property deals (valuation, ROI, mortgages)
- **Requires PII vault** (user may input exact property prices, mortgage rates, income multiples)
- **Preferred Backend:** `hybrid` (cloud for complex financial modeling; local for sensitive data)
- **Anonymization:** `required` (financial details redacted before cloud)

**System Prompt Themes:**
- Property valuation methods (comparable sales, income approach, cost approach)
- Mortgage strategy and financing options (fixed vs ARM, refinancing)
- Investment property analysis (cash flow, cap rate, ROI)
- Tax implications (depreciation, capital gains, 1031 exchanges)
- Market analysis and timing considerations
- Rental property management considerations
- First-time homebuyer guidance

**Key Disclaimers:**
- "This is educational guidance, not legal or investment advice"
- "Real estate markets are local; verify all assumptions with local professionals"
- "Consult a licensed real estate attorney for contracts and title issues"
- "Financial data is redacted before cloud processing for your privacy"

**Failure Modes:**
- Declines to guarantee property appreciation or investment returns
- Refuses to provide specific valuation without market context

---

### 4. Cybersecurity Advisor

**ID:** `cybersecurity-advisor`  
**Icon:** 🔐  
**Temperature:** 0.65 (precision with educational tone)  
**Max Tokens:** 4096  

**Privacy Stance:**
- Highest privacy alignment of batch 2 (David's key persona)
- Handles personal security practices, threat response, data protection
- **Preferred Backend:** `local` (all advice can run locally; no external dependencies)
- **Anonymization:** `optional` (code examples/scenarios don't need redaction)

**System Prompt Themes:**
- Password security, passkey adoption, credential management
- Two-factor authentication (2FA) setup and best practices
- Phishing detection and social engineering defense
- Privacy settings for common platforms
- Data breach response and notification procedures
- VPN selection, DNS privacy, and traffic encryption
- Device hardening and software update strategies
- Backup and disaster recovery planning
- Zero-trust architecture for personal computing

**Key Disclaimers:**
- "This is educational security guidance, not a security audit"
- "Your threat model depends on your specific situation"
- "No single tool guarantees security; defense is layered"

**Failure Modes:**
- Declines to suggest illegal tools or activities
- Refuses to help bypass security controls (even for "lost password" scenarios)
- Does not provide targeted hacking techniques

---

### 5. Immigration/Visa Advisor

**ID:** `immigration-visa-advisor`  
**Icon:** 🌍  
**Temperature:** 0.65 (precise but empathetic)  
**Max Tokens:** 4096  

**Privacy Stance:**
- Handles visa pathways, relocation planning, international tax implications
- **Requires PII vault** (user may input passport info, visa dates, income for visa calculations)
- **Preferred Backend:** `hybrid` (cloud for complex visa/tax rules; local for personal data)
- **Anonymization:** `required` (passport numbers, dates, amounts redacted)

**System Prompt Themes:**
- Visa categories and eligibility assessment (work, study, family, investment)
- Application timeline and document requirements
- Relocation planning (cost of living, visa requirements, tax residency)
- International tax implications (treaty relief, filing obligations)
- Dual citizenship and residency strategy
- Sponsorship and credential recognition
- Visa denial and appeal processes
- Post-immigration integration resources

**Key Disclaimers:**
- "This is informational guidance, not legal advice from an immigration lawyer"
- "Visa rules change frequently; verify current requirements on official websites"
- "Your eligibility depends on specific circumstances; consult a licensed immigration attorney"
- "Personal data is redacted before cloud processing for your privacy"

**Failure Modes:**
- Declines to guarantee visa approval or timelines
- Refuses to suggest illegal immigration pathways
- Does not provide legal representation or notarization

---

## Backend Defaults & Privacy Pipeline

### Backend Selection by Persona

| Persona | Preferred Backend | Rationale | PII Vault | Custom Redaction |
|---------|-------------------|-----------|-----------|------------------|
| Personal Branding Coach | `hybrid` | Creative guidance needs cloud; personal data optional | No | Optional |
| Social Media Strategist | `hybrid` | Trend/analytics use cloud; content is public | No | Optional |
| Real Estate Advisor | `hybrid` | Financial modeling needs cloud; prices/mortgages redacted | **Yes** | Required (financial) |
| Cybersecurity Advisor | **`local`** | Max privacy alignment; all advice local | No | Optional |
| Immigration/Visa Advisor | `hybrid` | Complex rules need cloud; passport/dates redacted | **Yes** | Required (passport/dates) |

**All batch 2 personas inherit batch 1's infrastructure:**
- GLiNER anonymization for `hybrid` personas
- Prompt Review Modal before cloud send (for `hybrid`)
- Network Audit logging in Settings
- Privacy badges in UI (if applicable)

### Custom GLiNER Redaction Rules (Phase 2)

Design only (implementation Phase 2):

**Real Estate Advisor:**
- PII categories: `financial_amount`, `property_address`, `mortgage_rate`, `income_bracket`, `person_name`
- Custom entities: `[PROPERTY_VALUE]`, `[MORTGAGE_RATE]`, `[ANNUAL_INCOME]`

**Immigration/Visa Advisor:**
- PII categories: `passport_number`, `visa_date`, `person_name`, `country_of_residence`, `income_bracket`
- Custom entities: `[PASSPORT]`, `[VISA_DATE]`, `[PERSON]`, `[RESIDENCE_COUNTRY]`

---

## UI & UX Changes

### Persona Selector Grouping (Update from Batch 1)

The selector dropdown expands to show 14 personas in 3 groups:

```
┌─────────────────────────────────────┐
│ Personas                            │
├─────────────────────────────────────┤
│ General Advisors (3)                │
│  • Psychologist                     │
│  • Life Coach                       │
│  • Career Coach                     │
├─────────────────────────────────────┤
│ Specialist Advisors (10)            │
│ Batch 1 (5):                        │
│  • Tax Navigator                    │
│  • Health Coach                     │
│  • Legal Advisor                    │
│  • Financial Advisor                │
│  • Negotiation Coach                │
│ Batch 2 (5):                        │
│  • Personal Branding Coach          │
│  • Social Media Strategist          │
│  • Real Estate Advisor              │
│  • Cybersecurity Advisor 🔐         │
│  • Immigration/Visa Advisor         │
├─────────────────────────────────────┤
│ Custom (2)                          │
│  • My Legal Template                │
│  • My Tax Q&A Bot                   │
└─────────────────────────────────────┘
```

**Privacy Badges:**
- 🔐 (local-only) for Cybersecurity Advisor
- 🛡️ (anonymization required) for Real Estate & Immigration Advisors
- ⚠️ (hybrid) for Personal Branding & Social Media (optional redaction)

### Privacy Configuration (No New Components Needed)

Batch 2 personas use existing Privacy Tab infrastructure:
- **Privacy Badges** — Already built in batch 1 (T04)
- **Backend Override** — Already built in batch 1 (T04)
- **Prompt Review Modal** — Already built in batch 1 (T11)
- **Network Audit** — Already built in batch 1 (T14)

No new UI components needed for batch 2. Batch 1 controls scale to all personas.

---

## Testing Strategy

### 1. Regression Testing (Batch 1 Personas)

Ensure no breakage to 9 existing personas:
- All 4 original personas still selectable and functional
- All 5 batch 1 personas still work (tax, health, legal, financial, negotiation)
- No localStorage corruption during v2→v3 migration
- Privacy pipeline (redaction, prompt review, network audit) still works

**Test File:** `apps/desktop/src/__tests__/stores/personas.test.ts`  
**Effort:** M (Medium)

### 2. Unit Tests for Batch 2 Personas

Verify persona definitions are correct:
- All 5 personas load from DEFAULT_PERSONAS
- TypeScript interface compliance (all required fields present)
- Backend defaults correct (hybrid vs local)
- Temperature/maxTokens reasonable
- isBuiltIn=true prevents deletion
- Icons render without errors

**Test File:** `apps/desktop/src/__tests__/stores/personas.test.ts`  
**Effort:** S (Small)

### 3. Golden Path Tests (Manual + Semi-Automated)

For each batch 2 persona, test real conversation flow:

**Personal Branding Coach:**
- Send: "Help me craft my LinkedIn summary as a data engineer transitioning to PM"
- Expect: Domain-aware response with career narrative guidance, not generic CV tips

**Social Media Strategist:**
- Send: "I'm starting a tech blog. What should my content calendar look like?"
- Expect: Platform-specific advice (blogging ≠ TikTok), sample content pillars

**Real Estate Advisor:**
- Send: "I'm looking at a $500k condo with $2k HOA. Is it a good investment?"
- Expect: "This requires knowing your mortgage rate, local market, and tax situation. Let me walk you through the math…" (with placeholders, no specific advice)

**Cybersecurity Advisor:**
- Send: "My email was in a data breach. What should I do?"
- Expect: Step-by-step response (check if compromised, change password, 2FA, monitor)

**Immigration/Visa Advisor:**
- Send: "I'm a software engineer in Germany on a work visa. Can I move to the Netherlands?"
- Expect: Visa category guidance (D visa, recognition of foreign credentials), timeline expectations

**Effort:** L (Large)

### 4. Privacy Validation (Batch 2 Personas)

Verify no PII leakage for hybrid personas:
- Real Estate: Send message with "$500k property, 5% rate, $120k income" → Cloud receives `[PROPERTY_VALUE] [MORTGAGE_RATE] [ANNUAL_INCOME]`
- Immigration: Send "My passport is AB123456789, visa expires 2027-03-01" → Cloud receives `[PASSPORT] [VISA_DATE]`
- Cybersecurity: Send local-only advice → No cloud call made

**Effort:** M (Medium)

### 5. Integration Testing

End-to-end app flow:
- App boots with 14 personas loaded
- Switch between batch 1 and batch 2 personas mid-conversation
- Settings persist after close/reopen
- Grouped dropdown renders 3 categories + 14 personas
- Privacy badges display correctly

**Effort:** S (Small)

---

## Known Risks & Mitigations

### Risk 1: localStorage Version Collision

**Risk:** If v3 migration runs twice or conflicts with batch 1 migration.  
**Mitigation:** Use same version number (v3) in Zustand persist. Batch 1 code already handles this. Batch 2 just adds new personas to the same v3 array.

### Risk 2: System Prompt Length/Quality

**Risk:** New personas have weak or off-brand system prompts.  
**Mitigation:** Domain experts (Margot for personal branding, David for cybersecurity, Aisha for real estate/immigration) review prompts pre-ship.

### Risk 3: Backend Route Confusion

**Risk:** Real Estate & Immigration personas marked `required` anonymization but users not prompted.  
**Mitigation:** Batch 1's Prompt Review Modal (T11) handles this. Verify `requiresPromptReview` field is set for batch 2 PII-heavy personas.

### Risk 4: Incomplete Persona Grouping

**Risk:** UI selector doesn't render "Batch 2 (5)" as subgroup clearly.  
**Mitigation:** Test UI rendering explicitly (T03 update). Use nested group headers or visual separators.

### Risk 5: Phase 2 Custom Redaction Not Ready

**Risk:** Custom GLiNER rules for Real Estate & Immigration not implemented.  
**Mitigation:** This is design-only. Mark Phase 2 in CLAUDE.md. Use generic GLiNER entity detection until Phase 2.

---

## Deliverables

### 1. DESIGN.md (This Document)
- Overview, architecture, per-persona specs
- Backend defaults and privacy pipeline
- Testing strategy
- Risk mitigation

### 2. TASKS.md
- 8–10 concrete implementation tasks
- Task dependencies and parallelization
- Acceptance criteria per task

### 3. Code Changes (Summary)
- **personas.ts:** 5 new persona objects, v3 migration
- **PersonaSelector.tsx:** Grouping logic for 14 personas
- **README & CLAUDE.md:** Documentation updates
- **Test files:** Regression + golden path tests

### 4. Rust Backend Changes (None)
- Batch 2 uses existing GLiNER, anonymization, backend routing from batch 1
- No new Rust modules needed

---

## Success Criteria (Overall Change)

1. ✅ All 5 batch 2 personas load in app (PersonaSelector shows 14 personas)
2. ✅ Each persona produces domain-appropriate responses in golden path tests
3. ✅ No regressions to batch 1 or original 4 personas
4. ✅ localStorage v2→v3 migration succeeds for all users
5. ✅ Privacy pipeline works (Real Estate & Immigration redaction, Cybersecurity local-only)
6. ✅ README updated: "14 Specialist Advisors" section complete
7. ✅ CLAUDE.md updated with batch 2 roadmap and persona specs
8. ✅ All 3 target personas (Margot, David, Aisha) can use batch 2 personas

---

## Timeline & Effort Estimate

**Effort:** M–L (Medium-Large)  
**Est. Serial Days:** ~12  
**Est. Parallelized Days:** ~8

### Breakdown
- T01 (Add personas): 1 day
- T02 (localStorage v3): 0.5 day
- T03 (UI grouping): 1.5 days
- T04 (Tests): 2 days
- T05 (Documentation): 1.5 days
- T06 (Privacy validation): 1.5 days
- T07 (Integration & bugs): 2 days

**Critical Path:** T01 → T02 → T03 → T04 → T06 → T07
