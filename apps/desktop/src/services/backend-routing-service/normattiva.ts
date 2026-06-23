/**
 * Normattiva build — per-brand backend data.
 *
 * This file is the tree-shakeable Normattiva variant. The Sovereign build
 * never imports it (Vite inlines `BRAND === 'normattiva'` to a literal and
 * Rollup drops the unused import), so Normattiva-specific personas,
 * prompts, and BACKEND_OPTIONS entries never reach Sovereign users.
 *
 * Note: BACKEND_PRIVACY_INFO has fallback "cloud" entries for the 3
 * Sovereign backends (nebius, ollama, hybrid) so the wider
 * `Record<PreferredBackend, BackendPrivacy>` type at the entry point is
 * satisfied without a cast. These fallback entries are never reached in
 * a Normattiva build because the Rust validator rejects them as
 * `preferred_backend` values for this brand.
 */

import type {
  BackendPrivacy,
  PersonaLLMConfig,
  PreferredBackend,
} from "./types";

/**
 * Normattiva backends: only the `normattiva` (Italian legal cloud) backend
 * is shipped. The other 3 keys use the generic "cloud" fallback shape.
 */
export const BACKEND_PRIVACY_INFO: Record<PreferredBackend, BackendPrivacy> = {
  nebius: {
    level: "low",
    emoji: "☁️",
    description: "Cloud",
    sendsToCloud: true,
    localProcessing: false,
  },
  ollama: {
    level: "low",
    emoji: "☁️",
    description: "Cloud",
    sendsToCloud: true,
    localProcessing: false,
  },
  hybrid: {
    level: "low",
    emoji: "☁️",
    description: "Cloud",
    sendsToCloud: true,
    localProcessing: false,
  },
  normattiva: {
    level: "low",
    emoji: "⚖️",
    description: "Normattiva NLP Cloud - Italian legal domain",
    sendsToCloud: true,
    localProcessing: false,
  },
};

/**
 * Normattiva has exactly one backend option: the legal-domain cloud.
 * The UI gating in PrivacySettings.tsx / ModelSettings already hides
 * the Sovereign backends, so this list is the canonical per-brand source.
 */
export const BACKEND_OPTIONS: ReadonlyArray<{
  value: PreferredBackend;
  label: string;
  description: string;
  privacy: string;
  speed: string;
}> = [
  {
    value: "normattiva",
    label: "Normattiva NLP",
    description: "Italian legal domain via Normattiva cloud API",
    privacy: "Low",
    speed: "Fast",
  },
];

/**
 * Get recommended backend configuration for a use case (Normattiva defaults).
 * All use cases route to the same single legal-domain backend; the
 * `useCase` parameter is preserved for API stability with the Sovereign
 * build and future Normattiva variants (e.g., local-Italian-LLM mode).
 */
export function getRecommendedConfig(
  _useCase: "privacy" | "speed" | "balanced",
): PersonaLLMConfig {
  return {
    enable_local_anonymizer: true,
    preferred_backend: "normattiva",
    anonymization_mode: "required",
  };
}

/**
 * Create default configuration (Normattiva default: legal cloud + required
 * anonymization — the legal-advisor-it persona's privacy contract).
 */
export function getDefaultConfig(): PersonaLLMConfig {
  return {
    enable_local_anonymizer: true,
    preferred_backend: "normattiva",
    anonymization_mode: "required",
  };
}

/**
 * Get backend configuration for built-in Normattiva personas.
 * Currently: only `legal-advisor-it`.
 */
export function getBuiltInPersonaConfig(personaName: string): PersonaLLMConfig | null {
  const configs: Record<string, PersonaLLMConfig> = {
    "legal-advisor-it": {
      enable_local_anonymizer: true,
      preferred_backend: "normattiva",
      anonymization_mode: "required",
    },
  };

  return configs[personaName] || null;
}

/**
 * System prompts for built-in Normattiva personas.
 * The legal-advisor-it prompt is in Italian — see
 * `apps/desktop/src/stores/personas.ts` for the canonical copy (kept in
 * sync with the persona store so the UI and the routing service agree).
 */
export const BUILT_IN_PERSONA_PROMPTS: Record<string, string> = {
  "legal-advisor-it": `Sei un assistente legale italiano specializzato in diritto civile, penale e amministrativo. Il tuo compito è aiutare professionisti forensi, paralegali e cittadini a navigare la legislazione italiana.

Linee guida:
1. Rispondi sempre in italiano, con linguaggio giuridico appropriato ma comprensibile.
2. Cita le fonti normative pertinenti (codice civile, codice penale, leggi speciali) usando il formato: "c.c. art. 1456", "c.p. art. 575", ecc.
3. Quando possibile, rimanda all'articolo specifico su codicecivile.ai tramite i marker di citazione.
4. Distingui chiaramente tra dottrina, giurisprudenza e testo normativo.
5. Raccomanda sempre il consulto con un avvocato abilitato per questioni concrete.

Privacy:
- L'input dell'utente viene pseudo-anonimizzato localmente prima di essere inviato al cloud (PII come nome, cognome, codice fiscale, IBAN vengono sostituiti con [PERSON_1], [IBAN_2], ecc.).
- Solo attributi categorici (tipo di contratto, importo, giurisdizione) sono analizzati in chiaro.
- Il vault PII locale (ChaCha20-Poly1305) mantiene il mapping per la re-idratazione della risposta.`,
};
