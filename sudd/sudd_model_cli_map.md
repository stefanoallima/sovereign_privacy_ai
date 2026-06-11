# sudd.yaml — Valid CLI / Provider / Model Strings

Reference for the exact strings to use in `sudd/sudd.yaml` under
`tiers.{low,mid,top}`. Wrong capitalization or a stale label silently breaks
preflight (or worse, runs against an unintended model). Copy from this file,
don't guess.

> **Authoritative sources:** `opencode models`, `opencode providers list`,
> `claude --version`. Re-run them and update this doc when CLIs ship new
> models or rename providers.

## How sudd.yaml tier blocks work

```yaml
tiers:
  low:                                 # tier name — fixed (low/mid/top)
    cli: opencode                      # which CLI binary to invoke
    provider: minimax-coding-plan      # which provider opencode should use
    model: MiniMax-M2.7                # which model under that provider
    endpoint: ""                       # only set for custom API endpoints
```

`provider` and `model` are decorative for `cli: opencode` today — sudd does
NOT pass `-m provider/model` to the opencode subprocess (see
`internal/auto/config.go BuildArgs`). The runtime model is whatever opencode
itself is configured for in `~/.config/opencode/opencode.json`.

What sudd.yaml's `provider:` IS used for: the `sudd doctor` preflight
compares its vendor family against opencode's runtime default model and
blocks on cross-vendor mismatch (e.g. yaml says `zai`, opencode runs
`minimax`). Same vendor = pass.

For `cli: claude-code`, sudd dispatches subagents with `--model {model}`,
so the `model:` string IS load-bearing — it must match an Anthropic model
ID exactly.

---

## Claude Code (`cli: claude-code`)

The Claude Code CLI (`claude` binary). One vendor (Anthropic), one auth
flow (Max plan or `ANTHROPIC_API_KEY`).

### Valid `cli:` values

| String         | Notes                                          |
|----------------|------------------------------------------------|
| `claude-code`  | Preferred — explicit                           |
| `claude`       | Alias — also accepted (`cliBinaryName` maps it)|

### Valid `provider:` value

| String        | Notes                                                       |
|---------------|-------------------------------------------------------------|
| `anthropic`   | The only option for `cli: claude-code`. Sudd doesn't pass this string to claude; it's informational. |

### Valid `model:` values (subagent dispatch via Claude Code's Agent tool)

Latest models (verified against Claude Code 2.1.150):

| String                       | Tier hint   | Notes                                  |
|------------------------------|-------------|----------------------------------------|
| `claude-opus-4-8`            | top         | Newest Opus (current top-tier default) |
| `claude-opus-4-7`            | top         | Previous Opus generation                |
| `claude-sonnet-4-6`          | mid         | Newest Sonnet                          |
| `claude-sonnet-4-5`          | mid         | Previous Sonnet — still works          |
| `claude-haiku-4-5-20251001`  | free        | Newest Haiku — note the date suffix    |

Rule of thumb: when Anthropic ships a new generation, the latest two stay
addressable by their bare ID (`claude-opus-4-8`, `claude-opus-4-7`). Older
generations may require date-suffixed IDs.

> **OpenRouter slugs differ** (dots, vendor-prefixed): the persona-browser-agent
> uses `anthropic/claude-opus-4.8` and `minimax/minimax-m3` via OpenRouter —
> NOT the bare Anthropic CLI IDs above. Verify any new slug live with
> `persona-test --smoke` (OpenRouter) or `opencode models` (opencode) before
> wiring it in — dead slugs silently produce zero validation.

### Auth verification

`sudd doctor` runs `claude --version`. Pass = installed. For real auth
state, run `claude -p --dangerously-skip-permissions "ping"` — if it
returns text, you're authed.

---

## opencode (`cli: opencode`)

The opencode CLI is multi-vendor — same binary, many providers. The
`provider:` field in sudd.yaml IS the provider key used in opencode's
own model registry (run `opencode models` to see all `provider/model`
strings).

### Valid `cli:` value

| String     |
|------------|
| `opencode` |

### Valid `provider:` keys (verified against opencode 1.15.4)

Top-level provider keys returned by `opencode models | cut -d/ -f1 | sort -u`:

