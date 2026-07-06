# Specs: Always Review Mode

## Feature Specification

### 1. Global Settings Toggle

**Component**: Settings → Privacy → "Always Review Before Send"
- Default: OFF (opt-in feature, no friction for existing users)
- Type: boolean
- Persistence: localStorage (key: `alwaysReviewBeforeSend`)
- Scope: Global (applies to all personas and backends)

### 2. Review Enforcement (Cloud Sends Only)

**Trigger**: When user sends message AND `alwaysReviewBeforeSend === true` AND backend is cloud-based

**Flow**:
1. User clicks send or presses Enter
2. Check: is `alwaysReviewBeforeSend` enabled?
3. Check: is backend cloud? (NOT local/ollama/llama.cpp)
4. If YES to both: show PromptReviewPanel (non-dismissible modal)
5. User MUST click "Approve & Send" or "Reject"
6. Cannot dismiss via Escape, X button, or outside click

**Handling**:
- **Approve & Send**: Send message cloud, log approval event
- **Reject**: Block send, log rejection event with reason, clear modal
- **Local backends**: Skip review, log as "sent_local_persona"
- **Hybrid mode**: Treat as cloud (review required)

### 3. Audit Trail Integration

**Events Logged** (via analytics.ts):
- `approved_for_cloud`: User approved cloud send
- `rejected`: User rejected send
- `sent_local`: Message processed locally (local backend)
- `sent_local_persona`: Local persona processed without review

**Metadata per event**:
```json
{
  "action": "approved_for_cloud",
  "timestamp": "ISO-8601",
  "personaId": "string",
  "backend": "cloud|ollama|llama.cpp|hybrid",
  "rejectionReason": "optional string"
}
```

**Privacy**: No prompt content logged, only metadata

### 4. Visual Indicator

**Location**: Chat header (next to persona name)
**Display**: "🛡️ Review Enabled" badge (only when toggle is ON)
**Purpose**: Remind user that review is active
**Placement**: ChatWindow.tsx header, right-aligned

### 5. Modal Behavior (PromptReviewPanel)

**When displayed**: Every cloud send with toggle ON
**Non-dismissible**: 
- Escape key: disabled
- X button: removed
- Outside click: modal stays open

**Buttons**:
- "Approve & Send" (primary button, blue)
- "Reject" (secondary button, gray)

**Additional field**:
- Rejection reason textarea (optional, for "Reject" action)

**Content shown**:
- Original prompt text
- Persona name
- Backend destination
- Clear call-to-action

## Data Model Changes

### Settings Store (appSettings.ts)

```typescript
interface AppSettings {
  // ... existing fields
  alwaysReviewBeforeSend: boolean;  // NEW
  updateAlwaysReviewBeforeSend(value: boolean): void;  // NEW
}
```

**Persistence**: localStorage with key `alwaysReviewBeforeSend`
**Migration**: Default to `false` for existing users

### Chat Store (messages.ts)

```typescript
interface ChatStore {
  // ... existing fields
  reviewModal: {
    pending: {
      userMessage: string;
      personaId: string;
      backend: string;
      timestamp: number;
    } | null;
  };  // NEW
  setReviewModalPending(state: { ... }): void;  // NEW
  clearReviewModal(): void;  // NEW
}
```

### Inference Hook (useInference.ts)

```typescript
const sendMessage = async (userMessage: string) => {
  // BEFORE: direct send
  // AFTER:
  const isLocalBackend = detectLocalBackend(selectedBackend, selectedPersona);
  const needsReview = appSettings.alwaysReviewBeforeSend && !isLocalBackend;
  
  if (needsReview) {
    setReviewModalPending({ userMessage, personaId, backend, timestamp });
    return; // Block send, wait for user approval
  }
  
  // Proceed with send as normal
};

const confirmSendMessage = (action: 'approve' | 'reject', reason?: string) => {
  if (action === 'approve') {
    logPromptReviewGate('approved_for_cloud', metadata);
    doActualSend();
  } else {
    logPromptReviewGate('rejected', { ...metadata, rejectionReason: reason });
    clearReviewModal();
  }
};
```

## Component APIs

### SettingsPage.tsx

**New section**: Privacy & Review
- Checkbox input: "Always Review Before Send"
- Label: "Require my explicit approval before any message leaves your device for cloud processing"
- Save automatically on toggle

