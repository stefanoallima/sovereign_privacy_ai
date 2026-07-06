# Specs: brown_normattiva-phase0-hardening_01

Read every file cited below before writing code. All line numbers are stable as of
normattiva-phase-0 merge.

## FR-1: `AnonymizationMode::from_string` strict parse
**Current:** `apps/desktop/src-tauri/src/backend_routing.rs:42-50`:
```rust
pub fn from_string(s: &str) -> Self {
    match s {
        "optional" => AnonymizationMode::Optional,
        "required" => AnonymizationMode::Required,
        _ => AnonymizationMode::None,
    }
}
```

**Required:**
- `from_string("none" | "optional" | "required")` → unchanged (`None` / `Optional` / `Required`).
- `from_string("")` and `from_string("   ")` and `from_string("require")` (typo) →
  `Err(Box<dyn Error + Send + Sync>)` whose `Display` includes the offending input.
- The function signature changes from `-> Self` to `-> Result<Self, Box<dyn Error + Send + Sync>>`.
- **All callers updated** to `?` the result (or `.unwrap_or(AnonymizationMode::None)` if they
  genuinely want the unsafe fallback). Call sites to update:
  - `backend_routing.rs:117` `determine_backend` — uses `AnonymizationMode::from_string(&persona.anonymization_mode)`. The persona is loaded from the DB, so a parse error here is a config error → bubble up with `?`.
  - `backend_routing.rs:160` `make_routing_decision` — same pattern, bubble up.
- **Existing test `test_anonymization_mode_from_string`** (`backend_routing.rs:400-405`) MUST be
  updated: `from_string("invalid")` now returns `Err`, not `None`. Update the test to assert
  `Err` for bad input and `Ok(None)` / `Ok(Optional)` / `Ok(Required)` for the good ones.

## FR-2: Regression test — all built-in personas parse cleanly
**New file:** `apps/desktop/src-tauri/src/backend_routing_personas_test.rs` (or add to the
existing `#[cfg(test)] mod tests` block at `backend_routing.rs:395`).
- For each built-in persona (`psychologist`, `life-coach`, `career-coach`, `tax-accountant`,
  `tax-audit`, `legal-advisor-it`), load its hard-coded `anonymization_mode` string and call
  `AnonymizationMode::from_string`. Assert `Ok` for all six.
- Asserts the strict-parse change doesn't break any shipped persona fixture.

## FR-3: Test — Required+Normattiva → AttributesOnly decision
**Add to** `backend_routing.rs` `#[cfg(test)] mod tests` (after line 482 where the existing
`determine_backend_maps_normattiva_string_to_enum` test lives).
- Build a `Persona` with `preferred_backend: "normattiva"`, `anonymization_mode: "required"`,
  `enable_local_anonymizer: true`.
- Call `make_routing_decision(&persona, &stub_inference, "...").await`.
- Assert returned `decision.backend == BackendType::Normattiva`,
  `decision.content_mode == ContentMode::AttributesOnly`, `decision.is_safe == true`,
  `decision.fallback == FallbackEvent::None`.
- Mirror the existing `Stub` impl at `backend_routing.rs:489+` — copy-paste is fine, the test
  file already has one.

## FR-4: `getDefaultModel()` skips Normattiva when key is empty
**Current:** `apps/desktop/src/stores/settings.ts` `getDefaultModel()` (around line 325 per the
spec, post-normattiva-phase-0 around line 408+ based on diff). Walks enabled models and returns
the one with `isDefault: true`.

**Required:**
- If the candidate default model has `provider === "normattiva"` AND
  `settings.normattivaApiKey.trim() === ""`, skip it and continue to the next enabled model.
- If no enabled model qualifies (everything skipped), return the first enabled model as
  today (preserves current behavior for the all-empty case).
- **Add unit test** in `apps/desktop/src/stores/settings.test.ts` (already exists per the
  diff). Two cases:
  - Empty `normattivaApiKey`, `normattiva-legal-pro` is `isDefault: true` → returns the
    Nebius default, not Normattiva.
  - Set `normattivaApiKey: "sk-test"`, `normattiva-legal-pro` is `isDefault: true` → returns
    `normattiva-legal-pro` (the legal-persona case).

## FR-5: `setNormattivaApiEndpoint` setter + UI consistency
**Current:** `apps/desktop/src/stores/settings.ts:189-191` has `setApiKey` and
`setNormattivaApiKey`; no endpoint setter.

**Required:**
- Add `setNormattivaApiEndpoint: (endpoint: string) => void` to `SettingsStore` (mirror
  `setNormattivaApiKey` exactly).
- Update `apps/desktop/src/components/settings/PrivacySettings.tsx`:
  - Destructure `setNormattivaApiEndpoint` alongside `setNormattivaApiKey`.
  - Replace the inline `useSettingsStore.getState().updateSettings({ normattivaApiEndpoint: ... })`
    in the endpoint `<input>` `onChange` with the destructured setter.

## FR-6: Comment on `anonymize: false` in Required arms
**Files:**
- `apps/desktop/src-tauri/src/backend_routing.rs` — both the Nebius+Required arm (around line 184)
  and the new Normattiva+Required arm (around line 211+).
- Add a single-line comment above `anonymize: false` in both spots:
  ```rust
  // anonymize=false: redaction is done by the desktop pipeline (GLiNER →
  // redactForCloud), not by the routing layer. "anonymize" here means
  // "do anonymization in the routing layer"; the outbound text IS redacted.
  ```
- No behavior change.

## FR-7: TODO marker for Phase 1 streaming `x_normattiva` accumulation
**File:** `apps/desktop/src/services/nebius.ts`, inside `streamChatCompletion` (around line
91-148 in the branch-version of the file).
- After the SSE loop (after `return { inputTokens, outputTokens }`), add a `// TODO(phase-1):`
  block pointing at:
  - The deferred `stream_options.include_usage` exact-usage capture.
  - The deferred `x_normattiva` accumulation from the final usage chunk (spec A6:
    "Citations may be sent in the final usage chunk's `x_normattiva.citations`").
  - The deferred citations UI (spec B8).
- Comment only — no code change.

## FR-8: Move spec doc
**Move:**
- `docs/normattiva-integration-spec.md`
- → `apps/desktop/docs/superpowers/specs/2026-06-15-normattiva-integration-spec.md`
- Use `git mv` (preserves history).
- **Before moving**, `grep -rn "normattiva-integration-spec" apps/ docs/` to find any references
  and update them.
- **No redirect** in the old location — `git log --follow` finds it, and any tooling that
  references the old path needs to update anyway.

## Non-Functional / Regression gates
- `cargo test` green (full Rust suite).
- `pnpm test` green; test count unchanged from pre-change (no tests removed, only added).
- No new clippy warnings on the touched files.
- No new eslint warnings on the touched files.
- The two e2e tests (`e2e-redact-rehydrate.test.ts`) still pass against the mock OpenAI server.

## Out of scope
- Streaming `x_normattiva` accumulation (Phase 1).
- Citations UI (Phase 1).
- Phase 2 streaming usage capture (Phase 2).
- Persona editor UI changes (out of scope; privacy settings already show the right
  affordances).
- Renaming `anonymize` to something less misleading (would touch too many call sites for a
  hardening change; comment-only this round).
