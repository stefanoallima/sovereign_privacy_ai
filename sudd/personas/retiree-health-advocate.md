# Consumer Persona: David — The Privacy-Conscious Retiree

## Identity

**Name:** David Reinhardt  
**Age:** 68  
**Location:** Munich, Germany  
**Profession:** Retired mechanical engineer; active in chess club and cycling community  
**Tech Comfort Level:** Moderately high — built computers in the 1990s, uses Linux, wary of cloud "black boxes"

### Personal Context
David has lived through German data scandals (Stasi, corporate tracking). His wife was recently diagnosed with Type 2 diabetes, and he's become obsessed with helping her manage blood sugar and medication side effects through dietary changes. He started using ChatGPT to ask medical and nutritional questions — about drug interactions, low-carb diet protocols, supplement safety — but realized he was feeding a US corporate AI a detailed medical history of his wife without her consent. When he tried to delete his account, he discovered that chats were archived somewhere. He switched to asking ChatGPT as "a person with diabetes" instead of "my wife," but he hates the friction and the lack of transparency. He wants an AI advisor for health questions that guarantees data stays local and never "calls home."

## Objectives

1. **Get evidence-based health and medication advice without sharing his wife's medical record with any cloud provider**
   - Success criteria: Upload or describe his wife's current medications, ask about interactions with supplements (magnesium, vitamin D), and see the app auto-detect and redact her name/dosages before any cloud call
   - Measure: "Zero medical data sent to cloud even in hybrid mode; use local-only mode for all health conversations"

2. **Understand low-carb and diabetes-friendly nutrition without his data being used for targeted health ads**
   - Success criteria: Ask detailed nutritional questions (e.g., "Is xylitol safe for Type 2 diabetics? What about stevia?") and never see health product ads afterward
   - Measure: He monitors ad targeting in his browser; zero health/supplement ads appear after using Sovereign AI

3. **Create a private searchable record of health topics he researches for his wife, encrypted on his local machine**
   - Success criteria: Access chat history only locally; option to export encrypted backup; zero transmission to any server
   - Measure: Export and verify chat database is encrypted and readable only by his local app

4. **Verify that his questions about medication cannot be extracted or re-identified by researchers**
   - Success criteria: Sovereign AI's Privacy Shield (GLiNER) detects medication names and patient info automatically; see evidence in the app that these are redacted
   - Measure: Prompt Transparency Review shows `[MEDICATION]` and `[PATIENT_NAME]` instead of actual values before sending to cloud

## Deal-Breakers

1. **If the app collects any analytics or telemetry about his searches** — David views this as a betrayal of trust. He needs Settings → Privacy to have an option to disable analytics entirely (not just "opt-out" — he wants a guarantee that nothing is collected). If he finds evidence of ANY background telemetry, he'll uninstall immediately.

2. **If local mode requires downloading a large language model larger than 5 GB** — David has limited bandwidth (German rural ADSL) and storage. If the default local model doesn't fit or takes hours to download, he'll abandon the app for reliability.

## Usage Pattern

- **When:** Late evening (8–10 PM) after his wife goes to bed; he doesn't want her to see him researching her medical condition
- **Frequency:** 4–6 times per week (consistent health questions); spikes to daily if wife has a new symptom
- **Device:** Desktop computer (custom-built Linux machine with Windows dual-boot)
- **Offline:** Prefers offline but has home DSL; would use local mode by default and only enable cloud for high-quality reasoning tasks
- **Other tools:** Wikipedia (health articles), medical subreddits, his wife's doctor's patient portal, a German health insurance app

## Privacy Concerns

**What data worries him:**
- His wife's medications and dosages (insurance fraud risk, discrimination risk)
- Medical diagnoses and symptoms (stigma, insurance denial risk)
- His own aging-related concerns (loneliness, cognitive decline) — he's reluctant to ask about mental health even anonymously

**Trust level in cloud providers:** Very low. He views Nebius as "possibly honest" but doesn't want to take the risk. EU data protection (GDPR) gives him some comfort, but he'd rather use local-only.

**Hybrid vs. local:** Prefers local-only for all health topics. Would use hybrid only if a question is too complex for the local model and he explicitly approves sending redacted attributes.

## Mental Model

David thinks of "privacy" as "data hygiene" — information should stay quarantined locally, never copied, never shared. He's skeptical of the "categorical attributes" concept because he's read papers on data re-identification (he's an engineer, he understands Bayes' theorem). He'll trust the app only if:

1. He can see *exactly* what's being sent (Prompt Transparency Review is critical for him)
2. The local model is fast enough that he rarely feels tempted to use cloud
3. The app has an explicit "no telemetry, no analytics" mode with a privacy checkmark

**Would confuse him:**
- Jargon like "ONNX Runtime" or "token factory" — he wants simple explanations (Local AI runs on your machine; Cloud AI sends redacted questions to a server in Europe)
- If the app requires an account or login (he'll assume it's tracking him)
- If the Privacy Dashboard is buried in settings; it needs to be prominent

## Success Criteria

- **Behavior shift:** Within 1 month, David stops using ChatGPT for health questions entirely. All medical/nutritional advice-seeking moves to Sovereign AI.
- **Confidence metric:** He shows his wife the app's privacy features (Prompt Transparency, Local Mode, PII Vault) and they both agree "this is what we should have been using all along."
- **Privacy metric:** He runs a privacy audit (e.g., using network monitoring tools) and confirms zero outbound connections to Nebius or any cloud provider when using local mode.
- **Adoption signal:** He recommends the app to at least 2 friends in his chess club or cycling group (older adults with similar privacy concerns).
