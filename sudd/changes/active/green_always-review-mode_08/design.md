# Design: Always Review Mode

**Change**: green_always-review-mode_08  
**Persona**: David (primary), Aisha (secondary)  
**Acceptance Criteria**: 7  

---

## Architecture Overview

The "Always Review Before Send" feature adds a global security gate that ensures users have complete visibility and control over all cloud-based prompts before they leave the device.

**Key principle**: Eliminate the review/transparency gap by making prompt review mandatory (not optional per-persona) when the user enables this feature.

**Design approach**:
1. Add a simple boolean toggle in Settings → Privacy
2. Check this toggle before every cloud send in the inference hook
3. If enabled AND destination is cloud-based: block send, show review modal
4. User must explicitly click "Approve & Send" (cannot bypass via Escape, X, or click-outside)
5. Log all actions (approve, reject, local send) for audit trail
6. Show visual badge in chat header when feature is active

---

## Data Flow

### Normal Send Flow (Without Always Review)
```
User clicks Send
↓
useInference.sendMessage()
↓
[Cloud backend?] → Yes → Send to cloud API
                → No → Send to local backend
↓
Message appears in chat
```

### Send Flow (With Always Review ON)

```
User clicks Send
↓
useInference.sendMessage()
↓
Check: alwaysReviewBeforeSend enabled?
  ├─ NO → [Backend?] → Cloud or Local
  │         ├─ Cloud → Send directly
  │         └─ Local → Send directly
  │
  └─ YES → [Backend?]
           ├─ Local (ollama/llama.cpp) → Send directly (log as "sent_local")
           │
           └─ Cloud/Hybrid → Show PromptReviewPanel modal
                ↓
                User clicks Approve → Log "approved_for_cloud" → Send
                              OR
                User clicks Reject → Log "rejected" + reason → Don't send, clear modal
```

### Key Decision Points

1. **Local backend detection** (useInference.ts):
   - Detect backend from persona config or explicit backend selection
   - Local backends: ollama, llama.cpp, local
   - Cloud backends: Anthropic API, OpenAI API, etc.
   - Hybrid: treat as cloud (requires review)

2. **Modal non-dismissibility** (PromptReviewPanel.tsx):
   - Escape key: `onEscape={null}` (disabled)
   - X button: `display: none` (hidden)
   - Backdrop click: `onBackdropClick={null}` (disabled)
   - Only "Approve & Send" and "Reject" buttons functional

3. **Audit trail** (analytics.ts):
   - Log all actions (approve, reject, local send)
   - Metadata: timestamp, personaId, backend, rejectionReason (optional)
   - NO prompt content logged (privacy)

---

## Components & Integration Points

### 1. Settings Toggle (appSettings.ts + SettingsPage.tsx)

**Storage**:
- Field: `appSettings.alwaysReviewBeforeSend` (boolean, default: false)
- Persistence: localStorage key `alwaysReviewBeforeSend`
- Setter: `appSettings.updateAlwaysReviewBeforeSend(value)`

**UI**:
- Location: Settings → Privacy section
- Control: Checkbox toggle
- Label: "Always Review Before Send"
- Help text: "Require my explicit approval before any message leaves your device for cloud processing"
- Auto-save on toggle (no Save button needed)

**Integration**:
```typescript
// Read toggle in useInference.ts before send
const needsReview = appSettings.alwaysReviewBeforeSend && !isLocalBackend;
```

---

### 2. Review Gate Check (useInference.ts)

**Location**: In `sendMessage()` function, BEFORE any API call

**Logic**:
```typescript
const sendMessage = async (userMessage: string) => {
  const selectedBackend = personas[selectedPersona]?.backend || currentBackend;
  
  // Detect if backend is local (no cloud sends, no review needed)
  const isLocalBackend = 
    ['ollama', 'llama.cpp', 'local'].includes(selectedBackend) ||
    personas[selectedPersona]?.backendOption === 'local';
  
  // Check review requirement
  const needsReview = appSettings.alwaysReviewBeforeSend && !isLocalBackend;
  
  if (needsReview) {
    // Set pending review state (this triggers PromptReviewPanel modal)
    chatStore.setReviewModalPending({
      userMessage,
      personaId: selectedPersona,
      backend: selectedBackend,
      timestamp: Date.now(),
    });
    return; // Block send, wait for user to approve/reject
  }
  
  // Proceed with normal send (local or cloud without review required)
  await performActualSend(userMessage);
};
```

