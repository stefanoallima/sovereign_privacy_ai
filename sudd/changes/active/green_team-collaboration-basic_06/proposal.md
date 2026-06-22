# Proposal: Implement Team Collaboration (Multi-User, Shared Chats)

**ID:** green_team-collaboration-basic_06  
**Title:** Add multi-user access and shared chat functionality for team collaboration  
**Size:** L (large)  
**Persona:** Aisha (primary)  
**Priority:** 2  

## Why

The alignment report identifies **GAP005 (part 1)**: Aisha (startup founder) has a deal-breaker — "If she can't control what happens to her chats (export, retention, encryption keys)... she'll reject it." She explicitly needs:
1. Multi-user access (co-founder to review legal chats)
2. Team collaboration (shared conversations, audit trail)
3. Chat export/import (portable knowledge base)
4. Company-controlled encryption keys

Currently, NONE of these are implemented. Aisha views this as "non-negotiable" for her use case. Without multi-user support, she cannot use Sovereign AI as a team legal advisor.

**Why it matters:** Aisha's success metric is "Company adoption: She pitches Sovereign AI to her co-founder and they adopt it as the official legal/financial AI advisor." Without team collaboration, this is impossible. She'll either fork the app, build her own, or use ChatGPT (which she's trying to move away from).

**Scope decision:** Splitting GAP005 into two proposals:
1. **This proposal (green_team-collaboration-basic_06):** Multi-user access, shared chats, permission model
2. **Follow-up proposal (green_team-collaboration-audit_07):** Audit trail, export/import, encryption key control

This split allows shipping basic team features (L) before tackling the more complex audit/export/key management (L).

## Current State

- **Single-user app:** All chats are per-user; no multi-user model
- **No permission system:** Cannot grant access to specific conversations
- **No shared chats:** Each user has isolated chat history
- **No audit trail:** No way to see who accessed what, when
- **Chat storage:** IndexedDB + SQLite (local, single-user)

## Desired State (Basic)

1. **User accounts (local):**
   - App supports multiple local user profiles (not cloud-based)
   - Each user has isolated chat history
   - User can be added to team (optional: prompt on startup "Add team member?")

2. **Shared conversations:**
   - Creator marks a chat as "Shared"
   - Shared chats appear in other team members' chat lists
   - Team members can read and append to shared chats
   - Clear indication of who wrote each message

3. **Basic permission model:**
   - Creator: Can edit/delete conversation, manage permissions
   - Editor: Can read and append messages
   - Viewer: Can read only (optional, for sensitive reviews)

4. **Team settings:**
   - Settings → Team: List of team members, manage access
   - Add member: Generate invite link or manual add
   - Remove member: Revoke access to future shared chats

## Acceptance Criteria

1. **Multi-user accounts work** — App supports adding team members; each has separate login/profile
2. **Shared chats are accessible** — Creator marks chat as Shared; other members see it in their chat list with "Shared by [name]"
3. **Permission model is enforced** — Viewer can read; Editor can read+append; Creator can edit/delete
4. **Chat isolation is maintained** — Each user's private chats are not visible to others
5. **UI is clear** — Shared chats have visual indicator (e.g., 🔗 icon); permission level is shown
6. **Aisha can showcase to co-founder** — She shares a legal chat with co-founder; co-founder sees it and can comment

## Dependencies

- Depends on: None (independent feature, but should ship before export/import)
- Unblocks: green_team-collaboration-audit_07 (export, audit, key management)

## Effort Justification

**L (Large) — 3–4 weeks (15–20 business days)**

**Complexity breakdown:**

1. **User account system:** (4–5 days)
   - User profile store (Zustand)
   - Local user database (SQLite table for users)
   - User selector UI on startup
   - No cloud authentication needed (local-only)

2. **Chat sharing logic:** (4–5 days)
   - Chat metadata schema: owner, permissions, shared_with_list
   - Share UI: modal to select team members and permission level
   - Chat list filtering: show shared + private chats with icons
   - Message attribution: show "Posted by [name]" for shared chats

3. **Permission model enforcement:** (3–4 days)
   - Chat access control: check permissions before allow read/write
   - Edit/delete restrictions: creator only
   - UI enforcement: disable edit button if Viewer

4. **Team settings UI:** (2–3 days)
   - Team panel in Settings
   - Add/remove member UI
   - Member list with access level

5. **Testing & QA:** (3–4 days)
   - Multi-user scenarios: creator adds member, member edits, creator deletes
   - Edge cases: member removed mid-chat, permission downgrade
   - Data isolation: verify private chats stay private
   - Performance: shared chat list loads quickly with many users

**Why it's L and not M:**
- Adds an entire dimension to the app (user accounts)
- Permission model requires careful testing (access control bugs are security issues)
- UI complexity: multiple new panels, modals, filtering logic
- Data isolation: must verify shared/private boundary is bulletproof

**Why it's not XL:**
- No cloud infrastructure (local-only)
- No complex encryption or key exchange
- User count is small (Aisha's startup: 15 employees, but probably 2–3 core users)

## Alignment Gap

**Reference:** GAP005 (Team Collaboration & Export Features Expected by Aisha, Not Shipped)

**Report excerpt:**
> "Aisha explicitly states this is 'non-negotiable.' She is a founder with competitive data (cap tables, contracts) and will need to: 1. Share with co-founder securely (no multi-user model). This is a full feature gap that makes the app unsuitable for Aisha's use case as described."

This proposal directly addresses the "no multi-user model" gap.

## Design Decisions

1. **Local-only accounts (no cloud):** Aisha doesn't trust cloud storage. User accounts are stored in local SQLite; each machine has independent team config.
2. **Invite links vs. manual add:** Start with manual add (simpler); invite links in post-v1
3. **Granular permissions:** Three levels (Viewer, Editor, Creator) for future flexibility
4. **Shared vs. private by default:** Chats are private by default; creator must explicitly share

## UX Considerations

- **Aisha's mental model:** "I want my co-founder Sarah to see my legal questions and add notes, but not access my personal tax questions"
- **Privacy:** Sharing a chat does NOT change its redaction or encryption; shared chats are still redacted before cloud sends
- **Clarity:** Shared chats are clearly marked; permission level is visible when opening a chat

## Future Enhancement (Post-v1)

- Invite links (so Aisha doesn't have to manually add co-founder's email)
- Audit trail: Log all actions (who accessed what, when) — see green_team-collaboration-audit_07
- Encryption key sharing: Team-controlled keys for export — see green_team-collaboration-audit_07

## Success Metric (Aisha)

Within 2 months after this ships, Aisha:
1. Creates a shared "Legal Q&A" chat with co-founder
2. Co-founder reviews legal questions and adds notes
3. They both trust the app as their official legal advisor
4. Aisha recommends it to other founders
