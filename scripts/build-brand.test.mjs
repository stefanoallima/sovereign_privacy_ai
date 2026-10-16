#!/usr/bin/env node
// build-brand.test.mjs — tests for scripts/build-brand.mjs.
//
// These run the REAL applyBrand() against a throwaway directory tree (not a re-implemented
// copy of its logic), so a regression in the script itself fails here.

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyBrand, BrandBuildError } from "./build-brand.mjs";

const SOVEREIGN_CONF = JSON.stringify({ productName: "Sovereign AI" });
const NORMATTIVA_CONF = JSON.stringify({ productName: "Normattiva", pubkey: "REAL_KEY" });

let root;
const tauri = () => join(root, "apps/desktop/src-tauri");
const read = (rel) => readFileSync(join(tauri(), rel), "utf8");

function seed({ normattivaConf = NORMATTIVA_CONF } = {}) {
  mkdirSync(join(tauri(), "icons-sovereign"), { recursive: true });
  mkdirSync(join(tauri(), "icons-normattiva"), { recursive: true });
  writeFileSync(join(tauri(), "icons-sovereign/icon.png"), "sovereign-icon");
  writeFileSync(join(tauri(), "icons-normattiva/icon.png"), "normattiva-icon");
  writeFileSync(join(tauri(), "tauri.conf.json"), SOVEREIGN_CONF);
  writeFileSync(join(tauri(), "tauri.conf.normattiva.json"), normattivaConf);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "build-brand-"));
  mkdirSync(join(root, "apps/desktop"), { recursive: true });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("applyBrand", () => {
  it("defaults to sovereign: leaves tauri.conf.json, copies sovereign icons, writes .env.local", () => {
    seed();
    applyBrand({ root });
    assert.equal(read("tauri.conf.json"), SOVEREIGN_CONF);
    assert.equal(read("icons/icon.png"), "sovereign-icon");
    assert.equal(readFileSync(join(root, "apps/desktop/.env.local"), "utf8"), "VITE_BRAND=sovereign\n");
    assert.equal(existsSync(join(tauri(), "tauri.conf.sovereign.bak")), false);
  });

  it("normattiva: swaps config + icons and keeps a backup of the Sovereign config", () => {
    seed();
    applyBrand({ brand: "normattiva", root });
    assert.equal(read("tauri.conf.json"), NORMATTIVA_CONF);
    assert.equal(read("icons/icon.png"), "normattiva-icon");
    assert.equal(read("tauri.conf.sovereign.bak"), SOVEREIGN_CONF);
    assert.equal(readFileSync(join(root, "apps/desktop/.env.local"), "utf8"), "VITE_BRAND=normattiva\n");
  });

  it("normattiva then sovereign restores the Sovereign config (no identity leak)", () => {
    seed();
    applyBrand({ brand: "normattiva", root });
    applyBrand({ brand: "sovereign", root });
    assert.equal(read("tauri.conf.json"), SOVEREIGN_CONF);
    assert.equal(read("icons/icon.png"), "sovereign-icon");
    assert.equal(existsSync(join(tauri(), "tauri.conf.sovereign.bak")), false);
  });

  it("running normattiva twice never overwrites the backup with the Normattiva config", () => {
    seed();
    applyBrand({ brand: "normattiva", root });
    applyBrand({ brand: "normattiva", root });
    assert.equal(read("tauri.conf.sovereign.bak"), SOVEREIGN_CONF);
    applyBrand({ brand: "sovereign", root });
    assert.equal(read("tauri.conf.json"), SOVEREIGN_CONF);
  });

  it("rejects an unknown brand", () => {
    seed();
    assert.throws(() => applyBrand({ brand: "foo", root }), BrandBuildError);
    assert.throws(() => applyBrand({ brand: "Normattiva", root }), /Unknown VITE_BRAND/);
  });

  it("refuses to build normattiva with a PLACEHOLDER updater key", () => {
    seed({ normattivaConf: JSON.stringify({ pubkey: "PLACEHOLDER_NORMATTIVA_PUBKEY_REPLACE_IN_T10" }) });
    assert.throws(() => applyBrand({ brand: "normattiva", root }), /PLACEHOLDER/);
    // and it must not have touched the tracked config
    assert.equal(read("tauri.conf.json"), SOVEREIGN_CONF);
    assert.equal(existsSync(join(tauri(), "tauri.conf.sovereign.bak")), false);
  });

  it("allows the placeholder only with the explicit dev override", () => {
    seed({ normattivaConf: JSON.stringify({ pubkey: "PLACEHOLDER_X" }) });
    assert.doesNotThrow(() => applyBrand({ brand: "normattiva", root, allowPlaceholder: true }));
  });

  it("fails clearly when brand sources are missing", () => {
    seed();
    rmSync(join(tauri(), "icons-normattiva"), { recursive: true });
    assert.throws(() => applyBrand({ brand: "normattiva", root }), /missing .*icons-normattiva/);
    rmSync(join(tauri(), "tauri.conf.normattiva.json"));
    mkdirSync(join(tauri(), "icons-normattiva"));
    assert.throws(() => applyBrand({ brand: "normattiva", root }), /missing .*tauri.conf.normattiva.json/);
  });
});
