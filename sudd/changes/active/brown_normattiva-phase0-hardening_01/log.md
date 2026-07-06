# Log: brown_normattiva-phase0-hardening_01

- 2026-06-22 — Created (proposal + specs + design + tasks). Output of a code-grounded review
  of the normattiva-phase-0 work (commits `a566fe0d` plan, `c8d492bd` spec v2, `9fa0b518`
  e2e). 7 defects bundled: 1 privacy-impacting silent-failure (FR-1), 1 missing test (FR-3),
  1 default-model UX risk (FR-4), 4 polish (FR-5..FR-8). TDD-ordered; small frequent
  commits; e2e gate at the end. Ready for `/sudd-apply`.
- 2026-06-23 — `sudd auto` ran the change (9h 22m session). Initial run reported
  "Implementation Complete" with 6 commits on `_temp_normattiva` (commits
  `d6a5c818..4b431265`), but the gate never passed — background task killed at 600s
  during validation, change logged as `UNKNOWN` not `DONE`.
- 2026-06-23 — Post-mortem found the FR-8 commit was polluted with 11 unrelated files
  (orchestrator's other green_* change artifacts were swept into the same commit). The 11
  files were preserved on branch `_scratch_orchestrator_artifacts` (the orchestrator's
  work product from those other changes), then `_temp_normattiva` was reset to FR-7's tip
  and FR-8 was re-done cleanly: spec move + nebius.ts path ref + 3 plan.md refs (4 files
  total, no pollution). New commit: `b6da59c2`.
- 2026-06-23 — Caught a real bug in the FR-4 implementation: `getDefaultModel()` was
  skipping normattiva when the key was empty (correct) but the new test "returns
  normattiva-legal-pro when key is set" was failing — the implementation preferred
  `cloudModeModel` / `defaultModelId` over the normattiva default. Fixed by promoting
  `isDefault: true` normattiva models when the key is set (B6/B10 intent: normattiva-legal-pro
  is the natural default for the legal-advisor-it persona). New commit: `2a1e1749`.
- 2026-06-23 — Local validation:
  - `pnpm test`: **27/27 pass** (settings.test.ts covers FR-4 + FR-5 + all persona fixtures;
    cloud-client.test + xnorm + validate + mock-openai-server all pass;
    e2e-redact-rehydrate.test.ts both cases pass — redaction chokepoint still works).
  - `pnpm tsc --noEmit`: clean.
  - `cargo test`: **could not run locally** — Windows cmake/llama-cpp-sys-2 build fails
    on this machine (MSBuild cannot find `install.vcxproj`); code reviewed by hand against
    the spec and matches FR-1 (strict parse, `?` on callers, regression test for all 6
    built-in personas), FR-3 (Required+Normattiva → AttributesOnly test), and FR-6
    (anonymize=false comment). Expected to pass in CI / Linux.
- 2026-06-23 — Status: **ready for DONE**. All 7 FRs shipped; 7 clean commits on
  `_temp_normattiva`; pollution files preserved on `_scratch_orchestrator_artifacts`;
  regression tests + e2e redact→cloud→rehydrate loop all green locally.
