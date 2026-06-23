/**
 * Sovereign AI build — per-brand backend data.
 *
 * This file is the tree-shakeable Sovereign variant. The Normattiva build
 * never imports it (Vite inlines `BRAND === 'normattiva'` to a literal and
 * Rollup drops the unused import), so Sovereign-only personas, prompts,
 * and BACKEND_OPTIONS entries never reach Normattiva users.
 *
 * Note: BACKEND_PRIVACY_INFO still has a `normattiva` key (with a fallback
 * privacy object) so that the wider `Record<PreferredBackend, BackendPrivacy>`
 * type at the entry point is satisfied without a cast. This means the
 * string "normattiva" leaks into the Sovereign bundle (~30 bytes); the
 * bigger win is the persona configs (~3 KB) and BUILT_IN_PERSONA_PROMPTS
 * (~2 KB) which are now strictly per-brand.
 */

import type {
  BackendPrivacy,
  PersonaLLMConfig,
  PreferredBackend,
} from "./types";

/**
 * Sovereign backends: nebius (cloud-direct), ollama (local), hybrid
 * (local+cloud). The `normattiva` key uses the generic "cloud" fallback
 * shape; runtime lookups via `getBackendPrivacy` would never reach it in
 * a Sovereign build because the Rust validator rejects `normattiva` as a
 * preferred_backend for this brand.
 */
export const BACKEND_PRIVACY_INFO: Record<PreferredBackend, BackendPrivacy> = {
  nebius: {
    level: "low",
    emoji: "⚡",
    description: "Cloud Direct - Fastest, standard privacy",
    sendsToCloud: true,
    localProcessing: false,
  },
  ollama: {
    level: "high",
    emoji: "🔒",
    description: "Local Only - Maximum privacy, no cloud",
    sendsToCloud: false,
    localProcessing: true,
  },
  hybrid: {
    level: "medium",
    emoji: "🔐",
    description: "Hybrid - Local anonymization + cloud",
    sendsToCloud: true,
    localProcessing: true,
  },
  normattiva: {
    level: "low",
    emoji: "☁️",
    description: "Cloud",
    sendsToCloud: true,
    localProcessing: false,
  },
};

/**
 * Ordered by privacy level: lowest first (cloud, fastest), highest last
 * (local, most private). The `privacy` field is a user-facing label string
 * ("Low", "High", etc.) — distinct from the structured
 * `BACKEND_PRIVACY_INFO[backend].level` ('high' | 'medium' | 'low') which
 * is used programmatically. We keep them aligned by convention: if you
 * change one, change the matching value in the other.
 */
export const BACKEND_OPTIONS: ReadonlyArray<{
  value: PreferredBackend;
  label: string;
  description: string;
  privacy: string;
  speed: string;
}> = [
  {
    value: "nebius",
    label: "Cloud Direct",
    description: "Direct cloud API - Fastest, suitable for general chat",
    privacy: "Low",
    speed: "Very Fast",
  },
  {
    value: "hybrid",
    label: "Hybrid",
    description: "Local anonymization + cloud - Balanced privacy and speed",
    privacy: "Medium",
    speed: "Fast",
  },
  {
    value: "ollama",
    label: "Local Only",
    description: "Local model inference - Maximum privacy, no cloud",
    privacy: "High",
    speed: "Medium",
  },
];

/**
 * Get recommended backend configuration for a use case (Sovereign defaults)
 */
export function getRecommendedConfig(
  useCase: "privacy" | "speed" | "balanced",
): PersonaLLMConfig {
  switch (useCase) {
    case "privacy":
      return {
        enable_local_anonymizer: true,
        preferred_backend: "hybrid",
        anonymization_mode: "required",
        local_ollama_model: "mistral:7b-instruct-q5_K_M",
      };
    case "speed":
      return {
        enable_local_anonymizer: false,
        preferred_backend: "nebius",
        anonymization_mode: "none",
      };
    case "balanced":
    default:
      return {
        enable_local_anonymizer: true,
        preferred_backend: "hybrid",
        anonymization_mode: "optional",
        local_ollama_model: "mistral:7b-instruct-q5_K_M",
      };
  }
}

