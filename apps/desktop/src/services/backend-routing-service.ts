/**
 * Backend Routing Service
 * Type-safe TypeScript wrapper for persona LLM backend configuration
 */

import { invoke } from '@tauri-apps/api/core';

// ==================== Types ====================

export type PreferredBackend = 'nebius' | 'ollama' | 'hybrid';
export type AnonymizationMode = 'none' | 'optional' | 'required';

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
}

/**
 * Content processing mode for privacy
 */
export type ContentMode = 'full_text' | 'attributes_only' | 'blocked';

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
export type PrivacyLevel = 'high' | 'medium' | 'low';

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

// ==================== Constants ====================

export const BACKEND_PRIVACY_INFO: Record<PreferredBackend, BackendPrivacy> = {
  nebius: {
    level: 'low',
    emoji: '⚡',
    description: 'Cloud Direct - Fastest, standard privacy',
    sendsToCloud: true,
    localProcessing: false,
  },
  ollama: {
    level: 'high',
    emoji: '🔒',
    description: 'Local Only - Maximum privacy, no cloud',
    sendsToCloud: false,
    localProcessing: true,
  },
  hybrid: {
    level: 'medium',
    emoji: '🔐',
    description: 'Hybrid - Local anonymization + cloud',
    sendsToCloud: true,
    localProcessing: true,
  },
};

export const ANONYMIZATION_MODE_INFO = {
  none: {
    label: 'No anonymization',
    description: 'Send data as-is without anonymization',
  },
  optional: {
    label: 'Optional anonymization',
    description: 'Anonymize if possible, continue if fails',
  },
  required: {
    label: 'Required anonymization',
    description: 'Fail request if anonymization fails',
  },
};

export const BACKEND_OPTIONS = [
  {
    value: 'nebius' as PreferredBackend,
    label: 'Cloud Direct',
    description: 'Direct cloud API - Fastest, suitable for general chat',
    privacy: 'Standard',
    speed: 'Very Fast',
  },
  {
    value: 'ollama' as PreferredBackend,
    label: 'Local Only',
    description: 'Local model inference - Maximum privacy, no cloud',
    privacy: 'Maximum',
    speed: 'Medium',
  },
  {
    value: 'hybrid' as PreferredBackend,
    label: 'Hybrid',
    description: 'Local anonymization + cloud - Balanced privacy and speed',
    privacy: 'High',
    speed: 'Fast',
  },
];

// ==================== API Functions ====================

/**
 * Make a routing decision for a persona
 * Determines which backend should be used based on persona configuration
 */
