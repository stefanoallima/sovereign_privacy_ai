# Tasks: Team Collaboration (Multi-User, Shared Chats)

**Change:** green_team-collaboration-basic_06  
**Total Tasks:** 18  
**Effort:** L (Large, 15-20 business days)

---

## PHASE 1: DATABASE & BACKEND (Days 1-5)

### T01: SQLite Schema Migrations

**Effort:** S  
**Files:** `src-tauri/src/db.rs`, `.migrations/`  
**Dependencies:** None  
**SharedFiles:** db.rs

Create database schema for users, teams, chat permissions:

- [ ] Add `users` table (id, name, email, created_at, updated_at, is_active)
- [ ] Add `teams` table (id, name, created_at, updated_at)
- [ ] Add `team_members` table (id, user_id, team_id, role, joined_at, added_by)
- [ ] Add `chat_permissions` table (id, chat_id, user_id, role, granted_at, granted_by)
- [ ] Add `owner_id` column to conversations table
- [ ] Add `is_shared` column to conversations table
- [ ] Create indexes: idx_chat_permissions_user, idx_chat_permissions_chat, idx_conversations_owner, idx_conversations_is_shared, idx_team_members_user, idx_team_members_team
- [ ] Write migration helper: `ensure_default_user()` (creates "Owner" on first launch)
- [ ] Test schema with sample data

**Acceptance Criteria:**
- [ ] All tables created without errors
- [ ] Indexes improve query performance (verify with EXPLAIN PLAN)
- [ ] ensure_default_user() creates single "Owner" user on first launch, skips on subsequent runs
- [ ] Foreign key constraints work (delete user → cascade delete chats)
- [ ] Sample data loads without constraint violations

---

### T02: Database Functions (Users & Teams)

**Effort:** M  
**Files:** `src-tauri/src/db.rs`  
**Dependencies:** T01  
**SharedFiles:** db.rs

Implement CRUD operations for users and teams:

- [ ] `create_user(name, email) -> User`
- [ ] `get_user(user_id) -> User`
- [ ] `get_all_users() -> Vec<User>`
- [ ] `update_user(user_id, name, email) -> ()`
- [ ] `deactivate_user(user_id) -> ()` (soft delete, sets is_active=0)
- [ ] `get_team_settings() -> TeamSettings`
- [ ] `add_team_member(user_id, role, added_by) -> ()`
- [ ] `remove_team_member(user_id) -> ()`
- [ ] `update_member_role(user_id, role) -> ()`
- [ ] `check_user_is_admin(user_id) -> Result<()>`
- [ ] Test with multi-user scenarios

**Acceptance Criteria:**
- [ ] User creation returns UUID with timestamps
- [ ] Deactivate sets is_active=0 without deleting
- [ ] Team member add/remove updates joined_at, added_by correctly
- [ ] Only admins can add members (check_user_is_admin succeeds)
- [ ] Non-admins get Unauthorized error on member ops
- [ ] Query performance: 100 team members < 50ms

---

### T03: Database Functions (Chat Permissions)

**Effort:** M  
**Files:** `src-tauri/src/db.rs`  
**Dependencies:** T01, T02  
**SharedFiles:** db.rs

Implement permission grant/revoke and access queries:

- [ ] `share_chat(chat_id, user_id, role, granted_by) -> ()`
- [ ] `unshare_chat(chat_id, user_id) -> ()`
- [ ] `update_chat_permission(chat_id, user_id, role) -> ()`
- [ ] `get_chat_permissions(chat_id) -> Vec<ChatPermissionGrant>`
- [ ] `get_accessible_conversations(user_id) -> Vec<Conversation>`
- [ ] `get_chat_owner(chat_id) -> String` (owned_id)
- [ ] `has_chat_permission(user_id, chat_id, role) -> bool`
- [ ] `evaluate_chat_access(user_id, chat_id) -> ChatAccessEvaluation`
- [ ] `check_user_owns_chat(user_id, chat_id) -> Result<()>`
- [ ] Test permission matrices (Viewer/Editor/Creator)

