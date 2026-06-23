# Batch 2 Golden Path Tests - Manual Testing Guide

**Release**: T06: Write Golden Path Tests (Batch 2 Personas)  
**Status**: Ready for manual testing  
**Date**: 2026-06-23  
**Testers**: Margot (Product), David (QA), Aisha (User Experience)

---

## Overview

This document provides manual testing procedures for 5 new personas added in Batch 2:

1. **Personal Branding Coach** - LinkedIn strategy and personal brand narrative
2. **Social Media Strategist** - Content strategy and audience engagement
3. **Real Estate Advisor** - Property valuation and investment analysis
4. **Cybersecurity Advisor** - Privacy and threat response (local-only backend)
5. **Immigration/Visa Advisor** - Visa pathways and relocation planning

**Key Principle**: Domain-appropriate responses mean the persona provides specific, actionable guidance in their domain—not generic advice.

---

## How to Test

### Setup

1. **Build AILocalMind**:
   ```bash
   cd apps/desktop
   pnpm install
   pnpm tauri build
   ```
   - Output: `C:\tmp\tb\release\bundle\nsis\AILocalMind_*.exe`

2. **Launch the App**:
   - Install and open AILocalMind desktop application

3. **Open Developer Tools**:
   - Press `F12` or click `View > Network Audit`
   - Keep this panel visible to verify privacy redaction

4. **Print This Guide**:
   - Print or open on a separate screen for reference

### For Each Persona Test

1. Select persona from dropdown menu (upper left)
2. Send the test message below
3. Review response against expected behavior
4. Check Network Audit for privacy/backend verification
5. Mark checklist items as you verify
6. Document any failures with screenshots

---

## Test 1: Personal Branding Coach 🎨

**SELECT**: "Personal Branding Coach" from persona dropdown  
**SEND**:
```
Help me craft my LinkedIn summary as a data engineer transitioning to PM
```

### Expected Response Should Include

- Career narrative guidance **specific to engineer → PM transition** (not generic)
- Leadership strategy or soft skill suggestions
- Mentions of authenticity and audience alignment
- LinkedIn-specific optimizations (headline, summary format)
- Does NOT provide boilerplate resume advice

### Manual Test Checklist

- [ ] Response acknowledges the career transition specifically
- [ ] Suggests unique value proposition for engineer-turned-PM
- [ ] Recommends LinkedIn-specific elements (headline, summary structure)
- [ ] Tone is encouraging but professional (not casual)
- [ ] Advice feels strategic, not generic

### Privacy Check

- [ ] Open Network Audit (F12)
- [ ] Minimal PII in cloud message (anonymization_mode = 'optional')
- [ ] If any names/email mentioned, should see placeholders like [PERSON_NAME]

### Pass/Fail

- **PASS** if all checklist boxes checked
- **FAIL** if response is generic or missing domain-specific guidance
- **Document**: Take screenshot of response + Network Audit if failed

---

## Test 2: Social Media Strategist 📱

**SELECT**: "Social Media Strategist" from persona dropdown  
**SEND**:
```
I'm starting a tech blog. What should my content calendar look like?
```

### Expected Response Should Include

- Blogging-specific strategy (not TikTok/Instagram focused)
- Content pillars suggestion (e.g., tutorials, thought leadership, industry analysis)
- Posting frequency guidance (concrete, e.g., "2-3x per week")
- Platform choice reasoning (blog + newsletter? blog + LinkedIn?)
- Sample content calendar or timeline
- Tone is analytical but creative

### Manual Test Checklist

- [ ] Distinguishes blog strategy from social media platforms
- [ ] Suggests 3-5 content pillars with examples
- [ ] Provides concrete posting frequency (not vague)
- [ ] Mentions cross-platform repurposing strategy
- [ ] Includes sample calendar or timeline example
- [ ] Response feels strategic and specific

### Privacy Check

- [ ] Open Network Audit (F12)
- [ ] No sensitive data visible in cloud request
- [ ] (anonymization_mode = 'optional')

### Pass/Fail

- **PASS** if all checklist boxes checked
- **FAIL** if response lacks platform-specific strategy or content structure
- **Document**: Screenshot if failed

---

## Test 3: Real Estate Advisor 🏠

**SELECT**: "Real Estate Advisor" from persona dropdown  
**SEND**:
```
I'm looking at a $500k condo with $2k HOA. Is it a good investment?
```

