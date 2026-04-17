# Tasks: green_gemma4-orchestration_01

## Batch 1 — Independent Rust Changes

### T01: Add Gemma 4 models to registry
- **Effort**: S
- **Files**: `apps/desktop/src-tauri/src/llama_backend.rs`
- **SharedFiles**: none
- **Dependencies**: none
- **Description**: Add gemma4-e2b and gemma4-e4b to `local_model_registry()`. Update `max_gen_tokens()` for large context. Update `N_BATCH` to be dynamic based on ctx_size.
- **Status**: [x]

### T02: Create orchestration module
- **Effort**: M
- **Files**: `apps/desktop/src-tauri/src/orchestration.rs`
- **SharedFiles**: none
- **Dependencies**: none
- **Description**: New module with uncertainty detection (`detect_uncertainty`), question extraction, and cloud delegation pipeline. Uses Nebius API via reqwest.
- **Status**: [x]

## Batch 2 — Integration (depends on Batch 1)

### T03: Wire orchestration into lib.rs and inference flow
- **Effort**: S
- **Files**: `apps/desktop/src-tauri/src/lib.rs`, `apps/desktop/src-tauri/src/orchestration_commands.rs`
- **SharedFiles**: `apps/desktop/src-tauri/src/lib.rs`
- **Dependencies**: T02
- **Description**: Add `mod orchestration` and orchestration commands to lib.rs. Create Tauri command that wraps orchestrated inference (local → check confidence → maybe cloud).
- **Status**: [x]

### T04: Add persona DB fields for cloud delegation
- **Effort**: S
- **Files**: `apps/desktop/src-tauri/src/db.rs`
- **SharedFiles**: `apps/desktop/src-tauri/src/db.rs`
- **Dependencies**: none
- **Description**: Add `enable_cloud_delegation` and `cloud_delegation_threshold` columns to personas table via migration. Update Persona struct and create/update/select queries.
- **Status**: [x]

## Batch 3 — Frontend (depends on Batch 2)

### T05: Frontend — model list, orchestration UI, and chat integration
- **Effort**: M
- **Files**: `apps/desktop/src/components/settings/ModelSettings.tsx`, `apps/desktop/src/components/personas/PersonaLLMConfigEditor.tsx`, `apps/desktop/src/components/chat/MessageBubble.tsx`, `apps/desktop/src/hooks/usePrivacyChat.ts`, `apps/desktop/src/types/index.ts`, `apps/desktop/src/services/backend-routing-service.ts`
- **SharedFiles**: none
- **Dependencies**: T01, T03, T04
- **Description**: Gemma 4 models appear in model selector with RECOMMENDED badge. Add cloud delegation toggle + threshold slider to persona LLM config. Add [cloud-assisted] badge to chat messages. Integrate orchestrated_generate into the local chat path.
- **Status**: [x]

## Batch 4 — Tests

### T06: Rust tests for new code
- **Effort**: S
- **Files**: `apps/desktop/src-tauri/src/llama_backend.rs`, `apps/desktop/src-tauri/src/orchestration.rs`
- **SharedFiles**: none
- **Dependencies**: T01, T02
- **Description**: Unit tests for model registry (gemma entries exist, ctx size, max_gen_tokens, batch_size), uncertainty detection, repetition detection, threshold effects.
- **Status**: [x]
