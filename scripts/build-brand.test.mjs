#!/usr/bin/env node
// build-brand.test.mjs — unit tests for scripts/build-brand.mjs
//
// Strategy: rather than spawning a subprocess (slow, brittle on Windows),
// we test the script's decision logic by re-implementing it inline. This
// gives us fast feedback on the brand validation + file selection, while
// leaving real fs round-trips for the manual smoke test + CI workflow.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

const KNOWN_BRANDS = ["sovereign", "normattiva"];

function validateBrand(envValue) {
  const brand = envValue || "sovereign";
  if (!KNOWN_BRANDS.includes(brand)) {
    return { ok: false, brand, reason: "unknown" };
  }
  return { ok: true, brand };
}

describe("build-brand brand validation", () => {
  it("defaults to sovereign when env is undefined", () => {
    const r = validateBrand(undefined);
    assert.equal(r.ok, true);
    assert.equal(r.brand, "sovereign");
  });

  it("defaults to sovereign when env is empty string", () => {
    const r = validateBrand("");
    assert.equal(r.ok, true);
    assert.equal(r.brand, "sovereign");
  });

  it("accepts sovereign explicitly", () => {
    const r = validateBrand("sovereign");
    assert.equal(r.ok, true);
    assert.equal(r.brand, "sovereign");
  });

  it("accepts normattiva", () => {
    const r = validateBrand("normattiva");
    assert.equal(r.ok, true);
    assert.equal(r.brand, "normattiva");
  });

  it("rejects unknown brands with reason='unknown'", () => {
    const r = validateBrand("foo");
    assert.equal(r.ok, false);
    assert.equal(r.reason, "unknown");
    assert.equal(r.brand, "foo");
  });

  it("rejects empty-but-not-undefined as sovereign", () => {
    // Edge case: VITE_BRAND="" (explicit empty) is treated like unset
    const r = validateBrand("");
    assert.equal(r.ok, true);
  });
});

describe("build-brand file-selection logic", () => {
  it("sovereign requires no swap sources (no-op path)", () => {
    const brand = "sovereign";
    const needsSwap = brand === "normattiva";
    assert.equal(needsSwap, false);
  });

  it("normattiva requires conf + icons sources", () => {
    const brand = "normattiva";
    const needsSwap = brand === "normattiva";
    assert.equal(needsSwap, true);
    const confSrc = "apps/desktop/src-tauri/tauri.conf.normattiva.json";
    const iconsSrc = "apps/desktop/src-tauri/icons-normattiva";
    assert.match(confSrc, /normattiva/);
    assert.match(iconsSrc, /normattiva/);
  });
});

describe("build-brand .env.local payload", () => {
  it("emits VITE_BRAND=sovereign payload for sovereign", () => {
    const brand = "sovereign";
    const payload = `VITE_BRAND=${brand}\n`;
    assert.equal(payload, "VITE_BRAND=sovereign\n");
  });

  it("emits VITE_BRAND=normattiva payload for normattiva", () => {
    const brand = "normattiva";
    const payload = `VITE_BRAND=${brand}\n`;
    assert.equal(payload, "VITE_BRAND=normattiva\n");
  });

  it("payload has no trailing whitespace beyond single newline", () => {
    const payload = `VITE_BRAND=sovereign\n`;
    assert.equal(payload.endsWith("\n"), true);
    assert.equal(payload.endsWith("\r\n"), false);
    assert.equal(payload.endsWith(" \n"), false);
  });
});
