# Privacy Validation Guide - AILocalMind

**Target Audience:** Margot (Product), David (QA), Aisha (User Experience)  
**Last Updated:** 2026-06-23  
**Test Status:** Ready for manual validation

## Overview

This guide documents how to validate privacy and PII redaction in AILocalMind personas. There are two layers of validation:

1. **Automated Tests** - Verify persona configuration (anonymization_mode, backend settings)
2. **Manual Tests** - Verify actual message redaction and local-only backend operation

---

## Persona Privacy Classification

### Required PII Redaction (Cloud + Local Anonymization)

These personas handle sensitive personal/financial data and MUST anonymize before sending to cloud.

| Persona | Icon | Backend | Anonymization | PII Vault | Notes |
|---------|------|---------|----------------|-----------|-------|
| Real Estate Advisor | 🏠 | Hybrid | Required | Yes | Redacts property values, mortgage rates, income |
| Immigration/Visa Advisor | 🌍 | Hybrid | Required | Yes | Redacts passport numbers, visa dates, travel docs |
| Tax Accountant | 🧾 | Hybrid | Required | Yes | Redacts BSN, income, tax details |
| Tax Audit Assistant | 📋 | Hybrid | Required | Yes | Redacts financial document info |

**How It Works:**
1. User sends message with sensitive data (e.g., "$500,000 property")
2. Local anonymizer detects PII and redacts to placeholders: `[PROPERTY_VALUE]`
3. Cloud receives ONLY redacted message
4. Response is filled back in (rehydrated) with original user data locally
5. User sees original message in chat history (not redacted)

**User's View:**
- Chat shows: "I'm buying a $500,000 property at 5.5% interest"
- Cloud never sees: dollar amounts or specific numbers

---

### Optional PII Redaction (User Control)

These personas have anonymization available but not required. Users can toggle.

| Persona | Icon | Backend | Anonymization | PII Vault | Notes |
|---------|------|---------|----------------|-----------|-------|
| Personal Branding Coach | 🎨 | Hybrid | Optional | No | User chooses whether to share personal brand details |
| Social Media Strategist | 📱 | Hybrid | Optional | No | User chooses content sensitivity level |

**How It Works:**
1. User can toggle "Anonymize Sensitive Data" in Privacy settings
2. If ON: Send redacted version like `[BRAND_NAME]`, `[CONTENT_DETAILS]`
3. If OFF: Send original message with full details
4. User chat history always shows original

---

### Local-Only Backend (No Cloud Communication)

This persona never sends data to cloud - maximum privacy by design.

| Persona | Icon | Backend | Anonymization | PII Vault | Notes |
|---------|------|---------|----------------|-----------|-------|
| Cybersecurity Advisor | 🔐 | Ollama (Local) | Optional | No | No cloud call - runs on device only |

**How It Works:**
1. User sends any message, including sensitive security questions
2. NO cloud API call is made
3. Response comes from local Ollama/llama.cpp model
4. Everything stays on device
5. User sees response in chat

**Network Audit Shows:**
- No outbound cloud requests
- Only local inference activity

---

## Automated Tests

Run these before manual testing:

```bash
cd apps/desktop
pnpm test -- personas.test.ts --reporter=verbose
```

**Suite 8: Privacy Validation Tests** verifies:

✓ Real Estate Advisor has `requiresPIIVault = true`  
✓ Immigration Advisor has `anonymization_mode = 'required'`  
✓ Cybersecurity Advisor uses `preferred_backend = 'ollama'`  
✓ Personal Branding has `anonymization_mode = 'optional'`  
✓ All hybrid personas have `enable_local_anonymizer = true`  
✓ System prompts mention privacy/redaction for PII personas  
✓ Configuration doesn't mix incompatible settings  

---

## Manual Privacy Validation Tests

### Test Setup

1. Build AILocalMind:
   ```bash
   cd apps/desktop
   pnpm install
   pnpm tauri build  # Windows: creates installer in C:\tmp\tb\release\bundle\nsis\
   ```

2. Install and launch the app

3. Open Settings → Privacy & Security, enable "Network Audit" logging

4. Open View → Network Audit (or F12) to inspect cloud messages

5. Follow each test below sequentially

---

### Test 1: Real Estate Advisor - Required Redaction

**Setup:**
- Select "Real Estate Advisor" from persona dropdown
- Open Network Audit panel (F12)

**Test Message:**
```
I'm looking at a $500,000 condo with $2,000/month HOA fees. 
My mortgage rate is 5.5% and my annual income is $110,000. 
Is this a good investment?
```

