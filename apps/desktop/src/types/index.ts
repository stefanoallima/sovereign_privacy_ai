// LLM Model Configuration
export interface LLMModel {
  id: string;
  provider: "nebius";
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

  // UI
  theme: "light" | "dark" | "system";
  showTokenCounts: boolean;
  showModelSelector: boolean;
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
  createdAt: Date;
  updatedAt: Date;
}

// Message
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
