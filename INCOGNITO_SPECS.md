# Incognito Mode - Technical Specifications

## Overview

Incognito Mode provides a privacy-first chat experience where conversations and messages exist only in memory and are automatically cleared when the application closes or the conversation is explicitly deleted. This feature is designed for sensitive use cases like contract review (Margot persona), legal consultation, and other scenarios where zero persistence is required.

## Core Requirements

### 1. Storage Architecture

#### In-Memory Storage (Primary)
- Incognito conversations and messages live **only in the Zustand store's JavaScript heap**, not in IndexedDB
- No writes to disk, filesystem, or any persistent storage mechanism
- Messages exist only for the current session
- No reconstruction from IndexedDB on app restart

#### Persistent Storage Exclusion
Incognito chats bypass:
- `LocalConversation` writes to `db.conversations` table
- `LocalMessage` writes to `db.messages` table
- Canvas documents linked to incognito conversations are **not saved**
- Form fills from incognito conversations are **not saved**
- Export/archive of incognito chats is **blocked** (except in-memory export during active session)

#### Storage Flag
- Add `isIncognito: boolean` field to:
  - `Conversation` interface (already present in types/index.ts)
  - `LocalConversation` interface (add to lib/db.ts)
- Check this flag before every `dbOps.*` call that would persist data

### 2. Chat Toggle Mechanism

#### User Interface
- **Sidebar**: Add toggle button next to "New Chat" button
  - Icon: `EyeOff` (already visible in updated Sidebar.tsx)
  - Label: "New Incognito Chat"
  - Tooltip: "Memory-only, cleared on close"
  - Action: Click to create incognito conversation
  - Visual state: Toggle shows when disabled (locked/blurred)

#### Chat Header Badge
- Display incognito indicator in ChatHeader above the conversation title
  - Icon: `EyeOff` with label "Incognito"
  - Background: Subtle red/amber warning color
  - Always visible when conversation is in incognito mode
  - Non-interactive (read-only indicator)

#### Per-Conversation Toggle (Future v2)
- Ability to toggle existing normal chat to incognito mode **after creation** (not in v1)
- For v1: incognito mode is set at chat creation and immutable

### 3. Persistence Layer

#### Current Flow (Normal Chats)
```
createConversation()
  → dbOps.createConversation() → IndexedDB
  
addMessage()
  → dbOps.createMessage() → IndexedDB
  
deleteConversation()
  → dbOps.deleteConversation() → IndexedDB
```

#### New Flow (Incognito Chats)
```
createConversation(personaId, modelId, projectId, isIncognito=true)
  → Skip dbOps.createConversation() if isIncognito
  → Add to Zustand state only
  
addMessage() 
  → Check conv.isIncognito before dbOps.createMessage()
  → Skip database write if incognito
  → Add to Zustand state only
  
updateConversationTitle()
  → Skip dbOps.updateConversation() if incognito
  → Update state only
  
deleteConversation()
  → Skip dbOps.deleteConversation() if incognito
  → Remove from state immediately (no soft delete)
  
finalizeStreaming()
  → Skip dbOps.createMessage() if incognito
  → Add to state only
```

#### Conditional Persistence Logic
Every `dbOps.*` call in `useChatStore` must check:
```typescript
const conv = get().conversations.find(c => c.id === conversationId);
if (!conv?.isIncognito) {
  await dbOps.updateConversation(...);
}
```

### 4. Clear-on-Close Logic

#### App Close Trigger
Incognito conversations are cleared when:

1. **User closes the application window** (Tauri window close event)
   - Triggered by window close button (X) or Cmd+Q / Alt+F4
   - Tauri hook: `getCurrentWebviewWindow().onCloseRequested()`
   - Action: Filter out incognito conversations from Zustand state
   - No alert/confirmation (silent cleanup)

2. **User explicitly closes conversation** (manual delete)
   - Delete button in conversation right-click menu
   - Confirmation dialog: "Clear this incognito chat?" (brief)
   - Action: Immediate removal from state

3. **App crashes or force-quit**
   - Incognito data is lost (expected behavior)
   - No recovery mechanism (by design)

#### Session Persistence (localStorage)
- Zustand's `persist` middleware only saves `currentConversationId`
- `currentConversationId` pointing to an incognito conversation will be cleared on app restart
  - On re-open, if `currentConversationId` points to a conversation that doesn't exist, reset to `null`
- Full conversation and message data is loaded from IndexedDB on init
  - Incognito data won't exist in IndexedDB, so it won't be loaded

#### Window Lifecycle Hook
Location: `src/App.tsx` (main component)
```typescript
useEffect(() => {
  const unlisten = getCurrentWebviewWindow().onCloseRequested(async (event) => {
    const state = useChatStore.getState();
    const incognitoConversations = state.conversations.filter(c => c.isIncognito);
    
    if (incognitoConversations.length > 0) {
      // Clear incognito conversations from state (no UI needed)
      useChatStore.setState((prev) => ({
        conversations: prev.conversations.filter(c => !c.isIncognito),
        currentConversationId: prev.currentConversationId?.startsWith?.('incog-') ? null : prev.currentConversationId,
      }));
    }
  });
  return () => unlisten.then(fn => fn());
}, []);
```

