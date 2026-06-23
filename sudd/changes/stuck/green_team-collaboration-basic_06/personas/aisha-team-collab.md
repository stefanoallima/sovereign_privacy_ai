# Consumer Persona: Aisha — Team Collaboration Feature

**Source:** startup-founder-legal.md (repo level)  
**Focus:** Multi-user shared chats, team member access control  
**Updated:** 2026-06-23

---

## Identity

**Name:** Aisha Okonkwo  
**Role:** Co-founder, Series A SaaS startup  
**Tech Comfort:** High (computer science background)  
**Company:** 15 employees, Lagos-based (remote-first)

### Context for This Feature

Aisha is fundraising and needs to collaborate with her co-founder Sarah on legal and financial decisions. Currently she uses Sovereign AI solo, asking legal questions privately. Her deal-breaker: **multi-user access and shared chat functionality** so Sarah can review sensitive questions and add notes without Aisha forwarding screenshots or summaries.

---

## Objectives (Team Collaboration Specific)

### O1: Share Legal Advice with Co-founder
- **Goal:** Create a shared "Legal Q&A" conversation; invite Sarah (co-founder) with Editor role; both ask questions and add notes
- **Success:** Sarah can read all legal questions; add clarifications; Aisha can see Sarah's additions in real-time
- **Measurement:** Within 2 weeks, move all contract/equity questions to shared chat; co-founder actively contributing

### O2: Control Who Sees What
- **Goal:** Some chats private (personal health/tax), some shared (company legal/finance); clear UI showing ownership
- **Success:** Private chats invisible to Sarah; shared chats marked with 🔗 icon; permission level (Editor/Viewer) visible
- **Measurement:** No accidental oversharing; Sarah has exactly the access Aisha grants

### O3: Audit & Export Collaboration
- **Goal:** Eventually export all shared legal Q&A as encrypted archive for lawyer review (post-v1)
- **Success:** Conversations have clear ownership/timestamps; who said what is traceable
- **Measurement:** Can hand lawyer a "company legal knowledge base" with full audit trail

### O4: Onboard New Team Members to Legal Precedents
- **Goal:** As company grows, invite lawyers/accountants with Viewer role to shared chats (read-only access)
- **Success:** New employees see company precedents without editing; reduces duplication of questions
- **Measurement:** New hire ramp-up time reduced; fewer repeat questions

---

## Deal-Breakers (Team Collaboration Specific)

1. **If she can't control who accesses each chat** — Aisha will NOT use this if she can't mark chats as private vs. shared. No app-level sharing (all chats accessible by default). She wants **private by default**, explicit sharing required.

2. **If permissions aren't enforced at the backend** — If Sarah can somehow edit Aisha's private chats via API hacking, or Aisha can see Sarah's private chats via URL manipulation, that's deal-breaking. **Backend permission checks mandatory.**

3. **If removing someone doesn't actually revoke access** — If Sarah is removed from the team but can still read old shared chats (via cache or app bug), that's a security failure. **Clean revocation required.**

4. **If there's no clear ownership indicator** — If it's ambiguous who created a chat or has delete rights, Aisha will be confused and frustrated. **Ownership must be visible in UI.**

---

## Usage Pattern (Team Collaboration Scenario)

**Day 1:** Aisha creates "Series A Fundraising" shared chat, invites Sarah as Editor
- Aisha adds Q: "What's standard vesting schedule in our geography?"
- Sarah adds Q: "Any anti-dilution precedents?"
- Both see AI responses, both add follow-up notes

**Day 3:** Aisha creates "Personal Tax Planning" (private, no share)
- Only Aisha sees this; Sarah has zero visibility

**Day 5:** Aisha creates "Customer Agreement Template" shared chat, invites lawyer John as Viewer
- John can read; can't edit (read-only)
- Aisha & Sarah can edit (Editor role)
- Company knowledge base is preserved

**Day 30:** Aisha exports "Series A Fundraising" + "Customer Agreement" chats as encrypted PDF
- Sends to lawyer for work product privilege review
- No Aisha-Sarah chat artifacts leak; only intended conversations exported

---

## Mental Model

**Aisha's thinking:** "I own these conversations. Sarah is a trusted co-founder, so she gets Editor access. When Sarah leaves (or if we hire external counsel), I can downgrade to Viewer or remove access entirely. The app enforces this; I don't have to manually revoke access."

**Doesn't understand yet:** How permission enforcement works at the backend; assumes it works (but will test).