**Acceptance Criteria:**
- [ ] Duplicate permission grants prevented (UNIQUE constraint)
- [ ] get_accessible_conversations returns owned + permitted chats
- [ ] evaluate_chat_access returns correct canRead/canWrite/canDelete per role
- [ ] has_chat_permission returns false for users with no grant
- [ ] check_user_owns_chat returns error for non-owners
- [ ] Query performance: 500 accessible chats < 200ms

---

### T04: Permission Enforcement Module

**Effort:** M  
**Files:** `src-tauri/src/permissions.rs` (NEW)  
**Dependencies:** T03  
**SharedFiles:** None

Create central permission checker middleware:

- [ ] Define `PermissionChecker` struct
- [ ] Implement `can_read_conversation(user_id, chat_id) -> bool`
- [ ] Implement `can_write_conversation(user_id, chat_id) -> bool`
- [ ] Implement `can_delete_conversation(user_id, chat_id) -> bool`
- [ ] Define `require_read_access(user_id, chat_id) -> Result<()>`
- [ ] Define `require_write_access(user_id, chat_id) -> Result<()>`
- [ ] Define `require_delete_access(user_id, chat_id) -> Result<()>`
- [ ] Add to lib.rs: `pub mod permissions;`
- [ ] Unit tests: verify all permission combinations

**Acceptance Criteria:**
- [ ] Owner always has all permissions
- [ ] Viewer has read-only access
- [ ] Editor has read+write (no delete)
- [ ] Non-shared users get denied access
- [ ] Each require_* function returns descriptive error message
- [ ] Permission checks complete in < 5ms (cached DB results)

---

### T05: Tauri Commands (Users & Teams)

**Effort:** M  
**Files:** `src-tauri/src/user_commands.rs` (NEW), `src-tauri/src/team_commands.rs` (NEW)  
**Dependencies:** T02, T04  
**SharedFiles:** lib.rs

Create Tauri command handlers for user/team management:

**user_commands.rs:**
- [ ] `create_user(name, email) -> User`
- [ ] `get_user(user_id) -> User`
- [ ] `get_all_users() -> Vec<User>`
- [ ] `update_user(user_id, name?, email?) -> ()`
- [ ] `deactivate_user(user_id) -> ()`
- [ ] Add error handling (CommandError enum)

**team_commands.rs:**
- [ ] `get_team_settings() -> TeamSettings`
- [ ] `add_team_member(current_user, user_id, role) -> ()` with permission check
- [ ] `remove_team_member(current_user, user_id) -> ()` with permission check
- [ ] `update_member_role(current_user, user_id, role) -> ()` with permission check
- [ ] Add DbState(Mutex<Connection>) wrapper for Tauri state
- [ ] Register all commands in lib.rs
- [ ] Test with mock Tauri context

**Acceptance Criteria:**
- [ ] Commands serialize/deserialize correctly
- [ ] Permission checks block non-admins from member ops
- [ ] All commands return proper error codes on failure
- [ ] IPC latency < 50ms per command (excluding DB work)

---

### T06: Tauri Commands (Chat Permissions)

**Effort:** M  
**Files:** `src-tauri/src/permission_commands.rs` (NEW)  
**Dependencies:** T03, T04, T05  
**SharedFiles:** lib.rs

Create Tauri command handlers for chat sharing:

- [ ] `share_chat(current_user, chat_id, user_id, role) -> ()`
  - Permission check: require owner
- [ ] `unshare_chat(current_user, chat_id, user_id) -> ()`
  - Permission check: require owner
- [ ] `update_chat_permission(current_user, chat_id, user_id, role) -> ()`
  - Permission check: require owner
- [ ] `get_chat_permissions(chat_id) -> Vec<ChatPermissionGrant>`
- [ ] `get_accessible_conversations(user_id) -> Vec<Conversation>`
- [ ] `evaluate_chat_access(user_id, chat_id) -> ChatAccessEvaluation`
- [ ] Register all commands in lib.rs
- [ ] Integration test: share → verify recipient sees chat

