# Tasks: brown_normattiva-phase0-hardening_01

Tests-first where Rust/TS test infra exists; comment-only / file-move tasks exempt. Small
frequent commits per the global guardrails. Order: privacy-impacting first (FR-1, FR-3, FR-4),
then polish (FR-5, FR-6, FR-7, FR-8).

---

## Phase 1: privacy-impacting fixes

### T1: FR-1 — strict parse for `AnonymizationMode::from_string`
- [ ] RED: extend `test_anonymization_mode_from_string` with `Err` assertions for
      `""`, `"   "`, `"require"` (typo). Confirm the test fails against the current
      implementation (which maps everything to `None`).
- [ ] GREEN: change `from_string` to return `Result<Self, Box<dyn Error + Send + Sync>>`,
      return `Err(format!("invalid anonymization_mode: {:?}", s).into())` for unknown input.
      Update both call sites (`determine_backend:117`, `make_routing_decision:160`) to `?`
      the result.
- [ ] Verify the 6 built-in personas still load: add a unit test
      `test_anonymization_mode_built_in_personas_load` that asserts each of
      `psychologist`, `life-coach`, `career-coach`, `tax-accountant`, `tax-audit`,
      `legal-advisor-it` parses `Ok`.
  - Files: `apps/desktop/src-tauri/src/backend_routing.rs`.
  - Commit: `fix(backend_routing): strict anonymization_mode parse (SUDD phase0-hardening FR-1)`.

### T2: FR-3 — test for Required+Normattiva → AttributesOnly
- [ ] Add `make_routing_decision_normattiva_required_uses_attributes_only` in the
      `#[cfg(test)] mod tests` block of `backend_routing.rs`. Copy the `Stub` impl from
      the existing `determine_backend_maps_normattiva_string_to_enum` test (line 489+).
- [ ] Assert `decision.backend == BackendType::Normattiva` +
      `decision.content_mode == ContentMode::AttributesOnly` +
      `decision.is_safe == true` + `decision.fallback == FallbackEvent::None`.
- [ ] Confirm the test passes against the current code (normattiva-phase-0 already
      implemented this arm).
  - Files: `apps/desktop/src-tauri/src/backend_routing.rs`.
  - Commit: `test(backend_routing): Required+Normattiva produces AttributesOnly (SUDD FR-3)`.

### T3: FR-4 — `getDefaultModel()` skips Normattiva when key empty
- [ ] RED: extend `apps/desktop/src/stores/settings.test.ts` (already exists per the
      diff) with two cases:
      - `normattivaApiKey: ""` + `normattiva-legal-pro.isDefault: true` → returns the Nebius
        default (not Normattiva).
      - `normattivaApiKey: "sk-test"` + `normattiva-legal-pro.isDefault: true` → returns
        `normattiva-legal-pro`.
      Confirm both fail/pass as expected against the current code.
- [ ] GREEN: modify `getDefaultModel()` in `apps/desktop/src/stores/settings.ts` to skip
      models where `m.provider === "normattiva"` AND `settings.normattivaApiKey.trim() === ""`.
- [ ] Re-run both tests. Confirm green.
  - Files: `apps/desktop/src/stores/settings.ts`, `apps/desktop/src/stores/settings.test.ts`.
  - Commit: `fix(settings): skip Normattiva default when API key missing (SUDD FR-4)`.

## Phase 2: polish

### T4: FR-5 — `setNormattivaApiEndpoint` setter + UI consistency
- [ ] Add `setNormattivaApiEndpoint: (endpoint: string) => void` to the `SettingsStore`
      interface and impl in `apps/desktop/src/stores/settings.ts` (mirror
      `setNormattivaApiKey`).
- [ ] Destructure `setNormattivaApiEndpoint` in `PrivacySettings.tsx` and use it in the
      endpoint `<input>` `onChange` (replace the inline
      `useSettingsStore.getState().updateSettings({ normattivaApiEndpoint: ... })`).
- [ ] `pnpm tsc --noEmit` green.
  - Files: `apps/desktop/src/stores/settings.ts`,
           `apps/desktop/src/components/settings/PrivacySettings.tsx`.
  - Commit: `refactor(settings): setNormattivaApiEndpoint setter (SUDD FR-5)`.

### T5: FR-6 — comment on `anonymize: false` in Required arms
- [ ] Add the clarification comment above `anonymize: false` in BOTH the Nebius+Required
      arm (around line 184) and the Normattiva+Required arm (added in normattiva-phase-0).
- [ ] Comment only — no test, no behavior change.
  - Files: `apps/desktop/src-tauri/src/backend_routing.rs`.
  - Commit: `docs(backend_routing): clarify anonymize=false semantics (SUDD FR-6)`.

### T6: FR-7 — TODO marker for Phase 1 streaming `x_normattiva`
- [ ] Inside `streamChatCompletion` in `apps/desktop/src/services/nebius.ts`, add a
      `// TODO(phase-1):` block after the SSE loop. Name the three deferred items
      (exact usage capture, x_normattiva SSE accumulation, citations UI) and reference
      `docs/normattiva-integration-spec.md` A6 / B8.
- [ ] Comment only.
  - Files: `apps/desktop/src/services/nebius.ts`.
  - Commit: `docs(nebius): mark deferred streaming x_normattiva work (SUDD FR-7)`.

### T7: FR-8 — move spec doc to `apps/desktop/docs/superpowers/specs/`
- [ ] `git grep -l normattiva-integration-spec` to find any references; update them.
- [ ] `git mv docs/normattiva-integration-spec.md apps/desktop/docs/superpowers/specs/2026-06-15-normattiva-integration-spec.md`.
- [ ] Confirm `git log --follow` works on the moved file.
  - Files: `docs/normattiva-integration-spec.md` →
           `apps/desktop/docs/superpowers/specs/2026-06-15-normattiva-integration-spec.md`.
  - Commit: `chore(docs): move normattiva spec under apps/desktop/docs (SUDD FR-8)`.

## Phase 3: gate

### T8: full suite + e2e
- [ ] `cd apps/desktop && cargo test` green.
- [ ] `cd apps/desktop && pnpm test` green; test count >= current count (no tests removed,
      only added — T1, T2, T3 added tests; no removals).
- [ ] `cd apps/desktop && pnpm tsc --noEmit` green.
- [ ] `cd apps/desktop && pnpm lint` (or whatever the project uses — check package.json)
      green on the touched files.
- [ ] `cd apps/desktop && pnpm test:e2e e2e-redact-rehydrate` (or run the vitest file
      directly: `pnpm vitest run test-helpers/e2e-redact-rehydrate.test.ts`) green.
- [ ] Manually smoke: `cargo run` from `apps/desktop/src-tauri` once and confirm the
      `legal-advisor-it` persona still loads (proves the strict parse doesn't break the
      built-in).

### T9: PR + done
- [ ] PR with all 7 commits; description references
      `brown_normattiva-phase0-hardening_01` so `/sudd-done` can find it.
- [ ] After merge: `/sudd-done brown_normattiva-phase0-hardening_01` archives the change.

---

## Anti-regression gates
- **No silent default changes:** FR-4 has the set-key test so users with a key keep the
  Normattiva default.
- **No silent parse downgrade:** FR-1 makes unknown modes error instead of silently
  becoming `None`; persona fixture regression test covers all 6 built-ins.
- **Redaction chokepoint still works:** T8's e2e test runs the redact → cloud →
  rehydrate loop end-to-end against the mock server.
- **No comment-only commit hides a behavior change:** FR-6 / FR-7 / T5 / T6 are comment-
  only; the gate explicitly notes "no test, no behavior change" for both.
