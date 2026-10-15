import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchEndpointModels,
  isSafeEndpoint,
  isValidModelId,
  parseModelIds,
  ModelDiscoveryError,
} from "./model-discovery";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("parseModelIds", () => {
  it("reads the OpenAI { data: [{ id }] } shape, de-duplicated and sorted", () => {
    expect(parseModelIds({ data: [{ id: "b" }, { id: "a" }, { id: "b" }] })).toEqual([
      "a",
      "b",
    ]);
  });

  it("tolerates a bare array, { models: [...] }, string entries and junk", () => {
    expect(parseModelIds(["x", { id: "y" }, 3, null, { id: " " }])).toEqual(["x", "y"]);
    expect(parseModelIds({ models: [{ id: "m" }] })).toEqual(["m"]);
    expect(parseModelIds({})).toEqual([]);
    expect(parseModelIds(null)).toEqual([]);
  });
});

describe("isValidModelId / parseModelIds hardening", () => {
  it("accepts typical ids and rejects whitespace, control chars and oversize", () => {
    for (const ok of ["gpt-4o", "meta-llama/Llama-3.3-70B-Instruct", "org/m:tag_1.2"]) {
      expect(isValidModelId(ok)).toBe(true);
    }
    for (const bad of ["", "a b", "a\tb", "a\u0000b", "x".repeat(201)]) {
      expect(isValidModelId(bad)).toBe(false);
    }
  });

  it("drops invalid ids and caps the list", () => {
    expect(parseModelIds({ data: [{ id: "good" }, { id: "bad id" }, { id: "x".repeat(500) }] })).toEqual(["good"]);
    const many = { data: Array.from({ length: 5000 }, (_, i) => ({ id: `m-${i}` })) };
    expect(parseModelIds(many)).toHaveLength(2000);
  });
});

describe("isSafeEndpoint", () => {
  it("allows https and loopback http only", () => {
    expect(isSafeEndpoint("https://api.example.com/v1")).toBe(true);
    expect(isSafeEndpoint("http://localhost:11434/v1")).toBe(true);
    expect(isSafeEndpoint("http://127.0.0.1:8000/v1")).toBe(true);
    expect(isSafeEndpoint("http://api.example.com/v1")).toBe(false);
    expect(isSafeEndpoint("ftp://x")).toBe(false);
    expect(isSafeEndpoint("javascript:alert(1)")).toBe(false);
    expect(isSafeEndpoint("not a url")).toBe(false);
  });

  it("never sends the API key to an insecure endpoint", async () => {
    const f = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", f);
    await expect(fetchEndpointModels("http://api.example.com/v1", "sk-secret")).rejects.toThrow(
      /insecure/i
    );
    expect(f).not.toHaveBeenCalled();
  });

  it("sends a trimmed key", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => new Response(JSON.stringify({ data: [] })));
    vi.stubGlobal("fetch", f);
    await fetchEndpointModels("https://x.example/v1", "  sk-abc  ");
    expect((f.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Bearer sk-abc");
  });
});

describe("fetchEndpointModels", () => {
  it("GETs {base}/models with the bearer key and strips trailing slashes", async () => {
    const f = stubFetch(async () => json({ data: [{ id: "m1" }] }));
    const ids = await fetchEndpointModels("https://api.example.com/v1//", "sk-test");
    expect(ids).toEqual(["m1"]);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.example.com/v1/models");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
  });

  it("refuses without an endpoint or key, before any network call", async () => {
    const f = stubFetch(async () => json({}));
    await expect(fetchEndpointModels("", "k")).rejects.toThrow(/endpoint/i);
    await expect(fetchEndpointModels("https://x", "  ")).rejects.toThrow(/API key/i);
    expect(f).not.toHaveBeenCalled();
  });

  it.each([
    [401, /rejected the API key/i],
    [403, /rejected the API key/i],
    [404, /add the model id manually/i],
    [500, /error \(500\)/],
  ])("maps HTTP %i to a readable error", async (status, message) => {
    stubFetch(async () => new Response("nope", { status }));
    const err = await fetchEndpointModels("https://x", "k").catch((e) => e);
    expect(err).toBeInstanceOf(ModelDiscoveryError);
    expect(err.message).toMatch(message);
    expect(err.status).toBe(status);
  });

  it("reports network failures and unreadable bodies without leaking details", async () => {
    stubFetch(async () => {
      throw new TypeError("fetch failed: secret-host");
    });
    const net = await fetchEndpointModels("https://x", "k").catch((e) => e);
    expect(net.message).toMatch(/couldn't reach/i);
    expect(net.message).not.toMatch(/secret-host/);

    stubFetch(async () => new Response("<html>", { status: 200 }));
    await expect(fetchEndpointModels("https://x", "k")).rejects.toThrow(/unreadable/i);
  });

  it("times out a hung endpoint", async () => {
    vi.useFakeTimers();
    try {
      stubFetch(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError"))
            );
          })
      );
      const pending = fetchEndpointModels("https://x", "k").catch((e) => e);
      await vi.advanceTimersByTimeAsync(10_001);
      expect((await pending).message).toMatch(/too long/i);
    } finally {
      vi.useRealTimers();
    }
  });
});