### Expected Response Should Include

- Asks clarifying questions instead of yes/no answer
- Explains decision framework (cap rate, cash flow, appreciation)
- Discusses needed context (mortgage rate, local market, tax situation)
- Uses placeholders for sensitive amounts
- Includes disclaimer: "Not investment advice; consult a financial advisor"
- Shows financial data redaction in Network Audit

### Manual Test Checklist

- [ ] Response asks clarifying questions (location, timeline, financing, goals)
- [ ] Explains cap rate formula or cash-on-cash return concept
- [ ] Discusses tax implications (depreciation, capital gains)
- [ ] Mentions importance of local market context
- [ ] Includes disclaimer about professional advice
- [ ] Does NOT give yes/no recommendation
- [ ] Tone is analytical, cautious, educational

### Privacy Verification (CRITICAL)

- [ ] Open Network Audit (F12) and inspect cloud API calls
- [ ] Search for "500" or "2000" in cloud request — should NOT appear
- [ ] Cloud request should show redacted values: [PROPERTY_VALUE], [HOA_AMOUNT]
- [ ] User message (left side) may contain numbers; cloud message (right) should not
- [ ] Confirm hybrid mode working: local anonymization + cloud call

### Pass/Fail

- **PASS** if checklist complete AND privacy redaction visible
- **FAIL** if numbers leak to cloud or response is generic
- **Document**: Screenshot of Network Audit showing [PROPERTY_VALUE] redaction is critical

---

## Test 4: Cybersecurity Advisor 🔐

**SELECT**: "Cybersecurity Advisor" from persona dropdown  
**SEND**:
```
My email was in a data breach. What should I do?
```

### Expected Response Should Include

Step-by-step response in priority order:
1. Verify breach with Have I Been Pwned
2. Change password immediately (unique, strong)
3. Enable 2FA/2SV
4. Check for unauthorized access
5. Monitor for fraud

- Tone is calm and educational (NOT alarming or fearmongering)
- Explains WHY each step matters
- Suggests specific tools where appropriate

### Manual Test Checklist

- [ ] Response is step-by-step and actionable
- [ ] Starts with verifying the breach (calm approach)
- [ ] Prioritizes password change first
- [ ] Recommends 2FA/2SV as critical step
- [ ] Explains fraud monitoring and prevention
- [ ] Tone is empowering, not scary
- [ ] Does not recommend unnecessary tools
- [ ] Specific tools mentioned (Have I Been Pwned, authenticator apps)

### Backend Verification (CRITICAL)

- [ ] Open Network Audit (F12)
- [ ] **SHOULD SEE**: No cloud API calls
- [ ] **SHOULD SEE**: Ollama or local inference only
- [ ] Confirm persona uses `preferred_backend: 'ollama'` (local-only)
- [ ] Response should come from local model, not cloud

### Pass/Fail

- **PASS** if checklist complete AND no cloud calls visible in Network Audit
- **FAIL** if cloud API calls appear or response lacks step-by-step guidance
- **Document**: Screenshot of Network Audit showing zero cloud calls

---

## Test 5: Immigration/Visa Advisor 🌍

**SELECT**: "Immigration/Visa Advisor" from persona dropdown  
**SEND**:
```
I'm a software engineer in Germany on a work visa. Can I move to the Netherlands?
```

### Expected Response Should Include

- Visa categories for software engineers (D visa, mutual recognition, sponsorship)
- Explanation of mutual recognition of foreign qualifications (EU)
- Timeline expectations (2-8 weeks for EU visa types)
- Documents needed (passport, employment contract, housing proof, insurance)
- Tax residency implications (Germany → Netherlands)
- Includes disclaimer: "Not legal advice; consult immigration attorney"
- Shows PII redaction (visa dates, employment dates)

### Manual Test Checklist

- [ ] Lists specific visa categories (D visa, EU recognition, work permit)
- [ ] Explains mutual recognition of engineering credentials
- [ ] Mentions employer sponsorship vs freelancer visa options
- [ ] Discusses timeline realistically (not vague)
- [ ] Lists specific documents needed
- [ ] Addresses tax residency and double taxation concerns
- [ ] Includes legal disclaimer
- [ ] Response is informative but not prescriptive
- [ ] Tone is empathetic and informative

### Privacy Verification (CRITICAL)

