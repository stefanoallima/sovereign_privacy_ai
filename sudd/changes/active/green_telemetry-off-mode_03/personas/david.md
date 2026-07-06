# Persona: David — The Paranoid Privacy Auditor

**Archetype:** Privacy maximalist who will audit your code with Wireshark.

---

## Identity

**Name:** David  
**Age:** 68  
**Location:** Munich, Germany  
**Profession:** Retired mechanical engineer  
**Tech Comfort:** Advanced (command-line, code reading, network protocols)  
**Income:** €35k/year (pension)  
**Device:** Windows 10 laptop, uses Firefox + DevTools daily

David spent 40 years designing industrial machinery with precision tolerances. He approaches software with the same philosophy: transparency, auditability, zero hidden assumptions. He believes every line of code is a contract with the user.

---

## Objectives

1. **Verify Telemetry OFF by Default (UI)**
   - **Goal:** Open Settings → Privacy and confirm toggle shows "Collect analytics: OFF"
   - **Success Criteria:**
     - Toggle exists and is labeled clearly
     - Default state is OFF (no pre-checked box)
     - Status badge shows "Privacy Mode: ON" or equivalent
     - No dark patterns (no confusing language, no "mostly off")
   - **Measurement:** Screenshot of Settings panel, toggle OFF state verified

2. **Audit Code for Telemetry Comments (Code Review)**
   - **Goal:** Grep the entire pps/desktop/src and src-tauri/src for uncommented etch() calls
   - **Success Criteria:**
     - All etch() calls have preceding // INTENTIONAL: or // FORBIDDEN: comment
     - No naked network calls (zero edge cases)
     - Comments are specific (not just "API call" — must explain which API and why)
     - ESLint rule or pre-commit hook enforces this for future code
   - **Measurement:** Run grep -r "fetch(" apps/desktop/src | wc -l and grep -c "// INTENTIONAL:" result.txt → should match 100%

3. **Verify DevTools Console (Real-Time Audit)**
   - **Goal:** Toggle OFF, start conversation, open DevTools Console, see only [Privacy]-prefixed logs
   - **Success Criteria:**
     - Console shows [Privacy] Network call: POST https://api.tokenfactory.nebius.com/... (INTENTIONAL calls only)
     - ZERO lines like [Privacy] Skipped network call (means telemetry attempted despite being OFF)
     - ZERO non-prefixed network calls in console (means something is hidden)
     - Console output is machine-readable (consistent format for parsing)
   - **Measurement:** Capture DevTools screenshot, count INTENTIONAL vs. unexpected calls, verify count matches TELEMETRY_AUDIT.md

4. **Verify Enforcement Prevents Regressions (Development Safety)**
   - **Goal:** Confirm that future code cannot bypass audit trail (ESLint rule + pre-commit hook)
   - **Success Criteria:**
     - Attempt to commit a etch() call without comment → pre-commit hook rejects it
     - ESLint rule 
o-uncommented-fetch is enabled and documented in .eslintrc.cjs
     - CONTRIBUTING.md explains the rule to new contributors
     - No way for a developer to accidentally (or intentionally) bypass the enforcement
   - **Measurement:** Try committing bare fetch() → see error message. Pass.

5. **Run Wireshark Audit (Third-Party Verification)**
   - **Goal:** Capture all network traffic during app use; verify zero unexpected domains
   - **Success Criteria:**
     - Only INTENTIONAL domains appear (api.tokenfactory.nebius.com, huggingface.co, etc.)
     - ZERO analytics domains (analytics.*, sentry.*, plausible.*, etc.)
     - ZERO unexpected subdomains (no secret phone-home)
     - Audit report generated and kept for reference
   - **Measurement:** Wireshark capture file + domain analysis + confidence report with signature

---

## Deal-Breakers

1. **Any Undocumented Telemetry**
   - "If I find even ONE network call that isn't in the audit trail or code comments, I uninstall immediately."
   - Rationale: Hidden telemetry is worse than no telemetry. It means the developers are lying.

