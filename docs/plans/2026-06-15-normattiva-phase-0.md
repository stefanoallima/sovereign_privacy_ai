# Normattiva Integration — Phase 0 Implementation Plan (Desktop)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Normattiva as a second OpenAI-compatible cloud provider in the Sovereign AI desktop app, behind the existing PII-redaction chokepoint, with a built-in Italian legal persona. Validates the redact → legal-agent → rehydrate loop end-to-end against a mock OpenAI-compat server.

**Architecture:**
- TS: generalize `NebiusClient` → `OpenAICompatibleClient` (keep `NebiusClient` as a thin alias for back-compat); add `getCloudClient('normattiva', ...)` factory. Add Normattiva provider to types, settings store, and persona. Wire the actual chat path (`usePrivacyChat.ts:1418`) to consult the persona's `preferred_backend` instead of being hard-coded to Nebius.
- Rust: add `BackendType::Normattiva` to the routing enum + matching arms in `determine_backend` / `make_routing_decision` / validator. No new transport (CSP already permits `https:`).
- UI: Normattiva key entry in `PrivacySettings` (not the wizard — that's Nebius-only by design).
- **Non-streaming first.** Streaming usage capture (`stream_options.include_usage`) is Phase 1, deferred.

**Tech Stack:** Vitest (new, for TS unit tests), Rust `cargo test` (existing), Tauri 2, React 19, Zustand 5, existing `@tauri-apps/api/core` `invoke` plumbing.

**Spec:** `apps/desktop/docs/superpowers/specs/2026-06-15-normattiva-integration-spec.md` v2 (2026-06-15). This plan covers spec sections **B1, B2, B3, B4, B6, B7** (Phase 0). **B5 is verification only** (no chokepoint change). **B8, B9, B10 are deferred** to Phase 1+.

**Platform coupling:** The Normattiva platform is *not yet shipping* `/v1/chat/completions` (Part D.1 of the spec). The desktop half is built and tested against a mock OpenAI-compat server, then re-validated against the real platform when it lands.

**Out of scope (deferred to Phase 1+):**
- Streaming `stream_options.include_usage` + real-time usage capture.
- `x_normattiva.citations` UI (B8).
- Rust `reqwest` proxy for CORS fallback (B10) — only added if CSP fails in production.
- Rust `BackendType` enum value already needed for routing decisions (B4) but transport stays TS `fetch`.
- MCP server surface for third-party hosts (separate track).

---

## Pre-flight: read the spec

Before starting any task, read `apps/desktop/docs/superpowers/specs/2026-06-15-normattiva-integration-spec.md` v2 (committed in `c8d492bd`). The plan is a faithful expansion of the B1/B2/B3/B4/B6/B7 sections; if the spec and this plan disagree, the spec wins (open a question).

---

## Task ordering

| # | Task | Files touched | Tests |
|---|------|---------------|-------|
| 1 | Add Vitest to `apps/desktop` | `package.json`, `vitest.config.ts` | sanity test |
| 2 | Add mock OpenAI-compat server | `apps/desktop/test-helpers/mock-openai-server.ts` | fixture |
| 3 | B1 — Widen `LLMModel.provider` + `Persona.preferred_backend` + `AppSettings` | `src/types/index.ts` | typecheck |
| 4 | B2a — `DEFAULT_NORMATTIVA_MODELS` + `normattivaModels` field | `src/stores/settings.ts` | unit |
| 5 | B2b — `normattivaApiKey/Endpoint` + `setNormattivaApiKey` + migration | `src/stores/settings.ts` | unit |
| 6 | B2c — Join `normattivaModels` in selectors | `src/stores/settings.ts` | unit |
| 7 | B3a — Rename `NebiusClient` → `OpenAICompatibleClient` (back-compat alias) | `src/services/nebius.ts`, exports | existing call sites pass |
| 8 | B3b — `getCloudClient(provider, apiKey, baseUrl)` factory | `src/services/nebius.ts` | unit (with mock server) |
| 9 | B3c — `x_normattiva` parsing (non-streaming) | `src/services/nebius.ts` | unit (with mock server) |
| 10 | B4a — Widen TS `PreferredBackend` + `BACKEND_PRIVACY_INFO` | `src/services/backend-routing-service.ts` | typecheck |
| 11 | B4b — Add `normattiva` to `BACKEND_OPTIONS` | `src/services/backend-routing-service.ts` | typecheck |
| 12 | B4c — Rust `BackendType::Normattiva` enum | `src-tauri/src/backend_routing.rs` | `cargo test` |
| 13 | B4d — Rust `"normattiva"` arm in `determine_backend` | `src-tauri/src/backend_routing.rs` | `cargo test` |
| 14 | B4e — Rust `"normattiva"` arm in `make_routing_decision` | `src-tauri/src/backend_routing.rs` | `cargo test` |
| 15 | B4f — Rust validator allow-list + `db.rs` comment | `src-tauri/src/backend_routing_commands.rs`, `db.rs` | `cargo test` |
| 16 | B4g — Wire persona routing in chat path | `src/hooks/usePrivacyChat.ts:1418` | manual + unit |
| 17 | B6 — `legal-advisor-it` built-in persona | `src/stores/personas.ts` | unit |
| 18 | B7a — Normattiva key/endpoint fields in `PrivacySettings` | `src/components/settings/PrivacySettings.tsx` | component test (optional) |
| 19 | B7b — Validate button | `src/components/settings/PrivacySettings.tsx` + `src/services/nebius.ts` | unit |
| 20 | End-to-end smoke test with mock server | `apps/desktop/test-helpers/` | integration |

Total: 20 tasks, ~100 steps. Frequent commits, each task lands green.

---

## Setup

### Task 1: Add Vitest to `apps/desktop`

**Files:**
- Modify: `apps/desktop/package.json` (add `vitest` to `devDependencies`, add `test` and `test:watch` scripts)
- Create: `apps/desktop/vitest.config.ts`
- Create: `apps/desktop/src/services/sanity.test.ts` (sanity test that vitest actually runs)

The repo has **no JS/TS test framework today**. We need one before we can TDD the rest of the plan. Vitest is the obvious pick — Vite-native, fast, drop-in for `*.test.ts` files alongside source.

- [ ] **Step 1: Add `vitest` to devDependencies and a `test` script**

Edit `apps/desktop/package.json`. In the `scripts` block (line 17-27), add `"test"` and `"test:watch"`:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "lint": "eslint src --ext ts,tsx",
    "lint:fix": "eslint src --ext ts,tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,css}\"",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "cap:sync": "cap sync android",
    "cap:open": "cap open android",
    "android": "pnpm build && cap sync android && cap open android",
    "android:run": "pnpm build && cap sync android && cap run android"
  },
```

In `devDependencies` (line 56-74), add `vitest` to the end:

```json
  "devDependencies": {
    "@capacitor/cli": "^8.0.0",
    "@tailwindcss/vite": "^4.1.18",
    "@tauri-apps/cli": "^2",
    "@types/node": "^22.19.3",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "@typescript-eslint/eslint-plugin": "^8.52.0",
    "@typescript-eslint/parser": "^8.52.0",
    "@vitejs/plugin-react": "^4.6.0",
    "autoprefixer": "^10.4.23",
    "eslint": "^9.39.2",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-react-hooks": "^7.0.1",
    "postcss": "^8.5.6",
    "prettier": "^3.7.4",
    "tailwindcss": "^4.1.18",
    "typescript": "~5.8.3",
    "vite": "^7.0.4",
    "vitest": "^2.1.5"
  },
```

- [ ] **Step 2: Install the new dep**

Run: `cd apps/desktop && pnpm install`
Expected: installs `vitest` and its peers, no errors. (If pnpm complains about lockfile drift, run `pnpm install --no-frozen-lockfile`.)

- [ ] **Step 3: Create `vitest.config.ts`**

Create `apps/desktop/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

The `@` alias mirrors `tsconfig.json`'s `paths` so existing imports (`@/services/...`) resolve in tests.

- [ ] **Step 4: Write a sanity test**

Create `apps/desktop/src/services/sanity.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("vitest", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the sanity test**

Run: `cd apps/desktop && pnpm test`
Expected: `1 passed`. If it errors with "Cannot find module 'vitest'", `pnpm install` didn't pick it up — re-run with `--no-frozen-lockfile`.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/package.json apps/desktop/vitest.config.ts apps/desktop/src/services/sanity.test.ts
git commit -m "test(desktop): add vitest, sanity test"
```

---

### Task 2: Mock OpenAI-compat server for tests

**Files:**
- Create: `apps/desktop/test-helpers/mock-openai-server.ts`
- Create: `apps/desktop/test-helpers/mock-openai-server.test.ts` (meta-test: server starts, serves /models and /chat/completions)

We can't hit the real Normattiva server in unit tests (it doesn't exist yet — Part D.1 of the spec). We need a small, in-process OpenAI-compat server we can point clients at. The minimum surface is:

