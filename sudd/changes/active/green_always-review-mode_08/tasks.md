# Tasks: Always Review Mode

**Change**: green_always-review-mode_08  
**Size**: M (Medium — ~1 week)  
**Mode**: brown (continue existing work)  

## Phase 1: Foundation (Day 1)

### T01: Add Settings Storage (appSettings.ts)
- **Effort**: S
- **Files**: `src/store/appSettings.ts`
- **Dependencies**: none
- **SharedFiles**: none
- **Description**: Add `alwaysReviewBeforeSend` boolean field and setter to app settings store
- **Acceptance**: 
  - [ ] Field exists in AppSettings interface
  - [ ] Setter function updates state
  - [ ] localStorage persists value with key `alwaysReviewBeforeSend`
  - [ ] Default is `false` for new users
- **Test Cases**: 
  - Setting persists across reload
  - Default value is false
  - Setter triggers state update

---

### T02: Add Review Modal State (messages.ts)
- **Effort**: S
- **Files**: `src/store/messages.ts`
- **Dependencies**: none
- **SharedFiles**: none
- **Description**: Add `reviewModal.pending` state object to track pending review
- **Acceptance**:
  - [ ] State object exists with userMessage, personaId, backend, timestamp fields
  - [ ] `setReviewModalPending()` function sets state
  - [ ] `clearReviewModal()` function clears state
  - [ ] State is cleared on app startup
- **Test Cases**:
  - Setting pending state works
  - Clearing pending state works
  - Only one message can be pending at a time

---

### T03: Add Header Badge (ChatWindow.tsx)
- **Effort**: S
- **Files**: `src/components/ChatWindow.tsx`
- **Dependencies**: T01 (read alwaysReviewBeforeSend from settings)
- **SharedFiles**: none
- **Description**: Add "🛡️ Review Enabled" badge to chat header when toggle is ON
- **Acceptance**:
  - [ ] Badge renders when `alwaysReviewBeforeSend === true`
  - [ ] Badge is hidden when toggle is OFF
  - [ ] Badge position: right side of header, next to persona name
  - [ ] Badge has tooltip explaining what it means
- **Test Cases**:
  - Badge shows when toggle ON
  - Badge hidden when toggle OFF
  - Badge position correct
  - Tooltip appears on hover

---

### T04: Settings Toggle UI (SettingsPage.tsx)
- **Effort**: S
- **Files**: `src/pages/SettingsPage.tsx`
- **Dependencies**: T01 (use appSettings for toggle)
- **SharedFiles**: none
- **Description**: Add toggle in Settings → Privacy section for "Always Review Before Send"
- **Acceptance**:
  - [ ] Toggle checkbox appears in Privacy section
  - [ ] Label explains feature: "Require my explicit approval before any message leaves your device for cloud processing"
  - [ ] Toggle reflects current setting
  - [ ] Clicking toggle updates setting immediately
  - [ ] Value persists after reload
- **Test Cases**:
  - Toggle appears in Settings
  - Toggle reflects stored value
  - Clicking toggle changes value
  - Value persists

---

### T05: Disable Send Button During Review (ChatWindow.tsx)
- **Effort**: S
- **Files**: `src/components/ChatWindow.tsx`
- **Dependencies**: T02 (check reviewModal.pending)
- **SharedFiles**: none
- **Description**: Disable send button while review modal is pending
- **Acceptance**:
  - [ ] Send button is disabled when `reviewModal.pending !== null`
  - [ ] Send button is re-enabled when modal clears
  - [ ] User cannot submit form via keyboard while button disabled
  - [ ] Visual feedback shows button is disabled (opacity, cursor)
- **Test Cases**:
  - Button disabled when modal shows
  - Button enabled when modal closes
  - Cannot send via keyboard shortcut while disabled
  - Visual disabled state clear

---

## Phase 2: Review Logic (Day 2)

