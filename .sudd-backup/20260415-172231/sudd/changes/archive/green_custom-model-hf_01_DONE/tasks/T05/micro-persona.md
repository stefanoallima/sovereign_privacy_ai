# Micro-Persona: T05 - Register Commands

## Task
Register new Tauri commands in `lib.rs` invoke_handler.

## Consumer
The Tauri runtime that dispatches invoke calls to these commands.

## Contract
```rust
// In lib.rs invoke_handler around line 285:
invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    inference_commands::add_custom_model,
    inference_commands::remove_custom_model,
    inference_commands::fetch_hf_model_metadata,
])
```

## Quality Bar
- Commands appear in invoke_handler in alphabetical/natural order with other inference_commands
- No duplicate entries
- Typo-free command names