**Expected in Chat History (User Sees):**
```
I'm looking at a $500,000 condo with $2,000/month HOA fees. 
My mortgage rate is 5.5% and my annual income is $110,000. 
Is this a good investment?
```
(Original message with all numbers visible)

**Expected in Network Audit (Cloud Receives):**
```
I'm looking at a [PROPERTY_VALUE] condo with [HOA_AMOUNT]/month HOA fees. 
My mortgage rate is [MORTGAGE_RATE] and my annual income is [ANNUAL_INCOME]. 
Is this a good investment?
```
(Redacted - numbers replaced with placeholders)

**Manual Test Checklist:**

- [ ] Chat history shows original message with "$500,000", "$2,000", "5.5%", "$110,000"
- [ ] Network Audit shows NO raw numbers (e.g., "500" not in cloud request)
- [ ] Network Audit shows placeholders like `[PROPERTY_VALUE]`
- [ ] Response appears in chat (cloud understood the redacted request)
- [ ] Persona Config shows:
  - `anonymization_mode = 'required'`
  - `requiresPIIVault = true`
  - `preferred_backend = 'hybrid'`
  - `enable_local_anonymizer = true`

**If Test Fails:**
- [ ] Raw numbers appear in Network Audit → anonymizer not working
- [ ] Chat history is redacted → rehydration not working
- [ ] No cloud call made → backend routing issue
- [ ] Response is generic → domain expertise issue

---

### Test 2: Immigration/Visa Advisor - Required Redaction

**Setup:**
- Select "Immigration/Visa Advisor" from persona dropdown
- Open Network Audit panel

**Test Message:**
```
My passport number is US12345678. My work visa expires on 2027-06-15. 
I want to move from Germany to the Netherlands next year. 
What visa options do I have?
```

**Expected in Chat History (User Sees):**
```
My passport number is US12345678. My work visa expires on 2027-06-15. 
I want to move from Germany to the Netherlands next year. 
What visa options do I have?
```
(Original with actual passport and dates)

**Expected in Network Audit (Cloud Receives):**
```
My passport number is [PASSPORT]. My work visa expires on [VISA_DATE]. 
I want to move from Germany to the Netherlands next year. 
What visa options do I have?
```
(Redacted - sensitive document numbers hidden)

**Manual Test Checklist:**

- [ ] Chat history shows original passport number and visa date
- [ ] Network Audit shows NO passport numbers (e.g., "US12345678" not in cloud)
- [ ] Network Audit shows NO visa dates (e.g., "2027-06-15" not in cloud)
- [ ] Network Audit shows `[PASSPORT]`, `[VISA_DATE]` placeholders
- [ ] Response mentions specific visa categories (D visa, work permit, etc.)
- [ ] Persona Config shows:
  - `anonymization_mode = 'required'`
  - `requiresPIIVault = true`
  - `preferred_backend = 'hybrid'`
  - `enable_local_anonymizer = true`

**If Test Fails:**
- [ ] Passport/dates appear in Network Audit → anonymizer not detecting travel docs
- [ ] Chat history is redacted → rehydration missing
- [ ] Response is generic → visa expertise not working
- [ ] No cloud call → backend routing broken

---

### Test 3: Cybersecurity Advisor - Local-Only (NO Cloud)

**Setup:**
- Select "Cybersecurity Advisor" from persona dropdown
- Open Network Audit panel
- Take note of initial Network Audit log count

**Test Message:**
```
My email address was found in a data breach. What should I do immediately?
```

**Expected in Network Audit:**
```
[NO CLOUD API CALLS]
Only local inference activity (ollama or llama.cpp)
```

**Expected in Chat History:**
- Response appears immediately with actionable security steps
- Response comes from local model, not cloud

**Manual Test Checklist:**

- [ ] Network Audit shows NO outbound cloud requests after sending message
- [ ] Network Audit shows local inference activity only
- [ ] Response appears in chat within 3-5 seconds (typical local inference latency)
- [ ] Response includes step-by-step actions (verify breach, change password, enable 2FA, etc.)
- [ ] Response is calm and educational (not alarmist)
- [ ] Persona Config shows:
  - `preferred_backend = 'ollama'`
  - `enable_local_anonymizer = false` (no cloud, so no anonymizer needed)
  - `anonymization_mode = 'optional'`
  - `requiresPIIVault = false` (local processing only)

