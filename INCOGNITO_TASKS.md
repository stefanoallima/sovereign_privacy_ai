# Incognito Mode - Implementation Tasks & Checklist

## Task Breakdown

### T1: Type Updates
**Title**: Add `isIncognito` field to Conversation and LocalConversation types

**Description**:
Update type definitions to include the `isIncognito` flag which marks conversations that should not be persisted to IndexedDB.

**Dependencies**: None

**Files**:
- `apps/desktop/src/types/index.ts` - Update `Conversation` interface
- `apps/desktop/src/lib/db.ts` - Update `LocalConversation` interface

**SharedFiles**:
- None (types are already central)

**Effort**: S (Small)

**Acceptance Criteria**:
1. `Conversation.isIncognito?: boolean` exists in type definition
2. `LocalConversation.isIncognito?: boolean` exists in type definition
3. Default value is `undefined` (treated as `false`)
4. All existing code continues to work (backward compatible)
5. TypeScript compilation succeeds with no new errors

**Checklist**:
- [ ] Edit `apps/desktop/src/types/index.ts`
- [ ] Add `isIncognito?: boolean;` after `totalTokensUsed` in `Conversation` interface
- [ ] Edit `apps/desktop/src/lib/db.ts`
- [ ] Add `isIncognito?: boolean;` after `totalTokensUsed` in `LocalConversation` interface
- [ ] Run `pnpm build` to verify no type errors
- [ ] Commit: "feat(incognito): add isIncognito type field"

---

### T2: Zustand Store - Conditional Persistence Logic
**Title**: Update useChatStore to skip IndexedDB writes for incognito conversations

**Description**:
Modify all create/update/delete operations in the chat store to check the `isIncognito` flag before calling `dbOps.*` methods. This is the core of the feature.

**Dependencies**: T1

**Files**:
- `apps/desktop/src/stores/chat.ts` - Update store methods

**SharedFiles**:
- `apps/desktop/src/lib/db.ts` (referenced via imports)

**Effort**: M (Medium)

**Acceptance Criteria**:
1. `createConversation()` skips `dbOps.createConversation()` when `isIncognito: true`
2. `addMessage()` skips `dbOps.createMessage()` when conversation is incognito
3. `finalizeStreaming()` skips `dbOps.createMessage()` when conversation is incognito
4. `updateConversationTitle()` skips `dbOps.updateConversation()` when conversation is incognito
5. `deleteConversation()` skips `dbOps.deleteConversation()` when conversation is incognito
6. Incognito conversations still appear in Zustand state (UI works)
7. Normal conversations still write to IndexedDB (no regression)
8. All store selectors (getCurrentConversation, getCurrentMessages) work with incognito chats

**Checklist**:
- [ ] Read entire `useChatStore` function (line 128-636)
- [ ] Update `createConversation` method to pass `isIncognito` through and skip dbOps when true
- [ ] Update `addMessage` method to check `conv?.isIncognito` before dbOps.createMessage
- [ ] Update `updateConversationTitle` method to check `conv?.isIncognito` before dbOps.updateConversation
- [ ] Update `deleteConversation` method to check `conv?.isIncognito` before dbOps.deleteConversation
- [ ] Update `finalizeStreaming` method to check `conv?.isIncognito` before dbOps.createMessage
- [ ] Add unit test: incognito creation skips database
- [ ] Add unit test: incognito message skips database
- [ ] Run `pnpm test` (or relevant test command)
- [ ] Commit: "feat(incognito): skip IndexedDB persistence for incognito chats"

---

### T3: Sidebar - Incognito Chat Section & Button
**Title**: Add "New Incognito Chat" button and separate incognito chat section in sidebar

**Description**:
Update the Sidebar component to display a dedicated section for incognito conversations (with visual separation) and ensure the "New Incognito Chat" button is wired to `createConversation(..., true)`.

**Dependencies**: T2

**Files**:
- `apps/desktop/src/components/chat/Sidebar.tsx` - Update UI structure

**SharedFiles**:
- `apps/desktop/src/stores/chat.ts` (referenced via hooks)

**Effort**: M (Medium)

