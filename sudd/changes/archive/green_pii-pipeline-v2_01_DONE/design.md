# Design: PII Pipeline V2

## Architecture

```
Cloud send path (hybrid/cloud mode):
  User message     → GLiNER + custom redaction → anonymized
  History messages → GLiNER + custom redaction → anonymized (NEW)
  Context docs     → GLiNER + custom redaction → anonymized (NEW)
  Canvas docs      → GLiNER + custom redaction → anonymized (NEW)
  Memories         → GLiNER + custom redaction → anonymized (NEW)
  System prompt    → NOT anonymized (templates, not user data)

  All → Nebius API → response → rehydrate → display
```

## Key Changes

### 1. Dedup in userContext.ts
Add value check in `addCustomRedactTerm` before pushing.

### 2. PII vault routing in DocumentUploadWidget.tsx
The `handleDynamicConfirm` already has the mapping logic but only for single-record docs. Fix: ensure `setPIIValue` is called for known fields.

### 3. Anonymization helper function
Create `anonymizeText(text, customTerms, glinerMappings)` reusable function.
Apply it to each content piece in `executePrivacySend` before building messages array.

### 4. Setting in settings.ts
Add `autoRedactAllContent: boolean` to AppSettings with default true.

### 5. PII report in PromptReviewPanel
Count PII entities found across all content. Show summary before send.

## Acceptance Criteria
1. No duplicate custom redaction terms after re-importing same document
2. Privacy Shield PII counter > 0 after importing document with name/BSN
3. Conversation history sent to cloud has PII replaced with placeholders
4. Context documents sent to cloud have PII replaced
5. Setting toggle works — OFF reverts to legacy behavior
6. Pre-send review shows PII counts across all content