---

### 3. Review Modal (PromptReviewPanel.tsx)

**Rendering**:
```typescript
{chatStore.reviewModal.pending && (
  <PromptReviewPanel
    userMessage={chatStore.reviewModal.pending.userMessage}
    personaId={chatStore.reviewModal.pending.personaId}
    backend={chatStore.reviewModal.pending.backend}
    onApprove={() => confirmSendMessage('approve')}
    onReject={(reason) => confirmSendMessage('reject', reason)}
  />
)}
```

**Modal Configuration**:
- `onEscape={null}` — Escape key disabled
- `onBackdropClick={null}` — Click outside disabled
- X button: `display: none` or removed entirely
- Tab focus: trapped within modal (TabbablePanel component)

**Content**:
- Show original prompt text
- Show persona name
- Show backend destination
- Two buttons: "Approve & Send" (blue), "Reject" (gray)
- Optional rejection reason textarea (shown on Reject hover)

**Non-dismissibility** (5-layer protection):
1. Modal has no X button (hidden)
2. Escape key disabled via Modal API
3. Click outside doesn't close (no backdrop click handler)
4. Send button disabled while modal pending
5. Both buttons require explicit user action to clear modal

---

### 4. Approval/Rejection Handler (useInference.ts)

**Function**:
```typescript
const confirmSendMessage = (action: 'approve' | 'reject', reason?: string) => {
  if (action === 'approve') {
    // Log approval
    logPromptReviewGate('approved_for_cloud', {
      personaId: chatStore.reviewModal.pending.personaId,
      backend: chatStore.reviewModal.pending.backend,
      timestamp: chatStore.reviewModal.pending.timestamp,
    });
    
    // Clear modal and proceed with send
    chatStore.clearReviewModal();
    performActualSend(chatStore.reviewModal.pending.userMessage);
  } else {
    // Log rejection
    logPromptReviewGate('rejected', {
      personaId: chatStore.reviewModal.pending.personaId,
      backend: chatStore.reviewModal.pending.backend,
      timestamp: chatStore.reviewModal.pending.timestamp,
      rejectionReason: reason || 'User rejected without reason',
    });
    
    // Clear modal, do NOT send
    chatStore.clearReviewModal();
  }
};
```

---

### 5. Audit Logging (analytics.ts)

**Function**:
```typescript
const logPromptReviewGate = (
  action: 'approved_for_cloud' | 'rejected' | 'sent_local' | 'sent_local_persona',
  metadata: {
    personaId: string;
    backend: string;
    timestamp: number;
    rejectionReason?: string;
  }
) => {
  const event = {
    action,
    timestamp: new Date(metadata.timestamp).toISOString(),
    personaId: metadata.personaId,
    backend: metadata.backend,
    rejectionReason: metadata.rejectionReason || null,
  };
  
  // Send to analytics (Sentry, internal logging, etc.)
  analytics.track('prompt_review_gate', event);
};
```

**Events Logged**:
- `approved_for_cloud`: User approved cloud send (allows send to proceed)
- `rejected`: User rejected send (blocks send completely)
- `sent_local`: Message processed locally (local backend, no review required)
- `sent_local_persona`: Local persona processed (no cloud, no review)

**Privacy**: No prompt content in logs, only metadata (persona, backend, action, timestamp)

---

### 6. Visual Indicator (ChatWindow.tsx)

**Location**: Chat header, right side (next to persona name)
**Visibility**: Only when `alwaysReviewBeforeSend === true`
**Content**: "🛈 Review Enabled" badge
**Purpose**: Remind user that review is currently active
**Styling**: 
- Icon: 🛈 (shield icon)
- Text: "Review Enabled"
- Color: Subtle blue or gray
- Font size: Smaller than persona name