**Acceptance Criteria**:
1. "New Incognito Chat" button (EyeOff icon) calls `createConversation(..., ..., true)`
2. Incognito conversations are visually separated from normal/project chats
3. Incognito conversation rows display the EyeOff icon next to the title
4. Incognito section has a header: "[EyeOff] Incognito Chats"
5. Hovering over incognito items shows "Incognito — cleared on close" tooltip
6. Filtering/search still works (incognito chats are searchable)
7. No regression in normal chat listing

**Checklist**:
- [ ] Read Sidebar.tsx (observe current filtering logic around line 95-103)
- [ ] Verify `handleNewIncognitoChat` exists and calls `createConversation(..., true)`
- [ ] Review current incognito section rendering (lines 95-96)
- [ ] Ensure incognito conversations are rendered with EyeOff badge
- [ ] Add incognito section header with conditional rendering
- [ ] Update CSS classes for incognito items (badge styling)
- [ ] Add tooltip: "Incognito — cleared on close"
- [ ] Test: Click "New Incognito Chat" → conversation created with `isIncognito: true`
- [ ] Test: Incognito chat appears in "Incognito Chats" section
- [ ] Test: Normal chat still appears in "Quick Chats" section
- [ ] Commit: "ui(incognito): add sidebar section for incognito chats"

---

### T4: ChatHeader - Incognito Badge
**Title**: Display incognito badge in chat header

**Description**:
Add a visual indicator in the ChatHeader component that displays when the current conversation is incognito. Badge should include the EyeOff icon and explanatory text.

**Dependencies**: T2 (requires incognito flag in state)

**Files**:
- `apps/desktop/src/components/chat/ChatHeader.tsx` (or appropriate header component)

**SharedFiles**:
- `apps/desktop/src/stores/chat.ts` (referenced via selectors)

**Effort**: M (Medium)

**Acceptance Criteria**:
1. When viewing an incognito conversation, a badge appears above the title
2. Badge displays "[EyeOff] Incognito — This chat will be cleared when you close the app"
3. Badge has amber/warning background color: `bg-amber-500/20`
4. Badge has amber/warning text color: `text-amber-700 dark:text-amber-400`
5. Badge is non-interactive (read-only indicator)
6. Badge does not appear for normal conversations
7. Badge appears immediately when switching to incognito chat
8. Badge disappears immediately when switching to normal chat

**Checklist**:
- [ ] Find ChatHeader component (likely in `apps/desktop/src/components/chat/`)
- [ ] Use `useChatStore` hook to get `getCurrentConversation()`
- [ ] Add conditional render block:
  ```
  {currentConversation?.isIncognito && (
    <div className="flex items-center gap-2 mb-2 px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30">
      <EyeOff className="h-4 w-4 text-amber-700 dark:text-amber-400" />
      <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
        Incognito — This chat will be cleared when you close the app
      </span>
    </div>
  )}
  ```
- [ ] Ensure EyeOff icon is imported from lucide-react
- [ ] Test: Create incognito chat → verify badge appears
- [ ] Test: Switch to normal chat → verify badge disappears
- [ ] Test: Close and reopen app → verify badge is gone (chat deleted)
- [ ] Commit: "ui(incognito): add incognito badge to chat header"

---

### T5: App Lifecycle - Clear-on-Close Handler
**Title**: Implement window close handler to clear incognito conversations

**Description**:
Add a Tauri window lifecycle hook in the App component that triggers when the app window closes. Filter out all incognito conversations from the Zustand state to ensure they're not saved in localStorage.

**Dependencies**: T2 (requires incognito flag in state)

**Files**:
- `apps/desktop/src/App.tsx` - Add useEffect hook

**SharedFiles**:
- `apps/desktop/src/stores/chat.ts` (referenced via Zustand)

**Effort**: M (Medium)

**Acceptance Criteria**:
1. `window.onCloseRequested()` handler is registered in App component
2. Handler checks if any incognito conversations exist
3. If yes, filters them out of Zustand state before app closes
4. `currentConversationId` is reset to `null` if it was an incognito chat
5. Normal conversations are **not** affected
6. Handler runs silently (no dialog/confirmation)
7. Handler cleans up (unlistens) on component unmount
8. Reopening app shows zero incognito chats

