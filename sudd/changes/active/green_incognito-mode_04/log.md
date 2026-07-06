# Log: Incognito Mode

**Created:** 2026-06-23 (task-discoverer)  
**Status:** Planning (Phase 2 of 4)

## Discovery Summary

Priority 2 feature gap: Incognito Mode is advertised in README but not fully implemented. Only a reference in Sidebar.tsx. Margot's use case depends on this feature for contract-related conversations.

## Planning Phase (2026-06-23 continuation)

### Persona Created
- **Margot** — Legal advisor who reviews sensitive contracts and needs zero trace of conversations
- Use case: "I need to review client contracts in Incognito Mode, close the app, and have zero trace left behind"
- Deal-breakers: Raw contract text in storage, unclear Incognito indicator, Incognito disables PII redaction

### Specs Document (specs.md)
- Storage model: In-memory Zustand slice for Incognito chats, normal IndexedDB for regular chats
- UI toggle in Sidebar per-chat, badge (🕵️) in ChatHeader
- Persistence bypass: Single conditional gate in `saveChat()`
- Clear-on-close via Tauri window lifecycle hook
- PII redaction still applies (storage difference, not transmission difference)
- Settings toggle for "Default to Incognito for new chats"
- 10 acceptance criteria covering all user-facing functionality

### Design Document (design.md)
- High-level architecture diagram: two paths (normal → IndexedDB, Incognito → RAM)
- Core design: Single conditional in `saveChat()` routes based on `isIncognito` flag
- Zustand store refactor: New `incognitoStore` slice for in-memory chats
- Component changes: ChatList toggle, ChatHeader badge, SettingsPanel toggle, App lifecycle hook
- Testing strategy: Unit + Integration + E2E (Playwright)
- Margot's success path documented end-to-end
- Known limitations (v1): No mid-conversation toggle, no export, no in-memory encryption
- Files modified: 8 total (1 new, 7 modified)

### Tasks Document (tasks.md)
- 11 tasks T1–T11 with clear dependencies
- Critical path: T1 (store) → T2 (routing) → T3–T7 (UI, parallel) → T8–T9 (tests) → T10–T11 (docs + review)
- Effort: ~9–10 days (M estimate confirmed)
- Each task has detailed acceptance criteria, implementation checklist, file list
- Definition of done: All tests pass, no regressions, Margot use case validated

## Architecture Review (Step 4b) — COMPLETED

**Peer review conducted on design.md, specs.md, tasks.md**

### Issues Found & Fixed
1. **Error handling gaps** → Added try-catch on clear-on-close, fallback to IndexedDB if store unavailable
2. **State management coupling** → Moved `defaultToIncognito` from incognitoStore to settingsStore
3. **API contracts undefined** → All incognitoStore functions now have explicit error contracts (throw vs. return null vs. silently succeed)
4. **Toggle validation** → Cannot toggle mid-conversation (throws error if messages exist)
5. **Conversation type** → `isIncognito: boolean` is now non-optional (was `isIncognito?: boolean`)

### Result: APPROVED (after revisions)
- Design is conceptually sound
- Critical gaps addressed before implementation
- Ready for design-gate validation

## Design-Gate (Step 4c) — COMPLETED (FAILED — 53.6/100)

**Margot persona validation results:**

### Score Breakdown
- Objective Coverage: 70/100 (toggle works, but clear-on-close handler missing)
- Deal-Breaker Check: 67/100 (raw data stays local ✓, but header badge missing ✗)
- Usability: 32.5/100 (sidebar button visible, but no header badge or help text)
- Trust: 45/100 (architecture is clear, but no user documentation)
- **Average: 53.6/100 → FAIL (≥70 required)**

### Critical Implementation Gaps (Must Fix Before Merge)
1. **ChatHeader Incognito Badge** — MISSING
   - Design T4 not fully implemented
   - Users see no visual confirmation in main chat area
   - Margot needs to see 🕵️ badge in ChatHeader when incognito is ON
   - Estimated effort: 2 hours

2. **Clear-on-Close Handler** — MISSING
   - Design section "Clear-on-Close Logic" specifies `window.onCloseRequested()` hook
   - Currently relies on OS memory cleanup, not guaranteed
   - Margot needs explicit code that clears incognito chats when app closes
   - Estimated effort: 3 hours

3. **User-Facing Documentation** — MISSING
   - No README section explaining Incognito Mode
   - No tooltip help text
   - No inline code comments
   - Margot cannot understand what Incognito does without reading design docs
   - Estimated effort: 1 hour

4. **Usability Improvements** — NEEDED
   - Improve sidebar button tooltip
   - Add "Cannot convert normal → incognito" UI hint
   - Estimated effort: 1 hour

### Why It Failed (Margot's Perspective)
"I see the sidebar has an Incognito button, but when I open an incognito chat, the main header is blank. I can't visually confirm Incognito Mode is on. I don't see code that clears the data when I close the app. There's no documentation explaining what 'Incognito' means. The architecture is solid, but I can't trust this with real client contracts until these gaps are filled."

### Impact on Build Phase
- Proceed to build with tasks T1–T11 as defined
- **Validation Squad (Step 5.3h)** will flag these gaps → architect escalation → fixes required before merge
- **Estimated rework:** 7–8 hours to implement missing features
- **Retry count:** Will increase if validation squad finds these gaps

### Margot's Confidence Level
- Current: 20% (too many unknowns)
- After fixes: 95% (would trust with real contracts)

### Next Action
Proceed to build phase (Step 5) with understanding that validation squad will catch and escalate these implementation gaps.
