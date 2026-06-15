# Normattiva ↔ Sovereign AI — OpenAI-Compatible Integration Spec

**Status:** reviewed / corrected (v2) · **Date:** 2026-06-15
**Scope:** how the Normattiva legal AI platform should expose an OpenAI-compatible surface, and the exact desktop (Tauri) changes to consume it through the existing PII-redaction chokepoint.

> v2 = repo review (2026-06-15) of the v1 draft written on 2026-06-12. Three corrections folded in: **B4** now also covers the Rust routing enum, **B7** splits the wizard from PrivacySettings, **B5** disambiguates the chat rehydrator from `rehydration-service.ts`. Smaller fixes in B2, B3, B10. See Review Log at the bottom.

---

## 0. Decisions (TL;DR)

1. **Transport for the thin client = a native OpenAI-compatible `POST /v1/chat/completions`** that fronts the platform's **server-side** codici+massime agent. The client sends one redacted question; the platform runs the legal tool-loop internally; one answer comes back; the desktop rehydrates.
2. **MCP stays**, but for *third-party agent hosts* (Claude Desktop, Cursor, LangChain-MCP) — **not** for this client. (Matches the prior strategic note: the MCP server is a distribution surface for other hosts.)
3. **Desktop side reuses what already exists**: `NebiusClient` is already a generic OpenAI-compatible client, and `redactForCloud()` is the single chokepoint. We add Normattiva as a second OpenAI-compatible **provider**, not a new pipeline.
4. **The redaction boundary is the desktop.** Everything Normattiva receives is already pseudonymized (`[PERSON_1]`, `[IBAN_2]`, …). The platform must treat those tokens as opaque and **echo them verbatim** so the desktop can rehydrate.

The one unknown that gates everything: **does the platform run the full codici+massime tool-loop server-side behind a single call, or is KG tool-calling only reachable by a client orchestrating MCP tools?** If server-side agent exists → wrap it OpenAI-compatible (this spec). If not → build that server-side endpoint first; it belongs there anyway for a thin client.

---

## PART A — Platform contract (what Normattiva must expose)

### A1. Base URL & versioning
- OpenAI-compatible root: **`https://api.normattiva.ai/v1`** (sits alongside the existing native `/api/v1/*` and `/api/v1/mcp/*`).
- The desktop sets `baseUrl = https://api.normattiva.ai/v1` and the client appends `/chat/completions` and `/models`. Trailing slashes are stripped client-side.

### A2. Authentication
- **`Authorization: Bearer <API_KEY>`** — the OpenAI SDK convention; this is what the desktop sends today for Nebius.
- The OpenAI-compatible endpoint must accept the **same API keys** used for MCP (`X-API-Key`) but presented as a Bearer token. Optionally also accept `X-API-Key` for symmetry.
- Required scope: **`ai:query`** (the server-side agent implicitly uses the KG/`mcp:read` capabilities internally; the *client* never needs `mcp:*`).
- Clerk JWT remains for the browser app; the **desktop uses API keys only**.

### A3. Endpoints

| Method | Path | Purpose | Priority |
|--------|------|---------|----------|
| `POST` | `/v1/chat/completions` | Core. Server-side legal agent; returns one assistant message (or SSE stream). | **P0** |
| `GET`  | `/v1/models` | List legal model ids; used for **API-key validation** and the model selector. | **P0** |
| `POST` | `/v1/chat/completions` w/ `stream:true` | Streamed answer (SSE). | P1 |

### A4. Request schema — `POST /v1/chat/completions`
Standard OpenAI ChatCompletion request. The desktop sends exactly:
```jsonc
{
  "model": "normattiva-legal-pro",          // an id returned by /v1/models
  "messages": [
    { "role": "system",    "content": "<legal persona system prompt>" },
    { "role": "user",      "content": "Il mio cliente [PERSON_1] ha ricevuto una cartella ..." },
    { "role": "assistant", "content": "..." },
    { "role": "user",      "content": "..." }
  ],
  "temperature": 0.2,
  "max_tokens": 4096,
  "stream": false,
  "stream_options": { "include_usage": true }   // when stream:true
}
```
- **`messages` contents are pseudonymized.** Placeholder tokens (`[PERSON_1]`, `[IBAN_2]`, …) are opaque entity handles. The agent must reason over them as stable entities and **must not** rewrite, translate, normalize, or "resolve" them.
- The `system` message is the legal persona (no PII); the platform may also prepend its own system instructions.
- Stateless by contract: the desktop **resends the full (redacted) history** each turn. Do **not** rely on a server-side session for conversation memory (the desktop registry is the source of truth for entity↔token consistency). A server session id, if offered, is optional/cache-only.

