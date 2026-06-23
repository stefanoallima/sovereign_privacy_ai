# Design: Team Collaboration (Multi-User, Shared Chats)

**Change:** green_team-collaboration-basic_06  
**Phase:** Design  
**Updated:** 2026-06-23

## Executive Summary

This design enables multi-user local accounts with shared conversation support. Users can create conversations, mark them as shared with team members, and control access via a simple permission model (Viewer/Editor/Creator). No cloud authentication required — all accounts are local to the workspace.

**Key decisions:**
- Local-only accounts (SQLite-based, no cloud auth)
- Three permission levels: Viewer (read-only), Editor (read+append), Creator (full control)
- PII redaction pipeline unchanged — shared chats are still redacted before cloud
- Ownership enforced at database layer via permission checks before every operation

---

## 1. ARCHITECTURE OVERVIEW

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    TAURI DESKTOP APP                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            REACT 19 FRONTEND (TypeScript)            │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Zustand Stores:                                     │  │
│  │  • userStore (currentUser, allUsers)                 │  │
│  │  • teamStore (members, permissions)                  │  │
│  │  • chatStore (conversations with ownership)          │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ▲                                   │
│                          │ Tauri invoke()                    │
│                          ▼                                   │
├──────────────────────────────────────────────────────────────┤
│  TAURI 2 RUST BACKEND                                       │
│                                                              │
│  • user_commands.rs (CRUD users, multi-user support)       │
│  • team_commands.rs (add/remove members, roles)            │
│  • permission_commands.rs (share/unshare chats)            │
│  • permissions.rs (permission check middleware)             │
│  • db.rs (SQLite schema + queries)                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow: User Login

```
App Start
  ↓
ensure_default_user() [Rust]
  → Creates "Owner" user if first launch
  ↓
Frontend useEffect on mount:
  invoke('get_all_users')
  → Set currentUser to first/default
  ↓
useUserStore.setCurrentUser(userId)
  ↓
useChatStore.getAccessibleChats()
  → invoke('get_accessible_conversations', { userId })
  → Returns: owned chats + explicitly shared chats
  ↓
Render ChatList with filtered conversations
```

### Data Flow: Share Chat

```
User clicks "Share" button on conversation
  ↓
ShareChatModal opens
  → Load current shares (invoke 'get_chat_permissions')
  → Show available team members
  ↓
User selects recipient + permission level (Viewer/Editor)
  ↓
invoke('share_chat', { chatId, userId, role, currentUser })
  ↓
Backend:
  1. check_user_owns_chat(currentUser, chatId) → fail if not owner
  2. INSERT INTO chat_permissions (chat_id, user_id, role, ...)
  ↓
Frontend:
  → Refresh permissions cache
  → Close modal, show toast
```

### Data Flow: Permission Enforcement

```
User tries to read/write chat
  ↓
Frontend: chatStore.getCanAccessChat(chatId)
  → Local evaluation: owner? → full access
  → Check permissions[chatId] array
  → Return canRead, canWrite, canDelete flags
  ↓
Render ChatWindow with appropriate UI
  (Viewer hides edit/delete buttons; Editor hides delete)
  ↓
If user tries to add message:
  → invoke('add_message_to_chat', { chatId, content, userId })
  ↓
Backend:
  1. require_write_access(userId, chatId)?
     → Query owner_id + chat_permissions table
     → Owner? → allow
     → Editor grant? → allow
     → Viewer? → deny
  2. If denied: return error "No write permission"
  3. If allowed: INSERT message, update chat
  ↓
Frontend catches result:
  → Success: add to message list
  → Error: show warning, disable input
```

---

## 2. DATA MODEL & SCHEMA

### TypeScript Types

**File: `apps/desktop/src/types/collaboration.ts` (NEW)**