**Acceptance Criteria:**
- [ ] Only owner can share/unshare (non-owners get 403)
- [ ] get_accessible_conversations includes all accessible chats
- [ ] evaluate_chat_access returns accurate permission evaluation
- [ ] Share operations update is_shared flag in conversations table
- [ ] Commands handle edge cases (user removed, duplicate grant, etc)

---

### T07: Update Existing Commands (Permission Checks)

**Effort:** M  
**Files:** `src-tauri/src/commands.rs` (or relevant chat command handlers)  
**Dependencies:** T04, T06  
**SharedFiles:** commands.rs

Add permission checks to all existing chat mutation commands:

- [ ] `add_message_to_chat()` → call require_write_access before INSERT
- [ ] `update_message()` → call require_write_access before UPDATE
- [ ] `delete_message()` → call require_delete_access before DELETE
- [ ] `delete_conversation()` → call require_delete_access before DELETE
- [ ] `create_conversation()` → set owner_id to current_user
- [ ] All commands must accept `user_id` parameter (from frontend)
- [ ] Test permission denied scenarios for each command

**Acceptance Criteria:**
- [ ] Viewer gets 403 on message add attempt
- [ ] Editor gets 403 on message delete attempt
- [ ] Owner can delete conversation
- [ ] Non-shared users get 403 on read attempt
- [ ] All existing tests still pass (no breaking changes)

---

## PHASE 2: FRONTEND STORES (Days 5-7)

### T08: Zustand User Store

**Effort:** S  
**Files:** `apps/desktop/src/stores/user.ts` (NEW), `apps/desktop/src/types/collaboration.ts` (NEW)  
**Dependencies:** T05  
**SharedFiles:** stores/

Create user account management store:

- [ ] Create `collaboration.ts` types (LocalUser, ChatPermissionLevel, etc)
- [ ] Create `user.ts` store with Zustand
- [ ] `currentUserId`, `currentUser`, `allUsers` state
- [ ] `setCurrentUser(userId)` → invoke 'get_user'
- [ ] `createUser(name, email?)` → invoke 'create_user'
- [ ] `updateUser(userId, updates)` → invoke 'update_user'
- [ ] `loadUsers()` → invoke 'get_all_users'
- [ ] `getUser(userId)` → find in allUsers
- [ ] Persist to localStorage with `persist` middleware
- [ ] Test store actions and subscriptions

**Acceptance Criteria:**
- [ ] Store persists across app reload
- [ ] setCurrentUser updates both currentUserId and currentUser
- [ ] loadUsers populates allUsers array
- [ ] getUser returns user from cache (no DB call)
- [ ] Create user returns new LocalUser object

---

### T09: Zustand Team Store

**Effort:** S  
**Files:** `apps/desktop/src/stores/team.ts` (NEW)  
**Dependencies:** T05  
**SharedFiles:** stores/

Create team membership and chat sharing store:

- [ ] Create `team.ts` store with Zustand
- [ ] `teamSettings` state, `loadTeamSettings()` → invoke 'get_team_settings'
- [ ] `addTeamMember(userId)` → invoke 'add_team_member'
- [ ] `removeTeamMember(userId)` → invoke 'remove_team_member'
- [ ] `updateMemberRole(userId, role)` → invoke 'update_member_role'
- [ ] `shareChat(chatId, userId, role)` → invoke 'share_chat'
- [ ] `unshareChat(chatId, userId)` → invoke 'unshare_chat'
- [ ] `updateChatPermission(chatId, userId, role)` → invoke 'update_chat_permission'
- [ ] `getChatPermissions(chatId)` → invoke 'get_chat_permissions'
- [ ] Persist to localStorage
- [ ] Test team operations

**Acceptance Criteria:**
- [ ] addTeamMember updates teamSettings.members
- [ ] removeTeamMember removes from list
- [ ] getChatPermissions returns array of permission grants
- [ ] shareChat reflects in chat list (owner sees "Shared")
- [ ] unshareChat removes permission grant

---

### T10: Update Chat Store (Permissions)

