# Micro-Persona: T03 - Merge Registries

## Task
Modify `list_models()` to merge hardcoded registry + custom models from JSON, ensuring no ID collisions.

## Consumer
The Tauri command `list_local_models` which returns the merged list to frontend.

## Contract
```rust
// Modified method signature (same behavior, enhanced implementation)
pub fn list_models(&self) -> Vec<LocalModelInfo>
```

## Merge Rules
1. Hardcoded models appear first (unchanged)
2. Custom models appended after hardcoded
3. Custom model IDs are prefixed with `custom-`
4. If JSON file missing/empty/corrupted, return hardcoded only (graceful degradation)

## Quality Bar
- Existing tests still pass
- Custom models appear after hardcoded in list
- No ID collisions between hardcoded and custom
- File errors don't cause list_models to fail