**Checklist**:
- [ ] Read App.tsx to understand structure
- [ ] Import `getCurrentWebviewWindow` from `@tauri-apps/api/webviewWindow`
- [ ] Import `useChatStore` if not already imported
- [ ] Add useEffect hook that:
  - Calls `getCurrentWebviewWindow().onCloseRequested()`
  - In callback, checks `state.conversations.some(c => c.isIncognito)`
  - Calls `useChatStore.setState()` to filter out incognito
  - Resets `currentConversationId` if needed
  - Returns cleanup function (unlisten)
- [ ] Test: Create incognito chat → close app → reopen → verify gone
- [ ] Test: Create normal and incognito chats → close → reopen → normal still there, incognito gone
- [ ] Verify no console errors
- [ ] Commit: "feat(incognito): clear incognito chats on app close"

---

### T6: Export Block & UI Feedback
**Title**: Disable export for incognito conversations

**Description**:
Prevent users from exporting incognito conversations (JSON/CSV export). Show a tooltip or disabled state when export is attempted for incognito chats.

**Dependencies**: T2 (requires incognito flag in state)

**Files**:
- `apps/desktop/src/components/chat/ChatWindow.tsx` (or export button component)

**SharedFiles**:
- `apps/desktop/src/stores/chat.ts` (referenced via selectors)

**Effort**: S (Small)

**Acceptance Criteria**:
1. Export button is disabled when viewing incognito conversation
2. Tooltip shows: "Incognito chats cannot be exported"
3. Export button works normally for non-incognito chats
4. No regression in export functionality for normal chats
5. User cannot manually trigger export for incognito via API

**Checklist**:
- [ ] Find export button component (likely in ChatWindow or dedicated Export component)
- [ ] Use `useChatStore` to get `getCurrentConversation()`
- [ ] Add condition to disable export button: `currentConversation?.isIncognito`
- [ ] Add disabled class and tooltip
- [ ] Example: `disabled={currentConversation?.isIncognito} title="Incognito chats cannot be exported"`
- [ ] Test: Create incognito chat → verify export button is disabled
- [ ] Test: Create normal chat → verify export button is enabled
- [ ] Test: Click export on normal chat → works as before
- [ ] Commit: "ui(incognito): disable export for incognito chats"

---

### T7: Delete Conversation - Confirmation Update
**Title**: Update delete confirmation message for incognito chats

**Description**:
When user deletes an incognito conversation, show a contextual confirmation that emphasizes the permanent nature (no recovery from IndexedDB).

**Dependencies**: T2 (requires incognito flag in state)

**Files**:
- `apps/desktop/src/components/chat/Sidebar.tsx` (or delete confirmation dialog)

**SharedFiles**:
- `apps/desktop/src/stores/chat.ts` (referenced via hooks)

**Effort**: S (Small)

**Acceptance Criteria**:
1. Delete confirmation dialog appears when user clicks delete on incognito chat
2. Dialog message: "Are you sure? This incognito chat cannot be recovered."
3. Delete confirmation for normal chats remains unchanged
4. Confirming delete removes chat from state and sidebar
5. Canceling delete keeps chat

**Checklist**:
- [ ] Find delete confirmation dialog (likely in Sidebar or separate dialog component)
- [ ] Get current conversation from useChatStore
- [ ] Update dialog message based on `isIncognito` flag
- [ ] Example: 
  ```
  const message = currentConversation?.isIncognito
    ? "Are you sure? This incognito chat cannot be recovered."
    : "Are you sure? This conversation will be deleted."
  ```
- [ ] Test: Delete normal chat → shows original message
- [ ] Test: Delete incognito chat → shows incognito-specific message
- [ ] Test: Confirm delete → chat removed from sidebar
- [ ] Test: Cancel delete → chat still visible
- [ ] Commit: "ui(incognito): update delete confirmation for incognito chats"

---

### T8: Unit Tests - Store Persistence Logic
**Title**: Write unit tests for incognito persistence skipping

**Description**:
Create comprehensive unit tests verifying that incognito conversations skip all database operations.

