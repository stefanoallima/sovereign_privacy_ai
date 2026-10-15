import { describe, it, expect } from "vitest";
import { isCodicecivileEndpoint, quotaUsed } from "./quota";
import { parseRateLimit, rateLimitMessage } from "./nebius";

const headers = (h: Record<string, string>) => new Headers(h);

describe("parseRateLimit", () => {
  it("parses numeric headers and 'unlimited'", () => {
    expect(
      parseRateLimit(
        headers({ "X-RateLimit-Limit": "100", "X-RateLimit-Remaining": "40", "X-RateLimit-Reset": "1790000000" })
      )
    ).toEqual({ limit: 100, remaining: 40, reset: 1790000000 });
    expect(parseRateLimit(headers({ "X-RateLimit-Limit": " Unlimited " }))?.limit).toBe("unlimited");
  });

  it("treats empty or whitespace values as absent, not as 0", () => {
    expect(parseRateLimit(headers({ "X-RateLimit-Limit": "", "X-RateLimit-Remaining": "  " }))).toBeUndefined();
    const r = parseRateLimit(headers({ "X-RateLimit-Limit": "", "X-RateLimit-Remaining": "5" }));
    expect(r?.limit).toBeUndefined();
    expect(r?.remaining).toBe(5);
  });

  it("rejects negative and non-numeric values", () => {
    expect(
      parseRateLimit(headers({ "X-RateLimit-Limit": "-1", "X-RateLimit-Remaining": "abc", "X-RateLimit-Reset": "-5" }))
    ).toBeUndefined();
  });

  it("returns undefined when no rate-limit headers are present", () => {
    expect(parseRateLimit(headers({}))).toBeUndefined();
  });
});

describe("quotaUsed", () => {
  it("is limit - remaining for ordinary values", () => {
    expect(quotaUsed({ limit: 100, remaining: 40 })).toBe(60);
  });

  it("clamps to [0, limit] when the server reports odd numbers", () => {
    expect(quotaUsed({ limit: 100, remaining: 150 })).toBe(0);
    expect(quotaUsed({ limit: 100, remaining: -20 })).toBe(100);
  });

  it("is undefined unless both are numbers", () => {
    expect(quotaUsed(undefined)).toBeUndefined();
    expect(quotaUsed({ limit: "unlimited", remaining: 3 })).toBeUndefined();
    expect(quotaUsed({ limit: 10 })).toBeUndefined();
  });
});

describe("isCodicecivileEndpoint", () => {
  it("matches the real host and its subdomains", () => {
    expect(isCodicecivileEndpoint("https://api.codicecivile.ai/api/v1")).toBe(true);
    expect(isCodicecivileEndpoint("https://codicecivile.ai/v1")).toBe(true);
    expect(isCodicecivileEndpoint("HTTPS://API.CodiceCivile.AI/v1")).toBe(true);
  });

  it("does not match lookalikes that merely contain the string", () => {
    expect(isCodicecivileEndpoint("https://evil.example/codicecivile.ai")).toBe(false);
    expect(isCodicecivileEndpoint("https://codicecivile.ai.evil.example/v1")).toBe(false);
    expect(isCodicecivileEndpoint("https://notcodicecivile.ai/v1")).toBe(false);
    expect(isCodicecivileEndpoint("not a url codicecivile.ai")).toBe(false);
  });
});

describe("rateLimitMessage", () => {
  it("shows usage and the upgrade link only for the real platform", () => {
    const q = { limit: 100, remaining: 0 };
    expect(rateLimitMessage(q, "https://api.codicecivile.ai/api/v1")).toBe(
      "You've hit the request limit. Used 100/100 this month. Upgrade at codicecivile.ai/pricing to continue."
    );
    expect(rateLimitMessage(q, "https://evil.example/codicecivile.ai")).toBe(
      "You've hit the request limit. Used 100/100 this month. Please try again later."
    );
  });

  it("never prints a negative usage count", () => {
    expect(rateLimitMessage({ limit: 10, remaining: 99 }, "https://x.example")).toContain("Used 0/10");
  });

  it("omits usage when the quota is unknown", () => {
    expect(rateLimitMessage(undefined, "https://x.example")).toBe(
      "You've hit the request limit. Please try again later."
    );
  });
});