**Will test:**
- Can Sarah read Aisha's private chats? (No — verified)
- If Sarah is removed, can she still access old shared chats? (No — verified)
- If Aisha changes Sarah's role to Viewer, can Sarah still edit? (No — verified)
- Is there a way to permanently delete a shared chat so no one can access it? (Yes, owner only)

---

## Success Criteria

### ✓ MVP Success (This Change)
1. Aisha creates "Legal Q&A" chat (private by default)
2. Aisha clicks Share → selects Sarah → sets role to Editor → Sarah invited
3. Sarah sees chat in her list with "Shared by Aisha" label
4. Sarah adds a message → Aisha sees it
5. Aisha removes Sarah from share → Sarah can no longer access chat
6. UI clearly shows who owns each conversation
7. **Aisha confirms:** "This is usable. I can collaborate with Sarah confidently."

### ✓ Extended Success (Post-MVP, future)
1. Aisha invites lawyer John as Viewer (read-only) to "Customer Agreement" chat
2. Aisha exports "Legal Q&A" + "Agreements" as encrypted database
3. Lawyer can read exported chats; can't edit
4. Aisha can revoke John's access anytime
5. **Aisha confirms:** "This is my competitive moat. No one can leak these conversations."

### ✗ Failure Scenarios

- **Fails if:** Sarah is removed but can still read old shared chats (permission revocation bug)
- **Fails if:** Aisha can't tell which chats are shared vs. private (UI clarity)
- **Fails if:** Editor permission allows Sarah to delete Aisha's chats (over-permissioning)
- **Fails if:** Permission enforcement happens only in UI (backend doesn't check)
- **Fails if:** Aisha invites co-founder, but co-founder is confused about permissions

---

## Test Scenarios (QA Checklist)

- [ ] Create private chat; Sarah can't see it (isolated chats work)
- [ ] Share chat with Sarah as Editor; Sarah sees it + can add messages
- [ ] Share same chat with John as Viewer; John sees but can't edit
- [ ] Remove Sarah from share; Sarah's list updates; chat gone
- [ ] Downgrade Sarah to Viewer; Sarah's edit buttons disappear
- [ ] Aisha deletes chat; Sarah can't access (cascade delete works)
- [ ] Aisha is owner; Sarah tries to delete → rejected (backend enforces)
- [ ] Sarah offline; permission revoked; Sarah comes online; next load shows chat gone
- [ ] Share with 3 people (2 Editors, 1 Viewer); correct UI per role
- [ ] Aisha can change Sarah's permission mid-chat (view updates in real-time if possible)

---

## Implementation Notes

**For devs:**
- Aisha expects permission checks on **every** mutation (add message, edit message, delete)
- Not just UI hiding of buttons — backend must reject
- Is-shared status should be **visible** on each chat item (icon or text)
- Owner name should be **visible** for shared chats ("Owner: Aisha")
- Role should be **visible** for non-owners ("Your role: Editor")

**For QA:**
- Test with 2–3 user accounts (Aisha, Sarah, John)
- Verify permission changes are **immediate** (no caching stale perms)
- Verify removal **actually revokes** (refresh to confirm)

---

## Acceptance Criteria

1. **Multi-user accounts work** ✓ (Aisha, Sarah, John can all have accounts)
2. **Shared chats accessible** ✓ (Creator marks as Shared; others see in list)
3. **Permission model enforced** ✓ (Viewer reads-only; Editor reads+appends; Creator full control)
4. **Chat isolation maintained** ✓ (Private chats hidden from non-owners)
5. **UI is clear** ✓ (Share status, owner, permission level all visible)
6. **Aisha can showcase to Sarah** ✓ (Share legal chat; Sarah can comment)

---

## Validation Rubric

| Criterion | Exemplary (95+) | Acceptable (70-94) | Needs Work (<70) |
|-----------|-----------------|-------------------|-----------------|
| **Multi-user accounts** | Easy signup, clear user context | Works, slightly confusing | Broken or missing |
| **Sharing works** | Instant, no bugs, clear confirmation | Delayed, needs refresh | Doesn't share or broken |
| **Permissions enforced** | Backend denies access, error clear | Sometimes works, UI unclear | Can bypass permissions |
| **Permission changes immediate** | Real-time updates, no cache lag | Works after refresh | Stale data persists |
| **UI clarity** | Every chat shows owner/role/status | Most chats labeled | No indicators |
| **Aisha's success** | She'd use this with Sarah daily | She'd use it occasionally | She'd switch to ChatGPT |