### ChatWindow.tsx

**Header modifications**:
- Add "🛡️ Review Enabled" badge when `alwaysReviewBeforeSend === true`
- Position: right of persona selector
- Remove on toggle OFF

**Send button logic**:
- Disable send while `reviewModal.pending !== null`
- Re-enable after modal clears (approval or rejection)

### PromptReviewPanel.tsx

**New buttons**:
- Approve & Send (primary, blue)
- Reject (secondary, gray)

**Modal config**:
- `onEscape={null}` (disables Escape)
- X button: `display: none` or removed
- Modal backdrop: cannot click to dismiss

**Form fields**:
- Rejection reason textarea (shown only on Reject button hover or state)

## Testability Matrix

| AC # | Acceptance Criteria | Unit Test | Integration Test | E2E Test |
|------|--------------------|----|---|---|
| AC1 | Settings toggle exists | ✓ appSettings has alwaysReviewBeforeSend field | ✓ Toggle appears in Settings → Privacy | ✓ User enables toggle, page reloads, still ON |
| AC2 | Review enforced globally for cloud | ✓ needsReview logic | ✓ sendMessage checks toggle before showing modal | ✓ Send message with toggle ON, modal appears |
| AC3 | Cannot bypass review | ✓ confirmSendMessage required for send | ✓ Modal cannot dismiss via Escape/X/click | ✓ Try Escape, X, outside click — modal stays |
| AC4 | Local mode respects setting | ✓ isLocalBackend detection | ✓ Local personas skip review modal | ✓ Switch to local persona, send, no modal |
| AC5 | Visual indicator | ✓ Badge component renders | ✓ Badge shows when toggle ON, hidden when OFF | ✓ Enable toggle, badge appears in header |
| AC6 | Audit trail logged | ✓ logPromptReviewGate formats correctly | ✓ Approval/rejection events written to analytics | ✓ Send message, export logs, verify action |
| AC7 | No performance regression | ✓ Hook performance <= 2ms | ✓ Modal render time <= 100ms | ✓ App responsiveness unchanged |

## Edge Cases

1. **Toggle during composition**: New setting applies to next send
2. **Reject then retry**: Independent send attempts, each logged
3. **Network error during approval**: Existing resilience handles
4. **Hybrid mode**: Treated as cloud-based (review required)
5. **Multi-persona conversation**: Correct persona in log
6. **App close with modal open**: Pending state cleared on startup
7. **Direct API bypass attempt**: Cannot access from browser console (sendMessage is only path)
8. **Keyboard shortcut (Ctrl+Enter)**: Treated same as mouse click (must go through modal)

## Constraints & Assumptions

- **Performance**: Review gate adds < 2ms per send
- **Compatibility**: Works on all personas (local, cloud, hybrid)
- **Security**: Modal cannot be dismissed except by explicit user action
- **Privacy**: No prompt content in audit logs
- **UX**: Approving every send adds ~1-2 seconds per message (acceptable for David)
- **Backward compatibility**: Default OFF, respects existing user experience
- **Persistence**: localStorage survives app restart

## Implementation Phases

**Phase 1** (Day 1): Foundation
- Add setting to appSettings.ts + localStorage
- Add state to messages.ts
- Add badge to ChatWindow.tsx
- Settings toggle UI in SettingsPage.tsx
- Verify: AC1, AC4, AC5

**Phase 2** (Day 2): Review Logic
- Add review gate in useInference.ts (needsReview check)
- Implement PromptReviewPanel buttons
- Disable send button during review
- Verify: AC2, AC3

**Phase 3** (Day 2-3): Audit Logging
- Implement confirmSendMessage() in useInference.ts
- Add logPromptReviewGate() to analytics.ts
- Wire approval/rejection to logging
- Verify: AC6

**Phase 4** (Day 3): Testing & Polish
- Full test matrix (50+ cases)
- Edge case testing
- UI refinement
- Verify: AC7 + all above

## Test Coverage Targets

- Unit tests: 95%+ coverage of review gate logic
- Integration tests: All approval/rejection paths
- E2E tests: Full user journeys (approve, reject, local bypass)
- Performance: No regression in send time
- Accessibility: Modal follows WCAG 2.1 AA (focus trap, ARIA labels)
