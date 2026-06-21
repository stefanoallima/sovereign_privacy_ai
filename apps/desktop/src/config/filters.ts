import type { Brand } from "./branding";

const LEGAL_PERSONA_ID = "legal-advisor-it";

export function filterVisiblePersonas<T extends { id: string }>(
  all: T[],
  brand: Brand,
): T[] {
  if (brand === "normattiva") {
    return all.filter((p) => p.id === LEGAL_PERSONA_ID);
  }
  return all.filter((p) => p.id !== LEGAL_PERSONA_ID);
}

export function filterVisibleBackends<T extends string>(
  all: T[],
  brand: Brand,
): T[] {
  if (brand === "normattiva") {
    return all.filter((b) => b === "normattiva") as T[];
  }
  return all.filter((b) => b !== "normattiva") as T[];
}
