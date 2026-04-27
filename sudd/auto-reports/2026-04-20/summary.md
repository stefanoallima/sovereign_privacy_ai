# Auto Report — 2026-04-20

## Session Info

- **Start**: 11:01 CEST
- **End**: 11:01 CEST
- **Elapsed**: <1s
- **CLI**: claude
- **Stop reason**: queue_empty

## Changes Processed

No changes processed.

## Quarantine

3 change(s) quarantined in `sudd/changes/stuck/`:

- **discovered_audit_archive-clears-zombie-stuck-dirs_01**
- **discovered_audit_stats-rollup-deadfield-fix_01**
- **discovered_audit_lesson-heading-matches-outcome_01**

Use `sudd auto --retry-stuck` to restore them to the active queue.

## Dirty (shipped, needs cleanup)

1 change(s) in `sudd/changes/dirty/` — code landed, hygiene follow-up needed:

- **discovered_audit_runner-stuck-requires-reason_01** — Code shipped at 2026-04-19T21:59:15Z; pre-archive hygiene check failed. The change landed in `sudd/changes/dirty/` instead of `sudd/changes/archive/` because the subprocess committed code AND recorded its lesson, but one or more cosmetic checks flagged the archive artifacts. Fix the issues listed below, then manually move the directory to `sudd/changes/archive/discovered_audit_runner-stuck-requires-reason_01_DONE/`.

Open each `FOLLOWUP.md` for the specific hygiene fix needed.

## Pre-archive checks

- Registered: 3
- Ran: 0
- Failures: 0


## Cured (auto-promoted from dirty/)

- 2026-04-20T09:45:57Z discovered_audit_runner-stuck-requires-reason_01: cured SummaryHasCanonicalHeadings
