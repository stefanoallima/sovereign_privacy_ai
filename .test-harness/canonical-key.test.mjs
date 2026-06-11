// RED→GREEN harness for the pure PII canonicalization logic that decides
// "same value → same token". Verifies the algorithm in isolation (the project
// has no TS test runner); the verified functions are then ported verbatim into
// stores/userContext.ts.
import { canonicalRedactKey, normalizeRedactValue } from './canonical-key.mjs';
import assert from 'node:assert/strict';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

// --- canonicalRedactKey: the dedup key (case/whitespace/unicode-insensitive) ---
t('collapses internal whitespace (PDF double-space)', () => {
  assert.equal(canonicalRedactKey('Mario  Rossi'), canonicalRedactKey('Mario Rossi'));
});
t('treats newline/tab between words as a single space', () => {
  assert.equal(canonicalRedactKey('Mario\nRossi'), 'mario rossi');
  assert.equal(canonicalRedactKey('Mario\tRossi'), 'mario rossi');
});
t('trims and case-folds', () => {
  assert.equal(canonicalRedactKey('  MARIO ROSSI  '), 'mario rossi');
});
t('reconciles Unicode NFC vs NFD for accented Italian names', () => {
  const nfc = 'Niccolò';        // "Niccolò" precomposed
  const nfd = 'Niccolò';       // "Niccolo" + combining grave
  assert.notEqual(nfc, nfd);          // genuinely different code points
  assert.equal(canonicalRedactKey(nfc), canonicalRedactKey(nfd));
});

// --- normalizeRedactValue: canonical STORED form (preserves display casing) ---
t('normalizes stored value but preserves original casing', () => {
  assert.equal(normalizeRedactValue('  Mario  Rossi  '), 'Mario Rossi');
  assert.equal(normalizeRedactValue('MARIO ROSSI'), 'MARIO ROSSI');
});
t('canonical key of a normalized value is stable', () => {
  const v = normalizeRedactValue('Mario\n Rossi');
  assert.equal(v, 'Mario Rossi');
  assert.equal(canonicalRedactKey(v), 'mario rossi');
});

console.log(`\n${n} passed`);
