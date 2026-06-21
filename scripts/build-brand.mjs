#!/usr/bin/env node
// build-brand.mjs — pre-build script for the dual-marketing build flavor.
// Reads VITE_BRAND env (default "sovereign") and:
//   - sovereign: copies icons-sovereign/ into icons/ (tauri.conf.json is the
//     git-tracked Sovereign default; only the icons/ directory is rebuilt)
//   - normattiva: copies tauri.conf.normattiva.json + icons-normattiva/ into place
//   - invalid: exits 1 with a clear error
//
// Both CI workflows call this before `pnpm tauri build`. Sovereign could
// technically skip the icons copy because `icons/` would be git-tracked, but
// after the dual-marketing refactor the canonical icon set lives in
// `icons-sovereign/` (git-tracked) and `icons/` is regenerated from it. This
// keeps the working tree clean (no uncommitted `icons/` churn) and makes the
// script symmetric across both flavors.

import { copyFileSync, cpSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TAURI = resolve(ROOT, "apps/desktop/src-tauri");
const DESKTOP = resolve(ROOT, "apps/desktop");

const brand = process.env.VITE_BRAND || "sovereign";

if (!["sovereign", "normattiva"].includes(brand)) {
  console.error(
    `Unknown VITE_BRAND: ${brand} (must be "sovereign" or "normattiva")`,
  );
  process.exit(1);
}

const iconsDir = resolve(TAURI, `icons-${brand}`);
if (!existsSync(iconsDir)) {
  console.error(`build-brand: missing ${iconsDir}`);
  process.exit(1);
}

if (brand === "normattiva") {
  const confSrc = resolve(TAURI, "tauri.conf.normattiva.json");
  if (!existsSync(confSrc)) {
    console.error(`build-brand: missing ${confSrc}`);
    process.exit(1);
  }
  copyFileSync(confSrc, resolve(TAURI, "tauri.conf.json"));
  console.log(`build-brand: copied tauri.conf.json from normattiva template`);
}

const iconsDst = resolve(TAURI, "icons");
if (existsSync(iconsDst)) {
  rmSync(iconsDst, { recursive: true, force: true });
}
cpSync(iconsDir, iconsDst, { recursive: true });
console.log(`build-brand: copied icons/ from ${basename(iconsDir)}/`);

if (brand === "normattiva") {
  console.log(`build-brand: switched tauri.conf + icons → normattiva`);
} else {
  console.log(`build-brand: sovereign (tauri.conf.json unchanged; icons regenerated from icons-sovereign/)`);
}

const envLocal = resolve(DESKTOP, ".env.local");
writeFileSync(envLocal, `VITE_BRAND=${brand}\n`);
console.log(`build-brand: wrote ${envLocal} (VITE_BRAND=${brand})`);