### A5. Response schema — non-streaming
Standard OpenAI `chat.completion`:
```jsonc
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1781230509,
  "model": "normattiva-legal-pro",
  "choices": [{
    "index": 0,
    "message": { "role": "assistant", "content": "...preserves [PERSON_1] verbatim..." },
    "finish_reason": "stop"
  }],
  "usage": { "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0 },

  // OPTIONAL additive extension (OpenAI clients ignore unknown fields):
  "x_normattiva": {
    "citations": [
      { "type": "article", "ref": "c.c. art. 1456", "title": "Clausola risolutiva espressa", "url": "https://..." },
      { "type": "massima", "ref": "Cass. civ. 12345/2023", "title": "...", "url": "https://..." }
    ],
    "tools_used": ["codici.search", "massime.search"],
    "cost_estimate_eur": 0.0123
  }
}
```
- **`content` must preserve placeholder tokens verbatim** wherever the answer refers to those entities.
- All legal-specific data (citations, tools used, cost) goes in a **namespaced `x_normattiva` object** so standard OpenAI clients keep working unchanged. Never repurpose standard fields.

### A6. Streaming (SSE)
- `stream: true` ⇒ `Content-Type: text/event-stream`; events are `data: <json>\n\n`; terminate with `data: [DONE]`.
- Each chunk is an OpenAI `chat.completion.chunk` with `choices[0].delta.content`. **The desktop parser already handles exactly this** (`nebius.ts` splits on `\n`, strips `data: `, stops on `[DONE]`).
- **Usage in stream:** honor `stream_options.include_usage: true` → emit a final chunk **before** `[DONE]` carrying `"usage": {...}` with `choices: []`. (Gives the desktop exact token counts instead of a char/4 estimate.)
- **Agent progress (optional, recommended):** between content deltas, emit additive chunks like
  `data: {"x_normattiva":{"stage":"searching_massime"}}` (empty/no `delta.content`). Standard parsers ignore them; the desktop can render them as live "agent is searching case law…" status. This gives agentic transparency **without** a custom protocol.
- Citations may be sent in the final usage chunk's `x_normattiva.citations`.

### A7. Usage & billing
- **Always return `usage`** (non-stream always; stream via `include_usage`). `prompt_tokens` / `completion_tokens` drive per-token billing.
- Optional billing transparency: `usage` may carry an additive `x_normattiva: { tool_calls, kg_lookups, cost_estimate_eur }`.
- Rate-limit headers on every response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`; `Retry-After` on 429.

### A8. Error semantics (OpenAI envelope)
Return the OpenAI error shape with the correct HTTP status:
```jsonc
{ "error": { "message": "human-readable", "type": "invalid_request_error", "code": "model_not_found", "param": "model" } }
```

| HTTP | `type` | When |
|------|--------|------|
| 401 | `authentication_error` | missing/invalid API key |
| 403 | `permission_error` | key lacks `ai:query` scope, or quota exhausted |
| 404 | `invalid_request_error` (`model_not_found`) | unknown `model` |
| 400/422 | `invalid_request_error` | malformed body |
| 429 | `rate_limit_error` | + `Retry-After` |
| 502/503 | `upstream_error` | OpenRouter / agent / KG failure |

The desktop surfaces `"<status> - <body>"` to the user, so keep `message` human-readable and non-sensitive.

### A9. Models — `GET /v1/models`
```jsonc
{ "object": "list", "data": [
  { "id": "normattiva-legal-pro",  "object": "model", "owned_by": "normattiva" },
  { "id": "normattiva-legal-lite", "object": "model", "owned_by": "normattiva" }
] }
```
Used for (a) key validation (200 = valid) and (b) populating the desktop model selector.

### A10. CORS / Tauri origin
- The desktop calls from a Tauri 2 webview (`http://tauri.localhost` on Windows, `tauri://localhost` on macOS). Either:
  - **(a)** Normattiva returns permissive CORS (`Access-Control-Allow-Origin`) for the Tauri origins (mirror whatever lets the current Nebius `fetch` path work), **or**
  - **(b)** the desktop proxies the call through its Rust HTTP client (server-to-server, no CORS). See B10.
- **Action:** confirm how the existing Nebius `fetch` avoids CORS in production and mirror it; otherwise pick (b).

