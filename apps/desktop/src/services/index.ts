/**
 * Services Index
 *
 * Export all services for the application.
 */

// Core Services
export { getNebiusClient } from './nebius';
export * from './tts';
export * from './stt';
export * from './livekit';

// PII & Privacy Services (explicitly named to avoid conflicts)
export {
  checkOllamaAvailability,
  anonymizeText,
  parseDocument,
  findPersonMatches,
  formatPiiForDisplay,
  type Person,
  type PIIExtraction,
  type AnonymizationResult,
  type ParsedDocument,
} from './pii-service';

export {
  makeBackendRoutingDecision,
  validatePersonaBackendConfig,
  getAvailableOllamaModels,
  getBackendPrivacy,
  getPrivacyIndicator,
  isConfigurationValid,
  type BackendDecision,
  type ContentMode,
  type PreferredBackend,
  type AnonymizationMode,
} from './backend-routing-service';

export {
  extractTaxAttributes,
  generatePrivacySafePrompt,
  processChatWithPrivacy,
  extractQuestion,
  type TaxAttributes,
  type ProcessedChatRequest,
} from './attribute-extraction-service';

export {
  sendPrivacyAwareChat,
  streamPrivacyAwareChat,
  previewPrivacyProcessing,
} from './privacy-chat-service';

export {
  analyzeTemplate,
  rehydrateTemplate,
  buildTemplatePrompt,
  PLACEHOLDER_TYPES,
  TEMPLATE_EXAMPLES,
  type PIIValues,
  type TemplateAnalysis,
  type RehydrationResult,
  type PlaceholderInfo,
  type FilledPlaceholder,
} from './rehydration-service';

export {
  parseDocument as parseDocumentWithPrivacy,
  extractPIIFromText,
  processDocumentWithPrivacy,
  anonymizeText as anonymizeTextWithPrivacy,
  isLocalProcessingAvailable,
  type DocumentParseResult,
  type ExtractedPII,
  type DocumentPrivacyResult,
} from './document-privacy-service';
