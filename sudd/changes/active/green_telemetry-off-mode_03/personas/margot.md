# Persona: Margot — The Power User Who Needs Proof

**Archetype:** Detail-oriented freelancer who wants to understand *why* and explain to others.

---

## Identity

**Name:** Margot  
**Age:** 34  
**Location:** Brussels, Belgium  
**Profession:** Freelance UI/UX designer  
**Tech Comfort:** Intermediate (not a developer, but reads docs and understands APIs)  
**Income:** €45k/year (self-employed)  
**Device:** MacBook Pro, uses Chrome DevTools occasionally, prefers UI over terminal

Margot is methodical, curious, and community-oriented. She doesn't assume the worst of companies, but she demands clear communication. If a tool solves her problem AND is transparent about its practices, she becomes an evangelist. She blogs about design, mentors junior designers, and regularly recommends tools to her network.

---

## Objectives

1. **Understand the Telemetry Model Deeply**
   - **Goal:** Read PRIVACY_FAQ.md + TELEMETRY_AUDIT.md and fully comprehend what is/is not collected
   - **Success Criteria:**
     - Can explain telemetry to a non-technical friend in < 2 minutes using plain language
     - Knows which analytics are collected IF toggle is ON (specific feature names, not vague "usage data")
     - Understands why OFF is default (aligns with privacy-first philosophy)
     - Can distinguish between "telemetry" and "data required to function" (model downloads, API calls)
     - Feels confident enough to recommend the app to peers
   - **Measurement:** Write a 3-paragraph recommendation post for LinkedIn; ask 2 peers if explanation is clear

2. **Toggle Analytics ON and Verify They Work**
   - **Goal:** Enable telemetry toggle, run the app, and see analytics data flow correctly
   - **Success Criteria:**
     - Toggle in Settings → Privacy is prominently placed (not hidden in "Advanced")
     - UI shows "Collect analytics: ON" with a clear status badge
     - Enable toggle, then check DevTools Network tab for analytics calls
     - Analytics calls appear (proves toggle works bidirectionally)
     - Disable toggle again → analytics calls stop (proves toggle is enforced)
     - No accidental Sentry/error tracking that wasn't disclosed
   - **Measurement:** Screenshot of toggle ON/OFF state, DevTools Network tab showing analytics calls appearing/disappearing

3. **Verify Toggle Persistence and Local Storage**
   - **Goal:** Confirm setting persists across app restarts using local storage (no cloud sync)
   - **Success Criteria:**
     - Toggle OFF → close app → reopen → toggle still OFF
     - Toggle ON → close app → reopen → toggle still ON
     - DevTools → Application → Local Storage shows ssistant-settings with 	elemetryEnabled: true/false
     - No suspicious network calls to sync settings (no cloud storage of preferences)
     - Zustand migration is documented so she understands data persistence
   - **Measurement:** Repeat toggle test 3 times, inspect localStorage each time, screenshot localStorage key/value

4. **Read and Classify TELEMETRY_AUDIT.md**
   - **Goal:** Understand the network call audit trail well enough to spot regressions or suspicious additions
   - **Success Criteria:**
     - TELEMETRY_AUDIT.md lists all network calls with categories: INTENTIONAL (allowed) vs FORBIDDEN (guarded)
     - Each call has a clear reason (e.g., "Nebius API for inference", "HuggingFace model download")
     - Familiar with the difference: INTENTIONAL = always allowed; FORBIDDEN = only if telemetryEnabled:true
     - Could spot a new network call in future versions and check if it's documented
     - Understands why enforcement (ESLint rule) prevents undocumented calls
   - **Measurement:** Review TELEMETRY_AUDIT.md checklist, classify 5 random calls as INTENTIONAL or FORBIDDEN, score 5/5 correct

5. **Recommend the App to Community (Evangelist Role)**
   - **Goal:** Write a community post or tell 2–3 freelance designer friends about the app and its privacy stance
   - **Success Criteria:**
     - Feels confident recommending it as "privacy-respecting alternative to ChatGPT"
     - Can answer friends' privacy questions with specific, confident answers
     - Points them to PRIVACY_FAQ.md for detailed transparency
     - Gets positive feedback (friends say "sounds trustworthy based on your explanation")
     - App gains community credibility through peer recommendation
   - **Measurement:** Blog post, LinkedIn post, or DM recommendation to ≥2 peers; screenshot of positive response