### T06: Review Gate Check (useInference.ts)
- **Effort**: M
- **Files**: `src/hooks/useInference.ts`
- **Dependencies**: T01 (read alwaysReviewBeforeSend), T02 (set reviewModal.pending)
- **SharedFiles**: none
- **Description**: Add review gate check before sending to cloud
- **Acceptance**:
  - [ ] Function detects local vs cloud backend
  - [ ] If toggle ON and cloud backend: set reviewModal.pending
  - [ ] If toggle OFF or local backend: skip review, proceed with send
  - [ ] Local backends: ollama, llama.cpp, local all detected
  - [ ] Hybrid mode treated as cloud (requires review)
- **Implementation**:
  ```typescript
  const isLocalBackend = (backend, persona) => {
    return ['ollama', 'llama.cpp', 'local'].includes(backend) ||
           persona.backendOption === 'local';
  };
  
  const needsReview = alwaysReviewBeforeSend && !isLocalBackend(backend, persona);
  if (needsReview) {
    setReviewModalPending({ userMessage, personaId, backend, timestamp });
    return; // Block send
  }
  ```
- **Test Cases**:
  - Local backend skips review
  - Cloud backend requires review
  - Hybrid mode requires review
  - Toggle OFF skips review

---

### T07: Review Panel Buttons (PromptReviewPanel.tsx)
- **Effort**: M
- **Files**: `src/components/PromptReviewPanel.tsx`
- **Dependencies**: T02 (use reviewModal.pending), T06 (confirmSendMessage)
- **SharedFiles**: none
- **Description**: Add Approve & Send and Reject buttons to modal
- **Acceptance**:
  - [ ] "Approve & Send" button (blue, primary)
  - [ ] "Reject" button (gray, secondary)
  - [ ] Clicking Approve calls confirmSendMessage('approve')
  - [ ] Clicking Reject calls confirmSendMessage('reject', reason)
  - [ ] Rejection reason textarea appears on hover/focus
  - [ ] Modal non-dismissible: Escape disabled, X hidden, click outside blocked
- **Test Cases**:
  - Approve button sends message
  - Reject button blocks send
  - Modal cannot close via Escape
  - Modal cannot close via X
  - Modal cannot close via outside click
  - Rejection reason captured

---

### T08: Modal Non-Dismissible Config (PromptReviewPanel.tsx)
- **Effort**: S
- **Files**: `src/components/PromptReviewPanel.tsx`
- **Dependencies**: T07 (modal implementation)
- **SharedFiles**: none
- **Description**: Configure modal to prevent accidental dismissal
- **Acceptance**:
  - [ ] Escape key disabled: `onEscape={null}`
  - [ ] X button removed or hidden: `display: none`
  - [ ] Backdrop click disabled: `onBackdropClick={null}`
  - [ ] Tab focus trapped within modal
  - [ ] Only Approve/Reject buttons functional
- **Test Cases**:
  - Escape key does not close modal
  - X button not visible or not functional
  - Click outside does not close modal
  - Tab focus stays within modal

---

## Phase 3: Audit Logging (Day 2-3)

### T09: Confirm Send Function (useInference.ts)
- **Effort**: M
- **Files**: `src/hooks/useInference.ts`
- **Dependencies**: T06 (review gate), T07 (modal buttons call this)
- **SharedFiles**: none
- **Description**: Implement confirmSendMessage() function for approval/rejection handling
- **Acceptance**:
  - [ ] Function signature: `confirmSendMessage(action: 'approve'|'reject', reason?: string)`
  - [ ] Approve path: log event, clear modal, call doActualSend()
  - [ ] Reject path: log event, clear modal, do NOT send
  - [ ] Both paths call analytics logging (T10)
  - [ ] reviewModal.pending cleared after each action
- **Implementation**:
  ```typescript
  const confirmSendMessage = (action, reason) => {
    if (action === 'approve') {
      logPromptReviewGate('approved_for_cloud', metadata);
      clearReviewModal();
      doActualSend();
    } else {
      logPromptReviewGate('rejected', { ...metadata, rejectionReason: reason });
      clearReviewModal();
    }
  };
  ```
- **Test Cases**:
  - Approve path sends message
  - Reject path blocks send
  - Events logged correctly
  - Modal cleared after action

---