- `GET /v1/models` → 200 with a list of model ids
- `POST /v1/chat/completions` (non-stream) → 200 with a canned `chat.completion` response, including the `x_normattiva` extension and a `usage` block
- `POST /v1/chat/completions` (stream) → SSE stream (we don't use it in Phase 0, but the client should at least not crash on it)

Built on Node's built-in `http` so it has zero test-only deps. Lives in `test-helpers/` and is imported by tests, not by app code.

- [ ] **Step 1: Create the mock server**

Create `apps/desktop/test-helpers/mock-openai-server.ts`:

```ts
import http from "node:http";
import type { AddressInfo } from "node:net";

export interface MockOpenAIServerHandle {
  baseUrl: string;
  /** Per-request response overrides; set in tests to drive error paths. */
  setResponse: (
    path: string,
    fn: (req: http.IncomingMessage, body: string) => MockResponse
  ) => void;
  /** Stop the server. Call in afterEach. */
  close: () => Promise<void>;
}

export interface MockResponse {
  status: number;
  headers?: Record<string, string>;
  body: string;
}

export async function startMockOpenAIServer(
  defaults: Partial<Record<string, MockResponse>> = {}
): Promise<MockOpenAIServerHandle> {
  const overrides = new Map<
    string,
    (req: http.IncomingMessage, body: string) => MockResponse
  >();

  const defaultResponse = (
    path: string,
    req: http.IncomingMessage,
    body: string
  ): MockResponse => {
    if (path === "/v1/models") {
      return {
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          object: "list",
          data: [
            { id: "normattiva-legal-pro", object: "model", owned_by: "normattiva" },
            { id: "normattiva-legal-lite", object: "model", owned_by: "normattiva" },
          ],
        }),
      };
    }
    if (path === "/v1/chat/completions") {
      const parsed = body ? JSON.parse(body) : {};
      const userMsg = parsed.messages?.findLast?.(
        (m: { role: string }) => m.role === "user"
      )?.content ?? "";
      return {
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "chatcmpl-test",
          object: "chat.completion",
          created: 1781230509,
          model: parsed.model ?? "normattiva-legal-pro",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: `Risposta legale di test per: ${userMsg.slice(0, 80)}`,
              },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 42, completion_tokens: 17, total_tokens: 59 },
          x_normattiva: {
            citations: [
              {
                type: "article",
                ref: "c.c. art. 1456",
                title: "Clausola risolutiva espressa",
                url: "https://example.normattiva.test/codice-civile/art1456",
              },
            ],
            tools_used: ["codici.search", "massime.search"],
            cost_estimate_eur: 0.0123,
          },
        }),
      };
    }
    return { status: 404, body: "not found" };
  };

  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const url = new URL(req.url ?? "/", "http://x");
      const path = url.pathname;
      const handler = overrides.get(path) ?? defaultResponse;
      const resp = handler(path, req, body);
      res.statusCode = resp.status;
      for (const [k, v] of Object.entries(resp.headers ?? {})) {
        res.setHeader(k, v);
      }
      res.end(resp.body);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    setResponse: (path, fn) => overrides.set(path, fn),
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      ),
  };
}
```

- [ ] **Step 2: Write a meta-test that starts the server, hits `/v1/models` and `/v1/chat/completions`, and shuts down**

Create `apps/desktop/test-helpers/mock-openai-server.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { startMockOpenAIServer, type MockOpenAIServerHandle } from "./mock-openai-server";

describe("mockOpenAIServer", () => {
  let server: MockOpenAIServerHandle | null = null;

  afterEach(async () => {
    if (server) await server.close();
    server = null;
  });

  it("responds to GET /v1/models", async () => {
    server = await startMockOpenAIServer();
    const res = await fetch(`${server.baseUrl}/v1/models`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.map((m: { id: string }) => m.id)).toContain(
      "normattiva-legal-pro"
    );
  });

  it("responds to POST /v1/chat/completions with usage + x_normattiva", async () => {
    server = await startMockOpenAIServer();
    const res = await fetch(`${server.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test",
      },
      body: JSON.stringify({
        model: "normattiva-legal-pro",
        messages: [{ role: "user", content: "Il mio cliente [PERSON_1]..." }],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.usage.total_tokens).toBe(59);
    expect(body.x_normattiva.citations[0].ref).toBe("c.c. art. 1456");
  });

  it("overrides per-path responses", async () => {
    server = await startMockOpenAIServer();
    server.setResponse("/v1/models", () => ({
      status: 401,
      body: JSON.stringify({ error: { message: "bad key" } }),
    }));
    const res = await fetch(`${server.baseUrl}/v1/models`);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Run the meta-tests**

Run: `cd apps/desktop && pnpm test`
Expected: 4 tests passed (1 sanity + 3 mock server). If the mock server can't bind, check no firewall is blocking Node's localhost listener.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/test-helpers/
git commit -m "test(desktop): mock OpenAI-compat server for normattiva tests"
```

---

## Foundations — types & settings

### Task 3: B1 — Widen `LLMModel.provider`, `Persona.preferred_backend`, `AppSettings`

**Files:**
- Modify: `apps/desktop/src/types/index.ts:4` (LLMModel.provider)
- Modify: `apps/desktop/src/types/index.ts:97` (Persona.preferred_backend)
- Modify: `apps/desktop/src/types/index.ts:17-68` (AppSettings — add normattivaApiKey/Endpoint + Citation)

All three are union/string widenings + additive fields. No new behavior. The typecheck at the end of this task is the test — if `tsc --noEmit` passes, we know every existing call site still compiles with the wider types.

- [ ] **Step 1: Widen `LLMModel.provider`**

Edit `apps/desktop/src/types/index.ts:4`. Change:
```ts
  provider: "nebius" | "ollama";
```
to:
```ts
  provider: "nebius" | "ollama" | "normattiva";
```

- [ ] **Step 2: Widen `Persona.preferred_backend`**

Edit `apps/desktop/src/types/index.ts:97`. Change:
```ts
  preferred_backend?: 'nebius' | 'ollama' | 'hybrid';
```
to:
```ts
  preferred_backend?: 'nebius' | 'ollama' | 'hybrid' | 'normattiva';
```

- [ ] **Step 3: Add Normattiva fields + `Citation` to `AppSettings`**

Edit `apps/desktop/src/types/index.ts:17-68`. Add to the `AppSettings` interface (just after `nebiusApiEndpoint: string;` on line 20):

```ts
  // API Configuration
  nebiusApiKey: string;
  nebiusApiEndpoint: string;
  normattivaApiKey: string;
  normattivaApiEndpoint: string;
  mem0ApiKey: string;
```

Add `Citation` and `NormattivaExtension` interfaces just *above* `AppSettings` (so they can be referenced in the future by `Message`/`ChatState` without an extra edit):

```ts
/** Citation returned by the Normattiva legal agent in `x_normattiva.citations`. */
export interface Citation {
  type: "article" | "massima" | "atto";
  ref: string;
  title: string;
  url: string;
}

/** Additive `x_normattiva` extension object on chat.completion responses. */
export interface NormattivaExtension {
  citations?: Citation[];
  tools_used?: string[];
  cost_estimate_eur?: number;
  /** Optional agent-stage transparency ("searching_massime", "drafting", etc.). */
  stage?: string;
}
```

- [ ] **Step 4: Run typecheck**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 0 errors. If anything fails, the most likely cause is a switch/if on `provider` or `preferred_backend` that doesn't have an exhaustive default — those are tasks B4a/B4c, not this one; the types are valid even without those code changes.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/types/index.ts
git commit -m "feat(types): widen LLMModel.provider + Persona.preferred_backend for normattiva"
```

---

### Task 4: B2a — `DEFAULT_NORMATTIVA_MODELS` + `normattivaModels` field on the store

**Files:**
- Modify: `apps/desktop/src/stores/settings.ts:8` (add `DEFAULT_NORMATTIVA_MODELS` constant)
- Modify: `apps/desktop/src/stores/settings.ts:141-180` (add `normattivaModels: LLMModel[]` to `SettingsStore` + initial state)

Pure data: one constant, one field. Tested by a unit test that reads the default state and asserts the field exists and has the expected model.

- [ ] **Step 1: Add the `DEFAULT_NORMATTIVA_MODELS` constant**

Edit `apps/desktop/src/stores/settings.ts`. Insert after `DEFAULT_MODELS` (the array ends at line 105 with `];`):

```ts

// Cloud models available on the Normattiva legal-AI platform.
// Endpoint is configured in AppSettings; the desktop points the
// OpenAI-compatible client at it.
const DEFAULT_NORMATTIVA_MODELS: LLMModel[] = [
  {
    id: "normattiva-legal-pro",
    provider: "normattiva",
    apiModelId: "normattiva-legal-pro",
    name: "Normattiva Legal Pro",
    contextWindow: 128000,
    speedTier: "medium",
    intelligenceTier: "very-high",
    // Cost is server-billed; placeholders until x_normattiva.cost_estimate_eur
    // is wired into the model settings UI (Phase 1).
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    isEnabled: true,
    isDefault: true,
  },
  {
    id: "normattiva-legal-lite",
    provider: "normattiva",
    apiModelId: "normattiva-legal-lite",
    name: "Normattiva Legal Lite",
    contextWindow: 64000,
    speedTier: "fast",
    intelligenceTier: "high",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    isEnabled: true,
    isDefault: false,
  },
];
```

- [ ] **Step 2: Add `normattivaModels` to the store interface**

Edit `apps/desktop/src/stores/settings.ts:141-180` (the `SettingsStore` interface). Add a field next to `ollamaModels: LLMModel[];`:

```ts
interface SettingsStore {
  settings: AppSettings;
  models: LLMModel[];
  ollamaModels: LLMModel[];
  normattivaModels: LLMModel[];
```

- [ ] **Step 3: Initialize `normattivaModels` in the store**

Edit `apps/desktop/src/stores/settings.ts:177-180` (the `useSettingsStore` initial state). Add to the returned object:

```ts
      settings: DEFAULT_SETTINGS,
      models: DEFAULT_MODELS,
      ollamaModels: DEFAULT_OLLAMA_MODELS,
      normattivaModels: DEFAULT_NORMATTIVA_MODELS,
```

- [ ] **Step 4: Wire it through the `persist` `partialize`**

Edit `apps/desktop/src/stores/settings.ts` near the bottom (the `partialize` block, ~line 396). Add `normattivaModels: state.normattivaModels,`:

```ts
      partialize: (state) => ({
        settings: state.settings,
        models: state.models,
        ollamaModels: state.ollamaModels,
        normattivaModels: state.normattivaModels,
      }),
```

- [ ] **Step 5: Write a failing test**

Create `apps/desktop/src/stores/settings.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore } from "@/stores/settings";

describe("settings store — normattiva models", () => {
  beforeEach(() => {
    // Reset to defaults between tests (zustand persist hydrates from
    // localStorage in browser; in node test env it's a no-op).
    useSettingsStore.getState().resetToDefaults();
  });

  it("exposes normattivaModels in the initial state", () => {
    const models = useSettingsStore.getState().normattivaModels;
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].provider).toBe("normattiva");
    expect(models[0].apiModelId).toBe("normattiva-legal-pro");
  });

  it("marks exactly one normattiva model as default", () => {
    const defaults = useSettingsStore
      .getState()
      .normattivaModels.filter((m) => m.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe("normattiva-legal-pro");
  });
});
```

- [ ] **Step 6: Run the test (will fail with `resetToDefaults` if that doesn't reset `normattivaModels`; should pass after Step 3-4)**

Run: `cd apps/desktop && pnpm test -- settings.test`
Expected: 2 passed.

If `resetToDefaults` (existing code at line 308) doesn't yet reset `normattivaModels`, the first test fails with stale data — extend `resetToDefaults` to include `normattivaModels: DEFAULT_NORMATTIVA_MODELS` (Step 7).

- [ ] **Step 7: Update `resetToDefaults` if the test in Step 6 failed**

Edit `apps/desktop/src/stores/settings.ts:308-313` (the `resetToDefaults` function). Change:

```ts
      resetToDefaults: () =>
        set({
          settings: DEFAULT_SETTINGS,
          models: DEFAULT_MODELS,
          ollamaModels: DEFAULT_OLLAMA_MODELS,
        }),
```

to:

```ts
      resetToDefaults: () =>
        set({
          settings: DEFAULT_SETTINGS,
          models: DEFAULT_MODELS,
          ollamaModels: DEFAULT_OLLAMA_MODELS,
          normattivaModels: DEFAULT_NORMATTIVA_MODELS,
        }),
```

Re-run `pnpm test -- settings.test` — must be green.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/stores/settings.ts apps/desktop/src/stores/settings.test.ts
git commit -m "feat(settings): add normattivaModels store field + defaults"
```

---

### Task 5: B2b — `normattivaApiKey/Endpoint` + `setNormattivaApiKey` + migration

**Files:**
- Modify: `apps/desktop/src/stores/settings.ts:107-139` (add fields to `DEFAULT_SETTINGS`)
- Modify: `apps/desktop/src/stores/settings.ts:141-180` (add setter to `SettingsStore` interface)
- Modify: `apps/desktop/src/stores/settings.ts:316` (add setter implementation)
- Modify: `apps/desktop/src/stores/settings.ts:367-394` (bump `version` to 17 + add migration)

- [ ] **Step 1: Add the settings fields to `DEFAULT_SETTINGS`**

Edit `apps/desktop/src/stores/settings.ts:107-139`. Add to `DEFAULT_SETTINGS` (just after `nebiusApiEndpoint: "..."` on line 109):

```ts
const DEFAULT_SETTINGS: AppSettings = {
  nebiusApiKey: "",
  nebiusApiEndpoint: "https://api.tokenfactory.nebius.com/v1",
  normattivaApiKey: "",
  normattivaApiEndpoint: "https://api.normattiva.ai/v1",
  mem0ApiKey: "",
```

- [ ] **Step 2: Add `setNormattivaApiKey` to the interface**

Edit `apps/desktop/src/stores/settings.ts:141-180` (the `SettingsStore` interface). Add to the `// Actions` block:

```ts
  // Actions
  updateSettings: (partial: Partial<AppSettings>) => void;
  setApiKey: (key: string) => void;
  setNormattivaApiKey: (key: string) => void;
  setDefaultModel: (modelId: string) => void;
```

- [ ] **Step 3: Implement `setNormattivaApiKey`**

Edit `apps/desktop/src/stores/settings.ts:316` (next to `setApiKey` at line 187-190). Add:

```ts
      setApiKey: (key) =>
        set((state) => ({
          settings: { ...state.settings, nebiusApiKey: key },
        })),

      setNormattivaApiKey: (key) =>
        set((state) => ({
          settings: { ...state.settings, normattivaApiKey: key },
        })),
```

- [ ] **Step 4: Bump `version` and add migration**

Edit `apps/desktop/src/stores/settings.ts:365-395` (the `persist` config). Change `version: 16` to `version: 17`, and add `normattivaApiKey` / `normattivaApiEndpoint` to the `migrate` function's spread of `old`:

```ts
    {
      name: "assistant-settings",
      version: 17, // v17: add normattivaApiKey + normattivaApiEndpoint
      migrate: (persisted: unknown, _version: number) => {
        const p = persisted as Partial<{ settings: Record<string, any> }>;
        const old = p?.settings ?? {} as Record<string, any>;
        const privacyMode = old.airplaneMode ? 'local' as const : (old.privacyMode ?? 'cloud' as const);
        return {
          settings: {
            ...DEFAULT_SETTINGS,
            ...old,
            privacyMode,
            theme: 'light',
            localModeModel: old.localModeModel ?? old.airplaneModeModel ?? 'qwen3-1.7b',
            hybridModeModel: 'minimax-m2',
            cloudModeModel: 'minimax-m2',
            defaultModelId: 'minimax-m2',
            airplaneMode: privacyMode === 'local',
            airplaneModeModel: old.airplaneModeModel ?? 'qwen3-1.7b',
            glinerEnabled: old.glinerEnabled ?? false,
            glinerModelId: old.glinerModelId ?? null,
            glinerConfidenceThreshold: old.glinerConfidenceThreshold ?? 0.4,
            autoRedactAllContent: old.autoRedactAllContent ?? true,
            useLocalMemory: old.useLocalMemory ?? true,
            cloudTrustLevel: old.cloudTrustLevel ?? null,
            normattivaApiKey: old.normattivaApiKey ?? '',
            normattivaApiEndpoint: old.normattivaApiEndpoint ?? 'https://api.normattiva.ai/v1',
          },
          models: DEFAULT_MODELS,
          ollamaModels: DEFAULT_OLLAMA_MODELS,
          normattivaModels: DEFAULT_NORMATTIVA_MODELS,
        };
      },
```

- [ ] **Step 5: Write a failing test**

Edit `apps/desktop/src/stores/settings.test.ts` — append at the bottom:

```ts
describe("settings store — normattiva api key", () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults();
  });

  it("defaults normattivaApiKey to empty string and endpoint to the normattiva host", () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.normattivaApiKey).toBe("");
    expect(settings.normattivaApiEndpoint).toBe("https://api.normattiva.ai/v1");
  });

  it("setNormattivaApiKey updates settings.normattivaApiKey", () => {
    useSettingsStore.getState().setNormattivaApiKey("sk-test-1234");
    expect(useSettingsStore.getState().settings.normattivaApiKey).toBe("sk-test-1234");
  });
});
```

- [ ] **Step 6: Run the test**

Run: `cd apps/desktop && pnpm test -- settings.test`
Expected: 4 passed (2 from Task 4 + 2 from this task).

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/stores/settings.ts apps/desktop/src/stores/settings.test.ts
git commit -m "feat(settings): add normattivaApiKey/Endpoint + setter + migration v17"
```

---

### Task 6: B2c — Join `normattivaModels` in selectors

**Files:**
- Modify: `apps/desktop/src/stores/settings.ts:316-360` (selector methods)

The store currently has 3 cloud/local selector functions that walk `models` + `ollamaModels`. Add `normattivaModels` to each so the chat model selector exposes Normattiva models.

- [ ] **Step 1: Add a test that exposes the gap (before fixing)**

Append to `apps/desktop/src/stores/settings.test.ts`:

```ts
describe("settings store — selectors include normattiva models", () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults();
  });

  it("getAllModels() returns normattiva models", () => {
    const all = useSettingsStore.getState().getAllModels();
    const normattiva = all.filter((m) => m.provider === "normattiva");
    expect(normattiva.length).toBeGreaterThan(0);
  });

  it("getEnabledModels() returns normattiva models in non-local mode", () => {
    const enabled = useSettingsStore.getState().getEnabledModels();
    const normattiva = enabled.filter((m) => m.provider === "normattiva");
    expect(normattiva.length).toBeGreaterThan(0);
  });

  it("getCloudModels() returns normattiva models", () => {
    const cloud = useSettingsStore.getState().getCloudModels();
    const normattiva = cloud.filter((m) => m.provider === "normattiva");
    expect(normattiva.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd apps/desktop && pnpm test -- settings.test`
Expected: 3 failures. Each test shows the normattiva models are missing from the relevant selector.

- [ ] **Step 3: Update `getAllModels`**

Edit `apps/desktop/src/stores/settings.ts:358`. Change:
```ts
      getAllModels: () => [...get().models, ...get().ollamaModels],
```
to:
```ts
      getAllModels: () => [
        ...get().models,
        ...get().ollamaModels,
        ...get().normattivaModels,
      ],
```

- [ ] **Step 4: Update `getEnabledModels`**

Edit `apps/desktop/src/stores/settings.ts:316-323`. Change:
```ts
      getEnabledModels: () => {
        const { settings, models, ollamaModels } = get();
        const enabledLocal = ollamaModels.filter((m) => m.isEnabled);
        if (settings.privacyMode === 'local') {
          return enabledLocal;
        }
        return [...models.filter((m) => m.isEnabled), ...enabledLocal];
      },
```
to:
```ts
      getEnabledModels: () => {
        const { settings, models, ollamaModels, normattivaModels } = get();
        const enabledLocal = ollamaModels.filter((m) => m.isEnabled);
        if (settings.privacyMode === 'local') {
          return enabledLocal;
        }
        return [
          ...models.filter((m) => m.isEnabled),
          ...normattivaModels.filter((m) => m.isEnabled),
          ...enabledLocal,
        ];
      },
```

- [ ] **Step 5: Update `getCloudModels`**

Edit `apps/desktop/src/stores/settings.ts:362`. Change:
```ts
      getCloudModels: () => get().models.filter((m) => m.isEnabled),
```
to:
```ts
      getCloudModels: () => [
        ...get().models,
        ...get().normattivaModels,
      ].filter((m) => m.isEnabled),
```

- [ ] **Step 6: Re-run the test**

Run: `cd apps/desktop && pnpm test -- settings.test`
Expected: 7 passed (all).

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/stores/settings.ts apps/desktop/src/stores/settings.test.ts
git commit -m "feat(settings): expose normattiva models in getAll/Enabled/CloudModels"
```

---

## Core client

### Task 7: B3a — Rename `NebiusClient` → `OpenAICompatibleClient` (back-compat alias)

**Files:**
- Modify: `apps/desktop/src/services/nebius.ts` (rename class, keep alias export)
- Modify: `apps/desktop/src/services/index.ts` (update export if necessary)
- Touch: every file that imports `NebiusClient` (search will show them)

The class is exported and imported by name in:
- `apps/desktop/src/services/nebius.ts` (definition + singleton getter)
- `apps/desktop/src/services/index.ts:8` (re-export)
- `apps/desktop/src/hooks/usePrivacyChat.ts:14, 342, 1418, 2078` (consumer)
- `apps/desktop/src/components/chat/ChatWindow.tsx:20, 495` (consumer)

We *don't* rename the *file* (stays `nebius.ts`) — just the class. A back-compat alias `export const NebiusClient = OpenAICompatibleClient` means call sites don't have to change in this task; subsequent tasks can migrate them one at a time.

- [ ] **Step 1: Rename the class and add an alias**

Edit `apps/desktop/src/services/nebius.ts:51`. Change:
```ts
export class NebiusClient {
```
to:
```ts
export class OpenAICompatibleClient {
```

Add at the end of the file (just before the existing `getNebiusClient` singleton) a back-compat alias:

```ts
// Back-compat alias. Existing call sites still import { NebiusClient };
// new code should use OpenAICompatibleClient directly. Remove this alias
// once all call sites migrate (tracked in a follow-up).
export { OpenAICompatibleClient as NebiusClient };
```

Also rename the singleton getter — change the function name but keep an alias for back-compat. Edit lines 175-185:

```ts
// Singleton instance — one per provider, kept for back-compat.
// New code should use getCloudClient(provider, ...) (Task 8).
let clientInstance: OpenAICompatibleClient | null = null;

export function getOpenAICompatibleClient(
  apiKey?: string,
  baseUrl?: string
): OpenAICompatibleClient {
  if (!clientInstance) {
    clientInstance = new OpenAICompatibleClient(apiKey || "", baseUrl);
  } else {
    if (apiKey !== undefined) clientInstance.setApiKey(apiKey);
    if (baseUrl !== undefined) clientInstance.setBaseUrl(baseUrl);
  }
  return clientInstance;
}

// Back-compat: keep the old name working.
export const getNebiusClient = getOpenAICompatibleClient;
```

- [ ] **Step 2: Run the existing app to confirm nothing broke**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 0 errors. The alias + back-compat getter should keep all existing call sites compiling.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/services/nebius.ts
git commit -m "refactor(nebius): rename NebiusClient to OpenAICompatibleClient with alias"
```

---

### Task 8: B3b — `getCloudClient(provider, apiKey, baseUrl)` factory

**Files:**
- Modify: `apps/desktop/src/services/nebius.ts` (replace singleton with a per-provider cache)
- Create: `apps/desktop/src/services/cloud-client.test.ts` (unit test using the mock server from Task 2)

The current singleton is one-instance-per-process. With a second provider, we need one client per provider (or per `(apiKey, baseUrl)`). The cleanest is a `Map<provider, OpenAICompatibleClient>` cache. The factory also picks the right `baseUrl` default per provider.

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/src/services/cloud-client.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { getCloudClient, resetCloudClients } from "./nebius";
import { startMockOpenAIServer, type MockOpenAIServerHandle } from "../../test-helpers/mock-openai-server";

describe("getCloudClient factory", () => {
  let server: MockOpenAIServerHandle | null = null;

  afterEach(async () => {
    resetCloudClients();
    if (server) await server.close();
    server = null;
  });

  it("returns a client whose baseUrl matches the provider default when none is passed", () => {
    const normattiva = getCloudClient("normattiva", "test-key");
    expect(normattiva).toBeDefined();
    // We don't expose baseUrl publicly; validate via /models below.
  });

  it("uses the explicit baseUrl when passed", async () => {
    server = await startMockOpenAIServer();
    const client = getCloudClient("normattiva", "test-key", server.baseUrl);
    const ok = await client.validateApiKey();
    expect(ok).toBe(true);
  });

  it("uses the normattiva default endpoint when no baseUrl is passed", async () => {
    // We can't start a real server on the default endpoint in tests,
    // but we can verify the URL the client picks is what we expect by
    // exercising validateApiKey against a server that will 404 — the
    // resulting ok=false is enough; we separately assert the URL prefix
    // by spying on fetch.
    const originalFetch = global.fetch;
    let observedUrl = "";
    global.fetch = (async (url: string | URL | Request) => {
      observedUrl = String(url);
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    try {
      const client = getCloudClient("normattiva", "k");
      await client.validateApiKey();
      expect(observedUrl.startsWith("https://api.normattiva.ai/v1/")).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("caches one client per (provider, apiKey, baseUrl) tuple", () => {
    const a = getCloudClient("normattiva", "k1");
    const b = getCloudClient("normattiva", "k1");
    expect(a).toBe(b);
    const c = getCloudClient("normattiva", "k2");
    expect(a).not.toBe(c);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd apps/desktop && pnpm test -- cloud-client.test`
Expected: 4 failures (function not exported).

- [ ] **Step 3: Replace the singleton with a per-provider cache + add the factory**

Edit `apps/desktop/src/services/nebius.ts`. Replace the singleton block (lines 174-185) with:

```ts
// One client per (provider, baseUrl) — keyed so different API keys can
// coexist. Normattiva and Nebius each get their own default endpoint.
const NORMATTIVA_DEFAULT_BASE = "https://api.normattiva.ai/v1";
const NEBIUS_DEFAULT_BASE = "https://api.tokenfactory.nebius.com/v1";

const clientCache = new Map<string, OpenAICompatibleClient>();

function cacheKey(provider: string, baseUrl: string, apiKey: string): string {
  return `${provider}::${baseUrl}::${apiKey}`;
}

/**
 * Get (or create) an OpenAI-compatible client for the given provider.
 * Provider-specific defaults are filled in for `baseUrl`; pass an explicit
 * `baseUrl` to override (used in tests, and to point at staging).
 */
export function getCloudClient(
  provider: "nebius" | "ollama" | "normattiva",
  apiKey: string,
  baseUrl?: string
): OpenAICompatibleClient {
  const defaultBase =
    provider === "normattiva" ? NORMATTIVA_DEFAULT_BASE : NEBIUS_DEFAULT_BASE;
  const resolvedBase = (baseUrl ?? defaultBase).replace(/\/+$/, "");
  const key = cacheKey(provider, resolvedBase, apiKey);
  const existing = clientCache.get(key);
  if (existing) {
    existing.setApiKey(apiKey);
    return existing;
  }
  const client = new OpenAICompatibleClient(apiKey, resolvedBase);
  clientCache.set(key, client);
  return client;
}

/** Test helper — drop all cached clients. Not exported in index.ts. */
export function resetCloudClients(): void {
  clientCache.clear();
}

// Back-compat: keep the old singleton getter working. It now points at
// the Nebius provider.
export function getOpenAICompatibleClient(
  apiKey?: string,
  baseUrl?: string
): OpenAICompatibleClient {
  return getCloudClient("nebius", apiKey ?? "", baseUrl);
}
export const getNebiusClient = getOpenAICompatibleClient;
```

- [ ] **Step 4: Re-run the test**

Run: `cd apps/desktop && pnpm test -- cloud-client.test`
Expected: 4 passed.

- [ ] **Step 5: Run typecheck + the full test suite**

Run: `cd apps/desktop && pnpm typecheck && pnpm test`
Expected: 0 type errors; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/services/nebius.ts apps/desktop/src/services/cloud-client.test.ts
git commit -m "feat(nebius): per-provider cloud client cache + getCloudClient factory"
```

---

### Task 9: B3c — `x_normattiva` parsing (non-streaming)

**Files:**
- Modify: `apps/desktop/src/services/nebius.ts` (extend `ChatCompletionResponse` type, parse `x_normattiva` in non-stream and stream paths)
- Create: `apps/desktop/src/services/cloud-client-xnorm.test.ts` (unit test against the mock server)

The Normattiva spec (A5) requires the response to include an additive `x_normattiva` object with `citations`, `tools_used`, `cost_estimate_eur`, and optionally `stage`. Phase 0 captures the non-streaming surface; streaming `stage` chunks land in Phase 1.

- [ ] **Step 1: Extend `ChatCompletionResponse`**

Edit `apps/desktop/src/services/nebius.ts:31-49` (the `ChatCompletionResponse` interface). Add the `x_normattiva` field:

```ts
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  /** Additive extension returned by Normattiva. Standard OpenAI clients
   *  ignore it; the desktop uses it for citations, cost, and (Phase 1)
   *  agent-stage streaming transparency. */
  x_normattiva?: {
    citations?: Array<{
      type: "article" | "massima" | "atto";
      ref: string;
      title: string;
      url: string;
    }>;
    tools_used?: string[];
    cost_estimate_eur?: number;
    stage?: string;
  };
}
```

- [ ] **Step 2: Write the failing test**

Create `apps/desktop/src/services/cloud-client-xnorm.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { getCloudClient, resetCloudClients } from "./nebius";
import { startMockOpenAIServer, type MockOpenAIServerHandle } from "../../test-helpers/mock-openai-server";

describe("OpenAICompatibleClient — x_normattiva extension", () => {
  let server: MockOpenAIServerHandle | null = null;

  afterEach(async () => {
    resetCloudClients();
    if (server) await server.close();
    server = null;
  });

  it("returns x_normattiva in the non-streaming chatCompletion response", async () => {
    server = await startMockOpenAIServer();
    const client = getCloudClient("normattiva", "test-key", server.baseUrl);
    const response = await client.chatCompletion({
      model: "normattiva-legal-pro",
      messages: [{ role: "user", content: "Ciao" }],
    });
    expect(response.x_normattiva).toBeDefined();
    expect(response.x_normattiva?.citations?.[0].ref).toBe("c.c. art. 1456");
    expect(response.x_normattiva?.tools_used).toContain("codici.search");
    expect(response.x_normattiva?.cost_estimate_eur).toBeCloseTo(0.0123);
  });

  it("returns undefined x_normattiva when the platform omits it", async () => {
    server = await startMockOpenAIServer();
    server.setResponse("/v1/chat/completions", () => ({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 1781230509,
        model: "normattiva-legal-pro",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "ok" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    }));
    const client = getCloudClient("normattiva", "test-key", server.baseUrl);
    const response = await client.chatCompletion({
      model: "normattiva-legal-pro",
      messages: [{ role: "user", content: "x" }],
    });
    expect(response.x_normattiva).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run the test (should already pass — `chatCompletion` returns parsed JSON and the type widens to allow `x_normattiva` as optional)**

Run: `cd apps/desktop && pnpm test -- cloud-client-xnorm.test`
Expected: 2 passed. The existing `chatCompletion` (nebius.ts:150-171) already does `return response.json()` and `Response.json()` returns `any` — the field is just structurally there. The only real change in this task is the *type* — callers now know what shape to expect.

If a test fails because of strict `unknown` typing on `response.json()`, change `chatCompletion`'s return statement to:

```ts
    return (await response.json()) as ChatCompletionResponse;
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/services/nebius.ts apps/desktop/src/services/cloud-client-xnorm.test.ts
git commit -m "feat(nebius): x_normattiva extension in ChatCompletionResponse"
```

---

## Routing (TS)

### Task 10: B4a — Widen TS `PreferredBackend` + add to `BACKEND_PRIVACY_INFO`

**Files:**
- Modify: `apps/desktop/src/services/backend-routing-service.ts:10-11` (widen `PreferredBackend` + `AnonymizationMode`)
- Modify: `apps/desktop/src/services/backend-routing-service.ts:91-113` (add `normattiva` to `BACKEND_PRIVACY_INFO`)
- Modify: `apps/desktop/src/services/backend-routing-service.ts:201-231` (functions that switch on `PreferredBackend`)

- [ ] **Step 1: Widen the `PreferredBackend` union**

Edit `apps/desktop/src/services/backend-routing-service.ts:10`. Change:
```ts
export type PreferredBackend = 'nebius' | 'ollama' | 'hybrid';
```
to:
```ts
export type PreferredBackend = 'nebius' | 'ollama' | 'hybrid' | 'normattiva';
```

- [ ] **Step 2: Add Normattiva to `BACKEND_PRIVACY_INFO`**

Edit `apps/desktop/src/services/backend-routing-service.ts:91-113`. Add a new entry:

```ts
export const BACKEND_PRIVACY_INFO: Record<PreferredBackend, BackendPrivacy> = {
  nebius: {
    level: 'low',
    emoji: '⚡',
    description: 'Cloud Direct - Fastest, standard privacy',
    sendsToCloud: true,
    localProcessing: false,
  },
  normattiva: {
    level: 'low',
    emoji: '⚖️',
    description: 'Legal AI (Normattiva) - Cloud legal-specialist, anonymized',
    sendsToCloud: true,
    localProcessing: false,
  },
  ollama: {
    level: 'high',
    emoji: '🔒',
    description: 'Local Only - Maximum privacy, no cloud',
    sendsToCloud: false,
    localProcessing: true,
  },
  hybrid: {
    level: 'medium',
    emoji: '🔐',
    description: 'Hybrid - Local anonymization + cloud',
    sendsToCloud: true,
    localProcessing: true,
  },
};
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 0 errors. (The switch/if on `PreferredBackend` in this file uses record lookups, not exhaustive match — widening the union is non-breaking.)

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/services/backend-routing-service.ts
git commit -m "feat(routing): widen PreferredBackend + add normattiva to BACKEND_PRIVACY_INFO"
```

---

### Task 11: B4b — Add `normattiva` to `BACKEND_OPTIONS`

**Files:**
- Modify: `apps/desktop/src/services/backend-routing-service.ts:130-152` (add a row)

- [ ] **Step 1: Add the row**

Edit `apps/desktop/src/services/backend-routing-service.ts:130-152`. Insert the normattiva row after the nebius row:

```ts
export const BACKEND_OPTIONS = [
  {
    value: 'nebius' as PreferredBackend,
    label: 'Cloud Direct',
    description: 'Direct cloud API - Fastest, suitable for general chat',
    privacy: 'Standard',
    speed: 'Very Fast',
  },
  {
    value: 'normattiva' as PreferredBackend,
    label: 'Legal AI (Normattiva)',
    description: 'Italian legal specialist (codici + massime). Redaction required.',
    privacy: 'Standard',
    speed: 'Fast',
  },
  {
    value: 'ollama' as PreferredBackend,
    label: 'Local Only',
    description: 'Local model inference - Maximum privacy, no cloud',
    privacy: 'Maximum',
    speed: 'Medium',
  },
  {
    value: 'hybrid' as PreferredBackend,
    label: 'Hybrid',
    description: 'Local anonymization + cloud - Balanced privacy and speed',
    privacy: 'High',
    speed: 'Fast',
  },
];
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/services/backend-routing-service.ts
git commit -m "feat(routing): add normattiva to BACKEND_OPTIONS"
```

---

## Routing (Rust)

### Task 12: B4c — Rust `BackendType::Normattiva` enum

**Files:**
- Modify: `apps/desktop/src-tauri/src/backend_routing.rs:22-30` (add enum variant)

- [ ] **Step 1: Add the variant**

Edit `apps/desktop/src-tauri/src/backend_routing.rs:22-30`. Change:
```rust
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BackendType {
    /// Direct cloud API (fastest, least private)
    Nebius,
    /// Local model inference (private, slowest)
    Ollama,
    /// Local anonymization then cloud (balanced)
    Hybrid,
}
```
to:
```rust
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BackendType {
    /// Direct cloud API (fastest, least private)
    Nebius,
    /// Local model inference (private, slowest)
    Ollama,
    /// Local anonymization then cloud (balanced)
    Hybrid,
    /// Italian legal-specialist cloud API (Normattiva).
    /// Same privacy posture as Nebius but with required anonymization
    /// for the legal persona by default.
    Normattiva,
}
```

- [ ] **Step 2: Run the existing Rust tests to make sure nothing broke**

Run: `cd apps/desktop/src-tauri && cargo test`
Expected: all existing tests pass. The enum widening is a *non-exhaustive* match in the existing code (it has a `_ =>` default in `determine_backend` and pattern-matches via `BackendType::Nebius | BackendType::Ollama | BackendType::Hybrid` arms in `make_routing_decision`). The latter is a *compile error* — Rust will complain that `BackendType::Normattiva` is not covered. Fix in the next task.

- [ ] **Step 3: Commit (the enum widening, even though it may not yet compile)**

Actually, do NOT commit until the test suite is green. The whole Rust file is a compilation unit; the existing match on `BackendType` will fail to compile. Proceed directly to Task 13 to add the matching arm.

- [ ] **No commit yet — move on to Task 13.**

---

### Task 13: B4d — Rust `"normattiva"` arm in `determine_backend`

**Files:**
- Modify: `apps/desktop/src-tauri/src/backend_routing.rs:117-153` (add the `"normattiva"` arm)
- Modify: `apps/desktop/src-tauri/src/backend_routing.rs:300+` (add a unit test)

- [ ] **Step 1: Add the arm in `determine_backend`**

Edit `apps/desktop/src-tauri/src/backend_routing.rs:119-123`. Change:
```rust
    let backend = match backend_str.as_str() {
        "ollama" => BackendType::Ollama,
        "hybrid" => BackendType::Hybrid,
        _ => BackendType::Nebius, // Default
    };
```
to:
```rust
    let backend = match backend_str.as_str() {
        "ollama" => BackendType::Ollama,
        "hybrid" => BackendType::Hybrid,
        "normattiva" => BackendType::Normattiva,
        _ => BackendType::Nebius, // Default
    };
```

- [ ] **Step 2: Add a unit test**

Find the test module at the bottom of `backend_routing.rs` (search for `mod tests` or `#[cfg(test)]`). Append a test that verifies the normattiva string maps to the right enum:

```rust
    #[tokio::test]
    async fn determine_backend_maps_normattiva_string_to_enum() {
        let persona = Persona {
            id: "p1".into(),
            name: "Legal".into(),
            description: "".into(),
            icon: "".into(),
            system_prompt: "".into(),
            voice_id: "".into(),
            preferred_model_id: Some("normattiva-legal-pro".into()),
            knowledge_base_ids: vec![],
            temperature: 0.2,
            max_tokens: 4096,
            is_built_in: true,
            created_at: "2026-01-01".into(),
            updated_at: "2026-01-01".into(),
            enable_local_anonymizer: true,
            preferred_backend: "normattiva".into(),
            anonymization_mode: "required".into(),
            local_ollama_model: None,
            enable_cloud_delegation: false,
            cloud_delegation_threshold: None,
        };

        // Use a stub LocalInference. The existing test module likely
        // has one; mirror its setup. If not, the simplest stub is
        // a struct that always returns is_available() = false.
        struct Stub;
        #[async_trait::async_trait]
        impl crate::inference::LocalInference for Stub {
            async fn is_available(&self) -> bool { false }
            async fn generate(&self, _: &str, _: Option<&str>) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
                unimplemented!()
            }
        }

        let config = determine_backend(&persona &Stub).await.unwrap();
        assert_eq!(config.backend, BackendType::Normattiva);
    }
```

> **Note on the test stub:** the exact shape of `LocalInference` may differ; if so, mirror the existing test module's stub. If the test file already imports a fixture, reuse it.

- [ ] **Step 3: Run cargo test**

Run: `cd apps/desktop/src-tauri && cargo test determine_backend`
Expected: existing tests pass + the new test passes.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/backend_routing.rs
git commit -m "feat(rust/routing): BackendType::Normattiva + determine_backend arm"
```

---

### Task 14: B4e — Rust `"normattiva"` arm in `make_routing_decision`

**Files:**
- Modify: `apps/desktop/src-tauri/src/backend_routing.rs:181-208` (add the arm)

The `make_routing_decision` function currently pattern-matches on `backend_str` for `"nebius"`, `"ollama"`, `"hybrid"`. Add `"normattiva"` mirroring the `"nebius"` cloud-direct path (the legal persona is configured with `anonymization_mode: 'required'` + `enable_local_anonymizer: true`, which the existing code already handles in the `"nebius"` arm by falling through to `attributes_only` content mode — same behavior for Normattiva).

- [ ] **Step 1: Add the arm**

Edit `apps/desktop/src-tauri/src/backend_routing.rs:181-208`. Insert the normattiva arm right after the `"nebius"` arm (after the closing `}` of the `"nebius"` block):

```rust
        "normattiva" => {
            // Same posture as Nebius direct-cloud. The legal persona
            // pairs this with enable_local_anonymizer: true +
            // anonymization_mode: 'required', which the existing logic
            // routes to attributes-only content mode.
            if matches!(anonymization_mode, AnonymizationMode::Required) && enable_anonymization {
                warn!("Normattiva backend with required anonymization - using attributes-only mode");
                BackendDecision {
                    backend: BackendType::Normattiva,
                    anonymize: false,
                    model: persona.preferred_model_id.clone().into(),
                    reason: "Legal AI (Normattiva) with attributes-only (required privacy mode)".to_string(),
                    content_mode: ContentMode::AttributesOnly,
                    fallback: FallbackEvent::None,
                    is_safe: true,
                }
            } else {
                BackendDecision {
                    backend: BackendType::Normattiva,
                    anonymize: false,
                    model: persona.preferred_model_id.clone().into(),
                    reason: "Legal AI (Normattiva) direct cloud (fastest)".to_string(),
                    content_mode: ContentMode::FullText,
                    fallback: FallbackEvent::None,
                    is_safe: true,
                }
            }
        }
```

- [ ] **Step 2: Run cargo test**

Run: `cd apps/desktop/src-tauri && cargo test`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/backend_routing.rs
git commit -m "feat(rust/routing): normattiva arm in make_routing_decision"
```

---

### Task 15: B4f — Rust validator allow-list + `db.rs` comment + enum-to-string mapping

**Files:**
- Modify: `apps/desktop/src-tauri/src/backend_routing_commands.rs:96` (extend the `matches!` allow-list)
- Modify: `apps/desktop/src-tauri/src/backend_routing_commands.rs:71-74` (add Normattiva to the `BackendType` -> string mapping for `BackendDecisionResponse.backend`)
- Modify: `apps/desktop/src-tauri/src/backend_routing.rs:378-385` (same enum-to-string for the `to_string` helper)
- Modify: `apps/desktop/src-tauri/src/attribute_extraction_commands.rs:254-256` (same enum-to-string)
- Modify: `apps/desktop/src-tauri/src/db.rs:53` (column comment only — no schema change)

- [ ] **Step 1: Extend the validator allow-list**

Edit `apps/desktop/src-tauri/src/backend_routing_commands.rs:96`. Change:
```rust
    if !matches!(preferred_backend.as_str(), "nebius" | "ollama" | "hybrid") {
```
to:
```rust
    if !matches!(preferred_backend.as_str(), "nebius" | "ollama" | "hybrid" | "normattiva") {
```

- [ ] **Step 2: Add Normattiva to the `BackendDecisionResponse.backend` mapping**

Edit `apps/desktop/src-tauri/src/backend_routing_commands.rs:71-74`. Change:
```rust
            crate::backend_routing::BackendType::Nebius => "nebius".to_string(),
            crate::backend_routing::BackendType::Ollama => "ollama".to_string(),
            crate::backend_routing::BackendType::Hybrid => "hybrid".to_string(),
```
to:
```rust
            crate::backend_routing::BackendType::Nebius => "nebius".to_string(),
            crate::backend_routing::BackendType::Ollama => "ollama".to_string(),
            crate::backend_routing::BackendType::Hybrid => "hybrid".to_string(),
            crate::backend_routing::BackendType::Normattiva => "normattiva".to_string(),
```

- [ ] **Step 3: Add Normattiva to the `to_string` helper**

Edit `apps/desktop/src-tauri/src/backend_routing.rs:378-385`. Change:
```rust
        BackendType::Nebius => "nebius",
        BackendType::Ollama => "ollama",
        BackendType::Hybrid => "hybrid",
```
to:
```rust
        BackendType::Nebius => "nebius",
        BackendType::Ollama => "ollama",
        BackendType::Hybrid => "hybrid",
        BackendType::Normattiva => "normattiva",
```

- [ ] **Step 4: Add Normattiva to the attribute_extraction mapping**

Edit `apps/desktop/src-tauri/src/attribute_extraction_commands.rs:254-256`. Change:
```rust
        crate::backend_routing::BackendType::Nebius => "nebius".to_string(),
        crate::backend_routing::BackendType::Ollama => "ollama".to_string(),
        crate::backend_routing::BackendType::Hybrid => "hybrid".to_string(),
```
to:
```rust
        crate::backend_routing::BackendType::Nebius => "nebius".to_string(),
        crate::backend_routing::BackendType::Ollama => "ollama".to_string(),
        crate::backend_routing::BackendType::Hybrid => "hybrid".to_string(),
        crate::backend_routing::BackendType::Normattiva => "normattiva".to_string(),
```

- [ ] **Step 5: Update `db.rs` comment**

Edit `apps/desktop/src-tauri/src/db.rs:53`. Change:
```rust
    pub preferred_backend: String, // 'nebius' | 'ollama' | 'hybrid'
```
to:
```rust
    pub preferred_backend: String, // 'nebius' | 'ollama' | 'hybrid' | 'normattiva'
```

(No migration needed — the column is `TEXT` and stores the string value.)

- [ ] **Step 6: Run the full Rust test suite**

Run: `cd apps/desktop/src-tauri && cargo test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src-tauri/src/backend_routing.rs apps/desktop/src-tauri/src/backend_routing_commands.rs apps/desktop/src-tauri/src/attribute_extraction_commands.rs apps/desktop/src-tauri/src/db.rs
git commit -m "feat(rust/routing): normattiva in validator + enum-to-string + db comment"
```

---

## Chat path wiring

### Task 16: B4g — Wire persona routing in chat path

**Files:**
- Modify: `apps/desktop/src/hooks/usePrivacyChat.ts:1418-1432` (replace the hard-coded `getNebiusClient` with a routing-aware call)

This is the load-bearing fix the spec glosses over. The current `executePrivacySend` (line 1124) hard-codes `getNebiusClient` regardless of the persona's `preferred_backend`. We need to:

1. Check `targetPersona.preferred_backend === 'normattiva'` (or model provider)
2. Pick the right `getCloudClient` invocation
3. Maintain the existing fallback path (default → Nebius)

- [ ] **Step 1: Read the current call site**

Read `apps/desktop/src/hooks/usePrivacyChat.ts:1418-1432` and the surrounding `else` branch (the non-Ollama path that always uses `getNebiusClient`). Confirm the exact code shape before editing.

- [ ] **Step 2: Add a routing-aware client selection helper**

In the same file (`usePrivacyChat.ts`), near the top after the imports, add a small helper. Find a good spot (e.g., just after the existing `getNebiusClient` import on line 14):

```ts
import { getNebiusClient, getCloudClient, type ChatMessage } from "@/services/nebius";
```

…and then immediately below the existing `executePrivacySend` definition (around line 1118), add:

```ts
/**
 * Pick the right cloud client for a persona + model. Defaults to Nebius
 * for backward compatibility (no persona override = today's behavior).
 */
function pickCloudClient(
  targetPersona: { preferred_backend?: string } | null | undefined,
  model: { provider?: string; apiModelId?: string } | null | undefined,
  settings: { nebiusApiKey: string; nebiusApiEndpoint: string; normattivaApiKey: string; normattivaApiEndpoint: string }
) {
  if (
    targetPersona?.preferred_backend === "normattiva" ||
    model?.provider === "normattiva"
  ) {
    return getCloudClient("normattiva", settings.normattivaApiKey, settings.normattivaApiEndpoint);
  }
  return getCloudClient("nebius", settings.nebiusApiKey, settings.nebiusApiEndpoint);
}
```

- [ ] **Step 3: Replace the hard-coded `getNebiusClient` call**

Edit `apps/desktop/src/hooks/usePrivacyChat.ts:1418-1421`. Change:

```ts
        const client = getNebiusClient(
          settings.nebiusApiKey,
          settings.nebiusApiEndpoint
        );
```

to:

```ts
        const client = pickCloudClient(targetPersona, model, settings);
```

- [ ] **Step 4: Apply the same replacement to the other call sites**

There are 3 other call sites of `getNebiusClient` in this file that the spec doesn't change but which currently bypass routing too: lines 342-346 (in `maybeGenerateProjectSummary`), 2078-2082 (likely another helper). Apply the same `pickCloudClient` swap to each. For `maybeGenerateProjectSummary` (line 342-346), the routing decision is "use the persona's backend if the model matches, else Nebius."

- [ ] **Step 5: Typecheck + run all tests**

Run: `cd apps/desktop && pnpm typecheck && pnpm test`
Expected: 0 type errors; all tests pass. The `pickCloudClient` helper is now the single point of routing in the chat path.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/hooks/usePrivacyChat.ts
git commit -m "feat(chat): route cloud client by persona.preferred_backend (not hard-coded nebius)"
```

---

## Persona

### Task 17: B6 — `legal-advisor-it` built-in persona

**Files:**
- Modify: `apps/desktop/src/stores/personas.ts:6` (append to `DEFAULT_PERSONAS`)

A built-in persona that exercises the new `preferred_backend: 'normattiva'` + `anonymization_mode: 'required'` + `requiresPIIVault: true` shape. The system prompt is Italian (per the spec) and instructs the model to use placeholder tokens verbatim — the A11 contract.

- [ ] **Step 1: Append the persona**

Edit `apps/desktop/src/stores/personas.ts`. After the last persona in `DEFAULT_PERSONAS` (the `tax-audit` block ends at line 198 with `};`), add a comma and a new entry:

```ts
  {
    id: "legal-advisor-it",
    name: "Consulente Legale IT",
    description:
      "Consulenza legale italiana (codici + massime) con privacy locale e reidrazione automatica",
    icon: "⚖️",
    systemPrompt: `Sei un assistente legale esperto di diritto italiano, specializzato in ricerca nei codici (codice civile, penale, del lavoro, ecc.) e nelle massime giurisprudenziali (Cassazione, Corti d'Appello, TAR, Consiglio di Stato).

Come funziona la privacy in questa conversazione:
- Gli identificativi personali (nomi, codici fiscali, IBAN, indirizzi) compaiono come SEGnaposti (es. [PERSON_1], [IBAN_2]).
- Trattali come entità stabili e usa i segnaposti VERBATIM nelle tue risposte — non sostituirli, tradurli, normalizzarli o tentare di risalire al valore originale.
- La reidrazione (sostituzione dei segnaposto con i valori reali) avviene solo in locale sul dispositivo dell'utente, dopo la tua risposta.

Linee guida operative:
- Rispondi in italiano.
- Cita sempre gli articoli di legge pertinenti (es. "c.c. art. 1456") e, quando possibile, massime giurisprudenziali (es. "Cass. civ. sez. III, n. 12345/2023").
- Indica il livello di certezza della tua risposta e segnala quando è necessario consultare un avvocato.
- Non fornire consulenza legale in senso stretto: sei uno strumento di orientamento, non un sostituto del professionista.
- Quando l'utente cita un caso specifico, struttura la risposta in: (1) quadro normativo, (2) giurisprudenza rilevante, (3) passi pratici suggeriti, (4) cautele e limiti.`,
    voiceId: "it_IT-riccardo-x_low",
    preferredModelId: "normattiva-legal-pro",
    knowledgeBaseIds: [],
    temperature: 0.2,
    maxTokens: 4096,
    isBuiltIn: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    requiresPIIVault: true,
    preferred_backend: "normattiva",
    enable_local_anonymizer: true,
    anonymization_mode: "required",
  },
```

- [ ] **Step 2: Write a unit test**

Create `apps/desktop/src/stores/personas.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { usePersonasStore } from "@/stores/personas";

describe("legal-advisor-it persona", () => {
  beforeEach(() => {
    // personas store uses persist; reset to default by reloading.
    // The store doesn't expose a resetToDefaults, so re-derive.
    usePersonasStore.setState({
      personas: usePersonasStore.getState().personas,
      selectedPersonaId: usePersonasStore.getState().selectedPersonaId,
    });
  });

  it("is registered as a built-in persona", () => {
    const p = usePersonasStore.getState().getPersonaById("legal-advisor-it");
    expect(p).toBeDefined();
    expect(p?.isBuiltIn).toBe(true);
  });

  it("uses the normattiva backend with required anonymization", () => {
    const p = usePersonasStore.getState().getPersonaById("legal-advisor-it");
    expect(p?.preferred_backend).toBe("normattiva");
    expect(p?.anonymization_mode).toBe("required");
    expect(p?.enable_local_anonymizer).toBe(true);
    expect(p?.requiresPIIVault).toBe(true);
  });

  it("references the normattiva-legal-pro model", () => {
    const p = usePersonasStore.getState().getPersonaById("legal-advisor-it");
    expect(p?.preferredModelId).toBe("normattiva-legal-pro");
  });
});
```

- [ ] **Step 3: Run the test**

Run: `cd apps/desktop && pnpm test -- personas.test`
Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/stores/personas.ts apps/desktop/src/stores/personas.test.ts
git commit -m "feat(personas): add legal-advisor-it built-in (normattiva backend)"
```

---

## UI

### Task 18: B7a — Normattiva key/endpoint fields in `PrivacySettings`

**Files:**
- Modify: `apps/desktop/src/components/settings/PrivacySettings.tsx` (add a "Normattiva Legal AI" section mirroring the existing Nebius section)

The wizard stays Nebius-only (per the v2 spec correction). Normattiva lives in `PrivacySettings` / `ModelSettings` instead. The simplest place to add the key + endpoint fields is a new card in `PrivacySettings`.

- [ ] **Step 1: Read the existing file**

Read `apps/desktop/src/components/settings/PrivacySettings.tsx` end-to-end. Identify the existing Nebius API key section as a template.

- [ ] **Step 2: Add a Normattiva section**

Insert a new card just after the existing Nebius section. The exact JSX mirrors the existing pattern:

```tsx
{/* Normattiva Legal AI (B7a) */}
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Scale className="h-5 w-5" />
      Normattiva Legal AI
    </CardTitle>
    <CardDescription>
      Italian legal-specialist cloud (codici + massime). Always redacts PII before sending.
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-3">
    <div>
      <Label htmlFor="normattiva-api-key">API Key</Label>
      <Input
        id="normattiva-api-key"
        type="password"
        placeholder="sk-..."
        value={settings.normattivaApiKey}
        onChange={(e) => setNormattivaApiKey(e.target.value)}
      />
    </div>
    <div>
      <Label htmlFor="normattiva-endpoint">Endpoint</Label>
      <Input
        id="normattiva-endpoint"
        type="text"
        value={settings.normattivaApiEndpoint}
        onChange={(e) => useSettingsStore.getState().updateSettings({ normattivaApiEndpoint: e.target.value })}
      />
      <p className="text-xs text-muted-foreground mt-1">
        Default: <code>https://api.normattiva.ai/v1</code>. Override for staging/mocks.
      </p>
    </div>
    <NormattivaValidateButton />
  </CardContent>
</Card>
```

Wire imports: add `Scale` to the lucide-react import line, and ensure `Input`, `Label`, `Card*` are already imported (they are, per the existing file's Nebius section).

- [ ] **Step 3: Add the placeholder for `NormattivaValidateButton` (defined in next task)**

Just above the new card (or wherever fits the file's import surface), add an empty stub:

```tsx
function NormattivaValidateButton() {
  // Implemented in Task 19.
  return null;
}
```

This lets Task 18 compile before Task 19 lands.

- [ ] **Step 4: Typecheck**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/settings/PrivacySettings.tsx
git commit -m "feat(ui): Normattiva key + endpoint fields in PrivacySettings"
```

---

### Task 19: B7b — Validate button (calls `GET /v1/models`)

**Files:**
- Modify: `apps/desktop/src/components/settings/PrivacySettings.tsx` (replace the `NormattivaValidateButton` stub)
- Modify: `apps/desktop/src/services/cloud-client-validate.test.ts` (test the existing `validateApiKey` against the mock server)

The client already has `validateApiKey()` (nebius.ts:68, hits `GET /v1/models`). The button just wires it to a UI state.

- [ ] **Step 1: Write the failing test for `validateApiKey` against the mock server**

Create `apps/desktop/src/services/cloud-client-validate.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { getCloudClient, resetCloudClients } from "./nebius";
import { startMockOpenAIServer, type MockOpenAIServerHandle } from "../../test-helpers/mock-openai-server";

describe("OpenAICompatibleClient.validateApiKey", () => {
  let server: MockOpenAIServerHandle | null = null;

  afterEach(async () => {
    resetCloudClients();
    if (server) await server.close();
    server = null;
  });

  it("returns true when the mock server returns 200", async () => {
    server = await startMockOpenAIServer();
    const client = getCloudClient("normattiva", "test-key", server.baseUrl);
    expect(await client.validateApiKey()).toBe(true);
  });

  it("returns false when the mock server returns 401", async () => {
    server = await startMockOpenAIServer();
    server.setResponse("/v1/models", () => ({
      status: 401,
      body: JSON.stringify({ error: { message: "bad key" } }),
    }));
    const client = getCloudClient("normattiva", "bad-key", server.baseUrl);
    expect(await client.validateApiKey()).toBe(false);
  });

  it("returns false when the network is unreachable", async () => {
    const client = getCloudClient("normattiva", "test-key", "http://127.0.0.1:1");
    // 1 is a privileged port nothing binds to in tests; should fail fast.
    expect(await client.validateApiKey()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test (should pass — `validateApiKey` already exists)**

Run: `cd apps/desktop && pnpm test -- cloud-client-validate.test`
Expected: 3 passed. (The existing `validateApiKey` at nebius.ts:68 already returns `response.ok || false`.)

- [ ] **Step 3: Replace the `NormattivaValidateButton` stub**

Edit `apps/desktop/src/components/settings/PrivacySettings.tsx`. Replace the `NormattivaValidateButton` stub with a real implementation:

```tsx
function NormattivaValidateButton() {
  const settings = useSettingsStore((s) => s.settings);
  const [state, setState] = useState<"idle" | "checking" | "ok" | "fail">("idle");

  const onClick = async () => {
    setState("checking");
    const client = getCloudClient("normattiva", settings.normattivaApiKey, settings.normattivaApiEndpoint);
    const ok = await client.validateApiKey();
    setState(ok ? "ok" : "fail");
  };

  return (
    <Button onClick={onClick} disabled={state === "checking" || !settings.normattivaApiKey} variant="outline" size="sm">
      {state === "checking" ? "Validating..." : "Validate Key"}
      {state === "ok" && <CheckCircle2 className="ml-2 h-4 w-4 text-green-500" />}
      {state === "fail" && <AlertCircle className="ml-2 h-4 w-4 text-red-500" />}
    </Button>
  );
}
```

Add `useState` to the React imports, add `CheckCircle2` and `AlertCircle` to the lucide-react imports, and add `getCloudClient` to the `services/nebius` import.

- [ ] **Step 4: Typecheck + run all tests**

Run: `cd apps/desktop && pnpm typecheck && pnpm test`
Expected: 0 errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/settings/PrivacySettings.tsx apps/desktop/src/services/cloud-client-validate.test.ts
git commit -m "feat(ui): Normattiva Validate button + validateApiKey tests"
```

---

## End-to-end verification

### Task 20: End-to-end smoke test with mock server

**Files:**
- Create: `apps/desktop/test-helpers/e2e-redact-rehydrate.test.ts`

This is the *Phase 0 acceptance test*. It exercises the full redact → cloud → rehydrate loop end-to-end against the mock OpenAI-compat server, using a real `getCloudClient` + real `redactForCloud` + real `rehydrateFromCloud`. Catches the integration issues that unit tests miss.

- [ ] **Step 1: Read the existing call-site shape**

Read `apps/desktop/src/hooks/usePrivacyChat.ts:332-394` (the `maybeGenerateProjectSummary` function). It shows the canonical pattern:

```ts
const tRes = await redactForCloud(transcript);
const dRes = await redactForCloud(docsContext);
const allMappings = new Map([...tRes.mappings, ...dRes.mappings]);
const client = getNebiusClient(settings.nebiusApiKey, settings.nebiusApiEndpoint);
const stream = client.streamChatCompletion({ model, messages, ... });
let content = "";
for await (const chunk of stream) content += chunk;
const finalContent = rehydrateFromCloud(content, allMappings);
```

The e2e test mirrors this against the mock server.

- [ ] **Step 2: Write the e2e test**

Create `apps/desktop/test-helpers/e2e-redact-rehydrate.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { getCloudClient, resetCloudClients } from "@/services/nebius";
import { redactForCloud, rehydrateFromCloud } from "@/services/cloud-redaction";
import { startMockOpenAIServer, type MockOpenAIServerHandle } from "./mock-openai-server";

describe("e2e: redact → cloud → rehydrate", () => {
  let server: MockOpenAIServerHandle | null = null;

  afterEach(async () => {
    resetCloudClients();
    if (server) await server.close();
    server = null;
  });

  it("redacts PII, sends only tokens, rehydrates the response with real values", async () => {
    server = await startMockOpenAIServer();

    // Simulate the registry containing a custom term for "Mario Rossi".
    // In production this comes from useUserContextStore.getState().ensureRedactTerm;
    // for the test we use a minimal stub via the same entry point.
    const { useUserContextStore } = await import("@/stores/userContext");
    const ensure = useUserContextStore.getState().ensureRedactTerm;
    const token = ensure("PERSON", "Mario Rossi");
    expect(token).toMatch(/\[PERSON(?:_\d+)?\]/);

    // Redact the user message.
    const original = "Il mio cliente Mario Rossi ha un debito di 50.000 euro.";
    const { redacted, mappings } = await redactForCloud(original);
    expect(redacted).not.toContain("Mario Rossi");
    expect(redacted).toContain(token);

    // Send the redacted text to the mock Normattiva server.
    const client = getCloudClient("normattiva", "test-key", server.baseUrl);
    const response = await client.chatCompletion({
      model: "normattiva-legal-pro",
      messages: [
        { role: "system", content: "Sei un consulente legale." },
        { role: "user", content: redacted },
      ],
    });

    const assistantText = response.choices[0].message.content;
    // The assistant's text echoes the token verbatim (A11 contract).
    expect(assistantText).toContain(token);

    // Rehydrate locally.
    const finalText = rehydrateFromCloud(assistantText, mappings);
    expect(finalText).toContain("Mario Rossi");
    expect(finalText).not.toContain(token);

    // Citations survive the round-trip (B3c).
    expect(response.x_normattiva?.citations?.[0].ref).toBe("c.c. art. 1456");
  });

  it("never sends a non-streaming request that contains the raw PII", async () => {
    server = await startMockOpenAIServer();

    // Capture outbound bodies.
    const bodies: string[] = [];
    const originalFetch = global.fetch;
    global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      if (init?.body) bodies.push(String(init.body));
      return originalFetch(url, init);
    }) as typeof fetch;

    try {
      const { redactForCloud } = await import("@/services/cloud-redaction");
      const { redacted } = await redactForCloud("Contatta mario@rossi.it");
      const client = getCloudClient("normattiva", "k", server.baseUrl);
      await client.chatCompletion({
        model: "normattiva-legal-pro",
        messages: [{ role: "user", content: redacted }],
      });
      expect(bodies.join("|")).not.toContain("mario@rossi.it");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
```

- [ ] **Step 3: Run the e2e test**

Run: `cd apps/desktop && pnpm test -- e2e-redact-rehydrate`
Expected: 2 passed. (If `redactForCloud` is not directly importable in tests because it pulls in `@tauri-apps/api/core`, mock that module — see Step 4.)

- [ ] **Step 4: Mock `@tauri-apps/api/core` if needed**

`redactForCloud` calls `invoke()` for GLiNER / `redact_text_command`. In a Node test env, `@tauri-apps/api/core` is a no-op stub that returns `undefined`. If the test fails because `redactForCloud` needs real Rust IPC, mock it in `apps/desktop/test-helpers/setup.ts`:

```ts
// apps/desktop/test-helpers/setup.ts
import { vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: async (cmd: string, args?: any) => {
    if (cmd === "detect_pii_with_gliner") {
      // Return empty list — term-matching below will still cover customRedactTerms.
      return [];
    }
    if (cmd === "redact_text_command") {
      const text: string = args?.text ?? "";
      const terms: Array<{ label: string; value: string; replacement: string }> = args?.terms ?? [];
      const mappings: Record<string, string> = {};
      let out = text;
      for (const t of terms) {
        if (out.includes(t.value)) {
          out = out.split(t.value).join(t.replacement);
          mappings[t.replacement] = t.value;
        }
      }
      return { text: out, mappings, redaction_count: Object.keys(mappings).length };
    }
    return null;
  },
}));
```

…and register it in `vitest.config.ts`:

```ts
      setupFiles: ["./test-helpers/setup.ts"],
```

- [ ] **Step 5: Re-run the e2e test**

Run: `cd apps/desktop && pnpm test -- e2e-redact-rehydrate`
Expected: 2 passed.

- [ ] **Step 6: Run the full test suite as a final check**

Run: `cd apps/desktop && pnpm typecheck && pnpm test && cd src-tauri && cargo test`
Expected: 0 type errors, all TS tests pass, all Rust tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/test-helpers/
git commit -m "test(e2e): redact → cloud → rehydrate end-to-end with mock normattiva"
```

---

## Self-review checklist (run before declaring done)

1. **Spec coverage.** Walk each requirement in `apps/desktop/docs/superpowers/specs/2026-06-15-normattiva-integration-spec.md` v2:
   - B1 (types) → Task 3 ✓
   - B2 (settings) → Tasks 4, 5, 6 ✓
   - B3 (client) → Tasks 7, 8, 9 ✓
   - B4 (routing) → Tasks 10, 11, 12, 13, 14, 15, 16 ✓
   - B5 (no chokepoint change) → verified by Task 20 e2e test passing without any chokepoint edit ✓
   - B6 (persona) → Task 17 ✓
   - B7 (UI) → Tasks 18, 19 ✓
   - B8 (citations UI) — Phase 1, not in this plan.
   - B9 (CSP) — verified no change needed, no task.
   - B10 (Rust proxy) — only if CSP fails; not in this plan.

2. **Placeholders.** Search the plan for "TBD", "TODO", "later", "appropriate", "similar to". Any hits should be filled in or removed. (I scanned; none present.)

3. **Type consistency.** Names used in later tasks match definitions in earlier tasks:
   - `OpenAICompatibleClient` (Task 7) → used in Tasks 8, 9, 19, 20.
   - `getCloudClient(provider, apiKey, baseUrl?)` (Task 8) → used in Tasks 16, 19, 20.
   - `BackendType::Normattiva` (Task 12) → used in Tasks 13, 14, 15.
   - `redactForCloud` / `rehydrateFromCloud` (unchanged) → used in Task 20.
   - `pickCloudClient` (Task 16) → defined and used in the same task.

4. **Working tree.** Each task ends with a commit. The repo's main branch stays green.

5. **Out-of-scope but worth noting:**
   - The chat path in `usePrivacyChat.ts:1418` has a 2-3 line drop-in change in Task 16, but the actual call site has surrounding code (rehydration, streaming, finalizeStreaming) that we are NOT touching. If those need adjustments when the client is swapped, file a follow-up issue.
   - The "Validate" button (Task 19) is intentionally in `PrivacySettings` only — the spec's v2 correction (B7) explicitly keeps the wizard Nebius-only.
   - The mock server in `test-helpers/` is a test-only artifact; it should not be imported by app code.

---

## What's NOT in this plan (deferred)

| Spec ref | Why deferred |
|---|---|
| B3 stream `stream_options.include_usage` + capture real usage | Phase 1; non-streaming first per spec. |
| B8 citations UI in `MessageBubble` | Phase 1; we capture the data in B3c but don't render it yet. |
| A6 agent-stage SSE transparency (`x_normattiva.stage` chunks) | Phase 2; needs streaming. |
| B10 Rust `reqwest` proxy for CORS | Only if production CSP fails; not pre-built. |
| MCP server for third-party hosts | Separate track per spec §0.2. |
| Real Normattiva endpoint integration | The platform ships it; we re-run Task 20 e2e against the real URL when ready. |

---

## Execution handoff

Plan complete and saved to `docs/plans/2026-06-15-normattiva-phase-0.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for a 20-task plan with frequent commits.

**2. Inline Execution** — Execute tasks in this session, batch execution with checkpoints. Better for a tighter feedback loop on tricky tasks (the Rust routing arms in particular benefit from in-session review).

Which approach?
