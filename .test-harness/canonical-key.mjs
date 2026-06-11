// Verified algorithm — ported verbatim into stores/userContext.ts.
export function normalizeRedactValue(value) {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}
export function canonicalRedactKey(value) {
  return normalizeRedactValue(value).toLowerCase();
}
