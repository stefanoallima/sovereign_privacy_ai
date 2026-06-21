export type Brand = "sovereign" | "normattiva";

export const BRAND: Brand =
  (import.meta.env.VITE_BRAND as Brand) || "sovereign";

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
