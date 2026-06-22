# Consumer Persona: Margot — The Anxious Freelancer

## Identity

**Name:** Margot Dubois  
**Age:** 34  
**Location:** Brussels, Belgium  
**Profession:** Freelance graphic designer (self-employed since 2019)  
**Tech Comfort Level:** Intermediate — comfortable with design tools, wary of financial/tax software

### Personal Context
Margot grew up watching her parents lose a copyright dispute because they couldn't afford legal counsel. Now, as a solo freelancer, she obsessively documents everything — invoices, contracts, emails — because she's terrified of tax audits or IP disputes. She's been using ChatGPT to ask about Belgian VAT rules and corporate tax deductions, but every time she copies-pastes her invoice summaries or client contracts, she feels a knot in her stomach. Last month, OpenAI's data breach made headlines, and she realized ChatGPT has seen her complete client list, income figures, and contract terms. She doesn't trust the cloud with her business data anymore.

## Objectives

1. **File accurate quarterly VAT returns without storing financial data in SaaS tax software**
   - Success criteria: Use Sovereign AI's local mode to cross-reference her income categories against Belgian VAT rules without uploading spreadsheets to cloud platforms
   - Measure: "Zero business files uploaded to cloud during tax filing"

2. **Understand deduction eligibility for home office and equipment expenses**
   - Success criteria: Ask about specific business expenses (home office wifi, new monitor, software subscriptions) and get tailored guidance without fear that a cloud AI is profiling her as a target for ads
   - Measure: Within 2 months, switch from paranoid googling to asking Sovereign AI directly

3. **Keep client contract clauses private while getting contract review advice**
   - Success criteria: Paste contract language into Sovereign AI's Legal Advisor, see PII/client names redacted automatically, get negotiation suggestions on the redacted version
   - Measure: Approve at least 3 contracts using the app's prompt review without discomfort

4. **Build a searchable, encrypted personal knowledge base of tax & legal patterns from her questions**
   - Success criteria: Review past conversations within the app; ensure they're never transmitted or visible to providers even accidentally
   - Measure: Open Settings → Privacy, confirm all chat history is stored locally with option to export encrypted backup

## Deal-Breakers

1. **If the app requires internet to function even in local mode** — Margot sometimes works offline from coffee shops and needs to ask quick tax questions without tethering to her phone. If Sovereign AI has any mandatory cloud check-in or analytics call, she'll view it as "still phoning home."

2. **If she can't verify that her data stayed local** — Margot will not trust generic privacy claims. She needs the Prompt Transparency Review panel (the "see what the cloud receives" feature) to appear automatically before any send. If she has to dig through settings or if approval is buried, she'll assume the app is collecting data by default.

## Usage Pattern

- **When:** Early mornings (6–7 AM) before client work starts; ad-hoc during tax season (January, April, October)
- **Frequency:** 3–5 times per week during normal months; daily during tax prep
- **Device:** Laptop (ThinkPad with Linux, but uses Windows VM for work) — rarely on phone
- **Offline:** Yes — works from co-working spaces without reliable WiFi; needs local-only mode to be seamless
- **Other tools:** Excel spreadsheets (income/expense tracking), Adobe CC (work), Wave Accounting (basic reconciliation)

## Privacy Concerns

**What data worries her:**
- Client names and contract terms (competitive intelligence risk)
- Income figures and tax bracket (fear of profiling, price discrimination)
- Business entity structure (VAT registration number, corporate type)

**Trust level in cloud providers:** Low. She views Nebius as "less evil than OpenAI" but still defaults to local-only mode for anything sensitive.

**Hybrid vs. local:** Would use hybrid mode for general business questions (e.g., "How do I price my services in 2025?") but insists on local-only for personal/financial data.

## Mental Model

Margot thinks of "privacy" as "keeping my business secrets private from competitors and advertisers." She doesn't fully understand categorical attributes vs. PII — she'd view "income bracket: 50k-75k" as still leaking too much. She'll need education on why it's safe. She's also skeptical of "anonymization" generally (she read articles about data re-identification).

**Would confuse her:**
- If the prompt review shows placeholder tokens like `[INCOME_BRACKET]` instead of explaining what gets sent to the cloud
- If hybrid mode requires approval every single message (friction)
- If local mode is slower than she expects (she has low patience for lag)

## Success Criteria

- **In-app confidence:** Within 3 months, Margot stops manually copying questions into plain-text files before asking Sovereign AI. The app becomes her trusted "thinking partner" for business questions.
- **Behavior shift:** She switches from "I can't ask the cloud about this" to "I can ask the Local Advisor about this."
- **Privacy metric:** Zero instances of her uploading financial data to any other SaaS platform (Wave, Excel Online, etc.) during tax season — she consolidates all sensitive advice-seeking into Sovereign AI.
- **Feature adoption:** She enables Incognito Mode for contract-related conversations and uses the PII Vault to store repeated client/partner names so they auto-redact in future prompts.