### T10: Audit Logging Function (analytics.ts)
- **Effort**: S
- **Files**: `src/services/analytics.ts`
- **Dependencies**: none
- **SharedFiles**: none
- **Description**: Add logPromptReviewGate() function for audit trail
- **Acceptance**:
  - [ ] Function accepts action and metadata
  - [ ] Action types: 'approved_for_cloud', 'rejected', 'sent_local', 'sent_local_persona'
  - [ ] Metadata: timestamp, personaId, backend, rejectionReason (optional)
  - [ ] No prompt content logged (privacy)
  - [ ] Events timestamp in ISO-8601 format
  - [ ] Events stored for export/analytics
- **Implementation**:
  ```typescript
  const logPromptReviewGate = (action, metadata) => {
    const event = {
      action,
      timestamp: new Date().toISOString(),
      personaId: metadata.personaId,
      backend: metadata.backend,
      rejectionReason: metadata.rejectionReason || null,
    };
    analytics.track('prompt_review_gate', event);
  };
  ```
- **Test Cases**:
  - Approval logged with correct metadata
  - Rejection logged with reason
  - Local sends logged as 'sent_local'
  - No prompt content in logs

---

### T11: Wire Logging to Review Flow (useInference.ts)
- **Effort**: S
- **Files**: `src/hooks/useInference.ts`
- **Dependencies**: T09 (confirmSendMessage), T10 (logPromptReviewGate)
- **SharedFiles**: none
- **Description**: Connect confirmSendMessage to logging
- **Acceptance**:
  - [ ] confirmSendMessage calls logPromptReviewGate
  - [ ] Metadata passed correctly to logging
  - [ ] Both approve and reject paths log events
  - [ ] Local sends also logged (handled in T09 or separate)
- **Test Cases**:
  - Approval events logged
  - Rejection events logged with reason
  - All metadata captured

---

## Phase 4: Testing & Polish (Day 3-4)

### T12: Unit Tests (useInference, appSettings)
- **Effort**: M
- **Files**: `src/hooks/__tests__/useInference.test.ts`, `src/store/__tests__/appSettings.test.ts`
- **Dependencies**: All T01-T11
- **SharedFiles**: none
- **Description**: Unit tests for review gate logic and settings
- **Acceptance**:
  - [ ] Review gate logic 95%+ covered
  - [ ] Settings persistence tested
  - [ ] Local backend detection tested
  - [ ] confirmSendMessage paths tested
  - [ ] All test cases from specs.md implemented
- **Test Cases**: 40+ unit tests covering:
  - Settings toggle persistence
  - Local vs cloud detection
  - Review gate logic
  - Modal state management
  - confirmSendMessage paths

---

### T13: Integration Tests (Review Flow)
- **Effort**: M
- **Files**: `src/__tests__/integration/always-review.integration.test.ts`
- **Dependencies**: All T01-T12
- **SharedFiles**: none
- **Description**: Integration tests for full review flow
- **Acceptance**:
  - [ ] Send with toggle ON → modal appears
  - [ ] Send with toggle OFF → no modal
  - [ ] Local backend → no modal
  - [ ] Approve → send succeeds, logged
  - [ ] Reject → send blocked, logged
  - [ ] Badge appears/disappears with toggle
- **Test Cases**: 35+ integration tests covering:
  - Full review flow (toggle + send + approve)
  - Edge cases (toggle during send, network error, etc.)
  - Badge visibility
  - Button state management

---

### T14: E2E Tests (User Journey)
- **Effort**: M
- **Files**: `cypress/e2e/always-review-mode.cy.ts` or Playwright equivalent
- **Dependencies**: All T01-T13
- **SharedFiles**: none
- **Description**: End-to-end browser tests for user experience
- **Acceptance**:
  - [ ] User enables toggle in Settings
  - [ ] User sends message, review modal appears
  - [ ] User clicks Approve, message sends
  - [ ] Badge shows in header
  - [ ] Logs can be exported and reviewed
  - [ ] Local persona bypasses review
- **Test Cases**: 25+ E2E tests covering:
  - Full user journey (settings → send → approve)
  - Local backend bypass
  - Badge visibility
  - Modal non-dismissibility
  - Settings persistence

---

