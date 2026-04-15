# Micro-Persona: T07 - Wire Frontend to Backend

## Task
Connect modal form to Tauri commands, handle success/error, add remove button.

## Consumer
End user who adds and removes custom models.

## Integration Points
```typescript
// Add custom model
const model = await invoke<LocalModelInfo>('add_custom_model', { url: url, ...formData });

// Remove custom model
await invoke('remove_custom_model', { id: modelId });

// Fetch metadata (for pre-fill)
const metadata = await invoke<HfModelMetadata>('fetch_hf_model_metadata', { url: url });
```

## UX Behavior
- On add success: Close modal, refresh model list, show success feedback
- On add error: Show error message in modal, keep form open
- On remove: Confirm removal, refresh list

## Quality Bar
- Model appears in list immediately after adding
- Model disappears from list after removing
- Error states are user-friendly
- No console errors on any flow
