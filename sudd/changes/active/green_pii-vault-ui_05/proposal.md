# Proposal: Implement PII Vault UI (Browse, Manage, Edit Vault Entries)

**ID:** green_pii-vault-ui_05  
**Title:** Build Vault Browser UI for managing detected and saved PII  
**Size:** M (medium)  
**Persona:** Margot (primary), David (secondary)  
**Priority:** 2  

## Why

The alignment report identifies **GAP004**: PII Vault UI is missing. The backend store exists (`apps/desktop/src/stores/piiVault.ts` with add/remove/increment functions), but users cannot see or manage vault entries. This makes a README-advertised feature ("PII Vault: Detected personal data can be saved to your encrypted local vault") invisible and unusable.

**Why it matters for Margot:** She wants to store repeated client/partner names in the Vault and have them auto-redact in future prompts. She also wants to verify (in Settings) that her PII is stored locally. Without a UI, she can't:
1. See what the app has learned about her (client names, payment amounts)
2. Edit or remove incorrect entries (e.g., if a client name is misspelled)
3. Export her Vault for backup or data portability
4. Verify that redaction is working (she can't see what's stored)

**Why it matters for David:** He wants to see which medical terms (medication names, dosages) are detected and stored, so he can audit the redaction logic.

## Current State

- **Zustand store exists:** `piiVault.ts` with `add()`, `remove()`, `incrementCount()` functions
- **No UI components** for Vault Browser
- **No Settings → Privacy → PII Vault tab**
- **No list/edit/delete interface** in the frontend
- Vault is created and used internally, but users cannot inspect it

## Desired State

1. **Settings → Privacy → PII Vault tab** with:
   - List of all vault entries (name, type, count, date added)
   - Search/filter by type (name, amount, medication, etc.)
   - Edit button: Change a vault entry (e.g., correct misspelling)
   - Delete button: Remove an entry from vault
   - Export button: Export vault as JSON (for backup/portability)
   - Clear all: Nuke the entire vault (confirmation required)

2. **Vault Entry details modal:**
   - Name/value
   - Type (detected or manually added)
   - Count (how many times redacted)
   - Date added
   - Redaction preview (how it appears in prompts: "[CLIENT_NAME]")
   - Edit: Modify the value or type
   - Delete: Remove this entry

3. **Visual clarity:**
   - Show that Vault is stored locally ("Stored on your machine, never transmitted")
   - Highlight which entries are auto-detected vs. manually added
   - Show a count of entries in Vault in the Privacy page header

## Acceptance Criteria

1. **Vault Browser UI is accessible** — Settings → Privacy → PII Vault tab exists and displays all entries
2. **CRUD operations work** — Create (auto-detect + manual), Read (list), Update (edit), Delete (remove) all work
3. **Redaction uses vault** — Verify that saved entries are substituted in prompts (manual test: add entry, send prompt, check redaction)
4. **Export works** — User can export vault as JSON; reimport into same or different app instance
5. **Privacy messaging is clear** — User sees "Stored on your machine, never transmitted" and trusts the vault
6. **No regressions** — Existing redaction logic still works; vault entries are properly encrypted (ChaCha20)

## Dependencies

- Depends on: None (builds on existing `piiVault.ts` store)
- Unblocks: GAP003 (Incognito Mode) — Margot can use Vault + Incognito together (store names persistently, use Incognito for sensitive conversations)

## Effort Justification

**M (Medium) — ~1 week (5 business days)**

- **UI components:** VaultBrowser, VaultEntryModal, VaultList (~2 days)
- **Integration with Settings:** Add tab to Privacy panel, routing (~1 day)
- **CRUD logic:** Wire UI to Zustand store (add/remove/edit) (~1 day)
- **Export/Import:** JSON serialization, file picker (~1 day)
- **Testing & QA:** List, edit, delete, export operations; verify redaction uses vault (~1 day)

**Why it's M and not S:**
- Requires UI design and multiple components
- Integration with existing Settings structure
- Export/import adds complexity
- Testing surface includes redaction verification

**Why it's not L:**
- No new backend logic (uses existing Zustand store)
- Straightforward React component work
- No cross-feature dependencies

## Alignment Gap

**Reference:** GAP004 (PII Vault UI Missing)

**Report excerpt:**
> "The README advertises 'PII Vault' as a core feature with automatic substitution. Users trying to enable this will look for a Vault Browser or Settings tab and not find it. The backend logic exists but the UX is missing, making it an incomplete feature."

This proposal completes the feature by providing the missing UI layer.

## Design Decisions

1. **Location:** Settings → Privacy → PII Vault tab (not a separate app section; keeps all privacy controls in one place)
2. **Manual vs. auto-detected:** Show both; allow manual additions for frequently-used terms (e.g., partner names not detected by GLiNER)
3. **Encryption:** Vault entries remain encrypted with ChaCha20 (no change to storage layer)
4. **Export format:** Plain JSON (easy to audit, re-import, or integrate with other tools)

## UX Considerations

- **Margot's mental model:** "My PII Vault is like a personal dictionary of things I don't want to leak"
- **Education:** Show a brief explainer: "The Vault stores detected personal data. When you ask a question, these entries are replaced with placeholders like [CLIENT_NAME] before sending to the cloud."
- **Safeguards:** Export requires confirmation (to prevent accidental leaks); clear all requires double-confirmation

## Future Enhancement

- Post-v1: Auto-detect suggestion UI ("We found 'Acme Corp' in your chats; add to vault?")
- Post-v1: Vault sharing (Aisha might want to share vault with co-founder)
- Post-v1: Vault categories (group entries by client, project, etc.)
