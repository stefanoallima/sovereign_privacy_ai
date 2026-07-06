# Follow-up — green_add-personas-batch2_02

## Status

Code shipped at 2026-06-23T00:19:46Z; pre-archive hygiene check failed. The change landed in `sudd/changes/dirty/` instead of `sudd/changes/archive/` because the subprocess committed code AND recorded its lesson, but one or more cosmetic checks flagged the archive artifacts. Fix the issues listed below, then manually move the directory to `sudd/changes/archive/green_add-personas-batch2_02_DONE/`.

## Failing Checks

- **LessonRecorded** — no canonical '### [DONE|STUCK|FAILURE] green_add-personas-batch2_02' or '## Lesson: green_add-personas-batch2_02' heading with ≥ 3 body lines in sudd/memory/lessons.md
- **SummaryHasCanonicalHeadings** — archive/green_add-personas-batch2_02_DONE/SUMMARY.md missing canonical headings: ## What Changed, ## Why, ## Validation, ## Lessons

## How to Fix

- `LessonRecorded`: append a `### [DONE] <change-id>` (or `## Lesson: <change-id>`) section with at least 3 body lines to `sudd/memory/lessons.md`.
- `SummaryHasCanonicalHeadings`: open the change's `SUMMARY.md` and ensure it contains the canonical headings (`## What Changed`, `## Why`, `## Validation`, `## Lessons`) with exact case and spelling.
