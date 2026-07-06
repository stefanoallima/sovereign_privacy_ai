# Proposal: Implement Incognito Mode (Disappearing Chats)

**ID:** green_incognito-mode_04  
**Title:** Implement Incognito Mode — memory-only chats that vanish on close  
**Size:** M (medium)  
**Persona:** Margot (primary)  
**Priority:** 2  

## Why

The alignment report identifies **GAP003**: README advertises "Incognito Mode: Disappearing chats that leave zero trace" as a core feature, but it's not fully implemented. Only a reference found in Sidebar.tsx; no UI toggle, no memory-only logic, no chat persistence prevention.

**Why it matters for Margot:** She reviews sensitive contracts with clients and wants to use Incognito for these conversations. The README explicitly lists Incognito as a feature, and Margot's success criteria include "Enable Incognito Mode for contract-related conversations." Without this, she'll:
1. Assume the app is unfinished or less privacy-focused than claimed
2. Continue using separate browsers/profiles for sensitive work (friction)
3. Distrust the "privacy-first" positioning if promised features are missing

**Scope:** This is a medium-effort feature that's cleanly separable from other work (no cross-cutting concerns). It directly enables one of Margot's success criteria.

## Current State

- **UI reference:** Only in Sidebar.tsx (grep hit; no functional implementation)
- **No memory-only session store** for Incognito chats
- **No persistence logic** to prevent Incognito chats from being saved to IndexedDB/localStorage
- **No clear-on-close** functionality

## Desired State

1. **UI Toggle** — Chat sidebar shows "🕵️ Incognito Mode" toggle per-conversation
   - Toggle on: Conversation enters memory-only mode
   - Toggle off: Conversation is persisted normally
   - Visual cue: Incognito badge in chat header (e.g., "🕵️ Incognito")

2. **Memory-Only Store** — Incognito chats:
   - Exist only in React component state / in-memory Zustand store
   - Are NOT written to IndexedDB, localStorage, or SQLite
   - Are cleared when: conversation is closed, app is closed, or user clicks "Clear Incognito Chat"

3. **Persistence Logic** — Non-Incognito chats persist normally
   - Export/import still works for normal chats
   - Incognito chats never appear in chat history exports

4. **Settings option** — User can set "Always use Incognito for new chats" (default: OFF)

## Acceptance Criteria

1. **Incognito toggle is visible in Sidebar** — User can enable/disable per-chat
2. **Incognito chats do not persist** — Close app, reopen, Incognito chats are gone (message verification via IndexedDB inspection)
3. **Incognito chats function normally** — Prompt review, PII redaction, cloud sends all work; only difference is memory-only storage
4. **Visual indicator is clear** — User sees 🕵️ Incognito badge; cannot confuse Incognito with normal chat
5. **Clear-on-close works** — Open app → create Incognito chat → close app → reopen → Incognito chat is gone
6. **Settings option works** — "Default to Incognito" toggle applies to all new chats

## Dependencies

- Depends on: None (independent)
- Unblocks: None immediate, but supports GAP004 (PII Vault) workflow — Margot uses Vault to store client names in persistent storage, then uses them in Incognito chats

## Effort Justification

**M (Medium) — ~1 week (5 business days)**

- **UI toggle & visual indicator:** Sidebar component update, chat header badge (~1.5 days)
- **Memory-only store:** Zustand store or React Context for in-memory chats, bypass persistence logic (~1 day)
- **Persistence logic refactor:** Audit all places that write to IndexedDB; add check for Incognito flag (~1.5 days)
- **Clear-on-close logic:** Lifecycle hook on app/window close to clear memory store (~0.5 days)
- **Testing & QA:** E2E test: open Incognito → close app → reopen, verify no trace (~1 day)

**Why it's M and not S:**
- Requires understanding app's persistence layer (IndexedDB, Zustand, localStorage)
- Testing surface is large (multiple close/open scenarios, export edge cases)
- UI touches multiple components (Sidebar, ChatHeader, Settings)

**Why it's not L:**
- Doesn't require new backend logic (local-only feature)
- No cross-feature dependencies
- Clear scope and implementation path

## Alignment Gap

**Reference:** GAP003 (Incognito Mode Mentioned in README, Not Fully Implemented)

**Report excerpt:**
> "Margot explicitly uses Incognito Mode in success criteria ('Enable Incognito Mode for contract-related conversations'). The README advertises this feature prominently. Users will look for it, not find it, and assume the app is unfinished or less privacy-focused than claimed."

This proposal fully implements Incognito Mode, enabling Margot's use case and validating the README feature claim.

## Design Decisions

1. **Per-chat toggle vs. global mode:** Per-chat (more flexible; Margot can use Incognito for sensitive, normal mode for general questions)
2. **Clear-on-close vs. manual clear:** Both (automatic on close for convenience; manual clear button for control)
3. **Backend behavior:** Incognito chats still go through PII redaction and prompt review (same privacy pipeline, just different storage)

## UX Considerations

- **Margot's mental model:** "Incognito means this conversation disappears like my browser history"
- **Education needed:** Clarify that Incognito is about *persistence*, not *transmission*. Redaction and approval still happen.
- **Clear labeling:** Avoid confusion with "private mode" (which some might assume = no cloud sends). Incognito = memory-only, not network-only.

## Future Enhancement

- Post-v1: Option to set auto-expiry on Incognito chats (e.g., "forget this chat in 1 hour")
- Post-v1: Incognito chat encryption in memory (paranoia guard against memory dumps)
