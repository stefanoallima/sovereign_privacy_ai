/**
 * Shared constants, helpers, and Tauri-invoke wrappers used by both
 * Sovereign and Normattiva builds.
 *
 * Per-brand data (BACKEND_PRIVACY_INFO entries, BACKEND_OPTIONS, persona
 * configs, prompts) lives in `./sovereign.ts` and `./normattiva.ts`. This
 * file holds everything else — the brand-agnostic privacy helpers, the
 * API functions that hit the Rust backend, and the metadata for
 * anonymization modes / content modes that don't differ between brands.
 */

import { invoke } from "@tauri-apps/api/core";

import type {
  AnonymizationMode,
  BackendConfigValidation,
  BackendDecision,
  BackendPrivacy,
  ContentMode,
  PersonaLLMConfig,
  PreferredBackend,
} from "./types";

/**
 * Display labels for the 3 anonymization modes. Brand-agnostic — both
 * Sovereign and Normattiva describe these the same way to the user.
 */
export const ANONYMIZATION_MODE_INFO = {
  none: {
    label: "No anonymization",
    description: "Send data as-is without anonymization",
  },
  optional: {
    label: "Optional anonymization",
    description: "Anonymize if possible, continue if fails",
  },
  required: {
    label: "Required anonymization",
    description: "Fail request if anonymization fails",
  },
} as const;

// ==================== Fallback (used by getBackendPrivacy) ====================

/**
 * Generic "cloud" privacy object returned by `getBackendPrivacy` when the
 * requested backend is not in this build's BACKEND_PRIVACY_INFO. This
 * happens when a legacy persona's `preferred_backend` is from a different
 * build (e.g., a Sovereign user with `preferred_backend: "normattiva"`
 * saved before the Rust validator started rejecting it).
 */
export const FALLBACK_CLOUD_PRIVACY: BackendPrivacy = {
  level: "low",
  emoji: "☁️",
  description: "Cloud",
  sendsToCloud: true,
  localProcessing: false,
};

// ==================== Tauri API Functions ====================

/**
 * Make a routing decision for a persona
 * Determines which backend should be used based on persona configuration
 */
export async function makeBackendRoutingDecision(persona: any): Promise<BackendDecision> {
  return invoke("make_backend_routing_decision", { persona });
}

/**
 * Validate persona LLM backend configuration
 * Checks for consistency and availability before saving
 */
export async function validatePersonaBackendConfig(
  preferred_backend: PreferredBackend,
  enable_local_anonymizer: boolean,
  anonymization_mode: AnonymizationMode,
  local_ollama_model?: string,
): Promise<BackendConfigValidation> {
  return invoke("validate_persona_backend_config", {
    preferred_backend,
    enable_local_anonymizer,
    anonymization_mode,
    local_ollama_model,
  });
}

/**
 * Check if Ollama service is available
 */
export async function checkOllamaAvailability(): Promise<boolean> {
  return invoke("check_ollama_availability");
}

/**
 * Get list of available Ollama models
 */
export async function getAvailableOllamaModels(): Promise<string[]> {
  return invoke("get_available_ollama_models");
}

// ==================== Privacy-Helper Wrappers ====================

/**
 * Look up privacy info for a backend. `BACKEND_PRIVACY_INFO` is injected
 * by the entry point (../backend-routing-service.ts) so this module
 * doesn't need to know which build it's in.
 */
export function lookupBackendPrivacy(
  backend: PreferredBackend,
  BACKEND_PRIVACY_INFO: Record<PreferredBackend, BackendPrivacy>,
): BackendPrivacy {
  return BACKEND_PRIVACY_INFO[backend] ?? FALLBACK_CLOUD_PRIVACY;
}

/**
 * Get privacy indicator emoji and description
 */
export function getPrivacyIndicator(
  backend: PreferredBackend,
  BACKEND_PRIVACY_INFO: Record<PreferredBackend, BackendPrivacy>,
): {
  emoji: string;
  description: string;
} {
  const privacy = lookupBackendPrivacy(backend, BACKEND_PRIVACY_INFO);
  return {
    emoji: privacy.emoji,
    description: privacy.description,
  };
}

/**
 * Check if backend requires local processing
 */
export function requiresLocalProcessing(
  backend: PreferredBackend,
  BACKEND_PRIVACY_INFO: Record<PreferredBackend, BackendPrivacy>,
): boolean {
  return lookupBackendPrivacy(backend, BACKEND_PRIVACY_INFO).localProcessing;
}

