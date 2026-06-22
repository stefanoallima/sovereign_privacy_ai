# Log: Always Review Mode

**Created:** 2026-06-23 (task-discoverer)  
**Status:** Proposal  

## Discovery Summary

Priority 2 privacy gap: Prompt Transparency Review exists but is optional (persona-dependent). David needs a global "Always Review Before Send" toggle to enforce complete transparency.

## Implementation Path

- Settings toggle in Privacy panel
- Refactor cloud send code to check toggle before sending
- Audit trail integration for verification
- Edge case handling (keyboard shortcuts, local mode)
