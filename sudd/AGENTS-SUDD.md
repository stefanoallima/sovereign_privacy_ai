# SUDD Framework Guide

> **Framework-owned file.** Auto-updated by `sudd update`. Do not edit manually —
> changes will be overwritten. Put repo-specific guidance in `AGENTS.md` instead.

This project uses **SUDD** (Simulated User-Driven Development) for autonomous
AI-driven development. The CLI agent IS the orchestrator. Everything else is
markdown. Code is only "done" when validated from the actual user's perspective.

## Smoke-Test Before You Trust (DEFAULT: VERIFY THE DEPENDENCY)

**Never build on an integration you haven't proven works. Smoke-test first; if
the smoke test fails, RAISE it loudly and STOP — do not proceed as if it works.**

This rule exists because it was violated expensively: persona-browser shipped
broken across ~40 framework versions and ~100 `sudd auto` sessions because
preflight only checked it was *installed*, never that it *functioned*. Presence
≠ function. An unverified dependency that silently no-ops poisons everything
built on top of it.

For ANY external API / service / tool, before relying on it, run the staged
smoke test (cheap → real → build):

1. **Hello-world (auth + endpoint).** The minimal possible call — does the
   endpoint respond and does auth work? (e.g. a 1-token completion to the
   configured model with the configured key.) If this fails, nothing downstream
   can work.
2. **Plausible-input shape check.** One realistic call with the *kind* of input
   the real flow sends, and verify the *output shape* is what you'll parse
   (e.g. a vision model: send an image like browser-use does, confirm it
   answers). Catches "auth works but the model/payload is wrong."
3. **Only then build / accept / gate on it.**

**On failure: surface it to the operator BEFORE launching** — a failed smoke
test is a blocking, loud event, never a warning to scroll past. The Go preflight
(`sudd doctor`, run automatically before `sudd auto`) enforces this for
persona-browser via a live LLM smoke test (auth + endpoint + a vision payload);
a Fail blocks `sudd auto`. Apply the same discipline by hand for any other API
you wire in.

**Override (proceed despite failure):** once warned, the operator can set
`SUDD_PROCEED_ON_SMOKE_FAIL=1` to keep moving (stalling token-consuming work
helps no one). When they do, the loop proceeds BUT writes a loud
`user_input_required.md` at the project root recording that the dependency is
broken and unvalidated — so the failure stays visible until fixed, never
silently forgotten.

## Privacy & Disclosure (DEFAULT: PRIVATE)

**Source and IP are private by default — a demo is the only thing that may be
public.** A deployed demo *site* (the running app/UI on a public URL — e.g. a
Render web/static service) MAY be publicly accessible; that is the product users
are meant to touch. What must NEVER be public is the *source and IP behind it*:
the GitHub repo, backend code, prompts, scoring rubrics, persona definitions,
business rules, configs, and credentials. Assume potential cloners across
GitHub, HuggingFace, npm, etc. are adversaries.

- **Public demo, private source.** A usable demo URL is fine; the code that
  powers it is not. Serve public demos from a host that keeps the repo private
  (e.g. Render deploying from a *private* repo) — NOT a public GitHub repo or a
  public HuggingFace Space, both of which expose their files to anyone.
- **Keep secrets and logic server-side.** A demo's client bundle is inherently
  downloadable — never ship prompts, rubrics, business rules, or API keys in
  frontend code; keep them behind the API.
- **Repos and Spaces stay private.** Never create, or flip to public, a GitHub
  repo, HuggingFace Space/model/dataset, gist, or any source mirror. When
  creating one, default to private (`gh repo create --private`, private Space).
- **A public push is permanent disclosure.** Anything pushed to a public remote
  can be cloned, cached, and indexed even after deletion. Treat it as irreversible.
- **Confirm before ANY public action.** Making a repo/Space public, publishing a
  package, or pushing to a public remote requires explicit user approval — never
  do it autonomously, even inside `sudd auto`.

## Framework Priority

