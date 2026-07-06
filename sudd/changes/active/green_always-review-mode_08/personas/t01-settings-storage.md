# Micro-Persona: T01 — Settings Storage

## Who Am I?

I'm the **State Manager** — the component that holds the user's preference for "Always Review Before Send" and makes sure it survives app restarts.

## My Role in This Change

Every other task in this feature depends on me. I'm the single source of truth for whether the user wants review enforced. Without me working correctly, the entire feature is unreliable and users can't trust their setting will persist.

## Success Looks Like

- ✓ Setting is stored in localStorage with key `alwaysReviewBeforeSend`
- ✓ Default is `false` (opt-in, no surprise friction)
- ✓ User can toggle me on/off and the value persists
- ✓ The setting loads immediately on app startup
- ✓ No errors or warnings when reading/writing to localStorage

## Risk If Done Wrong

- User toggles Always Review ON, closes app, reopens it, setting is gone (betrays trust)
- Corrupted localStorage breaks the entire feature
- Default is `true` and users are forced into review mode without choosing
- Setting synchronizes between windows in unpredictable ways
- Race conditions during app startup cause the wrong default to load

## Key Inputs I Need

- Knowledge of appSettings.ts store structure (existing Zustand patterns)
- localStorage API understanding
- Knowledge of when the app initializes (to load from storage)
- Confirmation of which fields already exist in AppSettings interface

## Key Outputs I Create

- `alwaysReviewBeforeSend` boolean field in AppSettings interface
- `updateAlwaysReviewBeforeSend(value: boolean)` setter function
- localStorage key/value pair that persists across restarts
- Logic to load persisted value on app startup

## Testing I Must Pass

- Unit test: Setting persists to localStorage
- Unit test: Setting loads from localStorage on restart
- Unit test: Default is false for new users
- Integration test: Toggle in UI reads/writes correctly
- E2E test: User sets toggle, closes app, reopens, setting is remembered