**Effort:** S  
**Files:** `apps/desktop/src/stores/chat.ts` (MODIFICATION)  
**Dependencies:** T08, T09  
**SharedFiles:** stores/chat.ts

Extend existing chat store with permission fields and actions:

- [ ] Add `ownerships: Record<string, string>` (chatId → userId)
- [ ] Add `permissions: Record<string, ChatPermissionGrant[]>` (chatId → perms)
- [ ] `getAccessibleChats()` → invoke 'get_accessible_conversations'
- [ ] `getCanAccessChat(chatId)` → local evaluation (owner? → permission? → role)
- [ ] `loadChatPermissions(chatId)` → invoke 'get_chat_permissions'
- [ ] Add computed `isOwner(chatId)` helper
- [ ] Add computed `canWrite(chatId)` helper
- [ ] Integrate with existing conversation loading
- [ ] Test permission evaluation with mock data

**Acceptance Criteria:**
- [ ] getCanAccessChat returns correct canRead/canWrite/canDelete
- [ ] Owner always gets all permissions
- [ ] Viewer returns canRead=true, canWrite=false
- [ ] Non-shared returns canRead=false
- [ ] getAccessibleChats filters for current user only
- [ ] Permission cache invalidates on team settings change

---

## PHASE 3: REACT COMPONENTS (Days 8-12)

### T11: Team Settings Panel Component

**Effort:** M  
**Files:** `apps/desktop/src/components/team/TeamSettingsPanel.tsx` (NEW)  
**Dependencies:** T08, T09  
**SharedFiles:** None

Create team member management UI:

- [ ] Component layout: member list + add button
- [ ] Render `teamSettings.members` with name, email, role
- [ ] Role dropdown (member/admin/owner) with change handler
- [ ] Remove button with confirmation dialog
- [ ] Add Member button → selection modal
- [ ] Modal shows available users (not already in team)
- [ ] Select user + confirm → invoke 'add_team_member'
- [ ] Call `useTeamStore.loadTeamSettings()` on mount
- [ ] Handle errors (show toast on failure)
- [ ] Styling: match existing Settings panels

**Acceptance Criteria:**
- [ ] List displays all team members
- [ ] Role change works (updates store + DB)
- [ ] Remove member shows confirmation + executes
- [ ] Add member modal shows only non-members
- [ ] Loading state while saving
- [ ] Error handling with user feedback

---

### T12: Share Chat Modal Component

**Effort:** M  
**Files:** `apps/desktop/src/components/chat/ShareChatModal.tsx` (NEW)  
**Dependencies:** T09, T10  
**SharedFiles:** None

Create chat sharing dialog:

- [ ] Modal layout: current shares + add section
- [ ] Display current permission grants for chat
- [ ] "Change" role button per share (opens role selector)
- [ ] "Remove share" button per recipient (with confirmation)
- [ ] Add share section: user multiselect + role dropdown
- [ ] Prevent sharing with self (grey out current user)
- [ ] Prevent duplicate shares (disable if already shared)
- [ ] "Share" button disabled until valid user + role selected
- [ ] Invoke 'share_chat' / 'unshare_chat' / 'update_chat_permission'
- [ ] Refresh permissions on successful action
- [ ] Styling: match chat UI theme

**Acceptance Criteria:**
- [ ] Current shares render correctly
- [ ] Can change permission level (Viewer ↔ Editor)
- [ ] Can unshare with confirmation
- [ ] Cannot share with self or duplicate
- [ ] Success toast on share
- [ ] Error toast with message on failure

---

### T13: Chat List Items & Filters

**Effort:** M  
**Files:** `apps/desktop/src/components/chat/Sidebar.tsx` (MODIFICATION), `apps/desktop/src/components/chat/ChatListItem.tsx` (MODIFICATION)  
**Dependencies:** T10, T11  
**SharedFiles:** None

Add sharing indicators and filter toggles:

**ChatListItem updates:**
- [ ] Show 🔗 icon if isShared
- [ ] Show 🔒 icon if private (not shared)
- [ ] Show "Shared by [Name]" if not owner
- [ ] Add permission badge (Viewer/Editor) if not owner
- [ ] Badge styling: different color per role
- [ ] Hover shows tooltip with permission details

