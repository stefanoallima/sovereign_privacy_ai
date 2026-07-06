# Tasks: Incognito Mode

## Overview

11 tasks split across store refactoring, UI components, testing, and documentation. Critical path: T1 → T2 → (T3-T7 parallel) → T8-T9 → T10-T11.

---

## T1: Create Zustand Incognito Store Slice

**Size:** S  
**Effort:** 1 day  
**Dependencies:** None  
**Files:**
- `src/store/incognito.ts` (NEW)
- `src/store/index.ts` (MODIFY to export incognitoStore)

**Acceptance Criteria:**
- [ ] `incognitoStore` exports: `addChat`, `updateChat`, `removeChat`, `getChat`, `getAllChats`, `clearAll`, `setDefaultToIncognito`
- [ ] Store holds `chats: Record<string, IncognitoChat>` and `defaultToIncognito: boolean`
- [ ] All actions update state immutably
- [ ] TypeScript types are correct (extends Chat, includes `isIncognito: true`)
- [ ] Can be imported and used in tests without errors

**Implementation Checklist:**
```typescript
// src/store/incognito.ts
interface IncognitoChat extends Chat {
  isIncognito: true;
}

interface IncognitoStore {
  chats: Record<string, IncognitoChat>;
  defaultToIncognito: boolean;
  addChat: (chat: IncognitoChat) => void;
  updateChat: (id: string, updates: Partial<IncognitoChat>) => void;
  removeChat: (id: string) => void;
  getChat: (id: string) => IncognitoChat | null;
  getAllChats: () => IncognitoChat[];
  clearAll: () => void;
  setDefaultToIncognito: (enabled: boolean) => void;
}

export const incognitoStore = create<IncognitoStore>((set, get) => ({
  // implement all actions
}));
```

---

## T2: Modify chatStore to Route on isIncognito

**Size:** S  
**Effort:** 1 day  
**Dependencies:** T1  
**Files:**
- `src/store/chatStore.ts` (MODIFY)

**Acceptance Criteria:**
- [ ] `saveChat()` checks `if (chat.isIncognito)` before writing to IndexedDB
- [ ] Incognito chats routed to `incognitoStore.addChat()`
- [ ] Normal chats still persist to IndexedDB (no regression)
- [ ] `deleteChat()` handles both Incognito and normal deletion
- [ ] Existing tests still pass (regression check)

**Implementation Checklist:**
- [ ] Find `saveChat()` function in chatStore.ts
- [ ] Add conditional: `if (chat.isIncognito) { incognitoStore.addChat(chat); return; }`
- [ ] Update `deleteChat()` to check incognitoStore first
- [ ] Test with unit tests (T8)

---

## T3: Add Incognito Toggle to Sidebar

**Size:** M  
**Effort:** 1.5 days  
**Dependencies:** T1, T2  
**Files:**
- `src/components/Sidebar/ChatList.tsx` (MODIFY)
- `src/styles/Sidebar.module.css` (MODIFY)

**Acceptance Criteria:**
- [ ] Checkbox/toggle button appears next to each chat in Sidebar
- [ ] Toggle shows 🕵️ icon (or 🔒 icon if preferred)
- [ ] Clicking toggle calls `toggleIncognito(chatId)` action
- [ ] Incognito chats have visual distinction (faded or different background color)
- [ ] Toggle state reflects current `chat.isIncognito` flag

**Implementation Details:**
- [ ] Add CSS class for Incognito styling (opacity: 0.7 or border-left color)
- [ ] Bind toggle to Zustand action that calls `chatStore.update()`
- [ ] Update on click should be instant (no API call)

---

## T4: Add Incognito Badge to Chat Header

**Size:** S  
**Effort:** 0.5 days  
**Dependencies:** T1  
**Files:**
- `src/components/ChatHeader.tsx` (MODIFY)
- `src/styles/ChatHeader.module.css` (MODIFY)

**Acceptance Criteria:**
- [ ] 🕵️ Incognito badge appears in ChatHeader when `chat.isIncognito === true`
- [ ] Badge text reads: "🕵️ Incognito Mode" or similar
- [ ] Tooltip on hover explains: "Memory-only. Vanishes on close."
- [ ] Badge is styled distinctly (e.g., orange or red background)
- [ ] Normal chats show no badge

