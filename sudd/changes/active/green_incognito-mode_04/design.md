# Design: Incognito Mode

## High-Level Architecture

```
Normal Chat Flow:                Incognito Chat Flow:
─────────────────                ─────────────────
User message
  ↓
PII Detection (GLiNER)
  ↓
Anonymize to categories
  ↓
Prompt Review Modal
  ↓
User approves
  ↓
Send to Cloud LLM           →   Send to Cloud LLM (same)
  ↓                             ↓
Receive response            →   Receive response (same)
  ↓                             ↓
Save to IndexedDB               Store only in RAM
  ↓                             (Zustand in-memory slice)
Persist in history          ×   NO PERSISTENCE
```

**Key insight:** The only difference is the final persistence step. Everything else (redaction, review, cloud send) is identical.

## Core Design Decision

**Single responsibility principle:** A single conditional `if (chat.isIncognito)` gate controls whether a chat bypasses IndexedDB. This gate lives in exactly one place in the codebase (the `saveChat()` function in `chatStore.ts`).

```typescript
// src/store/chatStore.ts (pseudocode)
const saveChat = async (chat: Chat) => {
  if (chat.isIncognito) {
    // Route to in-memory store
    incognitoStore.addIncognitoChat(chat);
    return;
  }
  // Normal path: persist to IndexedDB
  await db.chats.put(chat);
};
```

All other code remains unchanged. Components don't need to know if a chat is Incognito; they just call `saveChat()` and the store handles routing.

## Component Architecture

### Zustand Store Refactor

**New slice: `incognitoStore`** (in-memory chats ONLY; no settings)
```typescript
// src/store/incognito.ts
interface IncognitoChat extends Conversation {
  isIncognito: true;  // Enforced at type level
}

interface IncognitoStore {
  // In-memory storage (cleared on app close)
  chats: Record<string, IncognitoChat>;
  
  // Actions (explicit error contracts below)
  addChat: (chat: IncognitoChat) => void;
  updateChat: (id: string, updates: Partial<IncognitoChat>) => void;
  removeChat: (id: string) => void;
  getChat: (id: string) => IncognitoChat | null;
  getAllChats: () => IncognitoChat[];
  clearAll: () => void;
}

// Explicit error contracts for each function
export const incognitoStore = create<IncognitoStore>((set, get) => ({
  chats: {},
  
  // Throws if chat with same ID already exists
  addChat: (chat) => {
    const state = get();
    if (state.chats[chat.id]) {
      throw new Error(`Incognito chat ${chat.id} already exists`);
    }
    set(s => ({ chats: { ...s.chats, [chat.id]: chat } }));
  },
  
  // Returns silently if chat not found (idempotent)
  removeChat: (id) => {
    set(s => {
      const newChats = { ...s.chats };
      delete newChats[id];
      return { chats: newChats };
    });
  },
  
  // Returns null if not found (never throws)
  getChat: (id) => get().chats[id] || null,
  
  // Returns all chats (empty array if none)
  getAllChats: () => Object.values(get().chats),
  
  // Clears all chats (never throws; used on app close)
  clearAll: () => set({ chats: {} }),
  
  // Throws if chat not found
  updateChat: (id, updates) => {
    const state = get();
    const existing = state.chats[id];
    if (!existing) {
      throw new Error(`Incognito chat ${id} not found`);
    }
    set(s => ({
      chats: { ...s.chats, [id]: { ...existing, ...updates } }
    }));
  },
}));
```

