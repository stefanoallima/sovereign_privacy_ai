# Change: brown_normattiva-phase0-hardening_01

## Status
proposed

## Summary
Close 7 defects surfaced during a code-grounded review of the normattiva-phase-0 work (commits
`a566fe0d` plan, `c8d492bd` spec v2, `9fa0b518` e2e). The shipping change is small and well-scoped;
all defects are in already-shipped code, no new features. Privacy-impacting items (1, 2, 3) come
first; cosmetic items (4–7) are bundled polish.

## Motivation
Normattiva-phase-0 wired a new cloud provider into the existing redaction chokepoint. The shape of
the change is right, but a focused review found 1 silent-failure privacy risk (an unknown
`anonymization_mode` value silently maps to `None`), 1 missing test for the
Required+Normattiva → AttributesOnly arm, 1 default-model UX risk (silent 401 when the user has
no Normattiva key), and 4 polish items that make the next round of changes easier to land.

The whole point of the Sovereign AI vision is "raw PII never reaches a server the user doesn't
control, no transparency about what is sent". A persona with `anonymization_mode: "require"`
(typo) silently dropping to no anonymization is exactly the failure mode the architecture exists
to prevent. Fix it before Phase 1 lands streaming usage capture (which will widen the attack
surface if the privacy posture isn't already tight).

## Scope
Included (all in already-shipped code on `main`, branch `normattiva-phase-0` merged via
`c8d492bd` / `a566fe0d` / `9fa0b518`):

1. **`AnonymizationMode::from_string`** (`apps/desktop/src-tauri/src/backend_routing.rs:42-50`):
   unknown / empty / whitespace-only values must error at parse time, not silently map to `None`.
   A typo in any persona's `anonymization_mode` field would otherwise let raw PII reach the cloud.
   Tighten to: known values map as today; everything else → error. The validator at
   `backend_routing.rs:341` already rejects `Required` + `!enabled_anonymizer`; this just makes
   the parse step symmetric.

2. **Test the Required+Normattiva → AttributesOnly decision arm** (`backend_routing.rs:184-208`
   + the new arm at the parallel location for Normattiva, plus the existing
   `determine_backend_maps_normattiva_string_to_enum` test at line 482+). Add one Rust unit test
   that asserts: persona `preferred_backend="normattiva"` + `anonymization_mode="required"` +
   `enable_local_anonymizer=true` → decision `content_mode == AttributesOnly`. The Nebius
   equivalent is already tested; the Normattiva arm is not.

3. **`normattiva-legal-pro` is `isDefault: true`** (`apps/desktop/src/stores/settings.ts:115-128`).
   A user with no Normattiva key would silently 401 on the first chat. Either (a) set
   `isDefault: false` so the existing Nebius default wins until the user opts in, or (b) make
   `getDefaultModel()` skip Normattiva defaults when `normattivaApiKey` is empty. Pick (b) — it
   preserves the "Normattiva is the default for the legal persona" intent (B6) while keeping the
   general default safe. Cover with a unit test.

4. **`PrivacySettings.tsx` endpoint field** uses `useSettingsStore.getState().updateSettings({...})`
   inline while the API-key field uses the destructured `setNormattivaApiKey`. Add a
   `setNormattivaApiEndpoint` setter and use it; consistent with the rest of the file and
   easier to test.

5. **Add a clarifying comment** on `anonymize: false` for the Normattiva+Required arm in
   `backend_routing.rs:184` (and the matching Normattiva arm). "anonymize" here means "do
   anonymization in the routing layer", not "is the outbound text redacted" — the desktop
   pipeline (GLiNER → redactForCloud) handles the actual redaction. The current field name is
   misleading. Comment only — no behavior change.

6. **TODO marker in `streamChatCompletion`** (`apps/desktop/src/services/nebius.ts:91-148`):
   `x_normattiva` is parsed from non-streaming responses but never accumulated from SSE chunks.
   Streaming usage capture is deferred to Phase 1 per the plan, but the deferred work has no
   marker. Add a `// TODO(phase-1): ...` pointing at the deferred work so the next person
   extending `streamChatCompletion` doesn't forget that the citations field is silently dropped
   on streamed responses today.

7. **Move `docs/normattiva-integration-spec.md`** to
   `apps/desktop/docs/superpowers/specs/2026-06-15-normattiva-integration-spec.md` (matches the
   existing `2026-03-14-openclaw-privacy-layer-proposal.md`). Pure repo hygiene. Add a
   redirect note in the old location? **No** — it's a doc move, git log finds it.

NOT included:
- A new test for streaming `x_normattiva` accumulation (that's Phase 1 work, out of scope).
- Changing the persona's `anonymization_mode` field type (e.g. enum on the wire). Currently a
  string; tightening the parse is enough for now.
- Reorganizing the persona editor UI. The privacy settings UI already shows the right
  affordances; this change only tightens what's behind them.

## Success Criteria
- [ ] Unknown `anonymization_mode` values produce an `Err` from `AnonymizationMode::from_string`
      with a message that names the bad value; `None` / `Optional` / `Required` still work as
      today. Existing persona fixtures still load (regression test).
- [ ] New Rust unit test `make_routing_decision_normattiva_required_uses_attributes_only` passes;
      covers Required+Normattiva → AttributesOnly.
- [ ] `getDefaultModel()` returns a non-Normattiva model when `normattivaApiKey` is empty; new
      unit test covers both empty-key and set-key paths.
- [ ] `setNormattivaApiEndpoint` exists in the settings store; `PrivacySettings.tsx` uses it.
- [ ] Comment on `anonymize: false` in both Nebius+Required and Normattiva+Required arms.
- [ ] `// TODO(phase-1)` marker in `streamChatCompletion` pointing at the deferred
      `x_normattiva` SSE accumulation.
- [ ] `docs/normattiva-integration-spec.md` moved to
      `apps/desktop/docs/superpowers/specs/2026-06-15-normattiva-integration-spec.md`. No
      redirect in the old location (git log suffices).
- [ ] Full Rust test suite (`cargo test`) green; full TS test suite (`pnpm test`) green; no
      regressions in `vitest.config.ts` test count.

## Dependencies
- `normattiva-phase-0` merged on `main` — confirmed at `c8d492bd` / `a566fe0d` / `9fa0b518`.
- No platform-side dependencies (this is desktop-only).
- No schema migration (Rust enum widening is internal; TS widening already shipped in
  normattiva-phase-0; v17 settings migration already shipped).

## Risks
- **Item 1 (strict parse) breaks a persona fixture** if any existing fixture uses a typo. Mitigate
  with a regression test that loads the built-in personas (`psychologist`, `life-coach`,
  `career-coach`, `tax-accountant`, `tax-audit`, `legal-advisor-it`) and asserts all parse.
- **Item 3 (default model guard)** could regress users who *want* the Normattiva default and
  have a key set. Cover with a set-key test that asserts Normattiva *is* picked.
- **Item 7 (spec move)** is invisible to runtime but a docs-link rot risk. Search the repo for
  `normattiva-integration-spec` and update any references before moving.

## Acceptance (PR-able when)
- All 7 success criteria checked
- `cargo test` green, `pnpm test` green, no new lint errors
- PR description references `brown_normattiva-phase0-hardening_01` change id so
  `/sudd-done` can find it
