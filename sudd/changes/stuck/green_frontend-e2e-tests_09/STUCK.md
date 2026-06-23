# Stuck: green_frontend-e2e-tests_09

## Category
budget

## Probable Root Cause
MaxDuration budget hit; no pre-archive check ran

## Retry-Tier Recommendation
raise **MaxDuration:** in proposal.md (e.g. 2h → 4h), or split the change — adding compute at same tier tends to hit the same wall

## Files to Inspect
- `sudd/auto-reports/YYYY-MM-DD/green_frontend-e2e-tests_09.log`
- `sudd/changes/stuck/green_frontend-e2e-tests_09/STUCK_REPORT.md`
- `sudd/changes/stuck/green_frontend-e2e-tests_09/log.md`

## Timestamp
2026-06-23T06:43:02Z
