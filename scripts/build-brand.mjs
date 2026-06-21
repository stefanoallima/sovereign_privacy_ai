#!/usr/bin/env node
// build-brand.mjs — pre-build script for the dual-marketing build flavor.
// Reads VITE_BRAND env (default "sovereign") and:
//   - sovereign: no-op for files (uses git-tracked defaults); writes .env.local
//   - normattiva: copies tauri.conf.normattiva.json + icons-normattiva/ into place
//   - invalid: exits 1 with a clear error
//
// Run this BEFORE `pnpm tauri build`. Both CI workflows call it.

import { copyFileSync, cpSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
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

if (brand === "normattiva") {
  const confSrc = resolve(TAURI, "tauri.conf.normattiva.json");
  if (!existsSync(confSrc)) {
    console.error(`build-brand: missing ${confSrc}`);
    process.exit(1);
  }
  const iconsSrc = resolve(TAURI, "icons-normattiva");
  if (!existsSync(iconsSrc)) {
    console.error(`build-brand: missing ${iconsSrc}`);
    process.exit(1);
  }

  copyFileSync(confSrc, resolve(TAURI, "tauri.conf.json"));
  console.log(`build-brand: copied tauri.conf.json from normattiva template`);

  const iconsDst = resolve(TAURI, "icons");
  if (existsSync(iconsDst)) {
    rmSync(iconsDst, { recursive: true, force: true });
  }
  cpSync(iconsSrc, iconsDst, { recursive: true });
  console.log(`build-brand: copied icons/ from icons-normattiva/`);
  console.log(`build-brand: switched tauri.conf + icons → normattiva`);
} else {
  console.log(`build-brand: sovereign (no swap needed; using git-tracked files)`);
}

const envLocal = resolve(DESKTOP, ".env.local");
writeFileSync(envLocal, `VITE_BRAND=${brand}\n`);
console.log(`build-brand: wrote ${envLocal} (VITE_BRAND=${brand})`);
