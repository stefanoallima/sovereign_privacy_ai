#!/usr/bin/env node
// build-brand.mjs — pre-build script for the dual-brand build flavor.
// Reads VITE_BRAND env (default "sovereign") and:
//   - sovereign: copies icons-sovereign/ into icons/ and, if a previous normattiva run
//     swapped tauri.conf.json, restores the tracked Sovereign config
//   - normattiva: backs up the tracked tauri.conf.json, then copies
//     tauri.conf.normattiva.json + icons-normattiva/ into place
//   - invalid: exits 1 with a clear error
//
// tauri.conf.json is git-tracked and holds the Sovereign config, so a normattiva run
// keeps a backup (tauri.conf.sovereign.bak, gitignored) and the next sovereign run
// restores it. Without that, building Normattiva and then Sovereign on one machine would
// silently ship Sovereign with the Normattiva identity and updater feed.
//
// The Normattiva config must not ship with a placeholder updater key: an app built that
// way cannot verify (or would mis-verify) updates. Set ALLOW_PLACEHOLDER_UPDATER_KEY=1 to
// build a local dev flavor anyway.

import {
  copyFileSync,
  cpSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const BRANDS = ["sovereign", "normattiva"];

export class BrandBuildError extends Error {}

/**
 * Apply a brand to the working tree.
 * @param {{ brand?: string, root?: string, allowPlaceholder?: boolean, log?: (m: string) => void }} opts
 */
export function applyBrand({
  brand = "sovereign",
  root,
  allowPlaceholder = false,
  log = () => {},
} = {}) {
  if (!BRANDS.includes(brand)) {
    throw new BrandBuildError(
      `Unknown VITE_BRAND: ${brand} (must be "sovereign" or "normattiva")`,
    );
  }
  const ROOT = resolve(root);
  const TAURI = resolve(ROOT, "apps/desktop/src-tauri");
  const DESKTOP = resolve(ROOT, "apps/desktop");
  const conf = resolve(TAURI, "tauri.conf.json");
  const backup = resolve(TAURI, "tauri.conf.sovereign.bak");

  const iconsDir = resolve(TAURI, `icons-${brand}`);
  if (!existsSync(iconsDir)) {
    throw new BrandBuildError(`build-brand: missing ${iconsDir}`);
  }

  if (brand === "normattiva") {
    const confSrc = resolve(TAURI, "tauri.conf.normattiva.json");
    if (!existsSync(confSrc)) {
      throw new BrandBuildError(`build-brand: missing ${confSrc}`);
    }
    if (!allowPlaceholder && /PLACEHOLDER/i.test(readFileSync(confSrc, "utf8"))) {
      throw new BrandBuildError(
        "build-brand: tauri.conf.normattiva.json still contains a PLACEHOLDER value " +
          "(updater pubkey). Replace it with the real key before building, or set " +
          "ALLOW_PLACEHOLDER_UPDATER_KEY=1 for a local dev build.",
      );
    }
    // Keep the pristine Sovereign config; never overwrite an existing backup (that would
    // replace the real Sovereign config with a previous Normattiva one).
    if (!existsSync(backup)) copyFileSync(conf, backup);
    copyFileSync(confSrc, conf);
    log(`build-brand: copied tauri.conf.json from normattiva template`);
  } else if (existsSync(backup)) {
    copyFileSync(backup, conf);
    rmSync(backup, { force: true });
    log(`build-brand: restored Sovereign tauri.conf.json from backup`);
  }

  const iconsDst = resolve(TAURI, "icons");
  if (existsSync(iconsDst)) {
    rmSync(iconsDst, { recursive: true, force: true });
  }
  cpSync(iconsDir, iconsDst, { recursive: true });
  log(`build-brand: copied icons/ from ${basename(iconsDir)}/`);

  const envLocal = resolve(DESKTOP, ".env.local");
  writeFileSync(envLocal, `VITE_BRAND=${brand}\n`);
  log(`build-brand: wrote ${envLocal} (VITE_BRAND=${brand})`);

  return { brand, envLocal };
}

// CLI entry point (skipped when imported by tests).
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  const here = dirname(fileURLToPath(import.meta.url));
  try {
    applyBrand({
      brand: process.env.VITE_BRAND || "sovereign",
      root: resolve(here, ".."),
      allowPlaceholder: process.env.ALLOW_PLACEHOLDER_UPDATER_KEY === "1",
      log: console.log,
    });
  } catch (e) {
    if (e instanceof BrandBuildError) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }
}
