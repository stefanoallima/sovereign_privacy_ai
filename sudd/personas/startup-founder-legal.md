# Consumer Persona: Aisha — The Bootstrapped Founder

## Identity

**Name:** Aisha Okonkwo  
**Age:** 29  
**Location:** Lagos, Nigeria (operates remotely; sells to US/EU markets)  
**Profession:** Co-founder of SaaS logistics startup (15 employees, Series A fundraising)  
**Tech Comfort Level:** High — computer science degree, comfortable with code and infrastructure

### Personal Context
Aisha bootstrapped her startup with personal savings and is in early Series A fundraising. She's been asking ChatGPT for advice on equity structures, employment law in 3 countries (Nigeria, UK, US), contract negotiation tactics, and data protection compliance (GDPR, Nigerian Data Protection Act). She copies full employment contracts, salary bands, and cap tables into ChatGPT without hesitation — until her lawyer mentioned that every interaction might be training OpenAI's model, potentially leaking competitive information. Now she's paranoid that an LLM trained on her data could advise her competitors on similar equity structures or legal strategies. She also realizes that if ChatGPT is compromised or breached, her company's legal/financial data could become public. She needs a private AI advisor who can help her navigate startup legalities without feeding her competitive moats to a cloud LLM.

## Objectives

1. **Get contract and equity advice without exposing sensitive company financial or legal documents to cloud AI**
   - Success criteria: Paste full offer letters and equity agreements, ask about competitiveness and legal risks, see PII and sensitive clauses (salary, vesting, exercise prices) redacted before any cloud call
   - Measure: Use Sovereign AI's Legal Advisor for 100% of contract reviews vs. ChatGPT (current 80%); full audit trail of all legal questions stored locally

2. **Receive data protection and compliance guidance across multiple jurisdictions (Nigeria, UK, US) without transmitting customer PII or employment data**
   - Success criteria: Ask about GDPR cookie consent, Nigerian DPA compliance, and California privacy rules with examples from her actual customer agreements
   - Measure: Compile a compliance checklist using Sovereign AI's advice without ever uploading customer data or employee records to any cloud service

3. **Build a searchable, encrypted internal knowledge base of legal Q&A specific to her startup's stage and geography**
   - Success criteria: Export chat history as encrypted PDF or encrypted database; ensure it's auditable by her lawyer and co-founder but invisible to any external party
   - Measure: Set up a shared local copy of the Sovereign AI chat database on her company's internal server; all conversations encrypted with company-controlled key

4. **Negotiate deals (vendor contracts, customer agreements) with AI coaching without exposing terms to competitors via training data**
   - Success criteria: Use the Negotiation Coach persona to workshop tactics on realistic contract scenarios (modified to remove client names/amounts)
   - Measure: Complete at least 5 vendor negotiations with AI coaching; track deal terms improvement and report back (within 6 months)

## Deal-Breakers

1. **If she can't control what happens to her chats (export, retention, encryption keys)** — Aisha needs to own her data completely. If Sovereign AI stores chats server-side or requires account sync, she'll reject it. She wants her chat database to live in her company's file system, encrypted with keys that only her company controls. This is non-negotiable.

2. **If the app sends any data to any server without a prompt review that she explicitly approves** — Aisha will read the code (she's a developer). If there's any background sync, version check, or analytics that phones home without explicit approval, she'll fork the app or build her own. She needs guarantees in the documentation.

## Usage Pattern

- **When:** During business hours (9 AM–6 PM Lagos time, overlaps with EU/US morning); also late evenings for async legal thinking
- **Frequency:** 8–12 times per week during fundraising/hiring phases; drops to 2–3 times per week during stable operations
- **Device:** MacBook Pro (company issued); occasionally on iPhone for quick questions (but prefers desktop for security)
- **Offline:** Rarely — operates from co-working spaces with WiFi; but would enable local mode for sensitive questions as a matter of principle
- **Other tools:** Notion (company wiki), Google Drive (shared docs, contracts), Slack (team comms), Orrick/Cooley templates (legal), Carta (cap table management)

## Privacy Concerns

**What data worries her:**
- Equity cap table and salary bands (investor/competitor intelligence)
- Employment contract templates (competitive hiring strategy)
- Customer agreements and data protection clauses (business model details)
- Fundraising strategy and valuation expectations (investor confidentiality)

**Trust level in cloud providers:** Very low for anything sensitive. She views Nebius as "probably trustworthy" but doesn't want to depend on it. She'd use local mode as default for legal/financial, hybrid only for general business advice.

**Hybrid vs. local:** Would use hybrid for "public knowledge" questions (e.g., "Explain DCF valuation") but local-only for anything touching contracts, equity, or company confidentials.

## Mental Model

Aisha thinks of "privacy" as "competitive advantage protection." She understands that cloud LLMs are trained on their inputs; she views it as IP theft. She's technically sophisticated enough to understand categorical attributes (she might even design her own redaction patterns), but she doesn't trust the framework — she'd prefer to control what gets sent manually. She'll want:

1. A way to mark specific conversations as "never leave the machine"
2. Option to see the raw prompt before it's anonymized (to audit redaction logic)
3. Ability to set custom redaction rules (e.g., "always hide salary figures > 10k")
4. Export & audit trail (who accessed what, when)

**Would confuse/frustrate her:**
- If the app doesn't support multi-user access (she wants co-founder to review legal chats)
- If there's no way to encrypt the chat database with a company-controlled key
- If the UI assumes single-user scenarios (no permission model)

## Success Criteria

- **Behavior shift:** Within 2 months, Aisha moves 100% of sensitive contract/legal questions from ChatGPT to Sovereign AI. ChatGPT usage drops to zero for anything company-related.
- **Company adoption:** She pitches Sovereign AI to her co-founder and they adopt it as the official legal/financial AI advisor for the startup. It becomes part of onboarding for new employees.
- **Audit-readiness:** She can export a full encrypted backup of legal Q&A and present it to her lawyer as "confidential work product" without fear of data leaks.
- **Long-term lock-in:** As she scales, she evaluates self-hosting Sovereign AI's backend (if open-source) or paying for an enterprise version with team collaboration features.