### 5. Export / Import Handling

#### Export Restrictions
- **Block export** of incognito conversations to JSON/CSV
- Rationale: User explicitly chose "no persistence"; exporting would violate that choice
- UI feedback: Disable export button or show "Incognito chats cannot be exported" tooltip

#### In-Session Export (Allowed)
- User can manually copy/paste conversation text during the session
- User can manually create a canvas document and save it (separate feature)
- Once export is triggered, user loses the incognito property (intentional)

#### Import Handling
- Imported conversations are always **normal** (non-incognito)
- No option to mark imported conversations as incognito
- Rationale: Import implies persistence intent

### 6. Integration with PII Redaction Pipeline

#### Anonymization Still Applies
- PII detection (GLiNER) runs normally for incognito chats
- Attribute extraction works normally
- Redaction for cloud APIs applies normally
- Difference: Results are not saved, but they are still applied

#### Persona Privacy Levels
| Persona | Privacy Level | Incognito Support | Notes |
|---------|---------------|-------------------|-------|
| Margot (Legal) | local-only / hybrid | Yes ✓ | Primary use case |
| Tax Navigator | local-only | Yes ✓ | Highly sensitive |
| Financial Advisor | hybrid | Yes ✓ | Optional PII vault |
| Real Estate Advisor | hybrid | Yes ✓ | Requires anonymization |
| Cybersecurity Advisor | local-only | Yes ✓ | Maximum privacy |
| Immigration Advisor | hybrid | Yes ✓ | Requires PII vault |
| All others | hybrid | Yes ✓ | Anonymization optional |

#### Flow
```
User Message (Incognito)
  → PII Detection (GLiNER)
  → Attribute Extraction
  → Cloud API Call (if enabled)
    → Redaction applied
    → API response
  ← Response message
  → Zustand store (no IndexedDB save)
```

#### PII Vault Interaction
- Incognito chats can use the PII Vault (user's confirmed PII list)
- Vault itself is **persistent** and remains after incognito chat closes
- Rationale: Vault is a privacy tool, not conversation-specific

### 7. Visual Indicators and UI Changes

#### Sidebar
- Incognito conversations appear in a separate section or with a distinct badge
- Icon: `EyeOff` next to the conversation title
- Color: Subtle amber/red text or background
- Hover state: Show "Incognito — cleared on close"

#### Chat Header
- Large "Incognito" badge with `EyeOff` icon above conversation title
- Background: `bg-amber-500/20` or `bg-red-500/20`
- Text: `text-amber-700` or `text-red-700`
- Example: `[EyeOff] Incognito — This chat will be cleared when you close the app`

#### Message Bubbles
- No visual change (chats are already in memory)
- Optional: Add subtle watermark or faded styling (defer to v2 if design allows)

#### Settings
- Add checkbox: "Default to Incognito mode" (optional, future)
- Checkbox: "Confirm before closing if Incognito chats exist" (optional, future)

#### Right-Click Menu (Conversation)
- Add "Clear this chat" or "Delete" option (already exists)
- Confirmation: "Are you sure? This incognito chat cannot be recovered."

## Non-Functional Requirements

### Performance
- In-memory storage should be faster than IndexedDB (acceptable)
- No performance degradation for normal chats
- Clearing on app close should be instant

### Security
- No incognito data written to disk
- No cache files in `%APPDATA%` or `/tmp`
- Memory is cleared when app exits (OS-level, not app-controlled)

### Testing
- Unit tests: Store operations with `isIncognito: true` skip database calls
- Integration tests: App close clears all incognito conversations
- E2E tests: Create incognito chat → add messages → close app → reopen → chat gone

### Backwards Compatibility
- Existing conversations remain normal (no auto-migration)
- `isIncognito: undefined` treated as `false`
- localStorage migration: If `currentConversationId` points to missing conversation, reset to `null`

## Edge Cases

### What Happens If...

| Scenario | Behavior |
|----------|----------|
| User switches to normal chat, then back to incognito | State preserved, both chats exist |
| User closes incognito chat window (multi-window) | Only that window's incognito data lost |
| User has multiple incognito chats open | All cleared on app close |
| User tries to import an incognito chat | Import rejected or imported as normal chat |
| User disables localStorage persistence | Incognito chats still cleared on close (correct) |
| IndexedDB fails during app load | App still boots, incognito chats work (memory-only) |
| User has 100 incognito messages in memory | No DB bloat, memory footprint only |

## Success Criteria

1. ✓ Incognito conversations don't write to IndexedDB
2. ✓ Incognito messages don't write to IndexedDB
3. ✓ Chat header displays incognito badge
4. ✓ Sidebar shows incognito icon next to conversation title
5. ✓ App close clears all incognito conversations
6. ✓ User cannot export incognito chats
7. ✓ PII redaction pipeline works for incognito chats
8. ✓ Margot persona can use incognito mode
9. ✓ No performance impact on normal chats
10. ✓ E2E test: Create → Message → Close → Reopen → Verify Gone
