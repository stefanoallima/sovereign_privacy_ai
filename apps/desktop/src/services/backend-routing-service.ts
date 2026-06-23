/**
 * Backend Routing Service — Public API.
 *
 * Per-brand data (BACKEND_PRIVACY_INFO, BACKEND_OPTIONS, persona configs,
 * prompts, default/recommended configs) lives in the per-brand modules
 * `./backend-routing-service/sovereign.ts` and `./backend-routing-service/normattiva.ts`.
 *
 * The conditional `BRAND === 'normattiva'` here is a compile-time constant
 * because `BRAND` is set from `import.meta.env.VITE_BRAND`, which Vite
 * inlines to a literal at build time. Rollup then drops the unused
 * per-brand import, so the Sovereign bundle never contains the Normattiva
 * persona configs (and vice versa).
 *
 * Shared constants, helpers, and Tauri-invoke wrappers live in
 * `./backend-routing-service/shared.ts` and are imported by both builds.
 *
 * Types live in `./backend-routing-service/types.ts`.
 */

import { BRAND } from "@/config/branding";

import type {
  PersonaLLMConfig,
  PreferredBackend,
} from "./backend-routing-service/types";
import * as Sovereign from "./backend-routing-service/sovereign";
import * as Normattiva from "./backend-routing-service/normattiva";

// ==================== Re-exports ====================

// Types
export type {
  PreferredBackend,
  AnonymizationMode,
  ContentMode,
  BackendDecision,
  BackendConfigValidation,
  PrivacyLevel,
  BackendPrivacy,
  PersonaLLMConfig,
} from "./backend-routing-service/types";

// Shared constants, helpers, and Tauri-invoke wrappers
export {
  ANONYMIZATION_MODE_INFO,
  CONTENT_MODE_INFO,
  FALLBACK_CLOUD_PRIVACY,
  makeBackendRoutingDecision,
  validatePersonaBackendConfig,
  checkOllamaAvailability,
  getAvailableOllamaModels,
  getConfigurationErrors,
  getConfigurationWarnings,
  isConfigurationValid,
  isRequestBlocked,
  requiresAttributesOnly,
  hadFallback,
  getDecisionExplanation,
  getPrivacyBadge,
} from "./backend-routing-service/shared";

// ==================== Per-Brand Selection ====================
//
// Vite inlines `BRAND` to a string literal at build time, so the unused
// per-brand namespace import is dead-code-eliminated by Rollup.

const PER_BRAND = BRAND === "normattiva" ? Normattiva : Sovereign;

export const BACKEND_PRIVACY_INFO = PER_BRAND.BACKEND_PRIVACY_INFO;
export const BACKEND_OPTIONS = PER_BRAND.BACKEND_OPTIONS;
export const BUILT_IN_PERSONA_PROMPTS = PER_BRAND.BUILT_IN_PERSONA_PROMPTS;

export const getRecommendedConfig = PER_BRAND.getRecommendedConfig;
export const getDefaultConfig = PER_BRAND.getDefaultConfig;
export const getBuiltInPersonaConfig = PER_BRAND.getBuiltInPersonaConfig;

// ==================== Shared helpers that need the per-brand BACKEND_PRIVACY_INFO ====================

import {
  formatConfigForDisplay as _formatConfigForDisplay,
  getPrivacyIndicator as _getPrivacyIndicator,
  lookupBackendPrivacy as _lookupBackendPrivacy,
  requiresLocalProcessing as _requiresLocalProcessing,
  sendsToCloud as _sendsToCloud,
} from "./backend-routing-service/shared";

/**
 * Get privacy information for a backend type. Returns a generic "cloud"
 * fallback if the requested backend is not in this build's
 * BACKEND_PRIVACY_INFO (e.g., a Sovereign user with `preferred_backend:
 * "normattiva"` saved before the Rust validator started rejecting it).
 */
export function getBackendPrivacy(backend: PreferredBackend) {
  return _lookupBackendPrivacy(backend, BACKEND_PRIVACY_INFO);
}

export function getPrivacyIndicator(backend: PreferredBackend) {
  return _getPrivacyIndicator(backend, BACKEND_PRIVACY_INFO);
}

export function requiresLocalProcessing(backend: PreferredBackend) {
  return _requiresLocalProcessing(backend, BACKEND_PRIVACY_INFO);
}

export function sendsToCloud(backend: PreferredBackend) {
  return _sendsToCloud(backend, BACKEND_PRIVACY_INFO);
}

export function formatConfigForDisplay(config: PersonaLLMConfig) {
  return _formatConfigForDisplay(config, BACKEND_PRIVACY_INFO);
}
