# Consumer Persona: David — The Security Auditor

## Identity

**Name:** David Chen  
**Age:** 42  
**Location:** San Francisco, CA  
**Profession:** Security researcher & open-source auditor (contractor, reviews privacy-focused apps)  
**Tech Comfort Level:** Advanced — deep knowledge of cryptography, PII handling, data flow analysis

### Personal Context
David is a paranoid-by-training security engineer who reviews privacy tools for a living. He's audited 30+ open-source projects and always finds something wrong: off-by-one bugs in encryption, logs that shouldn't exist, data in memory longer than necessary. When he heard about Sovereign AI's PII detection and redaction pipeline, he wanted to verify it actually works. He's not a typical end-user — he's a "trusted validator" who wants to inspect the vault internals to confirm the redaction logic is sound.

## Objectives

1. **Inspect which PII entities are detected and stored in the Vault**
   - Success criteria: Open Settings → Privacy → PII Vault and see a detailed list of detected entities (name, type, confidence, count of redactions)
   - Measure: David can enumerate ALL detected PII types (medical terms, payment amounts, names, etc.) and verify they match what GLiNER actually detected

2. **Verify that Vault entries are correctly substituted in prompts before cloud transmission**
   - Success criteria: Add a known PII value to Vault; send a chat message containing that value; inspect the Prompt Review panel to confirm the value was replaced with a placeholder
   - Measure: David conducts 5+ tests confirming substitution works for names, medication names, amounts, etc.

3. **Audit the encryption and storage mechanism**
   - Success criteria: Export the Vault as JSON; inspect the file format; verify entries are stored securely in localStorage (ChaCha20) and not leaked in logs
   - Measure: David confirms no plaintext PII in exported data, no unencrypted storage, no log leaks

4. **Validate the redaction logic against real-world medical/financial/legal data patterns**
   - Success criteria: Add complex PII patterns (medication + dosage, corporate entity names, contract clauses) and verify each is correctly detected and stored
   - Measure: David tests edge cases (abbreviations, misspellings, compound entities) and documents which ones fail or need improvement

## Deal-Breakers

1. **If he can't see the raw PII types and entities in the Vault** — David needs forensic-level visibility. If the Vault UI only shows "5 entries, no type info," that's useless for auditing.

2. **If the redaction doesn't actually happen** — If he adds "Acme Corp" to the vault but the full text is still sent to the cloud in the next prompt, the entire feature is broken by design.

3. **If the implementation is closed-source or opaque** — David is a researcher, not a customer. He'll only validate Sovereign AI if he can read the source code and confirm the redaction happens client-side, not server-side.

## Usage Pattern

- **When:** During security audits (one-time or periodic); after app updates to verify no regression
- **Frequency:** 1-2 times per month (or whenever new features ship)
- **Device:** Linux laptop (secure build environment)
- **Offline:** Doesn't matter — this is a settings audit, not a real-world chat usage

## Privacy Concerns

**What he's auditing:**
- **Leakage vectors:** Does plaintext PII escape via logs, crash reports, network traffic, or memory?
- **Confidence thresholds:** Is GLiNER too strict (missing real PII) or too lenient (false positives)?
- **Substitution correctness:** Does every vault entry get replaced before cloud send?
- **Encryption at rest:** Is localStorage properly encrypted? Can an attacker extract the vault by reading disk?

**Trust level:** Skeptical by profession. He trusts code he can read; marketing claims alone aren't enough.

## Mental Model

David thinks of the PII Vault as a "security perimeter." He wants to:
1. Enumerate all PII being tracked
2. Verify each type is detected and stored correctly
3. Confirm substitution happens on every cloud-bound message
4. Audit the encryption to ensure it survives an attacker with local disk access
5. Test edge cases that the developers might have missed

**Would confuse him:**
- "Your data is anonymized" without seeing the actual anonymization code
- A vault UI that doesn't show entity types or confidence scores
- Export that obscures the raw stored values or encryption method
- Absence of a Prompt Review panel showing the exact substitutions

## Success Criteria (for this feature)

- **Audit completeness:** David can enumerate and verify every PII type stored in the Vault
- **Redaction verification:** He confirms via Prompt Review that Vault entries are substituted in at least 10 test messages
- **Security sign-off:** After 1-2 hours of testing, David can write a brief audit report: "The PII Vault correctly detects, stores, and substitutes PII. No obvious leakage vectors." OR "Issues found: [list]"
- **Developer feedback:** David documents any gaps or edge cases (e.g., "GLiNER misses abbreviations like 'ACE Corp' for 'Acme'") for future iterations

## Notes

David is NOT the typical end-user. Margot uses the app daily to get advice; David uses it weekly to confirm the advice engine is safe. Both personas are important:
- **Margot** validates that the feature is usable and solves her redaction needs
- **David** validates that the feature is actually secure and doesn't leak PII despite claiming to protect it
