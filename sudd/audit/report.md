# Platform Audit Report

**Date**: 2026-04-20
**Git SHA**: a648e051f61c5de9fc615ba83ca9d15431f6326a
**Personas evaluated**: 4 (default, framework-maintainer, sibling-repo-operator, auto-loop-watcher)
**Browser testing**: SKIPPED — repo is CLI+markdown framework, no HTTP surface (`api_surface.frontend_routes = []`, `backend_endpoints = []` per refreshed manifest)
**Code-intel pipeline (Step 2)**: SKIPPED — same reason; rubric is sourced from `vision.md` + per-persona `## Objectives`.
**Overall health**: **NEEDS_WORK** (floor persona = default at 64/100; 0 CRITICAL gaps)

## Persona Scores

| Persona | Score | Level | Objectives Met | Gaps |
|---------|-------|-------|---------------|------|
| sibling-repo-operator | 92/100 | EXCELLENT | 3/3 full | 3 (1 medium, 2 informational/cosmetic) |
| framework-maintainer | 78/100 | GOOD (floor) | 2/4 full, 2/4 partial | 5 (1 high, 2 medium, 2 low) |
| auto-loop-watcher | 72/100 | GOOD | 2/4 full, 2/4 partial | 6 (2 high, 3 medium, 1 low) |
| default (Stefano) | 64/100 | NEEDS_WORK | 1/4 full, 3/4 partial | 6 (3 high, 2 medium, 1 low) |

## Overall Health Criteria

- EXCELLENT: All personas ≥ 98, no critical gaps
- GOOD: All personas ≥ 80, no critical gaps
- NEEDS_WORK: Any persona 50–79, or important gaps ← **current**
- CRITICAL: Any persona < 50, or critical gaps

This audit closed the prior round's only CRITICAL gap (stats-rollup dead-field). Health stays NEEDS_WORK because:
- Floor persona (default) is at 64 — below the 80 GOOD threshold.
- One systemic HIGH gap (`LessonRecorded` false-positive) silently mislabels 4 of every 5 successful sessions as STUCK; pollutes every downstream observability surface.

## Per-Persona Details

### sibling-repo-operator — 92/100 (EXCELLENT)

#### Objectives
- [x] **Obj 1: `sudd update` idempotent + retired agents purged** — 95/100 — `grep -rn 'handoff-validator' sudd-go/cmd/sudd/templates/` returns 0 hits in shipping templates; the 5 hits in `framework_integrity_test.go` are guard-literals. Templates clean across all CLI variants; shrink-gate + `ErrSelfUpdate` prevent v3.8.x wipe regression.
- [x] **Obj 2: Curated personas survive update** — 100/100 — `installer.go:137-145` `PreservedPaths` covers entire `sudd/personas/` subtree; `livesource.go:221-267` only overwrites if `IsDegradedPersonaFile()` (empty/whitespace) returns true. `TestUpdateFromLiveSource` proves custom `default.md` survives `--force`. Behavior is *stricter* than the persona spec.
- [x] **Obj 3: Install references only live agents** — 90/100 — 35 shipped agents match live; zero dangling `agent=…` references across `apply.md`/`gate.md`/`run.md`/`plan.md` and all CLI-specific variants. 13 framework-integrity tests PASS.

