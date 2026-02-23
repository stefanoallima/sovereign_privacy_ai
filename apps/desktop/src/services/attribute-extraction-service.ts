/**
 * Attribute Extraction Service
 * Privacy-first approach: Extract categorical attributes locally instead of sending full text
 *
 * This service provides:
 * 1. Local extraction of tax-relevant attributes via Ollama
 * 2. Privacy-safe prompt generation from attributes
 * 3. Privacy-aware chat processing pipeline
 */

import { invoke } from '@tauri-apps/api/core';
import type { ContentMode } from './backend-routing-service';

// ==================== Types ====================

/**
 * Tax attributes extracted from user text
 * These are categorical values that cannot identify an individual
 */
export interface TaxAttributes {
  // Income & Employment
  income_bracket?: IncomeBracket;
  employment_type?: EmploymentType;
  has_multiple_employers?: boolean;
  receives_benefits?: boolean;

  // Housing & Assets
  housing_situation?: HousingSituation;
  has_mortgage?: boolean;
  has_savings_above_threshold?: boolean; // >€57k (Box 3 threshold)
  has_investments?: boolean;

  // Family & Filing
  filing_status?: FilingStatus;
  has_dependents?: boolean;
  has_fiscal_partner?: boolean;

  // Special Situations
  has_30_percent_ruling?: boolean;
  is_entrepreneur?: boolean;
  has_foreign_income?: boolean;
  has_crypto_assets?: boolean;

  // Tax-specific
  relevant_boxes: string[]; // ["Box 1", "Box 3"]
  deduction_categories: string[]; // ["mortgage_interest", "healthcare"]
}

export type IncomeBracket =
  | 'Below20k'
  | 'Range20kTo40k'
  | 'Range40kTo70k'
  | 'Range70kTo100k'
  | 'Above100k'
  | 'Unknown';

export type EmploymentType =
  | 'Employee'
  | 'Freelancer'
  | 'Entrepreneur'
  | 'Director'
  | 'Retired'
  | 'Student'
  | 'Unemployed'
  | 'Mixed'
  | 'Unknown';

export type HousingSituation =
  | 'Owner'
  | 'Renter'
  | 'LivingWithParents'
  | 'SocialHousing'
  | 'Unknown';

export type FilingStatus =
  | 'Single'
  | 'Married'
  | 'RegisteredPartner'
  | 'Cohabiting'
  | 'Divorced'
  | 'Widowed'
  | 'Unknown';

/**
 * Response from attribute extraction
 */
export interface AttributeExtractionResponse {
  success: boolean;
  attributes?: TaxAttributes;
  error?: string;
}

/**
 * Response from privacy-safe prompt generation
 */
export interface PrivacySafePromptResponse {
  success: boolean;
  prompt?: string;
  question_only?: string;
  error?: string;
}

/**
 * Processed chat request ready for LLM
 */
export interface ProcessedChatRequest {
  /** The prompt to send to the LLM */
  prompt: string;
  /** Which backend to use */
  backend: string;
  /** Model to use */
  model?: string;
  /** Whether the request is safe to proceed */
  is_safe: boolean;
  /** Processing mode used */
  content_mode: ContentMode;
  /** Any info or warnings */
  info?: string;
  /** Number of attributes extracted (if attributes-only mode) */
  attributes_count?: number;
}

// ==================== API Functions ====================

/**
 * Extract tax attributes from user text using local Ollama
 * This is privacy-first: extracts categorical data locally without sending to cloud
 *
 * @param text The user's input text
 * @returns Extracted attributes or error
 */
export async function extractTaxAttributes(text: string): Promise<AttributeExtractionResponse> {
  return invoke('extract_tax_attributes', { text });
}

/**
 * Generate a privacy-safe prompt from pre-extracted attributes
 * Use this when you already have attributes and need a cloud-ready prompt
 *
 * @param attributes The extracted tax attributes
 * @param question The user's question
 * @returns Privacy-safe prompt or error
 */
export async function generatePrivacySafePrompt(
  attributes: TaxAttributes,
  question: string,
): Promise<PrivacySafePromptResponse> {
  return invoke('generate_privacy_safe_prompt', { attributes, question });
}

