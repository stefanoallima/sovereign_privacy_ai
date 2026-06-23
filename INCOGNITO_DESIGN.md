# Incognito Mode - Technical Design & Architecture

## Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        React UI Layer                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Sidebar         ChatHeader         ChatWindow           │  │
│  │  ├─ New Chat    ├─ Incognito       ├─ Add Message       │  │
│  │  ├─ New Incog   │  Badge           ├─ Finalize Stream   │  │
│  │  ├─ Conv List   └─ Title           └─ Message Display   │  │
│  │  │  (badge)                                              │  │
│  │  └─ Incog Conv                                           │  │
│  │     (distinct)                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (dispatch actions)
┌─────────────────────────────────────────────────────────────────┐
│                    Zustand Chat Store                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  conversations: Conversation[]                           │  │
│  │  messages: Record<string, Message[]>                    │  │
│  │  currentConversationId: string | null                   │  │
│  │                                                          │  │
│  │  createConversation(personaId, modelId, project, isIncognito)
│  │    ├─ if (!isIncognito) → dbOps.createConversation()   │  │
│  │    └─ add to state (in-memory)                         │  │
│  │                                                          │  │
│  │  addMessage(conversationId, message)                    │  │
│  │    ├─ Get conversation from state                      │  │
│  │    ├─ if (!conv.isIncognito) → dbOps.createMessage()  │  │
│  │    └─ add to state messages[conversationId]           │  │
│  │                                                          │  │
│  │  deleteConversation(id)                                │  │
│  │    ├─ Get conversation from state                      │  │
│  │    ├─ if (!conv.isIncognito) → dbOps.deleteConv()     │  │
│  │    └─ remove from state                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                   ↓ (conditional write)
┌─────────────────────────────────────────────────────────────────┐
│                    IndexedDB (Dexie)                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  conversations table                                     │  │
│  │  messages table                                          │  │
│  │  (Incognito chats never written here)                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    App Lifecycle                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  window.onCloseRequested()                              │  │
│  │    → Filter conversations: keep only normal chats       │  │
│  │    → Update state (in-memory incognito data lost)       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **In-Memory Only**: Incognito conversations exist only in the Zustand store's JavaScript heap
2. **Conditional Persistence**: Every `dbOps.*` call checks `isIncognito` before writing
3. **Silent Clear on Close**: No dialog or confirmation—just clean removal on app exit
4. **No Retroactive Toggle**: Can't convert normal → incognito or vice versa (v1 scope)
5. **PII Pipeline Untouched**: Redaction, anonymization, and extraction all work normally

## Component Changes

### 1. Sidebar Component
**File**: `apps/desktop/src/components/chat/Sidebar.tsx`

#### Changes
- New button for creating incognito chats (already present: `EyeOff` icon)
- Filter conversations into sections:
  - Incognito (top, with badge)
  - Quick Chats (normal, non-project)
  - Project Chats (grouped by project)
- Add badge next to incognito conversation titles

#### Pseudocode
```typescript
const incognitoChats = filteredConversations.filter((conv) => conv.isIncognito);
const quickChats = filteredConversations.filter((conv) => !conv.projectId && !conv.isIncognito);

// Render incognito chats in a separate section:
{incognitoChats.length > 0 && (
  <div className="px-4 py-3 border-t border-[hsl(var(--border)/0.5)]">
    <div className="text-xs font-semibold text-[hsl(var(--muted-foreground)/0.7)] mb-2 flex items-center gap-2">
      <EyeOff className="h-3 w-3" />
      <span>Incognito Chats</span>
    </div>
    {incognitoChats.map((conv) => (
      <ConversationItem key={conv.id} conversation={conv} isIncognito={true} />
    ))}
  </div>
)}
```

### 2. ChatHeader Component
**File**: `apps/desktop/src/components/chat/ChatHeader.tsx` (or similar)

#### Changes
- Display incognito badge above the conversation title
- Badge is always visible when conversation is incognito

#### Badge JSX
```typescript
{currentConversation?.isIncognito && (
  <div className="flex items-center gap-2 mb-2 px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30">
    <EyeOff className="h-4 w-4 text-amber-700 dark:text-amber-400" />
    <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
      Incognito — This chat will be cleared when you close the app
    </span>
  </div>
)}
```

### 3. Zustand Chat Store
**File**: `apps/desktop/src/stores/chat.ts`

