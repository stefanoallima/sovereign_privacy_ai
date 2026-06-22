# Log: Incognito Mode

**Created:** 2026-06-23 (task-discoverer)  
**Status:** Proposal  

## Discovery Summary

Priority 2 feature gap: Incognito Mode is advertised in README but not fully implemented. Only a reference in Sidebar.tsx. Margot's use case depends on this feature for contract-related conversations.

## Implementation Path

- Memory-only store for Incognito chats
- UI toggle per conversation
- Clear-on-close and manual clear
- Persistence layer audit to bypass IndexedDB writes
