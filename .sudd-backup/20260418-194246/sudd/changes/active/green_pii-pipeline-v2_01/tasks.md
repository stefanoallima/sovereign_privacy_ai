# Tasks: PII Pipeline V2

## T01: Deduplication in addCustomRedactTerm
- **Effort**: S
- **Dependencies**: none
- **Files**: src/stores/userContext.ts
- **SharedFiles**: none
- **Description**: Add case-insensitive value dedup check in addCustomRedactTerm. Skip if value already exists.
- [ ] Add dedup check
- [ ] Also dedup in importCustomRedactTerms bulk path

## T02: PII Vault Routing on Import
- **Effort**: S
- **Dependencies**: none
- **Files**: src/components/pii/DocumentUploadWidget.tsx
- **SharedFiles**: none
- **Description**: Fix handleDynamicConfirm to call setPIIValue for known fields (single-record AND multi-record first row). Ensure Privacy Shield counter reflects PII vault entries.
- [ ] Route known fields to PII vault via setPIIValue
- [ ] Verify Privacy Shield counter updates

## T03: Auto-Redact Setting
- **Effort**: S
- **Dependencies**: none
- **Files**: src/stores/settings.ts, src/components/settings/PrivacySettings.tsx
- **SharedFiles**: src/stores/settings.ts
- **Description**: Add autoRedactAllContent boolean to AppSettings (default true). Add toggle in Privacy settings UI.
- [ ] Add setting to store
- [ ] Add toggle UI

## T04: Full-Pipeline Anonymization
- **Effort**: L
- **Dependencies**: T03
- **Files**: src/hooks/usePrivacyChat.ts
- **SharedFiles**: none
- **Description**: In executePrivacySend, apply custom redaction + GLiNER to conversation history, context docs, canvas docs, and memories before sending to cloud. Respect autoRedactAllContent setting.
- [ ] Create reusable anonymizeContent helper
- [ ] Apply to conversation history messages
- [ ] Apply to active context documents
- [ ] Apply to canvas/project documents
- [ ] Apply to memories
- [ ] Respect autoRedactAllContent setting toggle
- [ ] Collect all mappings for rehydration

## T05: Pre-Send PII Report
- **Effort**: M
- **Dependencies**: T04
- **Files**: src/hooks/usePrivacyChat.ts, src/components/chat/ChatWindow.tsx
- **SharedFiles**: src/components/chat/ChatWindow.tsx
- **Description**: In hybrid mode review panel, show PII counts found across all content. Show category breakdown.
- [ ] Count PII entities by category during anonymization
- [ ] Pass counts to review panel
- [ ] Display summary in PromptReviewPanel

## Dependency Graph
```
T01, T02, T03 (independent) → Batch 1
T04 (depends on T03) → Batch 2
T05 (depends on T04) → Batch 3
```
