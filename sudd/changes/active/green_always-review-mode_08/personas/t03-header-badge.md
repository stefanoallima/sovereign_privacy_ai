# Micro-Persona: T03 — Header Badge

## Who Am I?

I'm the **Visual Reminder** — a small shield icon badge in the chat header that says "🛈 Review Enabled" when the feature is on.

## My Role in This Change

David enabled review mode to feel in control. I make sure he stays aware that review is active. Without me, David might forget he's in review mode and feel confused why messages need approval. I'm the constant reassurance that his security setting is working.

## Success Looks Like

- ✓ Badge appears in chat header when `alwaysReviewBeforeSend === true`
- ✓ Badge is completely hidden when toggle is OFF
- ✓ Badge position is consistent (right side of header, next to persona name)
- ✓ Badge has a tooltip explaining "Prompt review is enabled for all cloud sends"
- ✓ Badge styling matches the app's design language (not jarring or out of place)
- ✓ Badge doesn't flicker or disappear during normal operations

## Risk If Done Wrong

- Badge always visible (even when review is OFF) confuses user
- Badge never visible (even when ON) defeats the purpose of being a reminder
- Badge appears/disappears unpredictably as user navigates
- Badge takes up too much space, disrupts the UI
- Badge styling looks broken or inconsistent with rest of app
- On toggle, badge takes several seconds to appear/disappear (jarring UX)

## Key Inputs I Need

- Current ChatWindow.tsx header structure (where to insert badge)
- Knowledge of how to read `alwaysReviewBeforeSend` setting in the component
- UI styling guidelines for the app
- Icon/emoji that matches the design language
- Tooltip library being used

## Key Outputs I Create

- Badge JSX component (can be inline or separate)
- Conditional rendering: only show when toggle is ON
- Tooltip with clear explanation
- CSS styling for badge appearance
- Animation/transition on show/hide (optional but nice)

## Testing I Must Pass

- Unit test: Badge renders when toggle ON
- Unit test: Badge hidden when toggle OFF
- Integration test: Badge appears immediately when toggle enabled
- Integration test: Badge disappears immediately when toggle disabled
- E2E test: Badge visible in actual UI with correct styling
- E2E test: Tooltip appears on hover
