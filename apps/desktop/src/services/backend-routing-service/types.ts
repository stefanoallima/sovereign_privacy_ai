/**
 * Shared types for backend routing.
 *
 * Both Sovereign and Normattiva use these types — they describe the full
 * `PreferredBackend` union (all 4 backends), even though any one build only
 * ships 3 (Sovereign) or 1 (Normattiva) of them. The per-brand modules
 * (`./sovereign.ts`, `./normattiva.ts`) export narrower `Record<...>` types
 * for their `BACKEND_PRIVACY_INFO`; the entry point (`../backend-routing-service.ts`)
 * widens those back to the full `Record<PreferredBackend, BackendPrivacy>`.
 */

export type PreferredBackend = "nebius" | "ollama" | "hybrid" | "normattiva";
export type AnonymizationMode = "none" | "optional" | "required";

/**
 * Persona configuration for LLM backend selection
 */
export interface PersonaLLMConfig {
  /** Whether to enable local PII anonymization */
  enable_local_anonymizer: boolean;
  /** Primary LLM backend service */
  preferred_backend: PreferredBackend;
  /** How strict anonymization should be */
  anonymization_mode: AnonymizationMode;
  /** Which Ollama model to use (if applicable) */
  local_ollama_model?: string;
  /** Whether to enable smart cloud delegation when local model is uncertain */
  enable_cloud_delegation?: boolean;
  /** Confidence threshold for cloud delegation (0.0-1.0, default 0.5) */
  cloud_delegation_threshold?: number;
}

/**
 * Content processing mode for privacy
 */
export type ContentMode = "full_text" | "attributes_only" | "blocked";

/**
 * Result of a backend routing decision
 */
export interface BackendDecision {
  /** Which backend will be used */
  backend: PreferredBackend;
  /** Whether PII will be anonymized */
  anonymize: boolean;
  /** Model identifier to use */
  model?: string;
  /** Reason for this decision */
  reason: string;
  /** How content should be processed (privacy-first) */
  content_mode: ContentMode;
  /** Description of any fallback that occurred */
  fallback_event?: string;
  /** Whether it's safe to proceed with this request */
  is_safe: boolean;
}

/**
 * Backend configuration validation result
 */
export interface BackendConfigValidation {
  /** Whether the configuration is valid */
  is_valid: boolean;
  /** List of configuration errors */
  errors: string[];
  /** List of configuration warnings */
  warnings: string[];
}

/**
 * Privacy level indicator
 */
export type PrivacyLevel = "high" | "medium" | "low";

/**
 * Privacy implications of backend choice
 */
export interface BackendPrivacy {
  /** Privacy level (high/medium/low) */
  level: PrivacyLevel;
  /** Emoji indicator */
  emoji: string;
  /** Description for users */
  description: string;
  /** Whether data sent to cloud */
  sendsToCloud: boolean;
  /** Whether local processing enabled */
  localProcessing: boolean;
}