**If Test Fails:**
- [ ] Cloud request appears in Network Audit → backend not using ollama
- [ ] Response takes 10+ seconds → using cloud inference instead
- [ ] No response appears → local model not running
- [ ] Config shows `preferred_backend = 'hybrid'` → wrong backend selected

---

### Test 4: Personal Branding Coach - Optional Redaction (Toggle Test)

**Setup:**
- Select "Personal Branding Coach" from persona dropdown
- Open Settings → Privacy & Security
- Look for "Anonymize Sensitive Data" toggle

**Test Part A: Without Anonymization**

**Test Message:**
```
Help me craft a LinkedIn summary for my personal brand. 
I'm a data engineer at TechCorp who specializes in ML infrastructure.
```

**Expected in Network Audit (No Anonymization):**
```
Help me craft a LinkedIn summary for my personal brand. 
I'm a data engineer at TechCorp who specializes in ML infrastructure.
```
(Original message with company name and details)

**Manual Test Checklist (Part A):**

- [ ] Privacy toggle is OFF (Anonymize Sensitive Data = disabled)
- [ ] Network Audit shows original message with "TechCorp" visible
- [ ] Response includes LinkedIn-specific guidance for the role
- [ ] Chat history shows original message

**Test Part B: With Anonymization**

1. Toggle "Anonymize Sensitive Data" ON in Privacy settings
2. Send the same message again:

```
Help me craft a LinkedIn summary for my personal brand. 
I'm a data engineer at TechCorp who specializes in ML infrastructure.
```

**Expected in Network Audit (With Anonymization):**
```
Help me craft a LinkedIn summary for my personal brand. 
I'm a data engineer at [COMPANY_NAME] who specializes in [SPECIALIZATION].
```
(Redacted - company name hidden)

**Manual Test Checklist (Part B):**

- [ ] Privacy toggle is ON (Anonymize Sensitive Data = enabled)
- [ ] Network Audit shows redacted message with `[COMPANY_NAME]`
- [ ] Chat history shows ORIGINAL message with "TechCorp"
- [ ] Response still includes LinkedIn guidance despite redaction
- [ ] Persona Config shows:
  - `anonymization_mode = 'optional'`
  - `requiresPIIVault = false` (not required)
  - `enable_local_anonymizer = true` (available but not forced)

**If Test Fails:**
- [ ] Toggle has no effect → toggle not wired to anonymizer
- [ ] Chat history becomes redacted → rehydration broken
- [ ] Network Audit doesn't change → toggle not affecting cloud message

---

### Test 5: Social Media Strategist - Optional Redaction (Toggle Test)

**Setup:**
- Select "Social Media Strategist" from persona dropdown
- Open Settings → Privacy & Security
- Check "Anonymize Sensitive Data" toggle state

**Test Part A: Without Anonymization**

**Test Message:**
```
I'm planning a content calendar for my SaaS product launch. 
We're targeting B2B software developers with a new data platform. 
What platforms should I focus on?
```

**Expected in Network Audit (No Anonymization):**
```
I'm planning a content calendar for my SaaS product launch. 
We're targeting B2B software developers with a new data platform. 
What platforms should I focus on?
```
(Original with product details visible)

**Manual Test Checklist (Part A):**

- [ ] Privacy toggle is OFF
- [ ] Network Audit shows original message with product details
- [ ] Response mentions platform strategy (LinkedIn, Dev.to, Twitter, blogs, etc.)
- [ ] Chat history shows original message

**Test Part B: With Anonymization**

1. Toggle "Anonymize Sensitive Data" ON
2. Send the same message again

**Expected in Network Audit (With Anonymization):**
```
I'm planning a content calendar for my [PRODUCT_CATEGORY]. 
We're targeting [TARGET_AUDIENCE] with a new [PRODUCT_NAME]. 
What platforms should I focus on?
```
(Redacted - sensitive details hidden)

**Manual Test Checklist (Part B):**

- [ ] Privacy toggle is ON
- [ ] Network Audit shows redacted message with `[PRODUCT_CATEGORY]`, `[TARGET_AUDIENCE]`
- [ ] Chat history shows ORIGINAL message with product details
- [ ] Response still includes platform recommendations despite redaction
- [ ] Persona Config shows:
  - `anonymization_mode = 'optional'`
  - `requiresPIIVault = false`
  - `enable_local_anonymizer = true`

---

## Summary of Expected Behavior

### PII Redaction Pipeline

