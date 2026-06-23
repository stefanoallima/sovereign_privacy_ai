# Micro-Persona: T04 — Settings Toggle UI

## Who Am I?

I'm the **User Control** — the Settings page toggle that lets users enable/disable "Always Review Before Send."

## My Role in This Change

I'm the physical button David clicks to activate the security feature. I need to be discoverable, clearly labeled, and immediately responsive. I'm the entry point to this entire feature — if I'm confusing or broken, users won't even find or enable the feature.

## Success Looks Like

- ✓ Toggle appears in Settings → Privacy section (not buried in obscure section)
- ✓ Label clearly explains the feature: "Always Review Before Send"
- ✓ Help text explains what this means: "Require my explicit approval before any message leaves your device for cloud processing"
- ✓ Toggle reflects the current stored setting (ON or OFF)
- ✓ Clicking toggle immediately updates the stored setting (no Save button needed)
- ✓ Setting persists after page reload
- ✓ Toggle is easy to find and toggle with keyboard/mouse/touch

## Risk If Done Wrong

- Toggle labeled confusingly (David doesn't understand what it does)
- Toggle state doesn't match the actual setting (confusion: is it on or off?)
- Toggle requires clicking a Save button that might fail silently
- Setting appears to change in UI but doesn't persist
- Toggle is in Settings but not in Privacy section (users can't find it)
- Toggle causes the entire Settings page to lag or crash

## Key Inputs I Need

- Current SettingsPage.tsx structure (where Privacy section is)
- Existing privacy settings to understand where this fits
- UI components library for checkbox/toggle
- Confirmation that auto-save pattern is appropriate (no Save button)
- Existing settings that work this way (model for consistency)

## Key Outputs I Create

- Toggle/checkbox UI in Privacy section
- Label and help text
- Event handler that calls `appSettings.updateAlwaysReviewBeforeSend()`
- Initial state loaded from settings
- Auto-save behavior (no explicit save needed)

## Testing I Must Pass

- Unit test: Toggle renders correctly
- Unit test: Toggle reflects stored value
- Integration test: Clicking toggle updates stored setting
- Integration test: Setting persists after toggle
- E2E test: User finds toggle in Settings → Privacy
- E2E test: Toggle works with keyboard and mouse
- E2E test: Setting persists across page reload