---

## T5: Add Incognito Settings Toggle

**Size:** S  
**Effort:** 1 day  
**Dependencies:** T1  
**Files:**
- `src/components/Settings/SettingsPanel.tsx` (MODIFY)
- `src/styles/Settings.module.css` (MODIFY)

**Acceptance Criteria:**
- [ ] New toggle in Settings: "Default to Incognito for new chats"
- [ ] Toggle is bound to `incognitoStore.setDefaultToIncognito()`
- [ ] Help text explains the setting: "All new conversations start in Incognito Mode if enabled"
- [ ] Clicking toggle updates store (persisted in normal settings, not Incognito-protected)
- [ ] Default value is `false`

---

## T6: Implement Clear-on-Close Logic

**Size:** S  
**Effort:** 0.5 days  
**Dependencies:** T1  
**Files:**
- `src/App.tsx` (MODIFY)

**Acceptance Criteria:**
- [ ] On Tauri window close event, `incognitoStore.clearAll()` is called
- [ ] All Incognito chats are removed from memory
- [ ] Cleanup happens before app actually closes
- [ ] No dialog or confirmation shown (silent cleanup)

**Implementation Checklist:**
```typescript
// In App.tsx or useEffect
const unlisten = await appWindow.onCloseRequested(async (event) => {
  incognitoStore.clearAll();
  appWindow.close();
});
```

---

## T7: Add Manual Clear Button

**Size:** S  
**Effort:** 0.5 days  
**Dependencies:** T1, T3  
**Files:**
- `src/components/Sidebar/ChatContextMenu.tsx` (MODIFY or NEW)
- `src/styles/ContextMenu.module.css` (MODIFY)

**Acceptance Criteria:**
- [ ] Right-click on Incognito chat shows context menu
- [ ] Menu includes "Clear Incognito Chat" option (only for Incognito chats)
- [ ] Clicking removes chat from memory immediately
- [ ] Chat disappears from sidebar
- [ ] No confirmation dialog (intentional: zero trace)

---

## T8: Write Unit & Integration Tests

**Size:** M  
**Effort:** 1.5 days  
**Dependencies:** T1, T2, T3, T4, T5, T6, T7  
**Files:**
- `src/store/incognito.test.ts` (NEW)
- `src/store/chatStore.test.ts` (MODIFY)
- `src/components/Sidebar/ChatList.test.tsx` (NEW or MODIFY)
- `src/components/ChatHeader.test.tsx` (NEW or MODIFY)

**Acceptance Criteria:**
- [ ] Unit tests for all incognitoStore actions (add, update, remove, clearAll)
- [ ] Integration test: normal chat persists to IndexedDB
- [ ] Integration test: Incognito chat stays in memory only
- [ ] Integration test: export normal chat succeeds
- [ ] Integration test: export Incognito chat throws error
- [ ] Component tests: toggle fires correct action
- [ ] Component tests: badge renders when isIncognito
- [ ] All tests pass locally

**Test Cases:**
```
incognitoStore:
- addChat / updateChat / removeChat work
- clearAll() empties chats
- defaultToIncognito toggle works
- getChat returns correct chat or null

chatStore.saveChat:
- Normal chat goes to IndexedDB
- Incognito chat goes to incognitoStore
- Normal chat persists after close/reopen
- Incognito chat gone after close/reopen

Components:
- Toggle button renders
- Clicking toggle calls store action
- Badge appears for Incognito chats
- Settings panel toggle works
```

---

## T9: Write E2E Test (Playwright)

**Size:** M  
**Effort:** 1 day  
**Dependencies:** T3, T4, T6, T8  
**Files:**
- `apps/desktop/src/__tests__/e2e/incognito.test.ts` (NEW)

**Acceptance Criteria:**
- [ ] E2E test runs against dev server or built app
- [ ] Test creates Incognito chat
- [ ] Test sends message with sensitive data
- [ ] Test verifies prompt review modal works
- [ ] Test closes and reopens app
- [ ] Test verifies Incognito chat is GONE
- [ ] Test opens DevTools and inspects IndexedDB (verifies no records)
- [ ] Test creates normal chat and verifies it persists (regression check)