```typescript
export interface LocalUser {
  id: string;
  name: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export type ChatPermissionLevel = 'Viewer' | 'Editor' | 'Creator';

export interface CollaborativeConversation extends Conversation {
  ownerId: string;
  sharedWith: ChatPermissionGrant[];
  isShared: boolean;
}

export interface ChatPermissionGrant {
  userId: string;
  role: ChatPermissionLevel;
  grantedAt: Date;
  grantedBy: string;
}

export interface TeamSettings {
  id: string;
  members: TeamMember[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  userId: string;
  role: 'member' | 'admin' | 'owner';
  joinedAt: Date;
  addedBy?: string;
}

export interface ChatAccessEvaluation {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  reason?: string;
}
```

### SQLite Schema

**Extensions to `apps/desktop/src-tauri/src/db.rs`:**

```rust
// === NEW TABLES ===

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE chat_permissions (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,  -- 'Viewer', 'Editor', 'Creator'
  granted_at TEXT NOT NULL,
  granted_by TEXT NOT NULL,
  UNIQUE(chat_id, user_id),
  FOREIGN KEY (chat_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id)
);

CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE team_members (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  role TEXT NOT NULL,  -- 'member', 'admin', 'owner'
  joined_at TEXT NOT NULL,
  added_by TEXT,
  UNIQUE(user_id, team_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id)
);

-- === EXTENDED CONVERSATIONS TABLE ===
ALTER TABLE conversations ADD COLUMN owner_id TEXT;
ALTER TABLE conversations ADD COLUMN is_shared INTEGER DEFAULT 0;

-- === INDICES (Performance) ===
CREATE INDEX idx_chat_permissions_user ON chat_permissions(user_id);
CREATE INDEX idx_chat_permissions_chat ON chat_permissions(chat_id);
CREATE INDEX idx_conversations_owner ON conversations(owner_id);
CREATE INDEX idx_conversations_is_shared ON conversations(is_shared);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_team_members_team ON team_members(team_id);
```

---

## 3. COMPONENT HIERARCHY

### New React Components

**TeamSettingsPanel** (`src/components/team/TeamSettingsPanel.tsx`)
- Shows list of team members
- Add member button → selection modal
- Each member has role dropdown (member/admin/owner)
- Remove button with confirmation

**ShareChatModal** (`src/components/chat/ShareChatModal.tsx`)
- Current shares list (user + role)
- "Add share" section: user multiselect + role dropdown
- "Unshare" button per recipient
- Validation: can't share with self, prevent duplicates

**ChatListItem Updates** (`src/components/chat/ChatListItem.tsx`)
- Add shared badge (icon: 🔗) if isShared=true
- Add owner name if not currentUser (small label)
- Add permission badge (Viewer/Editor) if not owner

**ChatWindow Header Updates** (`src/components/chat/ChatWindow.tsx`)
- Show "Shared with X people" if isShared
- Show "Owner: [name]" if not owner
- Show "Read-Only" warning if Viewer
- Share button (opens ShareChatModal)

**ChatListFilters Updates** (`src/components/chat/Sidebar.tsx`)
- Filter toggle: "All Chats" / "My Chats" / "Shared with Me" / "Contributed To"
- "My Chats": owner_id = currentUser
- "Shared with Me": has explicit permission grant
- "Contributed To": Editor or higher

---

## 4. RUST BACKEND MODULES

### user_commands.rs (NEW)

```rust
#[tauri::command]
pub fn create_user(state: State<DbState>, name: String, email: Option<String>) -> Result<User>

#[tauri::command]
pub fn get_user(state: State<DbState>, user_id: String) -> Result<User>

#[tauri::command]
pub fn get_all_users(state: State<DbState>) -> Result<Vec<User>>

#[tauri::command]
pub fn update_user(state: State<DbState>, user_id: String, name: Option<String>, email: Option<String>) -> Result<()>

#[tauri::command]
pub fn deactivate_user(state: State<DbState>, user_id: String) -> Result<()>
```

### team_commands.rs (NEW)

```rust
#[tauri::command]
pub fn get_team_settings(state: State<DbState>) -> Result<TeamSettings>

#[tauri::command]
pub fn add_team_member(state: State<DbState>, current_user: String, user_id: String, role: String) -> Result<()>
  // Permission check: only admin/owner can add

#[tauri::command]
pub fn remove_team_member(state: State<DbState>, current_user: String, user_id: String) -> Result<()>
  // Removes all future share grants; existing shared chats remain visible (legacy access)

#[tauri::command]
pub fn update_member_role(state: State<DbState>, current_user: String, user_id: String, role: String) -> Result<()>
```