**Dependencies**: T1, T2

**Files**:
- `apps/desktop/src/stores/__tests__/chat.test.ts` (new or existing)

**SharedFiles**:
- `apps/desktop/src/stores/chat.ts` (tested module)
- `apps/desktop/src/lib/db.ts` (mocked)

**Effort**: M (Medium)

**Acceptance Criteria**:
1. Test: `createConversation` with `isIncognito: true` skips `dbOps.createConversation()`
2. Test: `createConversation` with `isIncognito: false` calls `dbOps.createConversation()`
3. Test: `addMessage` in incognito chat skips `dbOps.createMessage()`
4. Test: `addMessage` in normal chat calls `dbOps.createMessage()`
5. Test: `deleteConversation` incognito skips `dbOps.deleteConversation()`
6. Test: `deleteConversation` normal calls `dbOps.deleteConversation()`
7. Test: `updateConversationTitle` incognito skips `dbOps.updateConversation()`
8. Test: `finalizeStreaming` incognito skips `dbOps.createMessage()`
9. All tests pass with >80% code coverage on store methods

**Checklist**:
- [ ] Create or update `apps/desktop/src/stores/__tests__/chat.test.ts`
- [ ] Set up test suite with mocked Dexie db
- [ ] Import `useChatStore`, mock `dbOps`
- [ ] Write test for createConversation incognito (verify spy not called)
- [ ] Write test for createConversation normal (verify spy called)
- [ ] Write test for addMessage incognito (verify spy not called)
- [ ] Write test for addMessage normal (verify spy called)
- [ ] Write test for deleteConversation incognito (verify spy not called)
- [ ] Write test for deleteConversation normal (verify spy called)
- [ ] Write test for updateConversationTitle incognito (verify spy not called)
- [ ] Write test for finalizeStreaming incognito (verify spy not called)
- [ ] Run tests: `pnpm test`
- [ ] Verify all tests pass
- [ ] Commit: "test(incognito): add unit tests for incognito persistence skipping"

---

### T9: E2E Test - Full Incognito Journey
**Title**: Write end-to-end test: Create incognito → Message → Close → Verify Gone

**Description**:
Create a complete E2E test covering the happy path: user creates incognito chat, sends a message, closes the app, reopens, and verifies the chat is gone.

**Dependencies**: T1, T2, T3, T4, T5

**Files**:
- `apps/desktop/src/__tests__/incognito.e2e.ts` (new)

**SharedFiles**:
- All components (tested via app)

**Effort**: L (Large)

**Acceptance Criteria**:
1. Test suite can launch the full app
2. Test: Click "New Incognito Chat" button
3. Test: Select "Margot" persona from dropdown
4. Test: Type message "Please review this contract for compliance"
5. Test: Send message and wait for response
6. Test: Verify incognito badge appears in chat header
7. Test: Verify message appears in chat history
8. Test: Close the app window
9. Test: Reopen the app
10. Test: Verify incognito chat does not appear in sidebar
11. Test: Verify normal chats still appear (no regression)
12. Test passes consistently (no flakes)

**Checklist**:
- [ ] Create `apps/desktop/src/__tests__/incognito.e2e.ts`
- [ ] Set up test infrastructure (Playwright, Tauri, etc.)
- [ ] Write test scenario:
  - Launch app
  - Click "New Incognito Chat"
  - Select persona
  - Type and send message
  - Wait for response
  - Verify badge visible
  - Verify message in history
  - Close window
  - Reopen app
  - Verify chat gone
  - Verify normal chats still there
- [ ] Run test: `pnpm test:e2e`
- [ ] Debug any failures (async timing, selectors, etc.)
- [ ] Verify test passes consistently (run 3x)
- [ ] Commit: "test(incognito): add E2E test for incognito journey"

---

### T10: Documentation & README Updates
**Title**: Document Incognito Mode in README and inline comments

**Description**:
Add high-level documentation of Incognito Mode to the project README and add inline code comments explaining the conditional persistence logic.

**Dependencies**: T1-T9 (all features complete)

**Files**:
- `apps/desktop/README.md` (or `CLAUDE.md`)
- `apps/desktop/src/stores/chat.ts` (inline comments)
- `apps/desktop/src/App.tsx` (inline comments)