/**
 * Map a TypeScript Persona (camelCase) to the snake_case shape the Rust command expects.
 * Only the fields present in the Rust `Persona` struct are included; extra JS fields
 * (icon, knowledgeBaseIds, requiresPIIVault …) are dropped so Serde doesn't error.
 */
function toRustPersona(persona: any): Record<string, unknown> {
  return {
    id: persona.id ?? '',
    name: persona.name ?? '',
    description: persona.description ?? '',
    system_prompt: persona.system_prompt ?? persona.systemPrompt ?? '',
    voice_id: persona.voice_id ?? persona.voiceId ?? '',
    preferred_model_id: persona.preferred_model_id ?? persona.preferredModelId ?? '',
    temperature: persona.temperature ?? 0.7,
    max_tokens: persona.max_tokens ?? persona.maxTokens ?? 2000,
    is_built_in: persona.is_built_in ?? persona.isBuiltIn ?? false,
    created_at: persona.created_at ?? persona.createdAt?.toISOString?.() ?? new Date().toISOString(),
    updated_at: persona.updated_at ?? persona.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    enable_local_anonymizer: persona.enable_local_anonymizer ?? false,
    preferred_backend: persona.preferred_backend ?? 'nebius',
    anonymization_mode: persona.anonymization_mode ?? 'none',
    local_ollama_model: persona.local_ollama_model ?? null,
  };
}

/**
 * Process a chat message with privacy-first routing
 * This is the main entry point for privacy-aware chat
 *
 * @param text The user's full message
 * @param persona The persona configuration
 * @returns Processed request ready for LLM
 */
export async function processChatWithPrivacy(
  text: string,
  persona: any,
): Promise<ProcessedChatRequest> {
  return invoke('process_chat_with_privacy', { text, persona: toRustPersona(persona) });
}

/**
 * Extract just the question from user text (strips context/PII)
 *
 * @param text The user's full message
 * @returns Just the question portion
 */
export async function extractQuestion(text: string): Promise<string> {
  return invoke('extract_question', { text });
}

// ==================== Helper Functions ====================

/**
 * Check if extraction was successful
 */
export function isExtractionSuccessful(response: AttributeExtractionResponse): boolean {
  return response.success && response.attributes !== undefined;
}

/**
 * Count how many attributes were extracted
 */
export function countExtractedAttributes(attributes: TaxAttributes): number {
  let count = 0;

  if (attributes.income_bracket) count++;
  if (attributes.employment_type) count++;
  if (attributes.has_multiple_employers !== undefined) count++;
  if (attributes.receives_benefits !== undefined) count++;
  if (attributes.housing_situation) count++;
  if (attributes.has_mortgage !== undefined) count++;
  if (attributes.has_savings_above_threshold !== undefined) count++;
  if (attributes.has_investments !== undefined) count++;
  if (attributes.filing_status) count++;
  if (attributes.has_dependents !== undefined) count++;
  if (attributes.has_fiscal_partner !== undefined) count++;
  if (attributes.has_30_percent_ruling !== undefined) count++;
  if (attributes.is_entrepreneur !== undefined) count++;
  if (attributes.has_foreign_income !== undefined) count++;
  if (attributes.has_crypto_assets !== undefined) count++;

  count += attributes.relevant_boxes?.length || 0;
  count += attributes.deduction_categories?.length || 0;

  return count;
}

/**
 * Get human-readable summary of extracted attributes
 */
export function getAttributesSummary(attributes: TaxAttributes): string {
  const parts: string[] = [];

  if (attributes.income_bracket && attributes.income_bracket !== 'Unknown') {
    parts.push(`Income: ${formatIncomeBracket(attributes.income_bracket)}`);
  }
  if (attributes.employment_type && attributes.employment_type !== 'Unknown') {
    parts.push(`Employment: ${attributes.employment_type}`);
  }
  if (attributes.housing_situation && attributes.housing_situation !== 'Unknown') {
    parts.push(`Housing: ${attributes.housing_situation}`);
  }
  if (attributes.filing_status && attributes.filing_status !== 'Unknown') {
    parts.push(`Status: ${attributes.filing_status}`);
  }
  if (attributes.has_30_percent_ruling) {
    parts.push('30% Ruling');
  }
  if (attributes.is_entrepreneur) {
    parts.push('Entrepreneur/ZZP');
  }
  if (attributes.relevant_boxes?.length > 0) {
    parts.push(`Tax Boxes: ${attributes.relevant_boxes.join(', ')}`);
  }

  return parts.length > 0 ? parts.join(' | ') : 'No attributes extracted';
}