### permission_commands.rs (NEW)

```rust
#[tauri::command]
pub fn share_chat(state: State<DbState>, current_user: String, chat_id: String, user_id: String, role: String) -> Result<()>
  // check_user_owns_chat(current_user, chat_id) before inserting permission

#[tauri::command]
pub fn unshare_chat(state: State<DbState>, current_user: String, chat_id: String, user_id: String) -> Result<()>
  // check_user_owns_chat before deleting permission

#[tauri::command]
pub fn update_chat_permission(state: State<DbState>, current_user: String, chat_id: String, user_id: String, role: String) -> Result<()>
  // check_user_owns_chat before updating

#[tauri::command]
pub fn get_chat_permissions(state: State<DbState>, chat_id: String) -> Result<Vec<ChatPermissionGrant>>

#[tauri::command]
pub fn get_accessible_conversations(state: State<DbState>, user_id: String) -> Result<Vec<Conversation>>
  // Union: owned + explicitly permitted chats

#[tauri::command]
pub fn evaluate_chat_access(state: State<DbState>, user_id: String, chat_id: String) -> Result<ChatAccessEvaluation>
  // Returns canRead, canWrite, canDelete flags
```

### permissions.rs (NEW)

Central permission enforcement module:

```rust
pub struct PermissionChecker;

impl PermissionChecker {
  pub fn can_read_conversation(conn: &Connection, user_id: &str, chat_id: &str) -> bool
  pub fn can_write_conversation(conn: &Connection, user_id: &str, chat_id: &str) -> bool
  pub fn can_delete_conversation(conn: &Connection, user_id: &str, chat_id: &str) -> bool
}

pub fn require_read_access(conn: &Connection, user_id: &str, chat_id: &str) -> Result<()>
pub fn require_write_access(conn: &Connection, user_id: &str, chat_id: &str) -> Result<()>
pub fn require_delete_access(conn: &Connection, user_id: &str, chat_id: &str) -> Result<()>
```

These are called by EVERY mutation (add_message, update_message, delete_message, etc) before executing.

---

## 5. FRONTEND STATE MANAGEMENT

### userStore (Zustand)

**File: `apps/desktop/src/stores/user.ts` (NEW)**

```typescript
interface UserStore {
  currentUserId: string | null;
  currentUser: LocalUser | null;
  allUsers: LocalUser[];

  setCurrentUser: (userId: string) => Promise<void>;
  createUser: (name: string, email?: string) => Promise<LocalUser>;
  updateUser: (userId: string, updates: Partial<LocalUser>) => Promise<void>;
  loadUsers: () => Promise<void>;
  getUser: (userId: string) => LocalUser | undefined;
}
```

### teamStore (Zustand)

**File: `apps/desktop/src/stores/team.ts` (NEW)**

```typescript
interface TeamStore {
  teamSettings: TeamSettings | null;

  loadTeamSettings: () => Promise<void>;
  addTeamMember: (userId: string) => Promise<void>;
  removeTeamMember: (userId: string) => Promise<void>;
  updateMemberRole: (userId: string, role: string) => Promise<void>;

  shareChat: (chatId: string, userId: string, role: ChatPermissionLevel) => Promise<void>;
  unshareChat: (chatId: string, userId: string) => Promise<void>;
  updateChatPermission: (chatId: string, userId: string, role: ChatPermissionLevel) => Promise<void>;
  getChatPermissions: (chatId: string) => Promise<ChatPermissionGrant[]>;
}
```

### chatStore (UPDATE)

**File: `apps/desktop/src/stores/chat.ts` (MODIFICATIONS)**

Add to existing ChatStore:

```typescript
interface ChatStore {
  // ... existing fields ...

  ownerships: Record<string, string>;          // chatId -> userId
  permissions: Record<string, ChatPermissionGrant[]>;

  getAccessibleChats: () => Promise<void>;
  getCanAccessChat: (chatId: string) => ChatAccessEvaluation;
  loadChatPermissions: (chatId: string) => Promise<void>;
}
```