**Default to SUDD for any new change.** If the user says "let's build X" or
"fix Y" or "add Z", use SUDD — not openspec, not superpowers, not feature-dev,
not bmad. Other frameworks produce artifacts SUDD can't see, causing silent
fragmentation across `openspec/changes/`, `docs/superpowers/plans/`,
`.planning/`, etc.

**Respect explicit opt-outs.** If the user literally says "use openspec" or
"brainstorm with superpowers" or types a slash command like `/openspec-new-change`,
honor that. Otherwise: SUDD.

**Continuing in-flight foreign work.** If there's an already-in-progress
openspec/superpowers change, continue it there — don't mid-flight migrate.
The nightly `sudd auto` sweep will port it to SUDD once it ships.

## Operating Principle: Smoke Test, Don't Ask

SUDD's north star is autonomous operation — **no human babysitting required**.
Users typically run ~20 projects in parallel; every clarifying question
breaks flow on the other 19. When you are uncertain about something the
environment can tell you, ALWAYS probe it instead of asking.

Safe probes — run them, never ask the user to:

- CLI / tool output → `opencode auth list`, `gh pr list`, `git status`,
  `--help`, `--version`, `which X`, `command -v Y`
- File contents → read the file
- Test or build status → run the test / build
- Env var values → print them
- Which provider, account, branch, or model is active → query the tool

Only ask the user when:

1. The action is destructive (deletes data, sends a message, force-pushes,
   spends >$0.10 in API calls).
2. The answer is a genuine preference between equally valid options.
3. A smoke test already returned ambiguous or contradictory results.

Pasting "can you run `<read-only command>` and share the output?" is an
autonomy failure. Run it yourself.

## Entry Points

The four entry points you'll use most:

| Command | When |
|---|---|
| `/sudd-run` | Start a new change or continue current work (vision → done) |
| `/sudd-auto` | Kick off the autonomous night queue (processes all proposals) |
| `/sudd-chat` | Thinking partner — explore ideas before committing to a change |
| `/sudd-status` | What state are we in? |

Full command reference: `sudd/commands/macro/` (run, auto, port, audit) and
`sudd/commands/micro/` (new, plan, apply, test, gate, done, discover, ...).
All 15+ commands are available as `.claude/skills/sudd-*` slash commands.

## The Loop

```
/sudd-new  → /sudd-plan → /sudd-apply → /sudd-test → /sudd-gate
                                                        ├── PASS → /sudd-done
                                                        └── FAIL → retry w/ escalation
```

Or autonomous: `/sudd-run green "what to build"` takes you from idea to done
without stopping.

## Key Paths

- `sudd/vision.md` — what we're building (repo-specific, never overwritten)
- `sudd/state.json` — orchestrator state
- `sudd/agents/` — agent instruction files
- `sudd/personas/` — who we're building for (validates at the gate)
- `sudd/changes/active/` — in-progress changes
- `sudd/changes/inbox/` — ported/staged proposals awaiting promotion
- `sudd/changes/archive/` — completed changes
- `sudd/standards.md` — scoring rules, schemas, conventions
- `sudd/sudd.yaml` — model tiers, dispatch config, MCP requirements
- `sudd/commands/` — full command reference (markdown-defined workflows)

## Preflight (v3.8.11+)

`sudd doctor` verifies your environment before any real work:
- `sudd/sudd.yaml` is healthy (not the v3.8.x wipe-stub)
- Each declared tier's CLI is installed + authenticated with the right provider
- Required MCP tools are reachable (persona-test, playwright-chromium)

`sudd auto` runs doctor automatically and refuses to start on failures.
Results cache per-device for 12h. Use `--probe` to also send a 1-token request
through each tier (catches silent quota/plan issues, costs ~3 tokens total).

## Self-Healing (v3.8.10+)

`sudd update` and `sudd heal` self-repair files wiped by the v3.8.x bug:
- `sudd/sudd.yaml` (stub → full template)
- `sudd/state.json` (empty / unparseable → default schema)
- `sudd/personas/default.md` (empty → template)
- `AGENTS.md` (old stub → regenerated per repo, see below)

