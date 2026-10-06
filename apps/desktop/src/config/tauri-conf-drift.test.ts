import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// tauri.conf.normattiva.json is a full copy of tauri.conf.json (build-brand swaps it in).
// A copy drifts: a setting added to one (updater artifacts, bundle config, CSP, ...) but not
// the other silently changes only one brand's build. This test pins the ONLY fields that are
// allowed to differ; anything else must be changed in both files.
const read = (name: string) =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../../src-tauri/${name}`, import.meta.url)), "utf8")
  );

type Json = Record<string, any>;

// Brand-specific fields (path in the config).
function stripBrandFields(conf: Json): Json {
  const c = JSON.parse(JSON.stringify(conf));
  delete c.productName;
  delete c.identifier;
  for (const w of c.app?.windows ?? []) delete w.title;
  if (c.plugins?.updater) {
    delete c.plugins.updater.endpoints;
    delete c.plugins.updater.pubkey;
  }
  return c;
}

describe("tauri config copies", () => {
  const sovereign = read("tauri.conf.json");
  const normattiva = read("tauri.conf.normattiva.json");

  it("differ only in brand fields", () => {
    expect(stripBrandFields(normattiva)).toEqual(stripBrandFields(sovereign));
  });

  it("have distinct app identities and update feeds", () => {
    expect(normattiva.identifier).not.toBe(sovereign.identifier);
    expect(normattiva.productName).not.toBe(sovereign.productName);
    expect(normattiva.plugins.updater.endpoints).not.toEqual(sovereign.plugins.updater.endpoints);
  });

  it("keep updater artifacts on for both (the installer and updater depend on them)", () => {
    expect(sovereign.bundle.createUpdaterArtifacts).toBe(true);
    expect(normattiva.bundle.createUpdaterArtifacts).toBe(true);
  });
});