---

## Deal-Breakers

1. **Unclear or Jargon-Heavy Documentation**
   - "If I have to read the code to understand privacy, I'll assume you're hiding something or you're incompetent."
   - Rationale: Margot is the bridge between technical and non-technical users. If she can't explain it, she can't recommend it.

2. **Toggle Not Prominently Integrated into Privacy Settings**
   - "If I have to dig through settings or search for telemetry, I'll assume it's a half-baked afterthought."
   - Rationale: Margot equates feature prominence with product maturity. Hidden features = unfinished product.

---

## Mental Model

Margot thinks of privacy like design accessibility: **"It should be obvious, well-documented, and work as expected."**

- **Privacy = Clarity:** Not "we're super private" (every app says this); rather "here's exactly what we collect and why."
- **Trust = Documentation:** Good docs prove you thought through the feature. Sloppy docs = sloppy thinking.
- **Toggle = Signal:** A well-placed privacy toggle signals the developers listen to user concerns. A buried toggle signals complacency.
- **Community = Amplifier:** If the tool is good AND trustworthy, her recommendation to peers multiplies its reach.

Margot's mantra: **"I'll trust you when you document your design clearly, prove your promises work, and let me explain it to others without shame."**

---

## Usage Patterns

1. **Evaluation Workflow (First 30 Minutes):**
   - Download and install app
   - Read README and feature overview
   - Navigate to Settings → Privacy (check if section is obvious)
   - Toggle "Collect analytics" ON and OFF, observe UI changes
   - Open PRIVACY_FAQ.md in browser alongside app
   - Check DevTools → Application → Local Storage to verify persistence
   - Skim TELEMETRY_AUDIT.md to understand what's audited

2. **Ongoing Use:**
   - Uses local mode by default (full privacy, zero data transmission)
   - Occasionally toggles telemetry ON to help improve features (feels good about contributing)
   - Monitors app updates for privacy-related changes (reads release notes)
   - Shares privacy features with peers when they ask about privacy concerns

3. **Community Engagement:**
   - Writes a blog post or LinkedIn article: "I Tested Privacy in AILocalMind—Here's How"
   - Mentions specific features: Settings toggle, PRIVACY_FAQ.md, console logging
   - Includes screenshots of Settings panel and documentation
   - Answers questions in comments from peers

---

## Validation Checklist

Use this checklist to verify the feature is complete for Margot:

- [ ] **Settings UI:** Settings → Privacy panel is visible, prominent, and easy to find (no "Advanced" subsection)
- [ ] **Toggle Behavior:** Toggle OFF → ON → OFF, status badge updates each time
- [ ] **DevTools Network:** Toggle ON, run conversation, verify analytics calls appear in Network tab
- [ ] **DevTools Network OFF:** Toggle OFF, run conversation, verify zero analytics calls appear
- [ ] **Local Storage:** DevTools → Application → Local Storage shows ssistant-settings with toggle value
- [ ] **Persistence Test:** Toggle state survives app restart (tested 3 times)
- [ ] **PRIVACY_FAQ.md:** File exists, explains telemetry in < 100 words of plain language (Margot can understand without developer background)
- [ ] **TELEMETRY_AUDIT.md:** File exists, categorizes calls as INTENTIONAL or FORBIDDEN, Margot can classify 5 random calls correctly
- [ ] **CLAUDE.md:** Has "Privacy & Telemetry" section with clear documentation
- [ ] **Help Text:** Toggle description is clear and non-technical (no jargon like "analytics backend" or "invoke")
- [ ] **Margot Interview:** Show Settings panel + PRIVACY_FAQ.md → ask "Would you recommend this to friends?" → Margot says "Yes, I already have."
- [ ] **Blog Post:** Margot (or tester playing Margot role) writes a community recommendation; gets positive engagement

---

## Community Impact

If Margot becomes an evangelist, the app gains:
- Peer-to-peer recommendation (stronger than marketing)
- Credibility in design/creative communities
- Blog/social media mentions that improve SEO
- Feedback from peers that shapes future development
- A vocal advocate who defends the app against FUD

Failure to satisfy Margot means:
- No community amplification (reliance on traditional marketing)
- Risk of negative posts ("I thought this app was private, but...")
- Missed opportunity to build network effects