**vision.md is SACRED.** Never overwritten by framework. If empty, `sudd-run`
step 0 auto-generates it from your repo's README, PROJECT_REPORT, AGENTS.md,
package.json, and top-level markdown.

## Vision Path Engagement (v3.8.24+)

`sudd/vision.md` is structured into `## North Star` (stable aspiration,
edited by humans only) and `## Current Path` (auto-appended dated log of
directional choices). Run `sudd vision context` to retrieve the
condensed planning input that `/sudd-new` and `/sudd-chat` inject into
their proposals.

The Go binary auto-appends one-line path entries on every archived
change (see `internal/auto/runner.go visionAppendForChange`). You only
get prompted at session-end when 3 consecutive changes carry the
`DIVERGENT` tag AND the next-queued change shares keywords with at
least 2 of them — silence by default; the prompt defaults to skip and
times out after 60s. Non-TTY environments (CI, nohup) suppress the
prompt entirely.

Kill switch: `SUDD_VISION_PATH=off` disables both the auto-append and
the divergence prompt. Migration is benign and is not reverted.

## Session-start read: `sudd/CURRENT_STATE.md` (v3.8.23+)

`sudd/CURRENT_STATE.md` is the canonical session-start read. When SUDD
wakes with a cleared context (fresh subprocess, new day), **read this
file FIRST** before scanning `changes/active/`, parsing `state.json`, or
re-reading recent archive SUMMARYs. It contains eight sections in
fixed order: `TL;DR`, `Active`, `Stuck`, `Just Shipped (last 10)`,
`Inbox (unpromoted)`, `Next up`, `Trajectory vs Vision`, `Health`.
Every list item is a link to the change dir so you can follow links
only when you actually need depth.

Content origin:

- Sections 2–6 + 8 are **pure extraction** from filesystem + state.json.
  The description under each change is the first `## What` paragraph
  of its `proposal.md`, capped at 200 chars. No LLM involvement.
- `TL;DR` and `Trajectory vs Vision` are LLM-synthesized (mid tier).

Refresh triggers:

- After every archived change inside `sudd auto` (cheap — no LLM call;
  reuses prior TL;DR + Trajectory).
- End of each `sudd auto` session (full — invokes the LLM).
- Manual: `sudd state --refresh` or `sudd state --no-llm`.

Tolerate missing file — if not present, fall through to legacy
exploration. Kill switch: `SUDD_STATE_DOC=off` disables every write
path; `sudd state` still prints whatever is on disk.

## Inbox → Active Promotion

When ports or discovery drop artifacts into `sudd/changes/inbox/`, they don't
enter the work queue until promoted. `sudd-run green` and the discovery
pipeline pick up inbox items, enrich them with real personas and proper
proposals, and promote them to `sudd/changes/active/`.

## How "Done" Works

Code is only done when an AI persona representing a real user validates the
change from the outside. Retries escalate the model tier:
- retries 0-1: free tier (MiniMax, opencode)
- retries 2-3: +Sonnet for validation
- retries 4-5: Sonnet for all agents
- retries 6-7: Opus for all agents
- retries 8+: STUCK (human review)

For the scoring rubric, interface schemas, and escalation details, see
`sudd/standards.md`.

For the architectural model behind dispatch (v3.1 inline vs v3.2
subprocess tiers, what ships today, why they coexist), see
`reference/architecture-v3.x.md` at the repo root.

## Tier Management (v3.8.20+)

**`sudd/sudd.yaml` is canonical for all tier assignments.** Agent body
`**Tier**: ...` or `**Model**: ...` hints are documentation — they MUST
agree with yaml. CI enforces this via `TestLintAgentTiers_LiveRepo`.

If you need to change an agent's tier:
  1. Edit `sudd/sudd.yaml` under `agents:` — this is authoritative
  2. Update the agent body hint to match (or remove the hint)
  3. Sub-mode-specific tier variations belong BELOW a `## Mode: ...`
     heading — the parser ignores those, so they don't conflict with
     the canonical top-level tier

This prevents the drift class where yaml and body disagree silently.