### A11. Privacy guarantees the platform must honor (contractual)
- Treat inbound text as **already pseudonymized**; do **not** attempt re-identification.
- **Echo placeholder tokens verbatim** in outputs.
- Do **not** persist raw prompt/response bodies beyond what billing requires; if logging, log token-redacted bodies. (The desktop's entire confidentiality story depends on the platform not de-anonymizing or leaking the pseudonymized text.)
- Publish a short data-handling note the desktop can show users ("Normattiva receives pseudonymized text only; raw identifiers never leave your machine").

---

## PART B — Desktop changes (file-by-file)

Guiding principle: **generalize the existing OpenAI-compatible client to a second provider; do not touch the redaction chokepoint.**

### B1. `src/types/index.ts`
- `LLMModel.provider`: `"nebius" | "ollama"` → `"nebius" | "ollama" | "normattiva"`.
- `Persona.preferred_backend`: add `'normattiva'`.
- `AppSettings`: add `normattivaApiKey: string;` and `normattivaApiEndpoint: string;`.
- (Optional) add a `Citation` interface for the `x_normattiva.citations` extension.

### B2. `src/stores/settings.ts`
- Add `DEFAULT_NORMATTIVA_MODELS: LLMModel[]` (provider `"normattiva"`, `apiModelId: "normattiva-legal-pro"`, large `contextWindow`, real `inputCostPer1M`/`outputCostPer1M`).
- Add a `normattivaModels: LLMModel[]` field on the store (mirrors `ollamaModels`).
- Bump `persist` `version` and add a `migrate` step that pushes Normattiva model ids into `enabledModelIds` only if `normattivaApiKey` is present.
- In `DEFAULT_SETTINGS`: add `normattivaApiKey: ""`, `normattivaApiEndpoint: "https://api.normattiva.ai/v1"`.
- Add a `setNormattivaApiKey` setter (mirror `setApiKey`).
- **Join in `getAllModels()` (line 358):** today's `getAllModels() = [...models, ...ollamaModels]`. Add `[...normattivaModels]` so the chat model selector exposes them. `getEnabledModels()` (line 316), `getDefaultModel()` (line 325), and `getCloudModels()` (line 362) all need the same parallel treatment — they currently only walk `models` + `ollamaModels`.

### B3. `src/services/nebius.ts` → generalize (recommended) or add sibling
- **Recommended:** rename the concept to a provider-agnostic `OpenAICompatibleClient` (keep `NebiusClient` as a thin alias for back-compat) and expose `getCloudClient(provider, apiKey, baseUrl)`. The streaming/usage/error code is already correct and provider-neutral.
- `validateApiKey()` already exists at `services/nebius.ts:68` — no new method needed; the generalized client reuses it directly.
- **Add exact usage in streaming:** include `stream_options: { include_usage: true }` in the streamed request body, and in the SSE loop capture a chunk whose `usage` is present (currently the loop only reads `delta.content`; add: if `json.usage` then record it and return real `{inputTokens, outputTokens}` instead of the char/4 estimate).
- Parse optional `x_normattiva` from the final chunk / non-stream response (ignore when absent).
- Minimal alternative if you don't want to generalize: a 10-line `NormattivaClient extends NebiusClient` whose only difference is the default `baseUrl` and the `x_normattiva` parsing.

### B4. Routing — TS + Rust (both halves need to change)

The TS `backend-routing-service.ts` is a thin wrapper that delegates the routing decision to Rust via `invoke('make_backend_routing_decision', ...)`; the actual decision lives in `apps/desktop/src-tauri/src/backend_routing.rs`. **Both halves must accept the new provider:**

**TS side** — `src/services/backend-routing-service.ts`:
- Widen the `PreferredBackend` union: `'nebius' | 'ollama' | 'hybrid' | 'normattiva'`.
- Add `normattiva` to `BACKEND_PRIVACY_INFO` (mirror `nebius`: `level: 'low'`, `sendsToCloud: true`, `localProcessing: false`).
- Add a row in `BACKEND_OPTIONS` so the persona editor exposes it.
- Mirror the new type into `Persona.preferred_backend` in `src/types/index.ts:97` (currently `'nebius' | 'ollama' | 'hybrid'`).

**Rust side** — `apps/desktop/src-tauri/src/backend_routing.rs` + `backend_routing_commands.rs`:
- Add `BackendType::Normattiva` to the enum (sibling of `BackendType::Nebius`).
- In `determine_backend` (`backend_routing.rs:117`) and `make_routing_decision` (line 160), add a `"normattiva"` arm. The cloud-direct logic mirrors `"nebius"`, but the **anonymization gate differs**: for the legal persona, default to `enable_local_anonymizer: true` + `anonymization_mode: 'required'`, which puts it on the `attributes_only` path (the same one the existing `hybrid` + `required` arms already take).
- In `validate_backend_config` (`backend_routing_commands.rs:96`), extend the allowed set from `"nebius" | "ollama" | "hybrid"` to include `"normattiva"`.
- In `db.rs:53`, update the column comment from `'nebius' | 'ollama' | 'hybrid'`. The TEXT column needs no migration since it's already a free string.

**Persona + call site:**
- The legal persona sets `preferred_backend: 'normattiva'` and `anonymization_mode: 'required'`.
- The chat send path: route `persona.preferred_backend === 'normattiva'` **or** `model.provider === 'normattiva'` → `getCloudClient('normattiva', settings.normattivaApiKey, settings.normattivaApiEndpoint)`. Normattiva is a **cloud** provider ⇒ every outbound message **must** go through `redactForCloud` first (same as Nebius). The legal persona defaults to `anonymization_mode: 'required'`, so the Rust validator already enforces it.

### B5. Redaction wiring — **no change to the chokepoint**, reuse it
The chat rehydrator is `rehydrateFromCloud` in `apps/desktop/src/services/cloud-redaction.ts:105` — **not** `rehydration-service.ts`, which is an unrelated tax-form template rehydrator (`[BSN]`, `[IBAN]`, etc.) and never touches chat traffic. The Normattiva path mirrors the Nebius path exactly, and the existing call sites already do it right:
1. For each outbound message, `redactForCloud(content)` → merge all `mappings` into one map for the request. (`usePrivacyChat.ts:332-340`, `ChatWindow.tsx:501-505`.)
2. Send the redacted `messages` array via the cloud client (`usePrivacyChat.ts:343-346`, `ChatWindow.tsx:495`).
3. **Rehydrate on the accumulated stream buffer, not per-delta.** ✅ The current code already does this: `for await (chunk of stream) { content += chunk }` then `rehydrateFromCloud(content, mappings)` *after* the loop ends (`usePrivacyChat.ts:367-386`). The platform must guarantee that a placeholder token like `[PERSON_1]` is **never split across two SSE chunks** — i.e., the server-side agent must emit whole tokens in a single `delta.content`. This is a *platform* contract (A11), not a desktop fix.
4. Store/display the rehydrated text locally; only tokens ever left the machine.
- The system prompt (legal persona) carries no PII → may bypass redaction.
- Multi-turn consistency is automatic: the registry guarantees same value → same token across turns (canonical-key dedup), so resent history stays coherent.

### B6. Legal persona (built-in seed)
Add a built-in `Persona`:
```jsonc
{
  "id": "legal-advisor-it",
  "name": "Consulente Legale",
  "description": "Consulenza legale italiana (codici + massime) con privacy locale",
  "systemPrompt": "Sei un assistente legale esperto di diritto italiano. Gli identificativi compaiono come segnaposto (es. [PERSON_1]); usali VERBATIM, non sostituirli né interpretarli. Cita articoli di legge e massime pertinenti.",
  "preferred_backend": "normattiva",
  "anonymization_mode": "required",
  "requiresPIIVault": true,
  "preferredModelId": "normattiva-legal-pro",
  "temperature": 0.2,
  "maxTokens": 4096,
  "isBuiltIn": true
}
```

### B7. Settings UI — `src/components/settings/PrivacySettings.tsx`, `ModelSettings.tsx`
- **Wizard stays Nebius-only.** `ApiConfigStep.tsx:47` hard-codes `https://api.studio.nebius.ai/v1/models` for first-run key validation; that's the onboarding path for the default cloud provider. A real second-provider picker in the wizard is out of scope for Phase 0.
- **Normattiva lives in `PrivacySettings` / `ModelSettings`.** Add:
  - A "Normattiva API key" field + endpoint field.
  - A **Validate** button that calls the client's existing `validateApiKey()` (already implemented at `services/nebius.ts:68`, hits `GET /v1/models`). Wraps it in a `getCloudClient('normattiva', ...)` once the client is generalized (B3).
- Trust level: treat Normattiva as `"partial"` (frontier models via OpenRouter behind it) → **always redact** regardless of `skipCloudReview`.

### B8. Citations UI (optional)
- When a response carries `x_normattiva.citations`, render a sources panel (article/massima refs as links). Purely additive.

### B9. `src-tauri/tauri.conf.json` (CSP)
- Current `connect-src` is `'self' ipc: http://ipc.localhost https: wss:` — `https:` already permits the Normattiva host, so **no change needed now**. If/when CSP is tightened to explicit hosts, add `https://api.normattiva.ai`.

### B10. Rust proxy (only if CORS requires it) — `src-tauri/src/backend_routing.rs`
- The webview CSP (`tauri.conf.json:25`) already permits `connect-src https:`, so the TS `fetch` path is expected to work without a Rust proxy. **If it doesn't** (e.g., platform doesn't return permissive CORS for `tauri.localhost` / `tauri://localhost`), proxy the call via Rust `reqwest` and add a `Normattiva` arm to `BackendType`. Note: B4 already requires adding `BackendType::Normattiva` for the *routing decision* regardless; this B10 is about the *transport*, not the routing enum.