```
User Message (with PII)
    ↓
Backend Router (checks persona.preferred_backend)
    ↓
┌─────────────────────────────────────────┐
│  If backend = 'hybrid':                 │
│  ├─ Local Anonymizer (if enabled)       │
│  │  └─ Detects & redacts PII            │
│  └─ Cloud API call                      │
│     └─ Receives ONLY [PLACEHOLDERS]     │
│                                          │
│  If backend = 'ollama':                 │
│  └─ Local Inference Only                │
│     └─ No cloud call at all             │
└─────────────────────────────────────────┘
    ↓
Cloud Response (with placeholders filled)
    ↓
Local Rehydration (replace placeholders with originals)
    ↓
Chat Display (show original message)
```

### Privacy Configuration Checklist

For each persona, verify:

```
REQUIRED REDACTION PERSONAS:
✓ anonymization_mode = 'required'
✓ requiresPIIVault = true
✓ enable_local_anonymizer = true
✓ preferred_backend = 'hybrid' or 'ollama'
✓ System prompt mentions "Privacy" and "redacted"
✓ Network Audit shows NO raw PII in cloud messages

OPTIONAL REDACTION PERSONAS:
✓ anonymization_mode = 'optional'
✓ requiresPIIVault = false or missing
✓ enable_local_anonymizer = true
✓ preferred_backend = 'hybrid'
✓ Privacy toggle in Settings controls anonymization

LOCAL-ONLY PERSONAS:
✓ preferred_backend = 'ollama'
✓ enable_local_anonymizer = false (not needed)
✓ anonymization_mode = 'optional'
✓ Network Audit shows NO cloud API calls
✓ Response comes from local inference only
```

---

## Troubleshooting

### Issue: Raw numbers appear in Network Audit

**Symptom:** "$500,000" appears in cloud request when it should be redacted

**Diagnosis:**
1. Check persona config: is `enable_local_anonymizer = true`?
2. Check Network Audit: was local anonymization attempted?
3. Run automated test: `pnpm test -- personas.test.ts`

**Fix:**
- Ensure persona has `enable_local_anonymizer: true`
- Check anonymization.rs module for detection patterns
- Verify backend router is calling anonymizer

---

### Issue: Chat history is redacted

**Symptom:** User sees "[PROPERTY_VALUE]" in their chat, not the original message

**Diagnosis:**
1. Rehydration should replace placeholders after response
2. Check rehydration.rs module
3. Verify PII mapping is being preserved

**Fix:**
- Ensure rehydration.rs is processing responses
- Check that PII map isn't being cleared prematurely
- Verify chat history UI is showing original message, not cloud message

---

### Issue: Cybersecurity Advisor makes cloud call

**Symptom:** Network Audit shows cloud API call for Cybersecurity persona

**Diagnosis:**
1. Check persona config: is `preferred_backend = 'ollama'`?
2. Backend router may be defaulting to hybrid
3. Local inference may not be running

**Fix:**
- Update persona to have `preferred_backend: 'ollama'` only
- Restart app to load updated config
- Verify ollama/llama.cpp is running on device

---

### Issue: Toggle doesn't affect Network Audit

**Symptom:** Anonymization toggle on/off doesn't change cloud message

**Diagnosis:**
1. Check if toggle is wired to backend routing
2. Message may be cached (not re-sent)
3. Anonymizer may be overriding user preference

**Fix:**
- Ensure UI toggle is connected to anonymization_mode override
- Force re-send of message after toggling
- Check backend_routing.rs for toggle logic

---

## When to Run Tests

| Scenario | Test Level | Commands |
|----------|-----------|----------|
| Daily development | Automated | `pnpm test` |
| Before PR merge | Automated + Manual (quick) | Tests + 1-2 personas |
| Before release | Automated + Full Manual | All tests + all personas |
| Privacy audit | Full Manual + Code review | All personas + source code |

---

## Reporting Results

### Test Pass

Include in PR/commit message:
```
Privacy Validation: PASSED
- [x] Real Estate Advisor redaction
- [x] Immigration Advisor redaction
- [x] Cybersecurity local-only
- [x] Personal Branding toggle
- [x] Social Media toggle
```

### Test Failure

Create GitHub issue with:
1. Which persona failed
2. Screenshot of Network Audit showing the issue
3. Chat history screenshot
4. Persona config dump
5. Steps to reproduce

---

## Questions?

Contact:
- **Product:** Margot (margot@...)
- **QA:** David (david@...)
- **UX:** Aisha (aisha@...)

---

**Version:** T07 Complete  
**Last Tested:** [Run tests to update]  
**Next Review:** Before release
