/**
 * PII Management Service
 * Handles PII extraction, encryption, anonymization, and profile management
 */

import { invoke } from '@tauri-apps/api/core';

// ============ Ollama PII Extraction ============

export interface PIIExtraction {
  bsn?: string;
  name?: string;
  surname?: string;
  phone?: string;
  address?: string;
  email?: string;
  income?: string;
  confidence_scores: ConfidenceScores;
}

interface ConfidenceScores {
  bsn: number;
  name: number;
  surname: number;
  phone: number;
  address: number;
  email: number;
  income: number;
}

export async function extractPiiFromDocument(
  text: string
): Promise<PIIExtraction> {
  return invoke('extract_pii_from_document', { text });
}

export async function checkOllamaAvailability(): Promise<boolean> {
  return invoke('ollama_is_available');
}

export async function initializeOllama(): Promise<void> {
  return invoke('ollama_initialize');
}

// ============ Anonymization ============

export interface AnonymizationResult {
  anonymized_text: string;
  mappings: PiiMapping[];
}

export interface PiiMapping {
  id: string;
  conversation_id: string;
  pii_category: string;
  placeholder: string;
  is_encrypted: boolean;
  created_at: string;
}

export async function anonymizeText(
  text: string,
  piiExtraction: PIIExtraction,
  conversationId: string
): Promise<AnonymizationResult> {
  return invoke('anonymize_text', {
    text,
    pii_extraction: piiExtraction,
    conversation_id: conversationId,
  });
}

export interface ValidationResult {
  is_safe: boolean;
  found_patterns: string[];
}

export async function validateAnonymization(text: string): Promise<ValidationResult> {
  return invoke('validate_anonymization', { text });
}

// ============ Document Parsing ============

export interface ParsedDocument {
  filename: string;
  file_type: string;
  text_content: string;
  page_count: number;
  document_type?: string;
}

export async function parseDocument(filePath: string): Promise<ParsedDocument> {
  return invoke('parse_document', { file_path: filePath });
}

// ============ Entity Resolution ============

export interface Person {
  id: string;
  household_id: string;
  name: string;
  relationship: string;
  created_at: string;
  updated_at: string;
}

export interface EntityMatch {
  person: Person;
  score: number;
  confidence: string;
}

export async function findPersonMatches(
  extractedName: string,
  existingPersons: Person[]
): Promise<EntityMatch[]> {
  return invoke('find_person_matches', {
    extracted_name: extractedName,
    existing_persons: existingPersons,
  });
}

export interface ShouldCreateDecision {
  should_create_new: boolean;
  suggested_match?: Person;
  match_confidence?: number;
}

export async function shouldCreateNewPerson(
  extractedName: string,
  existingPersons: Person[]
): Promise<ShouldCreateDecision> {
  return invoke('should_create_new_person_command', {
    extracted_name: extractedName,
    existing_persons: existingPersons,
  });
}

// ============ Profile Management ============

export async function maskPiiForDisplay(
  category: string,
  value: string
): Promise<string> {
  return invoke('mask_pii_for_display', {
    category,
    value,
  });
}

// ============ Tax Knowledge ============

export interface TaxConcept {
  term: string;
  definition: string;
  english_term?: string;
  why_needed: string;
  related_boxes: string[];
}

export interface RequirementAnalysis {
  concepts_needed: TaxConcept[];
  explanation: string;
  confidence: string;
}

export async function analyzeAccountantRequest(
  requestText: string
): Promise<RequirementAnalysis> {
  return invoke('analyze_accountant_request', { request_text: requestText });
}

export async function getTaxConcept(term: string): Promise<TaxConcept | null> {
  return invoke('get_tax_concept', { term });
}

export async function listTaxConcepts(): Promise<TaxConcept[]> {
  return invoke('list_tax_concepts');
}

// ============ Helper Functions ============

/**
 * Complete workflow: Parse document → Extract PII → Validate anonymization
 */
export async function processDocumentWorkflow(
  filePath: string,
  conversationId: string
): Promise<{
  document: ParsedDocument;
  pii: PIIExtraction;
  anonymized: AnonymizationResult;
  validation: ValidationResult;
}> {
  // Step 1: Parse document
  const document = await parseDocument(filePath);

  // Step 2: Extract PII using Ollama
  const pii = await extractPiiFromDocument(document.text_content);

  // Step 3: Anonymize text
  const anonymized = await anonymizeText(
    document.text_content,
    pii,
    conversationId
  );

  // Step 4: Validate anonymization
  const validation = await validateAnonymization(anonymized.anonymized_text);

  return {
    document,
    pii,
    anonymized,
    validation,
  };
}

/**
 * Get formatted explanation for missing PII fields
 */
export function getMissingPiiExplanation(pii: PIIExtraction): string {
  const missing: string[] = [];

  if (!pii.bsn) missing.push('BSN (Tax ID)');
  if (!pii.name) missing.push('First name');
  if (!pii.surname) missing.push('Surname');
  if (!pii.phone) missing.push('Phone number');
  if (!pii.address) missing.push('Address');
  if (!pii.email) missing.push('Email');
  if (!pii.income) missing.push('Income');

  if (missing.length === 0) {
    return 'All common PII fields were extracted successfully.';
  }

  return `Missing information: ${missing.join(', ')}. You can manually enter these values if needed.`;
}

/**
 * Format PII for display (masked)
 */
export async function formatPiiForDisplay(
  category: string,
  value: string
): Promise<string> {
  try {
    return await maskPiiForDisplay(category, value);
  } catch (error) {
    console.error('Failed to mask PII:', error);
    return '●●●●●●';
  }
}
