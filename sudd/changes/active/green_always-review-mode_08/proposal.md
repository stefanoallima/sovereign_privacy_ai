# Proposal: Implement Global "Always Review" Mode for Prompt Transparency

**ID:** green_always-review-mode_08  
**Title:** Add global "Always Review Before Send" toggle for complete prompt transparency  
**Size:** M (medium)  
**Persona:** David (primary), Aisha (secondary)  
**Priority:** 2  

## Why

The alignment report identifies **GAP006**: Prompt Transparency Review exists but is not guaranteed on all cloud sends. Currently:
- Review only appears "for personas configured with `attributes_only` content mode or `hybrid` backend"
- If David switches to a "local-only" persona, review is skipped
- If a user misconfigures a persona as "cloud-only," the review is also skipped
- **No global "always review before sending" mode**

David's mental model is: "I need to see *exactly* what's being sent." He views Prompt Transparency Review as critical for his use case. If he accidentally uses a "direct cloud" persona, data might leave without review, violating his trust.

**Why it matters:** David's success metric is "He can see *exactly* what's being sent... Prompt Transparency Review is critical for him." Without a global guarantee, this feature is optional (persona-dependent), not mandatory. If David discovers a review was skipped on any send, he'll distrust the app.

## Current State

- **PromptReviewPanel.tsx exists** and functions correctly
- **Review logic is conditional** — Only triggered for certain persona configurations
- **No Settings toggle** — User cannot enforce "always review"
- **Edge cases exist** — Misconfigured personas, local-only mode, etc. can bypass review
- **Documentation is unclear** — Users don't know when review will/won't trigger

## Desired State

1. **Settings → Privacy → "Always Review Before Send" toggle**
   - Default: OFF (respects user preference)
   - When ON: Every cloud send requires explicit approval in PromptReviewPanel
   - Works across all personas and backend configurations
   - Clear indicator: Badge in chat header "🛡️ Review Enabled"

2. **Override local-only backend restriction:**
   - Even for "local-only" personas, if Always Review is enabled, show a preview before local inference completes
   - Not a security restriction, but a UX consistency feature

3. **Audit trail integration:**
   - Log each review action: (timestamp, prompt_sent, approved_by_user)
   - Make reviewable in Privacy Dashboard for David's verification

4. **Edge case handling:**
   - User tries to send without reviewing → Prompt dialog: "Review is required before send. Click below."
   - Keyboard shortcut (Ctrl+Enter) bypasses review only if explicitly allowed in Settings

## Acceptance Criteria

1. **Settings toggle exists** — Settings → Privacy has "Always Review Before Send" option
2. **Review is enforced globally** — Every cloud send shows PromptReviewPanel when toggle is ON (across all personas)
3. **User cannot bypass review** — Cannot send without explicitly clicking Approve in review panel
4. **Local mode respects setting** — Even local-only responses show a preview/review if Always Review is ON
5. **Visual indicator is clear** — Badge in chat header shows review status
6. **David can verify in audit trail** — Privacy Dashboard shows all review actions and approvals
7. **No performance regression** — Enabling Always Review doesn't slow down the app

## Dependencies

- Depends on: None (builds on existing PromptReviewPanel)
- Unblocks: None immediate, but reinforces David's trust in the system

## Effort Justification

**M (Medium) — ~1 week (5 business days)**

- **Settings toggle:** Add to Privacy panel (~0.5 days)
- **Review enforcement logic:** Refactor cloud send code to check Always Review toggle (~1.5 days)
- **Local mode integration:** Add preview for local-only (optional; ~1 day)
- **Audit trail:** Log review actions to audit trail (~1 day)
- **Edge case handling:** Keyboard shortcuts, dialog prompts (~1 day)
- **Testing & QA:** Verify review cannot be bypassed; test edge cases (~1 day)

**Why it's M and not S:**
- Requires careful refactoring of cloud send code (high-risk; must not break existing review logic)
- Edge cases are numerous (keyboard shortcuts, misconfigured personas, etc.)
- Audit trail integration adds complexity

**Why it's not L:**
- No new backend logic needed
- PromptReviewPanel already exists and functions
- Mostly conditional logic and UI integration
- Low cognitive load once architecture is understood

## Alignment Gap

**Reference:** GAP006 (Prompt Transparency Review Not Guaranteed on All Cloud Sends)

**Report excerpt:**
> "David's mental model is 'I need to see *exactly* what's being sent.' The current implementation makes review optional per-persona. If David accidentally uses a 'direct cloud' persona, data leaves without review. The feature exists but is not a blanket guarantee. This could violate David's trust if he discovers a review was skipped."

This proposal adds the missing "blanket guarantee" that David needs.

## Design Decisions

1. **Global toggle (not per-persona):** Simpler for David; he sets it once and all his sends are reviewed
2. **Default OFF:** Respects users who understand the risks and don't want friction; David opts-in to Always Review
3. **Audit trail is optional:** Logged for David's peace of mind, but not mandatory for functionality
4. **Keyboard bypass is optional:** Experienced users can configure Ctrl+Enter to skip review (advanced setting)

## UX Considerations

- **David's mental model:** "I enable Always Review and know 100% that no prompt leaves without my approval"
- **Education:** Explain the difference between "Always Review" (every send) and "Prompt Transparency Review" (one-time feature that already exists)
- **Friction:** Approving every send adds ~1–2 seconds per message; David accepts this trade-off for confidence

## Testing Strategy

- **Unit test:** Verify Always Review toggle is read and checked before all cloud sends
- **E2E test:** Send message with Always Review ON; verify PromptReviewPanel is shown and approval is required
- **Edge case:** Try to send with keyboard shortcut (Ctrl+Enter); verify it's denied (unless user configured bypass)
- **Persona test:** Switch between local and hybrid personas; verify Always Review works for both
- **Audit trail test:** Enable Always Review, send messages, export audit log, verify all actions are logged

## Future Enhancement (Post-v1)

- Configurable keyboard bypass: Advanced users can set `always_review_shortcut_bypass = true`
- Review templates: For frequently-sent prompts, user can pre-approve templates
- Timed bypass: "Allow bypass for 5 minutes" (if user is in trusted environment)

## Success Metric (David)

Within 1 month after this ships, David:
1. Enables "Always Review Before Send" in Settings
2. Sends multiple messages across different personas; review panel appears every time
3. Exports audit trail showing all approval timestamps
4. Concludes: "I have complete control and visibility over what leaves my machine"
5. Recommends app to 2 friends (per his success criteria)