**Implementation**:
```typescript
{appSettings.alwaysReviewBeforeSend && (
  <div className="review-badge" title="Prompt review is enabled">
    <span>🛈 Review Enabled</span>
  </div>
)}
```

---

### 7. Send Button State (ChatWindow.tsx)

**Disable while reviewing**:
- Send button is disabled when `reviewModal.pending !== null`
- Visual feedback: opacity reduced, cursor not-allowed
- Re-enable immediately when modal clears (approve or reject)

```typescript
<button
  disabled={chatStore.reviewModal.pending !== null}
  onClick={sendMessage}
>
  Send
</button>
```

---

## File Changes Required

| File | Change | Lines | Phase |
|------|--------|-------|-------|
| `src/store/appSettings.ts` | Add `alwaysReviewBeforeSend` field + setter | ~15 | 1 |
| `src/store/messages.ts` | Add `reviewModal.pending` state object | ~20 | 1 |
| `src/pages/SettingsPage.tsx` | Add Privacy toggle UI | ~15 | 1 |
| `src/components/ChatWindow.tsx` | Add badge + disable send button | ~15 | 1 |
| `src/hooks/useInference.ts` | Add review gate + confirmSendMessage | ~40 | 2-3 |
| `src/components/PromptReviewPanel.tsx` | Add Approve/Reject buttons + modal config | ~25 | 2 |
| `src/services/analytics.ts` | Add logPromptReviewGate function | ~15 | 3 |

**Total**: ~7 files, ~145 lines of new/modified code

---

## Edge Cases & Handling

| # | Scenario | Handling |
|----|----------|----------|
| 1 | User toggles review during message composition | New setting applies to next send, current message unaffected |
| 2 | User rejects send, then retries | Independent send attempt, each logged separately |
| 3 | Network error during approval | Existing error resilience handles; user sees error dialog |
| 4 | Hybrid mode (local + cloud) | Treated as cloud-based, review required |
| 5 | Multi-persona conversation | Correct personaId stored in audit log per send |
| 6 | App closes with modal open | Pending state cleared on startup (recovers gracefully) |
| 7 | User presses Ctrl+Enter (keyboard shortcut) | Goes through same review gate (cannot bypass) |
| 8 | Direct browser console bypass attempt | Cannot call sendMessage without going through hook |

---

## Implementation Order (4 Phases)

### Phase 1: Foundation (Day 1)
- T01: appSettings.ts (toggle storage)
- T02: messages.ts (modal state)
- T03: ChatWindow.tsx (badge)
- T04: SettingsPage.tsx (toggle UI)
- T05: ChatWindow.tsx (disable send button)
- **Verification**: AC1, AC4, AC5

### Phase 2: Review Logic (Day 2)
- T06: useInference.ts (review gate)
- T07: PromptReviewPanel.tsx (buttons)
- T08: PromptReviewPanel.tsx (non-dismissible config)
- **Verification**: AC2, AC3

### Phase 3: Logging (Day 2-3)
- T09: useInference.ts (confirmSendMessage)
- T10: analytics.ts (logPromptReviewGate)
- T11: useInference.ts (wire logging)
- **Verification**: AC6

### Phase 4: Testing & Polish (Day 3-4)
- T12-T17: Unit + integration + E2E + edge case + performance + accessibility tests
- T18: Documentation & sign-off
- **Verification**: AC7 + all above

---

## Testability Notes

### Unit Tests (T12)
- Review gate logic (local vs cloud detection): 5+ cases
- Settings persistence: 3+ cases
- Modal state management: 4+ cases
- confirmSendMessage paths: 6+ cases
- **Coverage**: > 95%

### Integration Tests (T13)
- Full review flow (toggle + send + approve): 8+ cases
- Rejection + retry: 4+ cases
- Local backend bypass: 3+ cases
- Modal non-dismissibility: 5+ cases
- Audit logging: 6+ cases