/**
 * Format income bracket for display
 */
export function formatIncomeBracket(bracket: IncomeBracket): string {
  switch (bracket) {
    case 'Below20k':
      return '< €20k';
    case 'Range20kTo40k':
      return '€20k - €40k';
    case 'Range40kTo70k':
      return '€40k - €70k';
    case 'Range70kTo100k':
      return '€70k - €100k';
    case 'Above100k':
      return '> €100k';
    default:
      return 'Unknown';
  }
}

/**
 * Check if processed request is safe to proceed
 */
export function canProceed(request: ProcessedChatRequest): boolean {
  return request.is_safe;
}

/**
 * Check if request uses attributes-only mode
 */
export function isAttributesOnlyMode(request: ProcessedChatRequest): boolean {
  return request.content_mode === 'attributes_only';
}

/**
 * Get privacy indicator for processed request
 */
export function getPrivacyIndicator(request: ProcessedChatRequest): {
  icon: string;
  label: string;
  description: string;
} {
  if (!request.is_safe) {
    return {
      icon: '🚫',
      label: 'Blocked',
      description: request.info || 'Request cannot proceed',
    };
  }

  if (request.content_mode === 'attributes_only') {
    return {
      icon: '🔒',
      label: 'Max Privacy',
      description: `${request.attributes_count || 0} attributes extracted, no full text sent`,
    };
  }

  if (request.backend === 'ollama') {
    return {
      icon: '🔒',
      label: 'Local Only',
      description: 'All processing done locally',
    };
  }

  return {
    icon: '⚡',
    label: 'Standard',
    description: 'Full text processing via cloud',
  };
}

// ==================== Attribute Display Constants ====================

export const INCOME_BRACKET_LABELS: Record<IncomeBracket, string> = {
  Below20k: 'Below €20,000',
  Range20kTo40k: '€20,000 - €40,000',
  Range40kTo70k: '€40,000 - €70,000',
  Range70kTo100k: '€70,000 - €100,000',
  Above100k: 'Above €100,000',
  Unknown: 'Unknown',
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  Employee: 'Employee',
  Freelancer: 'Freelancer',
  Entrepreneur: 'Entrepreneur (ZZP/Eenmanszaak)',
  Director: 'Director (DGA)',
  Retired: 'Retired',
  Student: 'Student',
  Unemployed: 'Unemployed',
  Mixed: 'Mixed',
  Unknown: 'Unknown',
};

export const HOUSING_SITUATION_LABELS: Record<HousingSituation, string> = {
  Owner: 'Homeowner',
  Renter: 'Renter',
  LivingWithParents: 'Living with Parents',
  SocialHousing: 'Social Housing',
  Unknown: 'Unknown',
};

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  Single: 'Single',
  Married: 'Married',
  RegisteredPartner: 'Registered Partner',
  Cohabiting: 'Cohabiting',
  Divorced: 'Divorced',
  Widowed: 'Widowed',
  Unknown: 'Unknown',
};

/**
 * Dutch tax boxes explanation
 */
export const TAX_BOX_INFO: Record<string, { label: string; description: string }> = {
  'Box 1': {
    label: 'Box 1 - Income from work and home',
    description:
      'Salary, freelance income, pension, social benefits, and owner-occupied home (eigenwoningforfait)',
  },
  'Box 2': {
    label: 'Box 2 - Substantial shareholding',
    description: 'Income from substantial shareholding (> 5% of shares in a company)',
  },
  'Box 3': {
    label: 'Box 3 - Savings and investments',
    description: 'Wealth tax on savings, investments, and second properties above €57,000 threshold',
  },
};