2. **Settings Buried or Confusing**
   - "If I have to dig to find the toggle, I assume you're trying to hide it."
   - Rationale: David equates UI prominence with developer honesty. Clear, prominent control = honest intent.

---

## Mental Model

David thinks of software privacy like machine design: **"Every component must be visible, auditable, and intentional."**

- **Privacy = Transparency:** Not "we don't collect data"; rather "you can verify we don't collect data."
- **Trust = Verification:** He won't trust marketing claims or screenshots. He reads code and captures packets.
- **Default = Intent:** If telemetry is OFF by default, it signals the developers care about privacy by default. If it's ON by default (even with an easy toggle), it signals the developers want data.
- **Audit Trail = Insurance:** Comments, logs, code reviews, and enforcement mechanisms are his insurance that the app won't silently change behavior in an update.

David's mantra: **"I trust you when I can read your code, run it locally, and verify your network calls. Until then, you're asking me to have faith, and I'm too old for faith."**

---

## Usage Patterns

1. **First-Run Workflow:**
   - Download app
   - Check README for privacy claims
   - Open Settings → Privacy tab (first thing)
   - Read toggle label and description
   - Inspect DevTools → Console, Network tabs for any unexpected calls
   - Clone repo, grep for "fetch", cross-reference with TELEMETRY_AUDIT.md
   - Only then: create an account and use the app

2. **Ongoing Verification:**
   - Every app update: re-run Wireshark audit
   - Every month: spot-check DevTools console during a conversation
   - Reads GitHub commits related to privacy (looks for regressions)

3. **Share with Community:**
   - Sends Wireshark audit report to privacy-focused forums (Reddit r/privacy, HN)
   - Writes a blog post: "I Audited This AI App's Privacy Claims. Here's What I Found."
   - Points others to TELEMETRY_AUDIT.md and PRIVACY_FAQ.md

---

## Validation Checklist

Use this checklist to verify the feature is complete for David:

- [ ] **UI Test:** Settings → Privacy panel visible, toggle OFF by default
- [ ] **Code Audit:** grep -r "fetch(" apps/desktop/src returns 0 results with no comment above
- [ ] **Console Audit:** Start app, toggle OFF, DevTools Console shows zero non-INTENTIONAL calls
- [ ] **ESLint Rule:** Try committing bare etch() without comment — commit rejected
- [ ] **Enforcement:** CONTRIBUTING.md documents the no-uncommented-fetch rule
- [ ] **TELEMETRY_AUDIT.md:** File exists, lists all network calls with INTENTIONAL/FORBIDDEN tags
- [ ] **PRIVACY_FAQ.md:** File exists, includes DevTools Console screenshot and verification steps
- [ ] **Wireshark Test:** Capture 10 minutes of app use → only INTENTIONAL domains in traffic
- [ ] **Documentation:** CLAUDE.md has "Privacy & Telemetry" section with clear language
- [ ] **Persistence Test:** Toggle OFF → restart app → toggle still OFF (localStorage verified)
- [ ] **David Interview:** Show Settings panel → ask "Would you trust this?" → David says "Yes."
- [ ] **David Code Review:** Provide GitHub link to TELEMETRY_AUDIT.md → David reviews and signs off

---

## Technical Verification Depth

David will go deep. He's comfortable with:
- Regex searching (grep -r "fetch(", g "invoke")
- DevTools inspection (Network tab, Console, Application → localStorage)
- Wireshark packet capture and domain analysis
- ESLint configuration reading
- Git log review (looking for privacy-related commits)
- Source code auditing (reading Rust and TypeScript)

This is not an obstacle—it's his preferred verification method. Make it easy for him by providing:
- Clear code comments
- TELEMETRY_AUDIT.md checklist
- Console log format documentation
- CONTRIBUTING.md guidelines for future code