- [ ] Open Network Audit (F12) and inspect cloud API calls
- [ ] Search for visa dates, employment dates — should be redacted
- [ ] Cloud message should show: [VISA_DATE], [EMPLOYMENT_DATE], [EMPLOYER_NAME]
- [ ] Confirm PII vault requirement active (requiresPIIVault = true)
- [ ] User discusses sensitive visa info; cloud receives only categorical data

### Pass/Fail

- [ ] PASS if checklist complete AND privacy redaction visible
- [ ] FAIL if visa/employment dates leak to cloud or response lacks visa categories
- [ ] Document: Screenshot of Network Audit showing [VISA_DATE] redaction

---

## Summary Testing Procedure

### Quick Check (5 min per persona)

1. Select persona
2. Send test message
3. Skim response for domain-appropriateness
4. Quick Network Audit check
5. Move to next persona

### Thorough Check (15 min per persona)

1. Select persona
2. Send test message
3. Read full response against ALL checklist items
4. Take screenshot if anything unexpected
5. Inspect Network Audit in detail
6. Document findings

### Full Test (30 min per persona)

1. Repeat thorough check
2. Try follow-up question to ensure consistency
3. Verify tone matches persona definition
4. Check for hallucinations or unsafe content
5. Document all observations

---

## Known Test Results Template

Use this template to document your test run:

```
Test Date: ________
Tester: ________
Build Version: ________

PERSONAL BRANDING COACH
- Functionality: PASS / FAIL
- Privacy: N/A (optional mode)
- Notes: ____________________

SOCIAL MEDIA STRATEGIST
- Functionality: PASS / FAIL
- Privacy: N/A (optional mode)
- Notes: ____________________

REAL ESTATE ADVISOR
- Functionality: PASS / FAIL
- Privacy: PASS / FAIL
- Redaction visible: Yes / No
- Notes: ____________________

CYBERSECURITY ADVISOR
- Functionality: PASS / FAIL
- Backend (ollama): PASS / FAIL
- No cloud calls: Yes / No
- Notes: ____________________

IMMIGRATION/VISA ADVISOR
- Functionality: PASS / FAIL
- Privacy: PASS / FAIL
- Redaction visible: Yes / No
- Notes: ____________________

OVERALL: PASS / FAIL
Issues found: ____________________
Screenshots: [list files]
```

---

## Troubleshooting

### Response is generic/not domain-specific
- **Cause**: Model might not understand persona instructions
- **Check**: Is the system prompt in `apps/desktop/src/stores/personas.ts` complete?
- **Workaround**: Try follow-up question to clarify domain

### Network Audit shows no calls
- **Cause**: Could be local-only (Cybersecurity Advisor) or delayed rendering
- **Check**: Refresh Network Audit or try different message
- **For Cybersecurity Advisor**: This is expected (ollama backend)

### Numbers/dates visible in cloud message
- **Cause**: Anonymization not working properly
- **Check**: Is `anonymization_mode` set to `'required'`?
- **Fix**: Restart app and try again

### App crashes
- **Report**: Document steps to reproduce + screenshot
- **Escalate**: This is a blocker issue

---

## Checklist for Margot, David, and Aisha

### Before Testing

- [ ] AILocalMind builds successfully
- [ ] Installer or portable exe works
- [ ] Network Audit panel visible (F12)
- [ ] This guide printed or available on screen

### Test Execution

- [ ] Personal Branding Coach - PASS/FAIL
- [ ] Social Media Strategist - PASS/FAIL
- [ ] Real Estate Advisor - PASS/FAIL + Privacy
- [ ] Cybersecurity Advisor - PASS/FAIL + Local-only
- [ ] Immigration/Visa Advisor - PASS/FAIL + Privacy

### After Testing

- [ ] All tests documented in template above
- [ ] Screenshots collected for any failures
- [ ] Issues logged in GitHub/issue tracker
- [ ] Results shared with product team

---

## Questions?

If a response doesn't match expected behavior, ask:
1. Is the response domain-appropriate? (Not generic)
2. Does the tone match the persona definition?
3. Are privacy/backend requirements met?
4. Did the model understand the question?

If yes to all: Test PASSES  
If no to any: Test FAILS - document and escalate

---

**Generated**: 2026-06-23  
**For**: AILocalMind T06 Batch 2 Personas  
**Version**: 1.0  