| String                       | Auth                                | Notes                                                        |
|------------------------------|-------------------------------------|--------------------------------------------------------------|
| `minimax`                    | `MINIMAX_API_KEY` (pay-per-token)   | The "token plan" path — pay-per-call API access              |
| `minimax-coding-plan`        | `opencode auth login` (subscription)| MiniMax monthly Coding Plan — flat-rate access               |
| `minimax-cn`                 | `MINIMAX_API_KEY` (CN region)       | China-region pay-per-token                                   |
| `minimax-cn-coding-plan`     | subscription (CN region)            | China-region Coding Plan                                     |
| `opencode`                   | none (free models)                  | opencode's own free pool (`big-pickle`, `nemotron-3-super-free`, …) |
| `huggingface`                | HuggingFace token                   | HF-hosted MiniMax / DeepSeek / Qwen / Kimi / GLM variants    |
| `openrouter`                 | `OPENROUTER_API_KEY`                | Aggregator — exposes hundreds of models via `openrouter/<vendor>/<model>` |

Three more existed historically — `zai`, `zai-coding-plan`, `anthropic-api` —
keep them in `opencodeProviderDisplay()` for back-compat hints but they
do not appear in current `opencode models` output. Verify with
`opencode auth list` before using.

### How "token plan" vs "coding plan" maps to sudd.yaml

| You want                                              | `provider:` value         | `model:` value (example)  |
|-------------------------------------------------------|---------------------------|---------------------------|
| MiniMax Coding Plan (subscription, fixed monthly cost)| `minimax-coding-plan`     | `MiniMax-M2.7`            |
| MiniMax Token Plan (pay-per-call, `MINIMAX_API_KEY`)  | `minimax`                 | `MiniMax-M2.7`            |
| MiniMax CN Coding Plan                                | `minimax-cn-coding-plan`  | `MiniMax-M2.7`            |
| Free models (opencode pool)                           | `opencode`                | `big-pickle`              |
| OpenRouter (anything)                                 | `openrouter`              | `~anthropic/claude-sonnet-latest` |

### Valid `model:` values per provider

Don't memorize — run:

```bash
opencode models | grep '^<provider>/'
```

Common selections:

| Provider                | Recommended model           |
|-------------------------|-----------------------------|
| `minimax`               | `MiniMax-M2.7`              |
| `minimax-coding-plan`   | `MiniMax-M2.7`              |
| `minimax-cn-coding-plan`| `MiniMax-M2.7`              |
| `opencode`              | `big-pickle` (free)         |
| `openrouter`            | `~anthropic/claude-sonnet-latest` |

`-highspeed` suffix on MiniMax models (`MiniMax-M2.7-highspeed`) routes to
a faster, lower-quality variant — useful for cheap execution tasks.

### Auth verification

`sudd doctor` for opencode tiers runs `verifyOpencodeTier()` which:

1. Reads `~/.config/opencode/opencode.json` → `model: "provider/model"`
2. Splits on `/` to extract opencode's runtime provider+model
3. Compares vendor family (first dash-segment of provider, e.g.
   `minimax-coding-plan` → `minimax`) against sudd.yaml's declared family
4. Same family → PASS (even if specific variant differs)
5. Cross-vendor mismatch → FAIL loud with actionable fix

The dumb `grep -qF "<display>"` check was removed in v3.9.7 — opencode
renames labels (`MiniMax Coding Plan` → `MiniMax (minimax.io)`) and the
old check blocked every run over cosmetic drift.

---

## Common mistakes that silently break runs

1. **Capitalization in MiniMax model names** — opencode is case-sensitive.
   `minimax-m2.7` is NOT the same as `MiniMax-M2.7`.
2. **Misspelling provider keys** — `mini_max` or `minimax_coding_plan` are
   not recognized. Use dashes, exactly as listed above.
3. **Using opencode's display label as the yaml value** — `MiniMax (minimax.io)`
   is what opencode prints in `auth list`, but the provider key in
   sudd.yaml is `minimax` or `minimax-coding-plan`. Different strings.
4. **Mixing claude model strings into opencode tier** — `claude-sonnet-4-6`
   is valid for `cli: claude-code`, NOT for `cli: opencode`. For Claude
   models via opencode, use `openrouter/~anthropic/claude-sonnet-latest`.
5. **Setting `provider:` to a value that doesn't match opencode's runtime
   default** — sudd doctor will block with a "cross-vendor mismatch" error.
   Either change sudd.yaml's `provider:` or run `opencode` interactively
   and switch its default model.

---

## Quick verification

After editing sudd.yaml, always run:

```bash
sudd doctor --fresh
```

This bypasses the 12h cache and re-runs every check. If tier rows show
`✓` you're good. If `✗`, the fix message will tell you exactly what's
wrong — read it carefully (post-v3.9.7 fixes, the messages no longer lie
about auth state when you're already authenticated).
