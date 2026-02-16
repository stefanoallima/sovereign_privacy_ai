/**
 * Document Privacy Service
 *
 * Task 1 & 5 from Privacy-First Design:
 * - Parse documents (PDF, DOCX) locally
 * - Extract PII using local Ollama
 * - Store PII encrypted locally
 * - Return anonymized content for cloud processing
 *
 * Flow:
 * 1. User uploads PDF/DOCX
 * 2. PyMuPDF/docx2txt extracts text locally
 * 3. Local LLM (Ollama) identifies PII
 * 4. PII stored in encrypted UserContext
 * 5. Anonymized text ready for cloud analysis
 */

import { invoke } from '@tauri-apps/api/core';
import type { PIIValues } from './rehydration-service';

// ==================== Types ====================

export interface DocumentParseResult {
  /** Extracted text content */
  text: string;
  /** Document type */
  documentType: 'pdf' | 'docx' | 'txt' | 'unknown';
  /** Number of pages (if applicable) */
  pageCount?: number;
  /** Whether document has tables */
  hasTables: boolean;
  /** Parse errors if any */
  errors?: string[];
}

export interface ExtractedPII {
  /** BSN (Dutch tax ID) */
  bsn?: string;
  /** First name */
  name?: string;
  /** Last name */
  surname?: string;
  /** Phone number */
  phone?: string;
  /** Full address */
  address?: string;
  /** Email address */
  email?: string;
  /** Income amount */
  income?: string;
  /** IBAN bank account */
  iban?: string;
  /** Confidence scores for each field */
  confidence: PIIConfidenceScores;
}

export interface PIIConfidenceScores {
  bsn: number;
  name: number;
  surname: number;
  phone: number;
  address: number;
  email: number;
  income: number;
}