**SharedFiles**:
- None

**Effort**: S (Small)

**Acceptance Criteria**:
1. README has a new "Incognito Mode" section explaining feature
2. Readme covers: what it is, how to use, when to use (Margot persona)
3. Readme notes that data is not saved to disk
4. Inline comments in `chat.ts` explain `isIncognito` checks
5. Inline comments in `App.tsx` explain window close handler
6. Documentation is clear and accessible to new contributors

**Checklist**:
- [ ] Open `apps/desktop/README.md` or root `CLAUDE.md`
- [ ] Add section:
  ```markdown
  ## Incognito Mode
  
  Incognito Mode provides memory-only chats that are automatically cleared when the app closes.
  
  ### When to Use
  - Legal contracts (Margot persona)
  - Sensitive personal information
  - Temporary discussions you don't want to retain
  
  ### How It Works
  - Incognito chats exist only in memory during the session
  - No data is written to IndexedDB or disk
  - Closing the app automatically clears all incognito conversations
  - PII redaction and anonymization still apply
  
  ### UI Indicators
  - Sidebar: EyeOff icon next to conversation title
  - Chat header: "Incognito" badge
  - Cannot export or share incognito chats
  ```
- [ ] Add inline comment in `chat.ts` createConversation:
  ```typescript
  // Skip persistence for incognito conversations
  if (!isIncognito) {
    await dbOps.createConversation(...);
  }
  ```
- [ ] Add inline comment in `App.tsx` onCloseRequested:
  ```typescript
  // Clear all incognito conversations when app window closes
  // to ensure no memory-only data persists across sessions
  ```
- [ ] Review for clarity and completeness
- [ ] Commit: "docs(incognito): add documentation and inline comments"

---

### T11: Code Review & Bug Fixes
**Title**: Address code review feedback and fix any bugs

**Description**:
Participate in code review, fix issues identified by reviewers, and ensure all tests continue to pass.

**Dependencies**: T1-T10 (all tasks complete)

**Files**:
- All files modified in T1-T10

**SharedFiles**:
- N/A

**Effort**: M (Medium, depending on review feedback)

**Acceptance Criteria**:
1. All code review comments are addressed
2. All identified bugs are fixed
3. All tests pass (unit, integration, E2E)
4. No regressions in existing functionality
5. Code is merged to main branch

**Checklist**:
- [ ] Request code review from @stefanoallima
- [ ] Address all comments
- [ ] Re-run tests after changes
- [ ] Commit fixes: "fix(incognito): address review feedback"
- [ ] Merge to main

---

## Implementation Order

**Critical Path**:
1. T1 (Types) → Foundation
2. T2 (Store Logic) → Core feature
3. T3 (Sidebar UI) → User-facing
4. T4 (ChatHeader Badge) → User-facing
5. T5 (App Close Handler) → Core feature
6. T6-T7 (Export & Delete UI) → Polish
7. T8-T9 (Tests) → Validation
8. T10 (Docs) → Knowledge
9. T11 (Review) → Merge

**Parallel Work** (can run simultaneously after T2):
- T3, T4, T6, T7 (UI components don't block each other)
- T8 (unit tests can write against T2 even as T3-T7 develop)

**Estimated Total Effort**: 1 week (7 days, ~40 hours)
- T1: 2 hours
- T2: 6 hours (includes testing and debugging)
- T3: 4 hours
- T4: 3 hours
- T5: 4 hours
- T6: 1.5 hours
- T7: 1 hour
- T8: 6 hours (comprehensive tests)
- T9: 8 hours (E2E can be tricky)
- T10: 2 hours
- T11: 3-5 hours (depends on review)

## Definition of Done

All tasks must satisfy:
- [ ] Code is written and peer-reviewed
- [ ] Tests pass (unit, integration, E2E)
- [ ] No regression in existing features
- [ ] Documentation is updated
- [ ] Commits follow project conventions
- [ ] Feature works end-to-end on Windows (Tauri)
- [ ] Works for Margot persona (primary use case)
- [ ] Branch is merged to main