**Sidebar updates:**
- [ ] Add filter buttons: "All" / "My Chats" / "Shared with Me" / "Contributed To"
- [ ] "All": show everything user owns or has permission to access
- [ ] "My Chats": owner_id = currentUser only
- [ ] "Shared with Me": has permission grant + not owner
- [ ] "Contributed To": Editor or higher
- [ ] Filter updates chatStore conversation list
- [ ] Active filter highlighted
- [ ] Chat counts per filter shown

**Acceptance Criteria:**
- [ ] Icons display correctly per chat state
- [ ] Shared-by name renders for non-owners
- [ ] Permission badge visible and styled
- [ ] Filters switch conversation list correctly
- [ ] Chat counts update on share/unshare
- [ ] No performance regression (< 100ms filter)

---

### T14: Chat Window Header Updates

**Effort:** S  
**Files:** `apps/desktop/src/components/chat/ChatWindow.tsx` (MODIFICATION)  
**Dependencies:** T10, T12  
**SharedFiles:** None

Add share info and controls to chat header:

- [ ] Show "Shared with X people" if isShared (clickable → opens ShareModal)
- [ ] Show "Owner: [Name]" if not owner (small label, light color)
- [ ] Show "Read-Only" warning badge if Viewer role
- [ ] Show "Editable" badge if Editor role
- [ ] Share button in header (only for owner)
- [ ] Share button opens ShareChatModal
- [ ] Verify permission on render (canRead check)
- [ ] If not readable: show "Access Denied" message
- [ ] Styling: non-obtrusive, secondary text color

**Acceptance Criteria:**
- [ ] Shared indicator shows correct count
- [ ] Owner name accurate for shared chats
- [ ] Read-Only warning shows for viewers
- [ ] Share button only visible to owner
- [ ] Permission denied shows graceful message (not blank)
- [ ] Header updates when permission changes

---

### T15: Permission-Gated Message UI

**Effort:** S  
**Files:** `apps/desktop/src/components/chat/MessageBubble.tsx` (MODIFICATION), `apps/desktop/src/components/chat/ChatInputArea.tsx` (MODIFICATION)  
**Dependencies:** T10, T14  
**SharedFiles:** None

Update message editing and input based on permissions:

**MessageBubble updates:**
- [ ] Hide edit/delete buttons if Viewer
- [ ] Hide edit/delete buttons if Editor (only delete if own message)
- [ ] Show full controls if owner
- [ ] Add message author name for shared chats
- [ ] Styling: disable edit/delete buttons (greyed) vs hide

**ChatInputArea updates:**
- [ ] Disable text input if Viewer (show readonly notice)
- [ ] Disable text input if no write permission
- [ ] Show "You can only read this conversation" for Viewer
- [ ] Clear input on permission revoke (mid-chat)
- [ ] Add permission warning above input if not owner
- [ ] Handle permission denied on message send

**Acceptance Criteria:**
- [ ] Viewers see read-only UI (no input)
- [ ] Editors see input + edit but not delete own
- [ ] Owners see full controls
- [ ] Permission denied error handled gracefully
- [ ] Author names visible on shared chat messages
- [ ] UI updates when permission changes mid-chat

---

## PHASE 4: INTEGRATION & TESTING (Days 13-15)

### T16: Unit & Integration Tests (Rust Backend)

**Effort:** M  
**Files:** `src-tauri/src/db.rs`, `src-tauri/src/permissions.rs` (test modules)  
**Dependencies:** T01-T07  
**SharedFiles:** None

Write backend tests for correctness:

- [ ] Test user CRUD (create, read, update, deactivate)
- [ ] Test team member management (add, remove, role change)
- [ ] Test permission grant/revoke (share, unshare, update)
- [ ] Test permission evaluation (owner/viewer/editor matrix)
- [ ] Test access denial scenarios (non-owner share, non-reader access)
- [ ] Test edge cases (orphaned chats, duplicate perms, deleted user)
- [ ] Test performance (500 chats filter < 200ms)
- [ ] Run `cargo test` with all passing
- [ ] Measure code coverage (target: > 80% for permissions)

