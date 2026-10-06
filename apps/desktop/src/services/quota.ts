import type { RateLimitInfo } from "@/types";

/**
 * Requests used this period, derived from the X-RateLimit-* numbers. Returns undefined
 * unless both are finite numbers. Clamped to [0, limit]: a server that reports
 * remaining > limit (or a negative remaining) must not show a negative or >100% count.
 */
export function quotaUsed(quota: RateLimitInfo | undefined): number | undefined {
  if (typeof quota?.limit !== "number" || typeof quota?.remaining !== "number") {
    return undefined;
  }
  return Math.min(quota.limit, Math.max(0, quota.limit - quota.remaining));
}

/**
 * True when the endpoint is served by codicecivile.ai (or a subdomain). Matches on the
 * parsed hostname, not a substring, so `https://evil.example/codicecivile.ai` and
 * `https://codicecivile.ai.evil.example` do not get the upgrade link.
 */
export function isCodicecivileEndpoint(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return host === "codicecivile.ai" || host.endsWith(".codicecivile.ai");
  } catch {
    return false;
  }
}