---

## 6. UI SPECIFICATION

### Team Settings Panel

**Location:** Settings → Team

**Layout:**
```
┌─────────────────────────────────────┐
│ TEAM MEMBERS                        │
├─────────────────────────────────────┤
│                                     │
│  [+ Add Member]                     │
│                                     │
│  Alice (You)            [●●●] Owner │
│  Bob                    [@] Member  │
│  Carol                  [@] Member  │
│  [Remove]               [Remove]    │
│                                     │
└─────────────────────────────────────┘
```

**Interactions:**
- "Add Member" → shows all non-members, select to add
- Role dropdown: member ↔ admin ↔ owner (only owner can promote)
- "Remove" → confirmation → removes from team + revokes all future share grants

### Share Chat Modal

**Triggered by:** "Share" button in ChatWindow header

**Layout:**
```
┌──────────────────────────────────────┐
│ SHARE CONVERSATION                  │
├──────────────────────────────────────┤
│                                      │
│ CURRENTLY SHARED WITH:               │
│  • Bob (Editor)        [Change] [✕]  │
│  • Carol (Viewer)      [Change] [✕]  │
│                                      │
│ ADD MORE MEMBERS:                    │
│  [ Select member...  ▼]              │
│  [ Role: Viewer / Editor / Creator]  │
│  [ Add Share ]                       │
│                                      │
└──────────────────────────────────────┘
```

**Interactions:**
- "Change" role → dropdown to update
- "✕" → unshare immediately
- Can't select self, can't share with already-shared member
- "Add Share" disabled until member + role selected

### Chat List View Modes

**Sidebar Filter (new toggles):**
```
[ All Chats ] [ My Chats ] [ Shared with Me ] [ Contributed To ]
```

**All Chats:** Shows everything user owns or has permission to access

**My Chats:** `owner_id = currentUser` only

**Shared with Me:** `has explicit permission grant` + NOT owner

**Contributed To:** `role = Editor` or higher

**List items display:**
```
🔒 Tax Q&A                        [Shared]
   Owner: Alice
   
✎ Legal Review                   [Your conversation]
   Last: Jun 23
   
🔗 Team Budget Planning           [Shared with 2 people]
   Owner: Bob
```

Icons:
- 🔒 = private (not shared)
- 🔗 = shared (multiple people)
- ✎ = your own conversation
- [@] badge = only you can edit (others are viewers)

---

## 7. PERMISSION MODEL

### Access Matrix

| User | Role | Read | Write | Delete | Share |
|------|------|------|-------|--------|-------|
| Owner | Creator | ✓ | ✓ | ✓ | ✓ |
| Other | Editor | ✓ | ✓ | ✗ | ✗ |
| Other | Viewer | ✓ | ✗ | ✗ | ✗ |
| Not Shared | - | ✗ | ✗ | ✗ | ✗ |

### Rules

1. **Only the owner can share/unshare** — explicit permission checks before share_chat()
2. **Permission checks fire on every operation** — not just UI button hiding
3. **Ownership is immutable** — you can't transfer chat to another user (v1)
4. **Viewer has read-only UI** — edit/delete buttons hidden + server rejects mutations
5. **Editor can't delete** — only owner can delete conversation
6. **Removing user from team** — doesn't auto-revoke old shared chats (legacy access), but prevents future shares

---

## 8. EDGE CASES & ERROR HANDLING

| Edge Case | Handling |
|-----------|----------|
| Owner downgrades Editor→Viewer mid-chat | Permission check fails on next write; show warning; update UI |
| Owner removes Editor mid-chat | Chat disappears from their list on refresh; cached perms invalid |
| Chat left open during permission revoke | User tries to add message → server denies → show "access revoked" |
| Owner deletes account (user deactivated) | Chats become orphaned; admin can take ownership later |
| Concurrent edits (2 editors) | Last-write-wins on message edit; both see updates when synced |
| Multiple shares of same chat to same user | UNIQUE constraint prevents duplicates; update replaces |
| First-time launch (no users) | ensure_default_user() creates "Owner" user automatically |

