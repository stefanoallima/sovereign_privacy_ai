# Log: PII Vault UI

**Created:** 2026-06-23 (task-discoverer)  
**Status:** Proposal  

## Discovery Summary

Priority 2 feature gap: PII Vault backend exists but no UI for browsing/managing entries. Users cannot see, edit, or export their vault. Makes the README-advertised feature invisible.

## Implementation Path

- VaultBrowser component in Settings → Privacy
- CRUD UI: list, edit, delete, export
- Integration with existing piiVault.ts Zustand store
- Verification that redaction uses vault entries
