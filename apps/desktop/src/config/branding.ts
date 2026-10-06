export type Brand = "sovereign" | "normattiva";

/**
 * Resolve the build brand from a raw VITE_BRAND value. Anything that isn't a known brand
 * falls back to sovereign: an unvalidated value (e.g. a typo) would leave BRAND outside
 * the known set, and every `BRAND_DEFAULTS[BRAND]` lookup would then be undefined and
 * crash the UI at render time.
 */
export function resolveBrand(raw: unknown): Brand {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "normattiva" || v === "sovereign") return v;
  if (v !== "") {
    console.warn(`Unknown VITE_BRAND "${String(raw)}"; falling back to "sovereign".`);
  }
  return "sovereign";
}

export const BRAND: Brand = resolveBrand(import.meta.env.VITE_BRAND);

export const IS_NORMATTIVA = BRAND === "normattiva";
export const IS_SOVEREIGN = BRAND === "sovereign";

export const BRAND_NAME = IS_NORMATTIVA ? "Normattiva" : "Sovereign AI";
export const BRAND_TAGLINE = IS_NORMATTIVA
  ? "Consulenza legale italiana con privacy locale"
  : "Private AI for sensitive life decisions";
export const BRAND_COLOR_ACCENT = IS_NORMATTIVA ? "#0c2c54" : "#3b82f6";
export const BRAND_INSTALL_DIR = IS_NORMATTIVA ? "Normattiva" : "Sovereign AI";
export const BRAND_IDENTIFIER = IS_NORMATTIVA
  ? "it.normattiva.app"
  : "com.privateassistant.app";
