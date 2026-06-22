/**
 * Per-brand re-export for ModelSettings.
 *
 * Tree-shakeable: the Normattiva build never imports Sovereign.tsx, and the
 * Sovereign build never imports Normattiva.tsx. The bundler drops the
 * unused file, so the 749-line Sovereign component (with its Rust invoke
 * calls for download/management) is not shipped to Normattiva users.
 *
 * The selection uses VITE_BRAND (baked at build time by scripts/build-brand.mjs)
 * so this is a compile-time constant — the bundler inlines the chosen export.
 */

import { BRAND } from "@/config/branding";

import { ModelSettings as ModelSettingsSovereign } from "./Sovereign";
import { ModelSettings as ModelSettingsNormattiva } from "./Normattiva";

export const ModelSettings = BRAND === "normattiva" ? ModelSettingsNormattiva : ModelSettingsSovereign;
export default ModelSettings;