export interface DocumentPrivacyResult {
  /** Original document info */
  document: DocumentParseResult;
  /** Extracted PII (stored locally) */
  extractedPII: ExtractedPII;
  /** Anonymized text (safe for cloud) */
  anonymizedText: string;
  /** Mapping of placeholders to PII categories */
  placeholderMap: PlaceholderMapping[];
  /** Overall success */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

export interface PlaceholderMapping {
  /** The placeholder ID */
  id: string;
  /** PII category (bsn, name, email, etc.) */
  category: string;
  /** Position in anonymized text */
  position: number;
}

export interface ProcessingOptions {
  /** Minimum confidence for PII detection */
  confidenceThreshold?: number;
  /** Whether to use regex fallback */
  useRegexFallback?: boolean;
  /** Categories to extract */
  categories?: PIICategory[];
}

export type PIICategory = 'bsn' | 'name' | 'surname' | 'phone' | 'address' | 'email' | 'income' | 'iban';

// ==================== API Functions ====================

/**
 * Parse a document and extract its content
 */
export async function parseDocument(filePath: string): Promise<DocumentParseResult> {
  try {
    const result = await invoke<{
      text: string;
      document_type: string;
      page_count: number;
      has_tables: boolean;
    }>('parse_document', { path: filePath });

    return {
      text: result.text,
      documentType: result.document_type as DocumentParseResult['documentType'],
      pageCount: result.page_count,
      hasTables: result.has_tables,
    };
  } catch (error) {
    return {
      text: '',
      documentType: 'unknown',
      hasTables: false,
      errors: [error instanceof Error ? error.message : 'Failed to parse document'],
    };
  }
}

/**
 * Extract PII from text using local Ollama
 */
export async function extractPIIFromText(text: string): Promise<ExtractedPII> {
  try {
    const result = await invoke<{
      bsn: string | null;
      name: string | null;
      surname: string | null;
      phone: string | null;
      address: string | null;
      email: string | null;
      income: string | null;
      confidence_scores: PIIConfidenceScores;
    }>('extract_pii_from_document', { content: text });

    return {
      bsn: result.bsn || undefined,
      name: result.name || undefined,
      surname: result.surname || undefined,
      phone: result.phone || undefined,
      address: result.address || undefined,
      email: result.email || undefined,
      income: result.income || undefined,
      confidence: result.confidence_scores,
    };
  } catch (error) {
    console.error('PII extraction failed:', error);
    return {
      confidence: {
        bsn: 0,
        name: 0,
        surname: 0,
        phone: 0,
        address: 0,
        email: 0,
        income: 0,
      },
    };
  }
}

/**
 * Anonymize text by replacing PII with placeholders
 */
export async function anonymizeText(
  text: string,
  conversationId: string
): Promise<{
  anonymizedText: string;
  mappings: PlaceholderMapping[];
}> {
  try {
    const result = await invoke<{
      anonymized_text: string;
      mappings: Array<{
        id: string;
        pii_category: string;
        placeholder: string;
      }>;
    }>('anonymize_text', { text, conversationId });

    return {
      anonymizedText: result.anonymized_text,
      mappings: result.mappings.map((m, i) => ({
        id: m.id,
        category: m.pii_category,
        position: i,
      })),
    };
  } catch (error) {
    console.error('Anonymization failed:', error);
    return {
      anonymizedText: text,
      mappings: [],
    };
  }
}

/**
 * Full document privacy pipeline
 * Parses document → Extracts PII → Anonymizes → Returns safe content
 */
export async function processDocumentWithPrivacy(
  filePath: string,
  conversationId: string,
  _options: ProcessingOptions = {}
): Promise<DocumentPrivacyResult> {
  try {
    // Step 1: Parse document
    const document = await parseDocument(filePath);
    if (document.errors?.length) {
      return {
        document,
        extractedPII: { confidence: defaultConfidence() },
        anonymizedText: '',
        placeholderMap: [],
        success: false,
        error: document.errors.join(', '),
      };
    }

    // Step 2: Extract PII locally
    const extractedPII = await extractPIIFromText(document.text);

    // Step 3: Anonymize text
    const { anonymizedText, mappings } = await anonymizeText(document.text, conversationId);

    return {
      document,
      extractedPII,
      anonymizedText,
      placeholderMap: mappings,
      success: true,
    };
  } catch (error) {
    return {
      document: {
        text: '',
        documentType: 'unknown',
        hasTables: false,
      },
      extractedPII: { confidence: defaultConfidence() },
      anonymizedText: '',
      placeholderMap: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Convert extracted PII to PIIValues format for re-hydration
 */
export function extractedPIIToPIIValues(pii: ExtractedPII): PIIValues {
  return {
    bsn: pii.bsn,
    name: pii.name,
    surname: pii.surname,
    phone: pii.phone,
    address: pii.address,
    email: pii.email,
    income: pii.income,
    iban: pii.iban,
  };
}

/**
 * Check if Ollama is available for local processing
 */
export async function isLocalProcessingAvailable(): Promise<boolean> {
  try {
    return await invoke<boolean>('ollama_is_available');
  } catch {
    return false;
  }
}

// ==================== Helper Functions ====================

function defaultConfidence(): PIIConfidenceScores {
  return {
    bsn: 0,
    name: 0,
    surname: 0,
    phone: 0,
    address: 0,
    email: 0,
    income: 0,
  };
}

/**
 * Get human-readable summary of extracted PII
 */
export function getPIISummary(pii: ExtractedPII): string {
  const found: string[] = [];

  if (pii.bsn) found.push('BSN');
  if (pii.name || pii.surname) found.push('Name');
  if (pii.phone) found.push('Phone');
  if (pii.email) found.push('Email');
  if (pii.address) found.push('Address');
  if (pii.income) found.push('Income');
  if (pii.iban) found.push('IBAN');

  return found.length > 0 ? `Found: ${found.join(', ')}` : 'No PII detected';
}

/**
 * Get fields that are below confidence threshold
 */
export function getLowConfidenceFields(
  pii: ExtractedPII,
  threshold: number = 0.7
): string[] {
  const lowConfidence: string[] = [];
  const confidence = pii.confidence;

  if (pii.bsn && confidence.bsn < threshold) lowConfidence.push('BSN');
  if (pii.name && confidence.name < threshold) lowConfidence.push('Name');
  if (pii.surname && confidence.surname < threshold) lowConfidence.push('Surname');
  if (pii.phone && confidence.phone < threshold) lowConfidence.push('Phone');
  if (pii.address && confidence.address < threshold) lowConfidence.push('Address');
  if (pii.email && confidence.email < threshold) lowConfidence.push('Email');
  if (pii.income && confidence.income < threshold) lowConfidence.push('Income');

  return lowConfidence;
}

/**
 * Format PII for secure display (masked)
 */
export function formatPIIForDisplay(pii: ExtractedPII): Record<string, string> {
  const display: Record<string, string> = {};

  if (pii.bsn) display.BSN = maskBSN(pii.bsn);
  if (pii.name) display.Name = pii.name;
  if (pii.surname) display.Surname = pii.surname;
  if (pii.phone) display.Phone = maskPhone(pii.phone);
  if (pii.email) display.Email = maskEmail(pii.email);
  if (pii.address) display.Address = truncateAddress(pii.address);
  if (pii.income) display.Income = maskIncome(pii.income);
  if (pii.iban) display.IBAN = maskIBAN(pii.iban);

  return display;
}

function maskBSN(bsn: string): string {
  return '******' + bsn.slice(-3);
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return '****' + digits.slice(-4);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return local.slice(0, 2) + '***@' + domain;
}

function truncateAddress(address: string): string {
  return address.length > 30 ? address.slice(0, 30) + '...' : address;
}

function maskIncome(_income: string): string {
  return '€ ***';
}

function maskIBAN(iban: string): string {
  return iban.slice(0, 4) + '****' + iban.slice(-4);
}

// ==================== Document Type Detection ====================

/**
 * Detect document type from file path
 */
export function detectDocumentType(filePath: string): DocumentParseResult['documentType'] {
  const ext = filePath.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'docx':
    case 'doc':
      return 'docx';
    case 'txt':
      return 'txt';
    default:
      return 'unknown';
  }
}

/**
 * Check if file type is supported
 */
export function isSupportedDocumentType(filePath: string): boolean {
  const type = detectDocumentType(filePath);
  return type !== 'unknown';
}

export default {
  parseDocument,
  extractPIIFromText,
  anonymizeText,
  processDocumentWithPrivacy,
  extractedPIIToPIIValues,
  isLocalProcessingAvailable,
  getPIISummary,
  getLowConfidenceFields,
  formatPIIForDisplay,
  detectDocumentType,
  isSupportedDocumentType,
};