**Modify existing `chatStore`** (with error handling and validation)
```typescript
// src/store/chatStore.ts
const saveChat = async (chat: Chat) => {
  // Validate: cannot toggle Incognito mid-conversation
  const existing = get().conversations.find(c => c.id === chat.id);
  if (existing && existing.isIncognito !== chat.isIncognito) {
    throw new Error("Cannot toggle Incognito mid-conversation. Create a new chat instead.");
  }
  
  if (chat.isIncognito) {
    try {
      if (!incognitoStore) {
        console.error("IncognitoStore not available, falling back to IndexedDB");
        await db.conversations.put(chat);
        return;
      }
      incognitoStore.addChat(chat);
    } catch (err) {
      console.error("Failed to save to Incognito store:", err);
      throw new Error("Could not save conversation in Incognito mode. Try normal mode.");
    }
    return;
  }
  
  // Normal path: persist to IndexedDB
  await db.conversations.put(chat);
};

const deleteChat = async (id: string) => {
  const inMemory = incognitoStore.getChat(id);
  if (inMemory) {
    incognitoStore.removeChat(id);
    return;
  }
  // Existing deletion logic
  await db.conversations.delete(id);
};

// New function: toggle Incognito (validation + error handling)
const toggleIncognito = (chatId: string, newIsIncognito: boolean) => {
  const chat = get().conversations.find(c => c.id === chatId);
  if (!chat) {
    throw new Error(`Chat ${chatId} not found`);
  }
  
  // Validation: v1 does NOT allow toggle if messages exist
  if (chat.messages && chat.messages.length > 0) {
    throw new Error("Cannot toggle Incognito Mode after messages are sent. Create a new chat instead.");
  }
  
  // Call updateChat in the appropriate store
  const updated = { ...chat, isIncognito: newIsIncognito };
  if (newIsIncognito === chat.isIncognito) {
    return; // No-op
  }
  saveChat(updated);
};
```

### UI Components

**Sidebar (ChatList.tsx)**
```typescript
// Add toggle next to each chat
<div className="chat-item">
  <label className="incognito-toggle">
    <input
      type="checkbox"
      checked={chat.isIncognito || false}
      onChange={() => toggleIncognito(chat.id)}
    />
    🕵️
  </label>
  <span className={chat.isIncognito ? 'faded' : ''}>
    {chat.title}
  </span>
</div>
```

**ChatHeader.tsx**
```typescript
{chat.isIncognito && (
  <div className="incognito-badge">
    🕵️ Incognito Mode
    <Tooltip>Memory-only. Vanishes on close.</Tooltip>
  </div>
)}
```

**SettingsPanel.tsx** (use `settingsStore` not `incognitoStore`)
```typescript
// The defaultToIncognito setting persists in settingsStore (normal settings behavior)
// incognitoStore is for in-memory chats ONLY

const settingsStore = useSettingsStore();

<label>
  <input
    type="checkbox"
    checked={settingsStore.defaultToIncognito ?? false}
    onChange={(e) => settingsStore.setDefaultToIncognito(e.target.checked)}
  />
  Default to Incognito for new chats
</label>
```

### Clear-on-Close Logic (with error handling)

**App.tsx or main lifecycle**
```typescript
// Tauri window close event (with error handling)
const unlisten = await appWindow.onCloseRequested(async (event) => {
  try {
    // Clear all in-memory Incognito chats
    incognitoStore.clearAll();
  } catch (err) {
    // Log error but continue closing (in-memory data will be GC'd anyway)
    console.error("Failed to clear Incognito chats on app close:", err);
  }
  appWindow.close();
});
```

**Per-conversation clear** (ContextMenu or Sidebar)
```typescript
const clearIncognitoChat = (chatId: string) => {
  incognitoStore.removeChat(chatId);
  // UI automatically re-renders (Zustand subscriber)
};
```

## Persistence Flow Diagram

```
Chat added/updated
  ↓
Does chat have isIncognito === true?
  ├─ YES → incognitoStore.addChat()
  │         (RAM only)
  │         ↓
  │    Chat available in memory
  │    Chat NOT in IndexedDB
  │    Chat shown in current session
  │    Chat vanishes on app close
  │
  └─ NO → db.chats.put()
          (IndexedDB)
          ↓
          Chat persisted to disk
          Chat survives app close
          Chat in history on reopen
```

## Testing Strategy

### Unit Tests
- `incognitoStore.test.ts`: addChat, updateChat, removeChat, clearAll, defaultToIncognito toggle
- `chatStore.test.ts`: Verify `saveChat()` routes correctly based on `isIncognito` flag
- `components/ChatList.test.tsx`: Toggle fires correct store action
- `components/ChatHeader.test.tsx`: Badge appears when `chat.isIncognito`

### Integration Tests
- Create normal chat → save → verify in IndexedDB
- Create Incognito chat → save → verify NOT in IndexedDB, but in memory
- Toggle normal → Incognito → verify store routing
- Export normal chat succeeds; export Incognito chat fails

### E2E Tests (Playwright)
- Open app → create Incognito chat → send message with sensitive data → verify prompt review works
- Close app (browser close) → reopen → verify Incognito chat gone
- DevTools inspection: Open IndexedDB, confirm NO Incognito records
- Open Settings → toggle "Default to Incognito" → create new chat → verify starts in Incognito