#### Type Changes
```typescript
// Update Conversation interface in types/index.ts (already done)
export interface Conversation {
  id: string;
  projectId?: string;
  personaId: string;
  modelId: string;
  title: string;
  activeContextIds: string[];
  totalTokensUsed: number;
  isIncognito?: boolean;  // ← New field
  summary?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Update LocalConversation in lib/db.ts
export interface LocalConversation {
  id: string;
  projectId?: string;
  personaId: string;
  modelId: string;
  title: string;
  activeContextIds: string[];
  totalTokensUsed: number;
  isIncognito?: boolean;  // ← New field (matches Conversation)
  summary?: string;
  deleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Store Changes
```typescript
// In useChatStore create() function

createConversation: async (personaId, modelId, projectId, isIncognito) => {
  const id = `conv-${Date.now()}`;
  const now = new Date();

  const conversation: Conversation = {
    id,
    personaId,
    modelId,
    projectId,
    title: isIncognito ? "Incognito Chat" : "New Conversation",
    activeContextIds: [],
    totalTokensUsed: 0,
    isIncognito,  // ← Pass through
    createdAt: now,
    updatedAt: now,
  };

  // ← Skip persistence for incognito conversations
  if (!isIncognito) {
    await dbOps.createConversation({
      id,
      projectId,
      personaId,
      modelId,
      title: "New Conversation",
      activeContextIds: [],
      totalTokensUsed: 0,
      isIncognito,
      createdAt: now,
      updatedAt: now,
    });
  }

  set((state) => ({
    conversations: [conversation, ...state.conversations],
    messages: { ...state.messages, [id]: [] },
    currentConversationId: id,
  }));

  return id;
},

deleteConversation: async (id) => {
  const conv = get().conversations.find(c => c.id === id);
  
  // ← Skip database deletion for incognito conversations
  if (!conv?.isIncognito) {
    await dbOps.deleteConversation(id);
  }

  // Clean up associated form fills (if needed)
  try {
    const { formFillDbOps } = await import('../lib/db');
    await formFillDbOps.deleteFormFillsByConversation(id);
  } catch (e) {
    console.warn('Failed to clean up form fills:', e);
  }

  set((state) => {
    const { [id]: _, ...remainingMessages } = state.messages;
    return {
      conversations: state.conversations.filter((c) => c.id !== id),
      messages: remainingMessages,
      currentConversationId:
        state.currentConversationId === id ? null : state.currentConversationId,
    };
  });
},

updateConversationTitle: async (id, title) => {
  const conv = get().conversations.find(c => c.id === id);
  
  // ← Skip database update for incognito conversations
  if (!conv?.isIncognito) {
    await dbOps.updateConversation(id, { title });
  }

  set((state) => ({
    conversations: state.conversations.map((c) =>
      c.id === id ? { ...c, title, updatedAt: new Date() } : c
    ),
  }));
},

addMessage: async (conversationId, message) => {
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date();

  const newMessage: Message = {
    ...message,
    id,
    createdAt: now,
  };

  // ← Skip persistence for incognito conversations
  const conv = get().conversations.find(c => c.id === conversationId);
  if (!conv?.isIncognito) {
    await dbOps.createMessage({
      id,
      conversationId,
      role: message.role,
      content: message.content,
      audioPath: message.audioPath,
      modelId: message.modelId,
      personaId: message.personaId,
      inputTokens: message.inputTokens,
      outputTokens: message.outputTokens,
      latencyMs: message.latencyMs,
      createdAt: now,
      privacyLevel: message.privacyLevel,
      piiTypesDetected: message.piiTypesDetected,
      approvalStatus: message.approvalStatus,
      attachments: message.attachments,
    });

    // Update conversation timestamp
    await dbOps.updateConversation(conversationId, {});
  }

  set((state) => ({
    messages: {
      ...state.messages,
      [conversationId]: [
        ...(state.messages[conversationId] || []),
        newMessage,
      ],
    },
    conversations: state.conversations.map((c) =>
      c.id === conversationId ? { ...c, updatedAt: new Date() } : c
    ),
  }));
},

