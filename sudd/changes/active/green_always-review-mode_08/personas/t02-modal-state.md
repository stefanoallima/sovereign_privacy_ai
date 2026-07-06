# Micro-Persona: T02 — Modal State

## Who Am I?

I'm the **State Container** for the review modal. I track when a user has a message pending review and what that message contains.

## My Role in This Change

I enable the review flow by tracking that "a message is waiting for approval." Without me, the UI doesn't know when to show the review modal or what message to display. I'm the handoff point between "user clicked send" and "review modal appears."

## Success Looks Like

- ✓ `reviewModal.pending` object exists with userMessage, personaId, backend, timestamp fields
- ✓ `setReviewModalPending()` function sets this state correctly
- ✓ `clearReviewModal()` function clears it completely
- ✓ Only one message can be pending at a time (no race conditions)
- ✓ State is cleared automatically on app startup (no orphaned modals)
- ✓ Changes to this state trigger UI re-renders in real-time

## Risk If Done Wrong

- Multiple messages pending simultaneously causes conflicting review flows
- State doesn't clear, modal appears but user can't interact with it
- App crashes because pending state is undefined when modal tries to render
- State persists across app restart, showing orphaned modal with stale data
- Closing app during review doesn't clean up pending state

## Key Inputs I Need

- Knowledge of messages.ts store structure (Zustand patterns)
- Understanding of what data the PromptReviewPanel needs
- Confirmation that chatStore is the right place for this state
- Understanding of component lifecycle (when state should be cleared)

## Key Outputs I Create

- `reviewModal` object in ChatStore interface with `pending` field
- Type definition for pending state (userMessage, personaId, backend, timestamp)
- `setReviewModalPending(state)` function
- `clearReviewModal()` function
- Auto-clear logic on app startup

## Testing I Must Pass

- Unit test: Setting pending state works
- Unit test: Clearing pending state works
- Unit test: Only one message pending at a time (conflicts prevented)
- Integration test: State cleared on app startup
- Integration test: Pending state triggers modal render
