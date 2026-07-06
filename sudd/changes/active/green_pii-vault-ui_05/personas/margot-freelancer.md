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

1. **Store repeated client/partner names in the Vault and auto-redact them in future prompts**
   - Success criteria: Add a client name to the Vault via the Settings UI; in a subsequent chat, see the name automatically replaced with `[CLIENT_NAME]` before sending to cloud
   - Measure: Within 1 week, Margot has 5 client names in her vault and uses them across 3+ conversations

2. **Verify that her PII is stored locally and never transmitted**
   - Success criteria: Open Settings → Privacy → PII Vault, see the entries she's added, confirm "Stored on your machine, never transmitted" messaging
   - Measure: Margot achieves peace of mind that her client list is under her control, not anyone else's

3. **Edit or remove vault entries if they become incorrect**
   - Success criteria: Edit a misspelled client name in the Vault; delete an entry she no longer uses
   - Measure: Vault always stays in sync with her current client roster

4. **Export her Vault for backup or data portability**
   - Success criteria: Click "Export Vault" button, save JSON file to disk, inspect it, re-import if needed
   - Measure: Margot has a local backup of her Vault and can port it to a new machine

## Deal-Breakers

1. **If she can't see what's in her Vault** — Without a UI to browse and verify entries, Margot won't trust that redaction is working. She'll assume the app is either not storing anything OR storing it insecurely.

2. **If the Vault editing UI is confusing or requires too many clicks** — Margot has low patience for UI friction. If she has to drill through 3 menus to edit a client name, she'll give up and just use local files instead.

3. **If the Vault is not actually used during redaction** — If she stores "Acme Corp" but the app still sends the full client name to the cloud in the next prompt, that's a critical failure.

## Usage Pattern

- **When:** Before sending sensitive client information to cloud mode; during contract/financial conversations
- **Frequency:** 2-3 times per week (adding new clients); daily during client negotiation season
- **Device:** Laptop
- **Offline:** Sometimes — but Vault management is Settings-based, not chat-based, so offline isn't critical

## Privacy Concerns

**What data worries her:**
- Client names (competitive intelligence)
- Income/hourly rates (fear of price discrimination)
- Contract terms and negotiation strategies

**Trust level:** High in Sovereign AI (local-first design), skeptical of cloud LLMs generally.

## Mental Model

Margot thinks of the PII Vault as "my personal dictionary of business secrets that the app helps me hide." She expects:
1. Easy way to add/manage entries
2. Visual confirmation that redaction is working
3. Full control: delete anything anytime
4. Portable: can back it up or move to a new machine

**Would confuse her:**
- Technical jargon like "categorical attributes" or "GLiNER confidence scores"
- A vault that stores data but offers no UI to manage it
- Export showing encrypted or binary data (she wants readable JSON)

## Success Criteria (for this feature)

- **In-app confidence:** Margot opens Settings → Privacy → PII Vault at least once per week to verify her stored entries
- **Behavior shift:** She stops asking Sovereign AI to "just use my real client names — I trust you." Instead: "Let me add these to my Vault first."
- **Privacy metric:** Within 1 month, Margot is using Vault for at least 3 client names and feels comfortable that they're protected
- **Feature adoption:** Margot enables Vault + Incognito Mode together for her most sensitive conversations (contract negotiation, tax planning)
