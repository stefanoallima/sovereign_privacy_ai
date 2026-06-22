# Log: Frontend E2E Tests

**Created:** 2026-06-23 (task-discoverer)  
**Status:** Proposal  

## Discovery Summary

Priority 2 testing gap: Zero frontend tests. Privacy-critical components have no automated coverage. Risk: regressions in redaction, review, vault, incognito all undetected until production.

## Critical Workflows

1. Chat → Redaction → Review → Approval
2. PII Vault operations (add, edit, delete, export)
3. Incognito Mode (create, close app, verify gone)
4. Always Review mode (enforce review on all sends)
5. Prompt Transparency (verify categorical attributes only)

## Infrastructure

- Playwright config for Tauri app
- Test helpers and page object models
- CI/CD integration
- Screenshot/video capture on failure