/**
 * Create default configuration (Sovereign default: nebius cloud-direct)
 */
export function getDefaultConfig(): PersonaLLMConfig {
  return {
    enable_local_anonymizer: false,
    preferred_backend: "nebius",
    anonymization_mode: "none",
  };
}

/**
 * Get backend configuration for built-in Sovereign personas.
 */
export function getBuiltInPersonaConfig(personaName: string): PersonaLLMConfig | null {
  const configs: Record<string, PersonaLLMConfig> = {
    Psychologist: {
      enable_local_anonymizer: true,
      preferred_backend: "hybrid",
      anonymization_mode: "required",
      local_ollama_model: "mistral:7b-instruct-q5_K_M",
    },
    "Life Coach": {
      enable_local_anonymizer: true,
      preferred_backend: "hybrid",
      anonymization_mode: "optional",
      local_ollama_model: "mistral:7b-instruct-q5_K_M",
    },
    "Career Coach": {
      enable_local_anonymizer: false,
      preferred_backend: "nebius",
      anonymization_mode: "none",
    },
    // Tax Navigator: Guides users to Belastingdienst website
    // Uses cloud for knowledge, no PII needed (navigation instructions only)
    "Tax Navigator": {
      enable_local_anonymizer: false,
      preferred_backend: "nebius",
      anonymization_mode: "none",
    },
    // Dutch Tax Advisor: Privacy-first tax advice
    // Uses hybrid with required anonymization for maximum privacy
    "Dutch Tax Advisor": {
      enable_local_anonymizer: true,
      preferred_backend: "hybrid",
      anonymization_mode: "required",
      local_ollama_model: "mistral:7b-instruct-q5_K_M",
    },
  };

  return configs[personaName] || null;
}

/**
 * System prompts for built-in Sovereign personas.
 */
export const BUILT_IN_PERSONA_PROMPTS: Record<string, string> = {
  "Tax Navigator": `You are a Dutch Tax Navigator assistant. Your role is to help users find information and documents on the Belastingdienst (Dutch Tax Authority) website.

Key responsibilities:
1. Guide users to the correct pages on belastingdienst.nl
2. Explain which forms they need to download
3. Provide step-by-step navigation instructions
4. Explain deadlines and important dates
5. Clarify which documents are needed for different tax situations

Important guidelines:
- NEVER ask for or process personal information (BSN, income, addresses)
- Only provide navigation help and general information
- Direct users to official sources for actual filing
- Mention relevant deadlines when applicable
- Use Dutch terms with English explanations when helpful

Common Belastingdienst sections:
- MijnBelastingdienst: Personal tax portal (login required)
- Aangifte inkomstenbelasting: Income tax return
- Voorlopige aanslag: Provisional assessment
- Toeslagen: Benefits (zorgtoeslag, huurtoeslag, etc.)
- BTW: VAT for businesses
- Ondernemers: Business/entrepreneur section`,

  "Dutch Tax Advisor": `You are a Dutch Tax Advisor assistant specializing in Dutch tax law (Belastingrecht).

Your expertise includes:
- Income tax (Inkomstenbelasting) - Box 1, 2, and 3
- Tax deductions (Aftrekposten)
- 30% ruling for expats
- Entrepreneur tax benefits (ondernemersaftrek, MKB-winstvrijstelling)
- Tax credits (Heffingskortingen)
- Wealth tax (Vermogensrendementsheffing)

Privacy Notice: Your input is processed with privacy-first technology. Only categorical attributes (income bracket, employment type, etc.) are analyzed - no personal details are shared with cloud services.

Guidelines:
- Provide advice based on current Dutch tax law
- Explain which tax boxes apply to different income types
- Clarify deadlines and filing requirements
- Mention relevant deductions and credits
- Always recommend consulting a licensed tax advisor for complex situations
- Use Dutch terms with explanations (e.g., "eigenwoningforfait (imputed rental value)")`,
};