### T15: Edge Case Testing
- **Effort**: S
- **Files**: `src/__tests__/edge-cases/always-review.edge-cases.ts`
- **Dependencies**: All T01-T13
- **SharedFiles**: none
- **Description**: Test edge cases and error scenarios
- **Acceptance**:
  - [ ] Toggle during message composition
  - [ ] Reject then retry
  - [ ] Network error during approval
  - [ ] Hybrid mode handling
  - [ ] Multi-persona switching
  - [ ] App close with modal open
  - [ ] Keyboard shortcut (Ctrl+Enter)
- **Test Cases**: 8+ edge case scenarios

---

### T16: Performance Testing
- **Effort**: S
- **Files**: `src/__tests__/performance/always-review.perf.ts`
- **Dependencies**: All T01-T15
- **SharedFiles**: none
- **Description**: Verify no performance regression
- **Acceptance**:
  - [ ] Review gate adds < 2ms per send
  - [ ] Modal renders in < 100ms
  - [ ] Badge render < 50ms
  - [ ] No memory leaks with review modal
  - [ ] Settings persistence < 10ms
- **Test Cases**: Performance benchmarks for all components

---

### T17: Accessibility Testing
- **Effort**: S
- **Files**: `src/__tests__/accessibility/always-review.a11y.ts`
- **Dependencies**: All T01-T15
- **SharedFiles**: none
- **Description**: Verify WCAG 2.1 AA accessibility
- **Acceptance**:
  - [ ] Modal has proper ARIA labels
  - [ ] Focus trap works (tab/shift-tab)
  - [ ] Button labels accessible
  - [ ] Color contrast ratio > 4.5:1
  - [ ] Keyboard navigation works
  - [ ] Screen reader announces modal
- **Test Cases**: Accessibility compliance

---

### T18: Documentation & Sign-Off
- **Effort**: S
- **Files**: `DESIGN_SUMMARY.md`, `TEST_RESULTS.md`, `DEPLOY_NOTES.md`
- **Dependencies**: All T01-T17
- **SharedFiles**: none
- **Description**: Create documentation and verification checklist
- **Acceptance**:
  - [ ] Design summary written
  - [ ] Test results documented (pass/fail)
  - [ ] Deployment notes created
  - [ ] All 7 AC verified as met
  - [ ] Code review completed
  - [ ] Stakeholder approval obtained
- **Deliverables**: 
  - Design summary (1 page)
  - Test results (5 pages)
  - Deployment notes
  - Sign-off checklist

---

## Implementation Dependencies

```
T01 (appSettings) ─┬─→ T02 (modal state)
                   ├─→ T03 (badge)
                   └─→ T04 (settings UI)
                       ├─→ T05 (disable send button)
                       └─→ T06 (review gate)
                           ├─→ T07 (modal buttons)
                           ├─→ T08 (modal non-dismissible)
                           ├─→ T09 (confirmSendMessage)
                           └─→ T10 (audit logging)
                               └─→ T11 (wire logging)
                                   ├─→ T12 (unit tests)
                                   ├─→ T13 (integration tests)
                                   ├─→ T14 (E2E tests)
                                   ├─→ T15 (edge cases)
                                   ├─→ T16 (performance)
                                   ├─→ T17 (a11y)
                                   └─→ T18 (docs)
```

## Batch Scheduling

**Batch 1** (Day 1): T01-T05 (Foundation)
- Sequential in main workspace
- All independent, can run after T01 completes

**Batch 2** (Day 2): T06-T08 (Review Logic)
- Depends on Batch 1 complete
- T06 + T07 + T08 independent, run after each other

**Batch 3** (Day 2-3): T09-T11 (Logging)
- Depends on T06-T08 complete
- T09 → T10 → T11 (sequential, each depends on prior)

**Batch 4** (Day 3-4): T12-T18 (Testing & Docs)
- Depends on all code tasks complete
- Can run in parallel: T12 unit tests + T13 integration + T14 E2E
- T15-T18 run after test batches

## Summary

**Total Tasks**: 18
**Batch Groups**: 4
**Effort**: M (Medium, ~1 week)
**Files Changed**: 7
**New Tests**: 100+
**Deliverables**: Design docs + test suite + audit trail support