---

## PART C — Phased rollout

- **Phase 0 — PoC (~days):** platform ships `POST /v1/chat/completions` + `GET /v1/models` (Bearer auth, server-side agent). Desktop: B1, B2, B3 (minimal `NormattivaClient`), B4, B6, B7. **Non-streaming first.** Validates the redact → legal-agent → rehydrate loop end-to-end.
- **Phase 1:** streaming + `include_usage` (exact billing), `x_normattiva.citations` + citations UI (B8), trust-level handling.
- **Phase 2:** agent-stage SSE transparency (A6); MCP for third-party hosts (separate track, not this client).

---

## PART D — Contracts to confirm before building

1. **Does a single call run the full server-side codici+massime tool-loop?** (the deciding unknown — if not, build that endpoint first.)
2. **Placeholder-token preservation** guarantee in agent outputs (A11) — non-negotiable for rehydration.
3. **`x_normattiva` extension shape** (citations / stage / cost) — agree the JSON.
4. **CORS** for the Tauri origin vs. Rust-proxy (A10 / B10).
5. **Statelessness:** desktop resends redacted history; server sessions (if any) are cache-only, never the memory source of truth.
6. **Auth mapping:** OpenAI-compatible endpoint accepts existing API keys as `Bearer`, scoped `ai:query`.