---

## 9. SECURITY CONSIDERATIONS

**Permission Bypass Prevention:**
- Every read/write operation calls `require_*_access()` before executing
- No direct DB access from frontend — all through Tauri command interface
- Tauri commands re-validate user context on every call

**PII Redaction Independence:**
- Sharing mechanism does NOT bypass redaction pipeline
- Shared chats still undergo full anonymization before cloud transmission
- Redaction rules (Viewer/Editor/Creator) are orthogonal to PII rules

**Data Leakage:**
- Chat queries never return chats user can't access
- Responses filtered by permission at query level, not UI level

---

## 10. TESTING STRATEGY

### Critical Paths (Must Pass)

**Unit Tests**
- [ ] Permission validation logic (Viewer/Editor/Creator)
- [ ] Share/unshare duplicate prevention
- [ ] Role hierarchy enforcement
- [ ] SQL injection prevention (parameterized queries)

**Integration Tests**
- [ ] User create → auto-assigned to team
- [ ] Share chat → recipient sees it in list
- [ ] Permission downgrade → write blocked
- [ ] User removal → future shares blocked
- [ ] Chat isolation: User A can't see User B's private chats

**E2E Tests (Playwright)**
- [ ] Alice creates chat → only Alice sees it
- [ ] Alice shares with Bob (Editor) → Bob adds message → Alice sees it
- [ ] Alice downgrade Bob to Viewer → Bob's edit button gone → message rejected
- [ ] Carol joins as Viewer → can read → can't write
- [ ] Unshare from 3 users → all see access removed
- [ ] PII redacted identically for both users
- [ ] Permission check fails → error toast, not crash

### Performance Targets

- Chat list filter (500+ chats): < 200ms
- Permission check per message: < 5ms
- Load team settings (100+ members): < 100ms

---

## 11. IMPLEMENTATION PHASES

### Phase 1: Database & Backend (Days 1-5)
- SQLite schema migrations
- Rust db.rs functions (users, permissions, team)
- permissions.rs module (enforcement)
- user_commands, team_commands, permission_commands

### Phase 2: Frontend Stores (Days 5-7)
- userStore, teamStore
- Update chatStore with permissions
- Create collaboration.ts types

### Phase 3: React Components (Days 8-12)
- TeamSettingsPanel
- ShareChatModal
- ChatList filters
- ChatWindow header updates

### Phase 4: Integration & Testing (Days 13-15)
- E2E tests with Playwright
- Security testing (bypass attempts)
- PII redaction integration
- Performance benchmarking

---

## 12. RISK & MITIGATION

| Risk | Mitigation |
|------|-----------|
| Permission bypass in Tauri commands | Implement require_*_access() guards; code review all mutations |
| Cache invalidation (permissions change mid-chat) | Fetch permissions on every chat open; refresh on team settings change |
| Race condition (remove user → still has edit open) | Backend re-checks permissions before write; shows error in UI |
| PII leakage via sharing | Redaction happens before cloud send, independent of sharing |
| Orphaned chats (owner deactivated) | Cascade delete on user deactivation; or mark as orphaned for admin recovery |

---

## 13. TAURI IPC CONTRACT

```typescript
// Users
invoke('create_user', { name, email? })
invoke('get_user', { userId })
invoke('get_all_users', {})
invoke('update_user', { userId, name?, email? })
invoke('deactivate_user', { userId })

// Team
invoke('get_team_settings', {})
invoke('add_team_member', { currentUser, userId, role })
invoke('remove_team_member', { currentUser, userId })
invoke('update_member_role', { currentUser, userId, role })

// Permissions
invoke('share_chat', { currentUser, chatId, userId, role })
invoke('unshare_chat', { currentUser, chatId, userId })
invoke('update_chat_permission', { currentUser, chatId, userId, role })
invoke('get_chat_permissions', { chatId })
invoke('get_accessible_conversations', { userId })
invoke('evaluate_chat_access', { userId, chatId })
```

All commands return errors (string) if permission check fails.