export async function makeBackendRoutingDecision(persona: any): Promise<BackendDecision> {
  return invoke('make_backend_routing_decision', { persona });
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
  return invoke('validate_persona_backend_config', {
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
  return invoke('check_ollama_availability');
}

/**
 * Get list of available Ollama models
 */
export async function getAvailableOllamaModels(): Promise<string[]> {
  return invoke('get_available_ollama_models');
}

// ==================== Helper Functions ====================

/**
 * Get privacy information for a backend type
 */
export function getBackendPrivacy(backend: PreferredBackend): BackendPrivacy {
  return BACKEND_PRIVACY_INFO[backend];
}

/**
 * Get privacy indicator emoji and description
 */
export function getPrivacyIndicator(backend: PreferredBackend): {
  emoji: string;
  description: string;
} {
  const privacy = BACKEND_PRIVACY_INFO[backend];
  return {
    emoji: privacy.emoji,
    description: privacy.description,
  };
}

/**
 * Check if backend requires local processing
 */
export function requiresLocalProcessing(backend: PreferredBackend): boolean {
  return BACKEND_PRIVACY_INFO[backend].localProcessing;
}

/**
 * Check if backend sends data to cloud
 */
export function sendsToCloud(backend: PreferredBackend): boolean {
  return BACKEND_PRIVACY_INFO[backend].sendsToCloud;
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

/**
 * Get recommended backend configuration for a use case
 */
export function getRecommendedConfig(useCase: 'privacy' | 'speed' | 'balanced'): PersonaLLMConfig {
  switch (useCase) {
    case 'privacy':
      return {
        enable_local_anonymizer: true,
        preferred_backend: 'hybrid',
        anonymization_mode: 'required',
        local_ollama_model: 'mistral:7b-instruct-q5_K_M',
      };
    case 'speed':
      return {
        enable_local_anonymizer: false,
        preferred_backend: 'nebius',
        anonymization_mode: 'none',
      };
    case 'balanced':
    default:
      return {
        enable_local_anonymizer: true,
        preferred_backend: 'hybrid',
        anonymization_mode: 'optional',
        local_ollama_model: 'mistral:7b-instruct-q5_K_M',
      };
  }
}

/**
 * Get backend configuration for built-in personas
 */
export function getBuiltInPersonaConfig(personaName: string): PersonaLLMConfig | null {
  const configs: Record<string, PersonaLLMConfig> = {
    Psychologist: {
      enable_local_anonymizer: true,
      preferred_backend: 'hybrid',
      anonymization_mode: 'required',
      local_ollama_model: 'mistral:7b-instruct-q5_K_M',
    },
    'Life Coach': {
      enable_local_anonymizer: true,
      preferred_backend: 'hybrid',
      anonymization_mode: 'optional',
      local_ollama_model: 'mistral:7b-instruct-q5_K_M',
    },
    'Career Coach': {
      enable_local_anonymizer: false,
      preferred_backend: 'nebius',
      anonymization_mode: 'none',
    },
    // Tax Navigator: Guides users to Belastingdienst website
    // Uses cloud for knowledge, no PII needed (navigation instructions only)
    'Tax Navigator': {
      enable_local_anonymizer: false,
      preferred_backend: 'nebius',
      anonymization_mode: 'none',
    },
    // Dutch Tax Advisor: Privacy-first tax advice
    // Uses hybrid with required anonymization for maximum privacy
    'Dutch Tax Advisor': {
      enable_local_anonymizer: true,
      preferred_backend: 'hybrid',
      anonymization_mode: 'required',
      local_ollama_model: 'mistral:7b-instruct-q5_K_M',
    },
  };

  return configs[personaName] || null;
}

/**
 * System prompts for built-in personas
 */
export const BUILT_IN_PERSONA_PROMPTS: Record<string, string> = {
  'Tax Navigator': `You are a Dutch Tax Navigator assistant. Your role is to help users find information and documents on the Belastingdienst (Dutch Tax Authority) website.

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

  'Dutch Tax Advisor': `You are a Dutch Tax Advisor assistant specializing in Dutch tax law (Belastingrecht).

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

/**
 * Create default configuration
 */
export function getDefaultConfig(): PersonaLLMConfig {
  return {
    enable_local_anonymizer: false,
    preferred_backend: 'nebius',
    anonymization_mode: 'none',
  };
}

/**
 * Format config for display
 */
export function formatConfigForDisplay(config: PersonaLLMConfig): string {
  const privacy = BACKEND_PRIVACY_INFO[config.preferred_backend];
  const anonymization = ANONYMIZATION_MODE_INFO[config.anonymization_mode];

  return `${privacy.emoji} ${config.preferred_backend} - ${anonymization.label}`;
}

// ==================== Privacy-First Helper Functions ====================

/**
 * Check if a backend decision indicates a blocked request
 */
export function isRequestBlocked(decision: BackendDecision): boolean {
  return !decision.is_safe || decision.content_mode === 'blocked';
}

/**
 * Check if attributes-only mode is required
 */
export function requiresAttributesOnly(decision: BackendDecision): boolean {
  return decision.content_mode === 'attributes_only';
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

  if (decision.content_mode === 'attributes_only') {
    return 'Privacy-first mode: Only categorical attributes will be sent to cloud (no full text)';
  }

  if (decision.anonymize) {
    return 'Hybrid mode: Text will be anonymized locally before sending to cloud';
  }

  if (decision.backend === 'ollama') {
    return 'Local processing: All data stays on your machine';
  }

  return 'Direct cloud: Standard processing via Nebius API';
}

/**
 * Get privacy badge info for UI display
 */
export function getPrivacyBadge(decision: BackendDecision): {
  color: 'green' | 'blue' | 'yellow' | 'red';
  label: string;
  icon: string;
} {
  if (!decision.is_safe) {
    return { color: 'red', label: 'Blocked', icon: '🚫' };
  }

  if (decision.content_mode === 'attributes_only') {
    return { color: 'green', label: 'Max Privacy', icon: '🔒' };
  }

  if (decision.backend === 'ollama') {
    return { color: 'green', label: 'Local Only', icon: '🔒' };
  }

  if (decision.anonymize) {
    return { color: 'blue', label: 'Anonymized', icon: '🔐' };
  }

  return { color: 'yellow', label: 'Standard', icon: '⚡' };
}

/**
 * Content mode descriptions for users
 */
export const CONTENT_MODE_INFO: Record<ContentMode, { label: string; description: string }> = {
  full_text: {
    label: 'Full Text',
    description: 'Complete message sent (may be anonymized)',
  },
  attributes_only: {
    label: 'Attributes Only',
    description: 'Only categorical attributes extracted locally - maximum privacy',
  },
  blocked: {
    label: 'Blocked',
    description: 'Request cannot proceed due to privacy requirements',
  },
};
