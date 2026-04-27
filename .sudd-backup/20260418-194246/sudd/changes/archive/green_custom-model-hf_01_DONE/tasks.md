# Tasks: green_custom-model-hf_01

## Batch 1 — Rust Backend (Independent)

- [x] T01: Custom Model JSON Storage
  - **Files**: `apps/desktop/src-tauri/src/llama_backend.rs`
  - **SharedFiles**: none
  - **Effort**: S
  - **Dependencies**: none
  - **Description**: Add `CustomModelStore` struct with `load()` and `save()` methods. Handle file not found gracefully (create empty). Path: `{models_dir}/custom_models.json`.

- [x] T02: URL Parsing and HF API Integration
  - **Files**: `apps/desktop/src-tauri/src/llama_backend.rs`
  - **SharedFiles**: none
  - **Effort**: M
  - **Dependencies**: none (independent, but uses reqwest)
  - **Description**: Add `parse_hf_url()` to extract repo_id and filename from various URL formats. Add `fetch_hf_metadata()` using reqwest to call HF API. Parse JSON for model name/description. 10s timeout.

- [x] T03: Merge Registries
  - **Files**: `apps/desktop/src-tauri/src/llama_backend.rs`
  - **SharedFiles**: none
  - **Effort**: S
  - **Dependencies**: T01
  - **Description**: Modify `list_models()` in `LlamaCppBackend` to merge hardcoded registry + custom models from JSON. Ensure `custom-` prefix on IDs.

- [x] T04: Add Tauri Commands
  - **Files**: `apps/desktop/src-tauri/src/inference_commands.rs`
  - **SharedFiles**: none
  - **Effort**: S
  - **Dependencies**: T01, T02
  - **Description**: Add three `#[tauri::command]` functions:
    - `add_custom_model(url: String) -> Result<LocalModelInfo, String>`
    - `remove_custom_model(id: String) -> Result<(), String>`
    - `fetch_hf_model_metadata(url: String) -> Result<HfModelMetadata, String>`

- [x] T05: Register Commands
  - **Files**: `apps/desktop/src-tauri/src/lib.rs`
  - **SharedFiles**: none
  - **Effort**: S
  - **Dependencies**: T04
  - **Description**: Add new commands to `invoke_handler` in lib.rs around line 285.

## Batch 2 — Frontend (Independent, can run parallel with Batch 1)

- [x] T06: Custom Model Modal UI
  - **Files**: `apps/desktop/src/components/settings/ModelSettings.tsx`
  - **SharedFiles**: none
  - **Effort**: M
  - **Dependencies**: T04 (needs commands ready)
  - **Description**: Add "Add Custom Model" button. Create modal with URL input field, "Fetch Metadata" button, loading spinner, and confirmation form with editable fields (name, ctx_size, description, speed_tier, intelligence_tier).

- [x] T07: Wire Frontend to Backend
  - **Files**: `apps/desktop/src/components/settings/ModelSettings.tsx`
  - **SharedFiles**: none
  - **Effort**: S
  - **Dependencies**: T04, T06
  - **Description**: Connect modal form to `add_custom_model` and `remove_custom_model` commands. Handle success (close modal, refresh list) and error (show fallback form with defaults). Add remove button to custom models in list.

## Batch 3 — Tests

- [x] T08: Rust Tests
  - **Files**: `apps/desktop/src-tauri/src/llama_backend.rs`
  - **SharedFiles**: none
  - **Effort**: S
  - **Dependencies**: T01, T02, T03
  - **Description**: Unit tests for:
    - `parse_hf_url()` with various URL formats
    - `CustomModelStore::load()` / `save()` roundtrip
    - ID collision prevention (`custom-` prefix)
    - Merge logic in `list_models()`

- [x] T09: Integration Verification
  - **Files**: none
  - **SharedFiles**: none
  - **Effort**: S
  - **Dependencies**: T05, T07
  - **Description**: Run `cargo check`, `cargo test`. Run `npx tsc --noEmit`. Manual test adding/removing custom model.

---
**Total**: 9 tasks | **Est. effort**: S+S+S+S+S + M+S + S+S = ~6 hours

## Dependency Graph

```
T01 ─┬─▶ T03 ─┬─▶ T08 ─▶ T09
T02 ─┘        │
              │
T04 ◀── T01 + T02
T05 ◀── T04
T06 ◀── T04
T07 ◀── T04 + T06
```