### E2E Tests (T14)
- User enables toggle in Settings: 1 case
- User sends message, reviews, approves: 1 case
- User rejects send: 1 case
- Badge visibility: 1 case
- Local persona bypass: 1 case
- Settings persist after reload: 1 case
- **Total**: 25+ cases

### Edge Case Tests (T15)
- Toggle during composition: 1 case
- Reject + retry: 1 case
- Network error during approval: 1 case
- Hybrid mode: 1 case
- Multi-persona: 1 case
- App close with modal open: 1 case
- Keyboard shortcut: 1 case
- Console bypass attempt: 1 case

### Performance Tests (T16)
- Review gate: < 2ms per send
- Modal render: < 100ms
- Badge render: < 50ms
- Settings persistence: < 10ms
- No memory leaks

### Accessibility Tests (T17)
- Modal has ARIA labels
- Focus trap works
- Keyboard navigation (Tab/Shift-Tab)
- Color contrast > 4.5:1
- Screen reader announces modal

---

## Bypass Prevention (5-Layer Defense)

To ensure David cannot accidentally bypass review, we implement 5 independent layers:

1. **Modal Non-Dismissible**
   - Escape disabled: `onEscape={null}`
   - X button hidden: `display: none`
   - Click-outside disabled: `onBackdropClick={null}`
   → User MUST use a button to clear modal

2. **Send Button Disabled**
   - While `reviewModal.pending !== null`
   - Visual feedback (opacity, cursor)
   → User cannot click Send while modal showing

3. **Gate at Hook Level**
   - Review check in useInference.ts BEFORE any send
   - Cannot call performActualSend() without going through review
   → No direct API access from UI

4. **Message State Locked**
   - `reviewModal.pending` prevents double-send
   - Approval/rejection must clear this state
   → No concurrent sends while review pending

5. **Immutable Audit Trail**
   - Every action logged (approve, reject, local)
   - Timestamp + persona + backend recorded
   - Logs are read-only (append-only events)
   → Unauthorized sends visible in logs

---

## Success Criteria

When implemented correctly:
- ✓ David enables "Always Review Before Send" in Settings
- ✓ Every message to cloud backend shows review modal
- ✓ David cannot dismiss modal or bypass review
- ✓ David can click "Approve & Send" to proceed
- ✓ David can click "Reject" to block send
- ✓ All actions logged in audit trail
- ✓ Local personas still work without review
- ✓ Feature has zero performance impact
- ✓ David sees "🛈 Review Enabled" badge when feature is on

---

## Security & Privacy Considerations

- **No prompt content logged**: Only metadata (persona, backend, action, timestamp)
- **Local sends never leave device**: Review gate only applies to cloud
- **Settings stored locally**: No remote logging of user preference
- **Audit trail in-memory**: Can be exported by user, no cloud storage
- **Modal non-dismissible**: Prevents accidental data leaks
- **Rejection blocks all sends**: Strict safety-first approach

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| User forgets they enabled review | Badge in header reminds user every time |
| Repeated approvals become habitual (security theater) | Documentation explains the purpose; users remain engaged |
| Local backend detection breaks with new persona types | Centralized `isLocalBackend()` function; easy to update |
| Modal causes friction for power users | Default OFF; users can opt-out (disabled toggle) |
| Performance regression on approve/reject | All functions < 2ms; analytics calls async |

---

## Future Enhancements (Post-v1)

- Configurable keyboard bypass: "Allow Ctrl+Enter to skip review" (advanced setting)
- Review templates: "Always approve requests to persona X"
- Timed bypass: "Allow bypass for 5 minutes" (trusted environment)
- Granular rules: "Always review for sensitive data (PII, financial)" (per-content rules)

---

## Summary

This design adds a security layer that guarantees prompt review for cloud sends while respecting local-only personas. The 5-layer bypass prevention ensures David cannot accidentally skip review, and the audit trail gives him verifiable proof that all cloud sends were reviewed and approved.

Implementation is straightforward (18 tasks, ~145 LOC) with zero breaking changes and optional activation (default OFF).