---

## Review Log

### v2 — 2026-06-15 (repo review, code-grounded)

Read every file the v1 spec referenced; verified which claims matched the code and corrected the ones that didn't. Load-bearing claims that held up:

- `NebiusClient` is provider-neutral OpenAI-compat — `apps/desktop/src/services/nebius.ts:51` (Bearer, `/chat/completions`, SSE, usage block).
- `redactForCloud` / `rehydrateFromCloud` is the chokepoint — `apps/desktop/src/services/cloud-redaction.ts:35, 105`; called from `usePrivacyChat.ts:332, 386, 966, 992` and `ChatWindow.tsx:501, 530`.
- The streaming rehydration pattern (`for await chunk → accumulate → rehydrate after loop`) is already correct — `usePrivacyChat.ts:367-386`. The placeholder-split concern is a *platform* contract (A11), not a desktop fix.
- CSP `connect-src` already permits `https:` — `apps/desktop/src-tauri/tauri.conf.json:25` — so B9's "no change needed" holds.

Corrections folded in:

1. **B4 expanded to cover Rust.** The TS `backend-routing-service.ts` is a wrapper; the routing decision is in `apps/desktop/src-tauri/src/backend_routing.rs` (line 117 `determine_backend`, line 160 `make_routing_decision`) and the validator in `backend_routing_commands.rs:96`. The persona enum has to be widened in **both** halves, plus `db.rs:53` column comment, plus the TS `Persona.preferred_backend` union in `types/index.ts:97`. v1 only mentioned the TS file.
2. **B7 split.** v1 suggested adding the Normattiva key to `ApiConfigStep.tsx`, but that wizard step is hard-coded to Nebius (`ApiConfigStep.tsx:47`). Phase 0 puts Normattiva key entry in `PrivacySettings` / `ModelSettings`; the wizard stays Nebius-only.
3. **B5 disambiguated the rehydrator.** v1 said "no change to the chokepoint" without naming the file; B5 now explicitly distinguishes `rehydrateFromCloud` in `cloud-redaction.ts` (chat rehydrator) from `rehydration-service.ts` (tax-form template rehydrator — unrelated), and points at the actual call sites by line number.

Smaller fixes:

- **B2** now mentions the parallel `normattivaModels` field on the store and the joins needed in `getAllModels()` / `getEnabledModels()` / `getDefaultModel()` / `getCloudModels()` — v1 only mentioned `DEFAULT_NORMATTIVA_MODELS` and `enabledModelIds`.
- **B3** notes that `validateApiKey()` already exists at `nebius.ts:68` — v1 implied it was a new method.
- **B10** clarified that the `BackendType::Normattiva` enum arm is **required by B4 regardless of CORS**; B10 is about the *transport*, not the routing enum.

Still unverified (platform-side, not repo):

- The deciding question in Part D.1: does a single `POST /v1/chat/completions` call already run the full server-side codici+massime tool-loop, or is the desktop meant to drive MCP tools itself? Until answered, the desktop half is well-specified; the platform half of Phase 0 is the actual unknown.
```