#### Gaps Found
1. **`.claude/commands/sudd/init.md` drift** — MEDIUM (G10 → proposal #10).
2. **4 shipped agents unreferenced** (`context-manager`, `decomposer`, `monitor`, `solution-explorer`) — INFO (G11 → proposal #12).
3. **`discovered_handoff-validator-sibling-purge` STUCK on lesson hygiene only** — COSMETIC; the actual purge work landed (proposal not generated; pending re-archive after G6 lands).

---

### framework-maintainer — 78/100 (GOOD, at floor)

#### Objectives
- [x] **Obj 1: Real archetypes in `sudd/personas/`** — 92/100 — 4 files present: `default.md`, `framework-maintainer.md`, `sibling-repo-operator.md`, `auto-loop-watcher.md`. Each archetype carries the canonical sections and cites real archive evidence. `default.md:3` carries explicit "LAST-RESORT FALLBACK" note.
- [x] **Obj 2: Autogen preflight when understocked** — 95/100 — Hook at `sudd-go/cmd/sudd/auto.go:199-212`; helper at `internal/auto/personas.go`; regression test `TestAutoPreflightTriggersPersonaAutogenWhenUnderstocked` at `cmd/sudd/auto_persona_autogen_test.go:27` PASSES.
- [~] **Obj 3: Audits grade against archetypes, not fallback** — 55/100 — Scaffold shipped but unproven end-to-end. The previous `report.md` graded `Personas evaluated: 1 (default)`; this audit run is the first to exercise the per-archetype dispatch loop. **Closed by THIS audit.**
- [~] **Obj 4: Per-change + per-task persona layers populated** — 60/100 — Per-change `personas/` dir present on all 8 stuck changes (good). But **per-task** `tasks/{id}/micro-persona.md` exists in only 1/53 archives (`brown_gate-pb-integration_01_DONE`); 0/8 stuck changes have it. The `micro-persona-generator` agent isn't wired into the per-task dispatch loop.

#### Gaps Found
1. **Per-task micro-persona layer empty** — HIGH (G7 → proposal #7).
2. **Archetype grading not yet observed end-to-end** — MEDIUM. Closed by this audit run completing.
3. **Stuck changes use flat `tasks.md` not `tasks/{id}/` subdirs** — MEDIUM (folded into G7).
4. **Preflight warning emits to stdout, not structured auto-report** — LOW (G14 → proposal #14).
5. **`default.md` has both `## Goals` and `## Objectives`** — LOW cosmetic (G12 → proposal #13).

---

### auto-loop-watcher — 72/100 (GOOD)

#### Objectives
- [~] **Obj 1: Morning triage <5 min, ≤1-line reason per STUCK** — 78/100 — `auto-reports/2026-04-19/summary.md` has clean per-change table + `## Pre-archive checks` section with check name + offending file path above the fold. But Action Items line shows `# Stuck: <id>` (the H1) as the reason because `collectStuckReasons` reads first non-empty line of STUCK.md.
- [~] **Obj 2: STUCK items carry triage classifier** — 65/100 — Classifier shipped (`stuck.go:268 WriteStuckMD`), wired at write-time + preflight backfill. 6/8 STUCK.md files have classifier output. **2/8 still boilerplate** (`Max retries exhausted...`) — the meta-irony: `discovered_stuck-triage-classifier-at-write-time` itself stuck without painting over its own dirname.
- [~] **Obj 3: `CURRENT_STATE.md` reflects NOW** — 70/100 — Refresh timestamp ~3 min old (fresh). Counts line `0 active, 8 stuck, 0 dirty, 0 inbox, 0 queued` matches filesystem exactly. **But** the next paragraph contradicts itself: "Heavy stuck backlog (7) outnumbers 6 active changes with 11 inbox items waiting" — stale PrevTLDR prose. Stuck list bullets show "- **Timestamp**: <date>" instead of classifier output.
- [x] **Obj 4: Pre-archive checks visible in `doctor`** — 95/100 — `sudd doctor` shows `Checks ✓ pre-archive check registry  3 registered: LessonRecorded, TasksAllChecked, SummaryHasCanonicalHeadings`. Backed by regression tests in `doctor_test.go:386-431`.

#### Gaps Found
1. **Boilerplate STUCK.md for 2/8 stuck items** — HIGH (G3 → proposal #3).
2. **CURRENT_STATE prose contradicts counts line** — HIGH (G2 → proposal #2).
3. **`collectStuckReasons` reads STUCK.md H1 not classifier** — MEDIUM (G4 → proposal #4).
4. **Stuck list bullets show STUCK_REPORT.md timestamp not classifier** — MEDIUM (G5 → proposal #5).
5. **state.json `changes_processed[]` invisible across session boundaries** — MEDIUM (G13 → proposal #11).
6. **STUCK_REPORT.md lacks Category / Probable Root Cause sections** — LOW (informational; STUCK.md has them).

---

### default (Stefano fallback) — 64/100 (NEEDS_WORK)

Note: This is the LAST-RESORT FALLBACK persona. Grading it as a baseline; the more specific archetypes carry the main load.

#### Objectives
- [~] **Obj 1: Working code, no placeholder data** — 70/100 — Previous audit's deal-breaker (`stats: {0,0,0,0}`) is CLOSED. `state.json:94-101` now shows `tasks_completed=2, tasks_stuck=8, total_done_dirty=1, stats_seeded=true`. `go test ./...` green. Test ratio improved 0.67 → 0.72. **But** `CURRENT_STATE.md:8` body prose is stale (semi-regression of prior GAP-2).
- [~] **Obj 2: Autonomous progress without intervention** — 55/100 — Session completed 5 changes end-to-end, retry_count=0 — but **80% outcome-label lie rate**: 4/5 changes outcome=STUCK despite real `merged_sha` on `main`. The lessons ARE on disk (`lessons.md:16,43,52,59`); the `LessonRecorded` check rejects them anyway — strongly suggests timing/flushing bug.
- [~] **Obj 3: Understand from archive** — 80/100 — Recent SUMMARY.md files have rich canonical headings. **But** `_stats-rollup-deadfield-fix_01` (the most important fix of the prior audit) has NO heading at all in `lessons.md`. `_runner-stuck-requires-reason_01_DONE`'s `## Lessons` is the cure-dirty placeholder ("auto-cure: heading appended; flesh out as needed.").
- [~] **Obj 4: Stuck items unblockable** — 60/100 — All 8 stuck entries have STUCK.md with classifier (where wired). 5/8 have useful classification. 3/8 have `## Category: unknown` (predate the TimeoutReason invariant). The 4 STUCK-but-merged entries from live session are NOT in `stuck/` — they're in `archive/` modulo the outcome-label drift.

#### Gaps Found (overlap with other personas)
1. **`LessonRecorded` false-positive timing bug** — HIGH (G1 → proposal #1).
2. **CURRENT_STATE prose contradicts counts** — HIGH (G2 → proposal #2; shared with auto-loop-watcher).
3. **`_stats-rollup-deadfield-fix_01` lesson missing from `lessons.md`** — HIGH (G6 → proposal #6).
4. **3/8 STUCK.md `## Category: unknown`** — MEDIUM (G9 → proposal #9).
5. **Cure-dirty placeholder in `_runner-stuck-requires-reason_01_DONE` SUMMARY** — MEDIUM (G8 → proposal #8).
6. **Zombie-stuck cleanup unchanged** — LOW (prior GAP-5; the proposal `_archive-clears-zombie-stuck-dirs_01` itself stuck).

#### UX Issues
N/A (no UI surface).

## Proposals Generated

All 14 written to `sudd/changes/active/discovered_audit_<slug>_01/` with `proposal.md` + `personas/` subdirs.

| # | Proposal | Persona | Gap | Severity | Size |
|---|----------|---------|-----|----------|------|
| 1 | `discovered_audit_lesson-recorded-timing-bug_01` | default + framework-maintainer | G1 (HIGH) | HIGH | S |
| 2 | `discovered_audit_current-state-prose-counts-mismatch_01` | auto-loop-watcher + default | G2 (HIGH) | HIGH | S |
| 3 | `discovered_audit_stuck-md-classifier-missed-quarantines_01` | auto-loop-watcher | G3 (HIGH) | HIGH | S |
| 4 | `discovered_audit_stuck-reason-extractor-uses-classifier_01` | auto-loop-watcher | G4 (MEDIUM) | MEDIUM | S |
| 5 | `discovered_audit_current-state-stuck-bullets-classifier-source_01` | auto-loop-watcher | G5 (MEDIUM) | MEDIUM | S |
| 6 | `discovered_audit_cure-stuck-mechanical-lesson-failures_01` | default + framework-maintainer | G6 (HIGH) | HIGH | M |
| 7 | `discovered_audit_micro-persona-per-task-wiring_01` | framework-maintainer | G7 (HIGH) | HIGH | M |
| 8 | `discovered_audit_cure-dirty-placeholder-followup-marker_01` | default | G8 (MEDIUM) | MEDIUM | S |
| 9 | `discovered_audit_stuck-classifier-log-tail-fallback_01` | default + auto-loop-watcher | G9 (MEDIUM) | MEDIUM | S |
| 10 | `discovered_audit_init-template-variants-sync_01` | sibling-repo-operator | G10 (MEDIUM) | MEDIUM | S |
| 11 | `discovered_audit_morning-report-prior-session-stuck_01` | auto-loop-watcher | G13 (MEDIUM) | MEDIUM | S |
| 12 | `discovered_audit_audit-shipped-agent-references_01` | framework-maintainer | G11 (LOW) | LOW | S |
| 13 | `discovered_audit_default-persona-heading-cleanup_01` | framework-maintainer | G12 (LOW) | LOW | S |
| 14 | `discovered_audit_preflight-warning-structured-output_01` | auto-loop-watcher | G14 (LOW) | LOW | S |

**14 proposals from 14 distinct gaps. 5 HIGH, 6 MEDIUM, 3 LOW.** No collisions with the 8 in-flight stuck proposals.

## Recommendations

**P1 — Land G1 first** (`lesson-recorded-timing-bug`). Single highest-leverage fix: 4 of 5 changes in the live session were mislabeled STUCK because of this. Fixing it removes the dominant noise source from every observability surface (auto-reports, state.json, CURRENT_STATE), makes the next audit trustable, and lets several stuck changes auto-cure into DONE on retry.

**P1 — Land G2 second** (`current-state-prose-counts-mismatch`). The display layer's contradiction with itself is the kind of "framework lying to its operator" finding that erodes trust faster than any other defect class. ~5-line fix in `render.go pickBody` or extend `AssertTLDRMatchesBody`.

**P1 — Land G6 third** (`cure-stuck-mechanical-lesson-failures`). The most important shipped fix of the prior audit (`_stats-rollup-deadfield-fix_01`) has no lesson heading — embarrassing for a memory-layer-first framework. After G1 lands, mechanical LessonRecorded failures become rare; until then, sweeping `stuck/` for them turns 4-5 quarantined changes into shipped DONEs.

**P2 — G3, G4, G5 cluster** (STUCK classifier coverage). G3 closes the write-time hole; G4 and G5 surface the classifier output where the operator actually reads (Action Items, CURRENT_STATE bullets). Order: G3 → G4 → G5.

**P2 — G7** (`micro-persona-per-task-wiring`). The framework-maintainer's biggest drag. Per-task contract exists in agent specs but never fires — wiring it into apply.md and adding `TestEveryTaskHasMicroPersona` is a real ship.

**P3 — G8, G9, G10, G13** plus the LOW-priority hygiene items. Cheap, permanent.

## Previous Audit Comparison

Previous audit (`sudd/audit/report-previous.md`, 2026-04-19): **52/100 NEEDS_WORK**, 7 gaps including 1 CRITICAL.
This audit: **64/100 NEEDS_WORK** (floor), **0 CRITICAL gaps**, 14 gaps spread across 4 archetypes (vs 1 fallback persona).

**Net delta: +12 on the floor persona, +∞ on persona coverage** (from 1 fallback to 4 named archetypes), 5 of 7 prior gaps closed.

| Prior gap | Status | Evidence |
|---|---|---|
| GAP-1: stats rollup dead-field (CRITICAL) | **CLOSED** | `state.json:94-101` real values; `RollupSessionStats` + `IncrementChangeStats` shipped + tested |
| GAP-2: CURRENT_STATE TL;DR understates stuck | **PARTIALLY CLOSED** | counts line correct (filesystem-sourced); body prose still stale → new G2 |
| GAP-3: lessons.md labels STUCK as DONE | **CLOSED** | every current stuck has matching `[STUCK]` heading; `[STUCK]` count is 8, matches filesystem |
| GAP-4: runner missing `timeout_reason` on STUCK | **CLOSED** | `classifyStuckReason` shipped; source-level invariant test passes; all 5 live-session STUCKs have `timeout_reason` |
| GAP-5: zombie stuck dirs alongside DONE archives | **UNCHANGED** | proposal `_archive-clears-zombie-stuck-dirs_01` itself stuck; pending |
| GAP-6: session finalization skipped (`stop_reason=""`) | **CLOSED** | `finalizeAutoSession` defaults to `queue_empty`; prior finalized sessions show real value |
| GAP-7: handoff-validator in shipped templates | **CLOSED** | purge shipped + scanRoots widened in v3.8.25; integrity tests cover all CLI variants |

**Plus: 3 net-new archetype personas seeded** (`framework-maintainer`, `sibling-repo-operator`, `auto-loop-watcher`) with grounded objectives — the prior audit ran against `default` only.

**Interpretation**: The framework's foundation is materially better. The prior critical and most prior highs are gone; the new gaps cluster around two systemic problems (`LessonRecorded` timing + display-layer staleness in CURRENT_STATE) and one structural one (per-task persona contract not wired). Fixing G1+G2+G6 in order would likely take the floor persona to ≥80 (GOOD) by the next audit and resolve the dominant operator-trust regression.

## Audit Pipeline Notes

- **Step 0 (persona self-healing)**: skipped enrichment — all 4 personas already had `## Objectives` (the seed shipped on commit `5f70c63`).
- **Step 1 (manifest)**: regenerated; prior manifest's git SHA was stale.
- **Step 2 (code-intel)**: skipped; manifest's `api_surface.frontend_routes = []` and `api_surface.backend_endpoints = []` confirm CLI-only repo.
- **Step 3 (browser testing)**: skipped; no HTTP surface.
- **Step 4 (persona validation)**: 4 validators dispatched in parallel; results in `sudd/audit/validation-results/{persona}.md`.
- **Step 5 (gap analysis)**: deduplicated against 8 in-flight stuck proposals; 14 net-new proposals generated.
- **Evidence sources**: filesystem ground truth, manifest, state.json, CURRENT_STATE.md, lessons.md, archive/active/stuck listings, source code in `sudd-go/`, regression tests, prior audit report.
