# Micro-Persona: T06 - Custom Model Modal UI

## Task
Add "Add Custom Model" button and modal with URL input, fetch button, loading state, and confirmation form.

## Consumer
End user who wants to add custom GGUF models.

## UI Components
1. **Add Custom Model Button**: Above the model list, styled consistently
2. **Modal**:
   - URL input field with placeholder text
   - "Fetch Metadata" button
   - Loading spinner during fetch
   - Form fields: name, ctx_size, description, speed_tier, intelligence_tier (all editable)
   - Cancel and Add buttons
3. **Error State**: If fetch fails, show error message + form with defaults

## State Machine
```
Closed → [Click Add] → URLInput
URLInput → [Fetch] → Loading
Loading → [Success] → ConfirmationForm
Loading → [Error] → ConfirmationForm (with error msg + defaults)
ConfirmationForm → [Cancel] → Closed
ConfirmationForm → [Add] → Closed (refresh list)
```

## Quality Bar
- Modal opens/closes correctly
- Loading spinner visible during fetch
- Error message shown if fetch fails
- All form fields are editable
- Form pre-filled correctly on success
