# Specs: Incognito Mode

## Overview

Incognito Mode provides memory-only chat sessions for privacy-sensitive conversations. Chats in Incognito Mode use the full privacy pipeline (PII redaction, prompt review, cloud routing) but are never persisted to IndexedDB, localStorage, or disk. They vanish when the app closes or the conversation is manually cleared.

## Requirements

### R1: Chat Storage Model
- **Normal chats:** Persisted to IndexedDB via `chatStore`
- **Incognito chats:** Stored only in React component state / in-memory Zustand slice
- **Distinction:** Every chat document has an `isIncognito: boolean` flag (default: `false`)

### R2: UI Toggle & Indicator
- **Sidebar:** Checkbox or toggle button next to chat name to enable/disable Incognito
- **Header:** Visual badge (🕵️ Incognito) in chat header when mode is active
- **Color scheme:** Subtle visual cue (e.g., slightly faded background) to distinguish Incognito chats
- **Clear labeling:** Tooltip or help text explaining "Memory-only, vanishes on close"

### R3: Persistence Bypass
- **IndexedDB write gate:** Before any `saveChat()` call, check `if (chat.isIncognito) return;`
- **No localStorage:** Incognito chats never written to localStorage either
- **Local storage:** Only stored in RAM (Zustand in-memory store)
- **Files affected:** Any component/function that calls `chatStore.save()` or `dbPersist()`

### R4: Clear-on-Close Logic
- **App close:** On Tauri window close event, clear all in-memory Incognito chats
- **Manual clear:** Button in Settings or chat context menu: "Clear Incognito Chat"
- **Conversation close:** When user closes a conversation, if it's Incognito, remove it from memory
- **No recovery:** Cleared chats cannot be recovered (design intent: zero trace)

### R5: Export/Import Behavior
- **Export:** Block export for Incognito chats (throw error: "Cannot export Incognito chats")
- **Import:** Imported chats are always normal (never imported as Incognito)
- **Copy to normal:** User can manually copy Incognito chat to normal mode for persistence (future enhancement)

### R6: PII Pipeline Integration
- **Redaction:** Still applies to Incognito chats (same `anonymizeForCloud()` flow)
- **Prompt review:** Modal still appears before cloud send in Incognito Mode
- **Cloud send:** Incognito chats still reach cloud LLM (with redacted PII)
- **Response:** Cloud response received and displayed in Incognito chat
- **Design intent:** "Privacy about persistence" not "privacy about transmission"

### R7: Settings Option
- **New toggle:** "Default to Incognito for new chats" (default: OFF)
- **Effect:** When enabled, all new conversations start in Incognito Mode
- **Per-chat override:** User can toggle on/off mid-session
- **Persistence:** This setting itself is saved (not part of Incognito contract)

### R8: Edge Cases
- **App crash:** Incognito chats in memory are lost (acceptable; redaction should have prevented leaks)
- **Browser dev tools:** Incognito chat not visible in IndexedDB inspection (success criterion for Margot)
- **Tab reload:** Incognito chats lost (correct behavior; memory-only)
- **Multiple windows:** Each window has separate in-memory Incognito store

## Data Model

```typescript
interface IncognitoChat {
  id: string;
  isIncognito: true;
  personaId: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  metadata: {
    defaultToIncognito: boolean;
  };
}

// Normal chats remain unchanged (isIncognito: false or undefined)
interface NormalChat {
  id: string;
  isIncognito?: false;
  personaId: string;
  messages: Message[];
  createdAt: Date;
  // ... persisted to IndexedDB
}
```

## Zustand Store Changes

```typescript
// New slice for in-memory Incognito chats
interface IncognitoStore {
  chats: Map<string, IncognitoChat>; // in-memory only
  defaultToIncognito: boolean;
  
  addIncognitoChat(chat: IncognitoChat): void;
  updateIncognitoChat(id: string, updates: Partial<IncognitoChat>): void;
  removeIncognitoChat(id: string): void;
  clearAllIncognito(): void;
  setDefaultToIncognito(enabled: boolean): void;
}

// Modify existing chatStore to check isIncognito before persistence
const saveChat = async (chat: Chat) => {
  if (chat.isIncognito) {
    // Store in Incognito slice only
    incognitoStore.addIncognitoChat(chat);
  } else {
    // Store in IndexedDB (existing behavior)
    await db.chats.put(chat);
  }
};
```

## Component Changes

### Sidebar (ChatList)
- Add toggle checkbox or button next to each chat (🔒 Incognito icon)
- On click: call `toggleIncognito(chatId)`
- Styling: dim or fade Incognito chats to visual distinction

### ChatHeader
- Display 🕵️ badge in header when `chat.isIncognito === true`
- Show tooltip on hover: "This is an Incognito chat. It will vanish when closed."

### CreateChatButton
- On new chat: check `settings.defaultToIncognito`
- If true: set `newChat.isIncognito = true` before storing

### Settings Panel
- Add toggle: "Default to Incognito Mode for new chats"
- Link to help text explaining Incognito Mode

## Acceptance Criteria

1. **Toggle works** — User can click Incognito toggle in Sidebar; visual change occurs instantly
2. **Badge displays** — 🕵️ badge appears in ChatHeader when Incognito is ON
3. **No persistence** — Close app → reopen → Incognito chat is gone from history
4. **IndexedDB clean** — DevTools > Application > IndexedDB shows NO Incognito chat records
5. **Redaction works** — Send message to Incognito chat → see prompt review modal → PII redacted
6. **Cloud send works** — Redacted prompt sent to cloud LLM → response received in Incognito chat
7. **Settings apply** — Toggle "Default to Incognito" → create new chat → starts in Incognito Mode
8. **Clear-on-close** — Open Incognito chat → close app → reopen app → history shows 0 Incognito chats
9. **Export blocked** — Try to export Incognito chat → error "Cannot export Incognito chats"
10. **Normal chats unaffected** — Normal chats persist as before; no regression