**Acceptance Criteria:**
- [ ] All tests pass (`cargo test`)
- [ ] Permission matrix tests: 3×3 = 9 combinations
- [ ] Edge case tests cover 5 scenarios
- [ ] Performance benchmarks documented
- [ ] No panics or unwrap() calls in command handlers

---

### T17: E2E Tests (Playwright)

**Effort:** M  
**Files:** `apps/desktop/e2e/team-collaboration.spec.ts` (NEW)  
**Dependencies:** T08-T15  
**SharedFiles:** None

Write end-to-end browser tests:

- [ ] Test: Create chat (private, not shared)
- [ ] Test: Share chat with another user (Editor)
- [ ] Test: Recipient sees shared chat in list
- [ ] Test: Recipient can add message
- [ ] Test: Originator sees recipient's message
- [ ] Test: Downgrade permission (Editor → Viewer)
- [ ] Test: Viewer can read but not edit (button hidden)
- [ ] Test: Viewer tries to edit → error + no save
- [ ] Test: Unshare chat → chat disappears from recipient's list
- [ ] Test: Multiple recipients with different roles
- [ ] Test: PII redacted identically for both users
- [ ] Run with Playwright headless

**Acceptance Criteria:**
- [ ] All tests pass (`pnpm test:e2e`)
- [ ] Tests cover happy path + 3 error scenarios
- [ ] Permission downgrades tested with fresh browser state
- [ ] Screenshots captured on failure
- [ ] Tests complete < 5 min per user flow

---

### T18: Security & Manual QA Testing

**Effort:** M  
**Files:** Documentation, test cases  
**Dependencies:** T01-T17  
**SharedFiles:** None

Verify security and usability:

**Security Tests:**
- [ ] Attempt to share chat via API without ownership → 403
- [ ] Attempt to forge user_id in Tauri command → validation rejects
- [ ] Attempt SQL injection in username → parameterized query protects
- [ ] Attempt to access deleted user's chats → 403
- [ ] Attempt to grant permission to self → validation rejects
- [ ] Verify permission checks fire on EVERY mutation (not just UI)

**Manual QA Tests:**
- [ ] Create 3 user accounts, share 1 chat with different roles
- [ ] Verify read-only UI for Viewer (no edit buttons)
- [ ] Verify edit UI for Editor (can edit, not delete)
- [ ] Verify full UI for Owner (share button visible)
- [ ] Change permission mid-chat (downgrade → verify UI updates)
- [ ] Remove user from team (verify no future shares possible)
- [ ] Team settings panel: add/remove members, change roles
- [ ] Share modal: add/remove shares, change roles
- [ ] Chat list filters: all chats, my chats, shared with me
- [ ] Permission caching: verify no stale permissions

**Acceptance Criteria:**
- [ ] No permission bypass exploits found
- [ ] All manual tests pass on Windows + macOS
- [ ] Error messages are user-friendly (not technical)
- [ ] UI responsive (no hangs on permission ops)
- [ ] No data loss on permission revoke mid-operation

---

## SUMMARY

**Total Effort:** L (15-20 business days)

**Risk Areas:**
1. Permission race conditions (user offline, permission changes mid-chat)
2. PII redaction consistency with sharing
3. Cache invalidation (permission changes, team updates)
4. Concurrent edits by multiple editors

**Key Deliverables:**
- Multi-user account system
- Local team membership management
- Chat sharing with role-based access control
- Secure permission enforcement at backend
- Updated UI with sharing indicators and controls
- Comprehensive test coverage (unit + integration + e2e)

**Success Criteria:**
- Aisha can create shared legal chat with co-founder
- Co-founder sees chat, can comment (Editor role)
- Aisha can downgrade to Viewer later (read-only)
- PII redaction works identically for both users
- No permission bypass exploits
- All tests pass (unit, integration, e2e)

