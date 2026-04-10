// LLM Model Configuration
export interface LLMModel {
  id: string;
  provider: "nebius" | "ollama";
  apiModelId: string;
  name: string;
  contextWindow: number;
  speedTier: "very-fast" | "fast" | "medium" | "slow";
  intelligenceTier: "good" | "high" | "very-high";
  inputCostPer1M: number;
  outputCostPer1M: number;
  isEnabled: boolean;
  isDefault: boolean;
}

// App Settings
export interface AppSettings {
  // API Configuration
  nebiusApiKey: string;
  nebiusApiEndpoint: string;
  mem0ApiKey: string;
  enableMemory: boolean;
  useLocalMemory: boolean;

  // Model Preferences
  defaultModelId: string;
  enabledModelIds: string[];

  // Voice Settings
  defaultVoiceId: string;
  speechRate: number;
  inputDeviceId?: string;
  outputDeviceId?: string;

  // Hotkeys
  pushToTalkKey: string;

  // Privacy
  saveAudioRecordings: boolean;
  encryptLocalData: boolean;

  // Privacy Mode (replaces airplaneMode + per-persona backend)
  privacyMode: 'local' | 'hybrid' | 'cloud';
  localModeModel: string;    // apiModelId of local model for Local mode
  hybridModeModel: string;   // model id for Hybrid mode
  cloudModeModel: string;    // model id for Cloud mode

  // Backward compat — derived from privacyMode
  airplaneMode: boolean;
  airplaneModeModel: string;

  // Cloud trust
  cloudTrustLevel: "trusted" | "partial" | "minimal" | null;
  skipCloudReview: boolean; // Skip per-message privacy review when trusting the cloud provider

  // UI
  theme: "light" | "dark" | "system";
  showTokenCounts: boolean;
  showModelSelector: boolean;

  // GLiNER Privacy Shield settings
  glinerEnabled: boolean;
  glinerModelId: string | null;
  glinerConfidenceThreshold: number;  // 0.0-1.0, default 0.4

  // Auto-redact all cloud-bound content (history, context, memories)
  autoRedactAllContent: boolean;
}

// PII Vault Entry — a confirmed PII entity the user wants always redacted
export interface PiiVaultEntry {
  id: string;
  text: string;           // original text (e.g., "John Smith")
  category: string;       // PII category (e.g., "person name")
  placeholder: string;    // replacement (e.g., "[PERSON_NAME_1]")
  confirmedAt: string;    // ISO date string
  useCount: number;
}

// Persona
export interface Persona {
  id: string;
  name: string;
  description: string;
  icon: string;
  systemPrompt: string;
  voiceId: string;
  preferredModelId?: string;
  knowledgeBaseIds: string[];
  temperature: number;
  maxTokens: number;
  isBuiltIn: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Privacy-first LLM backend configuration
  enable_local_anonymizer?: boolean;
  preferred_backend?: 'nebius' | 'ollama' | 'hybrid';
  anonymization_mode?: 'none' | 'optional' | 'required';
  local_ollama_model?: string;
  // Smart cloud delegation (orchestration)
  enable_cloud_delegation?: boolean;
  cloud_delegation_threshold?: number;
  // PII Vault requirement (for personas like Tax Advisor)
  requiresPIIVault?: boolean;
}

// Project
export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  defaultPersonaId?: string;
  defaultContextIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Personal Context
export interface PersonalContext {
  id: string;
  name: string;
  content: string;
  tokenCount: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Conversation
export interface Conversation {
  id: string;
  projectId?: string;
  personaId: string;
  modelId: string;
  title: string;
  activeContextIds: string[];
  totalTokensUsed: number;
  isIncognito?: boolean;
  /** Rolling summary of older conversation turns for local LLM context */
  summary?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  audioPath?: string;
  modelId?: string;
  personaId?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  createdAt: Date;
  // Privacy
  privacyLevel?: 'local-only' | 'anonymized' | 'public';
  piiTypesDetected?: string[];
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  // Cloud delegation
  cloudAssisted?: boolean;
  // Canvas routing
  canvasDocId?: string;
  canvasIntro?: string;
  // Attachments
  attachments?: FileAttachment[];
}

// Knowledge Base
export interface KnowledgeBase {
  id: string;
  personaId?: string;
  name: string;
  description: string;
  documentCount: number;
  totalChunks: number;
  createdAt: Date;
  updatedAt: Date;
}

// Document in Knowledge Base
export interface KnowledgeDocument {
  id: string;
  knowledgeBaseId: string;
  name: string;
  type: "pdf" | "epub" | "md" | "docx" | "txt";
  chunkCount: number;
  tokenCount: number;
  createdAt: Date;
}

// Usage Stats
export interface UsageStats {
  date: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
  totalLatencyMs: number;
  estimatedCostUsd: number;
}

// Voice State
export type VoiceState =
  | "idle"
  | "listening"
  | "recording"
  | "processing"
  | "speaking";

// Chat State
export interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Record<string, Message[]>;
  isLoading: boolean;
  streamingContent: string;
}

// Context Selection State
export interface ContextSelection {
  personaId: string | null;
  projectId: string | null;
  contextIds: string[];
  knowledgeBaseIds: string[];
  modelId: string | null;
}

// Canvas Document — AI-generated or manually authored rich document
export interface CanvasDocument {
  id: string;
  projectId?: string;          // which project this belongs to (optional)
  conversationId?: string;     // which chat generated it (optional)
  title: string;
  content: string;             // markdown
  createdAt: Date;
  updatedAt: Date;
}

// === Form Fill Types ===

export interface FileAttachment {
  id: string;
  filename: string;
  fileType: 'pdf' | 'docx' | 'doc' | 'md' | 'txt';
  filePath: string;
  fileSize: number;
  textContent: string;
  structure?: {
    page_count: number;
    has_tables: boolean;
    document_type?: string;
  };
  isFormFill?: boolean;
}

export interface FormField {
  id: string;
  label: string;
  category: string;
  type: 'simple' | 'reasoning';
  value?: string;
  source?: 'profile' | 'user-input' | 'llm-composed' | 'skipped';
  hint?: string;
  placeholder?: string;
}

export interface FormFill {
  id: string;
  conversationId: string;
  messageId: string;
  templatePath: string;
  templateFilename: string;
  fileType: 'pdf' | 'docx' | 'doc' | 'md' | 'txt';
  fieldMap: FormField[];
  status: 'extracting' | 'filling' | 'reviewing' | 'complete';
  canvasDocId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfileAddress {
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface UserProfile {
  id: string;
  fullName?: string;
  dateOfBirth?: string;
  bsn?: string;
  nationality?: string;
  email?: string;
  phone?: string;
  address?: UserProfileAddress;
  employerName?: string;
  employmentType?: 'employed' | 'self-employed' | 'freelancer' | 'retired' | 'student';
  jobTitle?: string;
  incomeBracket?: string;
  bankName?: string;
  iban?: string;
  customFields: Record<string, string>;
  customRedactTerms?: Array<{
    label: string;
    value: string;
    replacement: string;
  }>;
}