/**
 * Check if backend sends data to cloud
 */
export function sendsToCloud(
  backend: PreferredBackend,
  BACKEND_PRIVACY_INFO: Record<PreferredBackend, BackendPrivacy>,
): boolean {
  return lookupBackendPrivacy(backend, BACKEND_PRIVACY_INFO).sendsToCloud;
}

/**
 * Get validation errors for a configuration
 */
export async function getConfigurationErrors(config: PersonaLLMConfig): Promise<string[]> {
  const validation = await validatePersonaBackendConfig(
    config.preferred_backend,
    config.enable_local_anonymizer,
    config.anonymization_mode,
    config.local_ollama_model,
  );
  return validation.errors;
}

/**
 * Get validation warnings for a configuration
 */
export async function getConfigurationWarnings(config: PersonaLLMConfig): Promise<string[]> {
  const validation = await validatePersonaBackendConfig(
    config.preferred_backend,
    config.enable_local_anonymizer,
    config.anonymization_mode,
    config.local_ollama_model,
  );
  return validation.warnings;
}

/**
 * Check if configuration is valid
 */
export async function isConfigurationValid(config: PersonaLLMConfig): Promise<boolean> {
  const validation = await validatePersonaBackendConfig(
    config.preferred_backend,
    config.enable_local_anonymizer,
    config.anonymization_mode,
    config.local_ollama_model,
  );
  return validation.is_valid;
}

// ==================== Privacy-First Helper Functions ====================

/**
 * Check if a backend decision indicates a blocked request
 */
export function isRequestBlocked(decision: BackendDecision): boolean {
  return !decision.is_safe || decision.content_mode === "blocked";
}

/**
 * Check if attributes-only mode is required
 */
export function requiresAttributesOnly(decision: BackendDecision): boolean {
  return decision.content_mode === "attributes_only";
}

/**
 * Check if a fallback occurred
 */
export function hadFallback(decision: BackendDecision): boolean {
  return decision.fallback_event !== undefined && decision.fallback_event !== null;
}

/**
 * Get user-friendly explanation of the routing decision
 */
export function getDecisionExplanation(decision: BackendDecision): string {
  if (!decision.is_safe) {
    return `Request blocked: ${decision.reason}`;
  }

  if (decision.content_mode === "attributes_only") {
    return "Privacy-first mode: Only categorical attributes will be sent to cloud (no full text)";
  }

  if (decision.anonymize) {
    return "Hybrid mode: Text will be anonymized locally before sending to cloud";
  }

  if (decision.backend === "ollama") {
    return "Local processing: All data stays on your machine";
  }

  return "Direct cloud: Standard processing via Nebius API";
}

/**
 * Get privacy badge info for UI display
 */
export function getPrivacyBadge(decision: BackendDecision): {
  color: "green" | "blue" | "yellow" | "red";
  label: string;
  icon: string;
} {
  if (!decision.is_safe) {
    return { color: "red", label: "Blocked", icon: "🚫" };
  }

  if (decision.content_mode === "attributes_only") {
    return { color: "green", label: "Max Privacy", icon: "🔒" };
  }

  if (decision.backend === "ollama") {
    return { color: "green", label: "Local Only", icon: "🔒" };
  }

  if (decision.anonymize) {
    return { color: "blue", label: "Anonymized", icon: "🔐" };
  }

  return { color: "yellow", label: "Standard", icon: "⚡" };
}

/**
 * Format config for display
 */
export function formatConfigForDisplay(
  config: PersonaLLMConfig,
  BACKEND_PRIVACY_INFO: Record<PreferredBackend, BackendPrivacy>,
): string {
  const privacy = lookupBackendPrivacy(config.preferred_backend, BACKEND_PRIVACY_INFO);
  return `${privacy.emoji} ${config.preferred_backend}`;
}

/**
 * Content mode descriptions for users
 */
export const CONTENT_MODE_INFO: Record<ContentMode, { label: string; description: string }> = {
  full_text: {
    label: "Full Text",
    description: "Complete message sent (may be anonymized)",
  },
  attributes_only: {
    label: "Attributes Only",
    description: "Only categorical attributes extracted locally - maximum privacy",
  },
  blocked: {
    label: "Blocked",
    description: "Request cannot proceed due to privacy requirements",
  },
};
