# Design: brown_normattiva-phase0-hardening_01

## Components (by file)

### `apps/desktop/src-tauri/src/backend_routing.rs` — FR-1, FR-3, FR-6

**FR-1: `AnonymizationMode::from_string` strict parse**
- Change return type from `-> Self` to `-> Result<Self, Box<dyn Error + Send + Sync>>`.
- Match arms for the 3 known values unchanged.
- `_` arm: `return Err(format!("invalid anonymization_mode: {:?}", s).into())`.
- Update the two callers (`determine_backend:117`, `make_routing_decision:160`) to `?` the
  result. Both are already in functions returning `Result<_, Box<dyn Error + Send + Sync>>`,
  so `?` works directly.
- Update the existing test `test_anonymization_mode_from_string` (line 400-405) to:
  - Assert `Ok(Optional)` / `Ok(Required)` / `Ok(None)` for the valid values.
  - Assert `Err` for `"invalid"`, `""`, `"   "`, `"require"` (typo).
- **Why `Box<dyn Error + Send + Sync>`:** matches the surrounding functions' error type; no
  new error enum needed.

**FR-3: New test `make_routing_decision_normattiva_required_uses_attributes_only`**
- Lives in the existing `#[cfg(test)] mod tests` block at line 395.
- Builds a `Persona` (use the same struct literal shape as the existing
  `determine_backend_maps_normattiva_string_to_enum` test at line 482+).
- Uses the same `Stub` impl from the existing test (copy-paste the inner `Stub` struct + impl
  — Rust test modules don't share items across `#[tokio::test]` functions cleanly).
- Asserts `decision.backend == BackendType::Normattiva` +
  `decision.content_mode == ContentMode::AttributesOnly` +
  `decision.is_safe == true` +
  `decision.fallback == FallbackEvent::None`.

**FR-6: Comment on `anonymize: false` in Required arms**
- Add the comment above `anonymize: false` in BOTH arms:
  - Nebius+Required at line 184.
  - Normattiva+Required at the parallel location in the Normattiva arm (added in
    normattiva-phase-0).
- Same comment text in both spots.

### `apps/desktop/src/stores/settings.ts` — FR-4, FR-5

**FR-4: `getDefaultModel()` skips Normattiva when key is empty**
- Locate `getDefaultModel()` in the `SettingsStore` interface impl. After
  normattiva-phase-0 it's around line 408+ based on the diff.
- Current behavior (post-phase-0): walks enabled models, returns the one with
  `isDefault: true`.
- New behavior: walk enabled models; for each candidate, if `m.provider === "normattiva"`
  AND `settings.normattivaApiKey.trim() === ""`, skip it. Return the first non-skipped
  enabled model with `isDefault: true`; if none, fall back to today's "first enabled model".
- **Why filter at `getDefaultModel()` not at `setNormattivaApiKey()`:** the user might add a
  Normattiva key later; we don't want to retroactively change which model is the default
  for the *Nebius* persona. Filtering at read time keeps the data model simple.
- Add test in `settings.test.ts` (exists per the diff).

**FR-5: `setNormattivaApiEndpoint` setter**
- Add to the `SettingsStore` interface (around line 178 per the diff).
- Add the impl: `setNormattivaApiEndpoint: (endpoint) => set((state) => ({ settings: {
  ...state.settings, normattivaApiEndpoint: endpoint } }))`.
- Mirror `setNormattivaApiKey` exactly.

### `apps/desktop/src/components/settings/PrivacySettings.tsx` — FR-5

- Destructure `setNormattivaApiEndpoint` alongside `setNormattivaApiKey` (the line that
  currently destructures `setNormattivaApiKey` is in the diff at the top of
  `PrivacySettings`).
- In the endpoint `<input>` `onChange`, replace
  `useSettingsStore.getState().updateSettings({ normattivaApiEndpoint: e.target.value })`
  with `setNormattivaApiEndpoint(e.target.value)`.

### `apps/desktop/src/services/nebius.ts` — FR-7

- Inside `streamChatCompletion` (around line 91-148 in the branch-version), after the
  SSE-loop closes and the `return { inputTokens, outputTokens }` happens, add a
  `// TODO(phase-1):` block. The block names the three deferred items (exact usage capture,
  x_normattiva SSE accumulation, citations UI) and links back to
  `docs/normattiva-integration-spec.md` A6 / B8.
- Comment-only. No behavior change.

### `docs/normattiva-integration-spec.md` → move — FR-8

- `git mv docs/normattiva-integration-spec.md apps/desktop/docs/superpowers/specs/2026-06-15-normattiva-integration-spec.md`.
- **Pre-flight grep** for any references to the old path; update them.

## Data flow
No data flow changes. This is a tightening pass: stricter parse (FR-1), one new test (FR-3),
one new filter at read-time (FR-4), one new setter (FR-5), two comments (FR-6, FR-7), one file
move (FR-8).

## Test plan
- FR-1: update `test_anonymization_mode_from_string`; new `test_anonymization_mode_personas_load`
  covers all 6 built-in personas.
- FR-3: new `make_routing_decision_normattiva_required_uses_attributes_only`.
- FR-4: 2 new cases in `settings.test.ts` (empty key + set key).
- FR-5: TS compiles; existing settings tests pass.
- FR-6 / FR-7: no test (comment-only).
- FR-8: `git mv` preserves history; `cargo test` + `pnpm test` confirm no breakage.

## File changes
- MOD: `apps/desktop/src-tauri/src/backend_routing.rs` (FR-1, FR-3, FR-6).
- MOD: `apps/desktop/src/stores/settings.ts` (FR-4, FR-5).
- MOD: `apps/desktop/src/components/settings/PrivacySettings.tsx` (FR-5).
- MOD: `apps/desktop/src/services/nebius.ts` (FR-7).
- MOD: `apps/desktop/src/stores/settings.test.ts` (FR-4 tests).
- MOVE: `docs/normattiva-integration-spec.md`
        → `apps/desktop/docs/superpowers/specs/2026-06-15-normattiva-integration-spec.md`
        (FR-8).

## Executor guardrails / SCOPE FENCE
Read `sudd/EXECUTOR_GUARDRAILS.md` first (if present in this repo). Otherwise follow
SUDD defaults from the global guardrails.

- **IN scope:** the 7 items above, exactly as specified.
- **OUT of scope:** new features, refactors beyond the comment in FR-6, any change to the
  persona data model, streaming x_normattiva work (Phase 1).
- **Privacy gate:** before DONE, run the two e2e tests
  (`apps/desktop/test-helpers/e2e-redact-rehydrate.test.ts`); both must pass against the
  mock OpenAI server. This proves the redaction chokepoint still works after FR-1's stricter
  parse (regression risk: a persona fixture typo would now error instead of silently
  downgrading).
- **No silent default changes:** FR-4 changes the default-model behavior when
  `normattivaApiKey` is empty. Cover with the set-key test so users who DO have a key aren't
  surprised.