**E2E Test Pseudocode:**
```typescript
test('Incognito chat vanishes on close', async ({ page, context }) => {
  // 1. Open app
  // 2. Create new chat
  // 3. Toggle Incognito ON (see badge)
  // 4. Send message "Review this: [contract clause]"
  // 5. Verify prompt review modal appears
  // 6. Approve send
  // 7. Verify response received
  // 8. Close app (context.close())
  // 9. Reopen app
  // 10. Verify Incognito chat not in history
  // 11. Open DevTools → IndexedDB
  // 12. Verify chat collection has 0 Incognito records
});
```

---

## T10: Documentation & README Update

**Size:** S  
**Effort:** 0.5 days  
**Dependencies:** T3, T4, T5  
**Files:**
- `README.md` (MODIFY)
- New section: `docs/INCOGNITO_MODE.md` (NEW, optional)

**Acceptance Criteria:**
- [ ] README updated: "Incognito Mode" section explains feature
- [ ] Section explains: per-chat toggle, memory-only, vanishes on close
- [ ] Clarifies PII redaction still applies (not about transmission, about persistence)
- [ ] Example: "Review contracts in Incognito Mode; conversations disappear when you close the app"
- [ ] In-app help text updated (Settings tooltip)

**Documentation Content:**
```markdown
## Incognito Mode

Enable Incognito Mode for conversations you want to keep completely private and local.

- **Memory-only storage:** Conversations are stored in RAM only, not on disk
- **Vanish on close:** Close the app → Incognito chats disappear automatically
- **PII redaction still applies:** Your sensitive data is still anonymized before cloud sends
- **Perfect for:** Reviewing client documents, legal contracts, health information

### How to use:
1. Create a new chat
2. Toggle 🕵️ in the Sidebar to enable Incognito Mode
3. Converse normally (PII redaction + prompt review work as usual)
4. Close the app when done → conversation is gone

### What persists:
- Only your explicit decisions (app settings) persist
- The chat history and messages do NOT persist

### What about security?
- Incognito Mode is about *local persistence*, not *cloud transmission*
- Your PII is still redacted before sending to the cloud
- See Prompt Review to verify what's being sent
```

---

## T11: Code Review & Cleanup

**Size:** S  
**Effort:** 0.5 days  
**Dependencies:** T8, T9, T10  
**Files:**
- All modified files (review for consistency, type safety, performance)

**Acceptance Criteria:**
- [ ] All code follows project style guide (TypeScript, React conventions)
- [ ] No console.log or debug code left behind
- [ ] No type errors (`npm run type-check`)
- [ ] No lint errors (`pnpm lint` for changed files)
- [ ] Performance acceptable (no memory leaks in incognitoStore)
- [ ] Error messages are user-friendly
- [ ] Accessibility: ARIA labels on toggle, badge accessible to screen readers

**Checklist:**
- [ ] Type safety: no `any` types
- [ ] Error handling: graceful fallbacks if store fails
- [ ] Memory leak check: incognitoStore doesn't leak references
- [ ] Test coverage > 80%
- [ ] All E2E tests pass
- [ ] No regressions in normal chat functionality

---

## Implementation Order

**Phase 1 (Foundation):** T1 → T2 (store layer)  
**Phase 2 (UI & Logic):** T3 → T7 (components + behaviors, can run parallel after T1-T2)  
**Phase 3 (Testing):** T8 → T9 (unit/integration + E2E)  
**Phase 4 (Polish):** T10 → T11 (docs + review)

**Estimated Timeline:**
- T1-T2: 2 days (foundation)
- T3-T7: 4 days (parallel, ~1-1.5 days each)
- T8-T9: 2.5 days (testing)
- T10-T11: 1 day (docs + review)
- **Total: ~9-10 days** (aligns with M estimate)

---

## Definition of Done

- [ ] All 11 tasks completed and merged
- [ ] All tests pass (unit + integration + E2E)
- [ ] No regressions in normal chat functionality
- [ ] Margot use case validated (can use Incognito for contracts, verify no trace)
- [ ] README and in-app help updated
- [ ] Code reviewed and approved
- [ ] Ready for shipping in next release