## Acceptance Criteria

1. **All unit tests pass** (incognitoStore, chatStore routing, component behavior)
2. **All integration tests pass** (storage layer, toggle behavior, export blocks)
3. **E2E test passes** (open Incognito → close app → reopen → gone + IndexedDB clean)
4. **No regression** (normal chats persist and function identically)
5. **Margot use case validated** (legal advisor can toggle Incognito, use with contracts, close app, verify no trace)
6. **Performance acceptable** (in-memory store adds <10ms to chat operations)
7. **Documentation updated** (README, in-app help text explain Incognito Mode)

## Known Limitations (v1)

1. **Cannot toggle mid-conversation** — Incognito is set at creation, cannot change after
   - **Workaround:** Create new Incognito chat if needed
   - **v2 enhancement:** Support toggle with data migration logic
2. **No export for Incognito chats** — User cannot save Incognito conversation
   - **Workaround:** Copy message text manually, create normal chat, paste
   - **v2 enhancement:** "Copy to normal chat" button
3. **No encryption in memory** — Sensitive data in RAM could theoretically be accessed via memory dump
   - **v2 enhancement:** ChaCha20-Poly1305 encryption for in-memory chats
4. **No auto-expiry** — Incognito chats stay in memory until app closes
   - **v2 enhancement:** "Forget this chat in 1 hour" timer

## Architecture Review Resolution (Critical Fixes)

**Issues identified in peer review:**

1. **Error handling gaps** ✓ FIXED
   - Added try-catch around `incognitoStore.clearAll()` in close handler
   - Added fallback to IndexedDB if `incognitoStore` unavailable
   - All store functions have explicit error contracts (throw vs. silently succeed)

2. **State store coupling** ✓ FIXED
   - Moved `defaultToIncognito` from `incognitoStore` to `settingsStore`
   - `incognitoStore` now handles ONLY in-memory chats (single responsibility)
   - Settings persist normally; in-memory chats do not

3. **API contracts undefined** ✓ FIXED
   - All `incognitoStore` functions now have explicit JSDoc / TypeScript contracts
   - Error behavior specified for each: throws vs. returns null vs. silently succeeds
   - `toggleIncognito()` function explicitly defined in `chatStore`, with validation

4. **Toggle validation missing** ✓ FIXED
   - Added validation: cannot toggle Incognito mid-conversation (throws error)
   - v1 limitation: toggle only allowed before messages sent
   - UI enforces this by disabling toggle after first message

5. **Conversation type incomplete** ✓ FIXED
   - Updated: `isIncognito: boolean` is now non-optional (was `isIncognito?: boolean`)
   - All new chats have explicit `isIncognito: true | false` (no undefined)

## Margot's Success Path

1. Open AILocalMind
2. Click "New Chat" → defaults to normal mode
3. Toggle 🕵️ Incognito ON in Sidebar
4. See badge in header: "🕵️ Incognito Mode"
5. Type: "Review this contract clause for liability issues: [clause]"
6. See Prompt Review Modal (PII detected: contract details)
7. Approve send
8. Get response from cloud LLM (with only categorical attributes sent)
9. Review response in Incognito chat
10. Close conversation
11. Close app
12. Reopen app → Incognito chat is GONE
13. Open DevTools → IndexedDB shows zero Incognito records → ✅ Margot trusts the feature

## Files Modified

- `src/types/conversation.ts` — MODIFY (make `isIncognito: boolean` non-optional in Conversation type)
- `src/store/incognito.ts` — NEW (Zustand slice for in-memory chats)
- `src/store/chatStore.ts` — MODIFY (add routing gate + validation + error handling in saveChat, add toggleIncognito)
- `src/store/settingsStore.ts` — MODIFY (add defaultToIncognito boolean + setter, ensure persisted)
- `src/components/Sidebar/ChatList.tsx` — MODIFY (add toggle button, call toggleIncognito)
- `src/components/ChatHeader.tsx` — MODIFY (add badge)
- `src/components/Settings/SettingsPanel.tsx` — MODIFY (use settingsStore for defaultToIncognito)
- `src/App.tsx` — MODIFY (clear-on-close hook with error handling)
- `src/hooks/useChat.ts` — MODIFY (handle Incognito delete flow)
- `README.md` — MODIFY (document Incognito Mode)
- Test files — NEW (unit, integration, E2E)
