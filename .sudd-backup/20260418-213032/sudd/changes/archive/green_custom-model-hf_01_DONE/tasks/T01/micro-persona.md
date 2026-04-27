# Micro-Persona: T01 - Custom Model JSON Storage

## Task
Add `CustomModelStore` struct with `load()` and `save()` methods for persisting custom model metadata to `{models_dir}/custom_models.json`.

## Consumer
The downstream code (T03 merge, T04 commands) that will call `CustomModelStore::load()` and `CustomModelStore::save()`.

## Contract
```rust
// Must implement
impl CustomModelStore {
    fn path(models_dir: &Path) -> PathBuf;
    fn load(models_dir: &Path) -> Result<Vec<LocalModelInfo>, String>;
    fn save(models_dir: &Path, models: &[LocalModelInfo]) -> Result<(), String>;
}
```

## Constraints
- File must be human-readable (pretty print JSON)
- Must handle missing file gracefully (return empty Vec)
- Must handle corrupted JSON gracefully (return error, don't crash)
- Model IDs must be prefixed with `custom-` (caller's responsibility to ensure)

## Quality Bar
- Roundtrip test: save models → load → verify identical
- Missing file returns empty Vec, not error
- Corrupted JSON returns Error with clear message