finalizeStreaming: async (conversationId, modelId, inputTokens, outputTokens, latencyMs, personaId) => {
  const { streamingContent } = get();
  if (!streamingContent) return;

  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date();

  const newMessage: Message = {
    id,
    conversationId,
    role: "assistant",
    content: streamingContent,
    modelId,
    personaId,
    inputTokens,
    outputTokens,
    latencyMs,
    createdAt: now,
  };

  // ← Skip persistence for incognito conversations
  const conv = get().conversations.find(c => c.id === conversationId);
  if (!conv?.isIncognito) {
    await dbOps.createMessage({
      id,
      conversationId,
      role: "assistant",
      content: streamingContent,
      modelId,
      personaId,
      inputTokens,
      outputTokens,
      latencyMs,
      createdAt: now,
    });

    // Update conversation with new token count
    if (conv) {
      await dbOps.updateConversation(conversationId, {
        totalTokensUsed: conv.totalTokensUsed + inputTokens + outputTokens,
      });
    }
  }

  set((state) => ({
    messages: {
      ...state.messages,
      [conversationId]: [
        ...(state.messages[conversationId] || []),
        newMessage,
      ],
    },
    conversations: state.conversations.map((c) =>
      c.id === conversationId
        ? {
          ...c,
          totalTokensUsed: c.totalTokensUsed + inputTokens + outputTokens,
          updatedAt: new Date(),
        }
        : c
    ),
    streamingContent: "",
    isLoading: false,
  }));
},
```

### 4. App Component (Window Lifecycle)
**File**: `apps/desktop/src/App.tsx`

#### Clear-on-Close Logic
```typescript
import { useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useChatStore } from '@/stores';

export function App() {
  // ... existing code ...

  useEffect(() => {
    const handleWindowClose = async () => {
      const state = useChatStore.getState();
      const hasIncognito = state.conversations.some(c => c.isIncognito);

      if (hasIncognito) {
        // Silent cleanup: filter out incognito conversations
        useChatStore.setState((prev) => ({
          conversations: prev.conversations.filter(c => !c.isIncognito),
          // Reset currentConversationId if it was an incognito chat
          currentConversationId: 
            prev.conversations.find(c => c.id === prev.currentConversationId)?.isIncognito
              ? null
              : prev.currentConversationId,
        }));
      }
    };

    // Subscribe to window close event
    const unlisten = getCurrentWebviewWindow().onCloseRequested(handleWindowClose);

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  return (
    // ... existing JSX ...
  );
}
```

## Persistence Flow Diagram

### Normal Chat Flow
```
User → UI (createConversation, addMessage)
  ↓
Zustand Store
  ↓
dbOps.createConversation() → IndexedDB (Dexie)
dbOps.createMessage() → IndexedDB (Dexie)
  ↓
Data persists across sessions
```

### Incognito Chat Flow
```
User → UI (createConversation, addMessage)
  ↓
Zustand Store
  ↓
Check isIncognito flag
  ├─ true → SKIP dbOps calls
  └─ false → dbOps.createConversation() → IndexedDB
  ↓
Data stays in memory only
  ↓
On app close → Memory cleared (OS-level)
```

## Testing Strategy

### Unit Tests

#### 1. Store: Incognito Conversation Creation
```typescript
test('createConversation with isIncognito=true skips database write', async () => {
  const store = useChatStore.getState();
  const spy = jest.spyOn(dbOps, 'createConversation');

  const id = await store.createConversation(
    'margot',
    'Qwen/Qwen3-235B',
    undefined,
    true  // isIncognito
  );

  expect(spy).not.toHaveBeenCalled();
  expect(store.conversations[0].isIncognito).toBe(true);
});

test('createConversation with isIncognito=false writes to database', async () => {
  const store = useChatStore.getState();
  const spy = jest.spyOn(dbOps, 'createConversation');

  const id = await store.createConversation(
    'margot',
    'Qwen/Qwen3-235B',
    undefined,
    false  // normal chat
  );

  expect(spy).toHaveBeenCalled();
});
```

#### 2. Store: Message Persistence Skip
```typescript
test('addMessage skips database write for incognito conversations', async () => {
  const store = useChatStore.getState();
  
  // Create incognito conversation
  const convId = await store.createConversation('margot', 'Qwen/Qwen3-235B', undefined, true);
  
  const spy = jest.spyOn(dbOps, 'createMessage');

  await store.addMessage(convId, {
    role: 'user',
    content: 'Test message',
  });

  expect(spy).not.toHaveBeenCalled();
});
```

#### 3. Store: Delete Conversation
```typescript
test('deleteConversation skips database deletion for incognito chats', async () => {
  const store = useChatStore.getState();
  const spy = jest.spyOn(dbOps, 'deleteConversation');

  const convId = await store.createConversation('margot', 'Qwen/Qwen3-235B', undefined, true);
  await store.deleteConversation(convId);

  expect(spy).not.toHaveBeenCalled();
});
```

### Integration Tests

#### 4. App Lifecycle: Clear on Close
```typescript
test('closing app clears all incognito conversations', async () => {
  // This is harder to test without full app context
  // Typically done in E2E tests
});
```

### E2E Tests

#### 5. Full Journey: Create → Message → Close → Verify Gone
```gherkin
Scenario: Incognito chat is cleared on app close
  Given the app is running
  When I click "New Incognito Chat"
  And I select the "Margot" persona
  And I send a message "Review this contract"
  And I wait for the response
  Then I should see the incognito badge in the chat header
  And I should see the message in the chat history

  When I close the app
  And I reopen the app
  Then the incognito chat should not appear in the sidebar
  And the chat history should be empty
```

## Acceptance Criteria

1. **Incognito Creation**
   - ✓ Clicking "New Incognito Chat" creates a conversation with `isIncognito: true`
   - ✓ Zustand store receives the new conversation
   - ✓ No row is written to `db.conversations` (verify via DevTools → Application → IndexedDB)

2. **Message Persistence Skip**
   - ✓ Sending a message in incognito chat skips `dbOps.createMessage()`
   - ✓ Message appears in UI (Zustand state)
   - ✓ No row is written to `db.messages`

3. **Visual Indicators**
   - ✓ ChatHeader displays "Incognito" badge with `EyeOff` icon
   - ✓ Sidebar shows incognito icon next to conversation title
   - ✓ Incognito section is visually distinct from normal chats

4. **Clear on Close**
   - ✓ Closing app triggers `window.onCloseRequested()` handler
   - ✓ All incognito conversations are removed from state
   - ✓ Reopening app shows zero incognito chats

5. **Export Block**
   - ✓ Export button is disabled for incognito chats
   - ✓ Tooltip shows "Incognito chats cannot be exported"

6. **PII Redaction Works**
   - ✓ Margot persona detects PII in incognito chats
   - ✓ Redaction is applied for cloud API calls
   - ✓ Anonymized content is sent to Nebius

7. **Edge Cases**
   - ✓ Multiple incognito chats can coexist
   - ✓ Switching between incognito and normal chats doesn't affect either
   - ✓ Deleting incognito chat removes it from state immediately
   - ✓ If `currentConversationId` points to deleted incognito chat, reset to `null`

8. **Margot-Specific**
   - ✓ Margot persona appears when creating incognito chat
   - ✓ Contract review use case works without persistence
   - ✓ Legal documents are not saved to disk

## Known Limitations (v1)

1. **No Retroactive Toggle**: Can't convert normal → incognito or vice versa
   - Workaround: Delete normal chat and recreate as incognito
   - Future: Add toggle in conversation settings (v2)

2. **No Selective Export**: Can't export specific messages from incognito chat
   - Workaround: Copy/paste during session
   - Future: Add "export to canvas" feature (v2)

3. **No Incognito Indicators in Notifications**: If notifications are added, incognito status isn't shown
   - Future: Add badge to toast notifications (v2)

4. **No Default Incognito Mode**: Can't set "always start as incognito"
   - Future: Add setting in AppSettings (v2)

5. **No Multi-Window Isolation**: If user opens multiple windows, incognito data is shared via Zustand
   - Future: Store incognito state per-window (v2)

## Future Enhancements (v2+)

1. **Incognito Settings**
   - Default to Incognito mode for specific personas
   - Auto-clear all incognito chats after N days
   - Confirm before closing if incognito chats exist

2. **Advanced Clear-on-Close**
   - Add explicit "Clear all incognito chats" button
   - Add dialog: "You have 3 incognito chats. Clear on close?" (confirmable)
   - Scheduled clear (e.g., every night at midnight)

3. **Persona-Specific Incognito**
   - Some personas always incognito by default (Margot, Tax Advisor)
   - Some personas never allow incognito (e.g., Financial Advisor with required vault)

4. **In-Session Export**
   - Allow exporting to canvas document (separate from persistence)
   - Allow copying formatted conversation to clipboard
   - After export, ask if user wants to keep the original chat or delete

5. **PII Vault Auto-Save**
   - When user confirms PII in incognito chat, auto-add to PII Vault
   - Future messages can reuse the vault

6. **Multi-Window Support**
   - Incognito chats per-window
   - Don't clear one window's data when closing another

7. **Advanced Privacy Indicators**
   - Show PII redaction status in message bubbles
   - Show backend routing (local vs. cloud) for each message
   - Watermark: "INCOGNITO" on screen (optional)
