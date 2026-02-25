import Dexie, { type Table } from "dexie";

export interface LocalConversation {
  id: string;
  projectId?: string;
  personaId: string;
  modelId: string;
  title: string;
  activeContextIds: string[];
  totalTokensUsed: number;
  deleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalMessage {
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
  privacyLevel?: 'local-only' | 'anonymized' | 'public';
  piiTypesDetected?: string[];
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  canvasDocId?: string;
  canvasIntro?: string;
  deleted?: boolean;
  createdAt?: Date;
}

export interface LocalProject {
  id: string;
  name: string;
  description: string;
  color: string;
  defaultPersonaId?: string;
  defaultContextIds: string[];
  deleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalContext {
  id: string;
  name: string;
  content: string;
  tokenCount: number;
  isDefault: boolean;
  deleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalCanvasDocument {
  id: string;
  projectId?: string;
  conversationId?: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalPersona {
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
  deleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class AppDatabase extends Dexie {
  conversations!: Table<LocalConversation>;
  messages!: Table<LocalMessage>;
  projects!: Table<LocalProject>;
  contexts!: Table<LocalContext>;
  personas!: Table<LocalPersona>;
  canvasDocuments!: Table<LocalCanvasDocument>;

  constructor() {
    super("PrivateAssistantDB");

    this.version(1).stores({
      conversations: "id, clientId, userId, projectId, updatedAt, pendingSync, deleted",
      messages: "id, clientId, conversationId, userId, createdAt, pendingSync, deleted",
      projects: "id, clientId, userId, updatedAt, pendingSync, deleted",
      contexts: "id, clientId, userId, updatedAt, pendingSync, deleted",
      personas: "id, clientId, userId, isBuiltIn, updatedAt, pendingSync, deleted",
      syncQueue: "++id, entityType, entityId, operation, createdAt",
      syncState: "id",
    });

    this.version(2).stores({
      canvasDocuments: "id, clientId, userId, projectId, conversationId, updatedAt, pendingSync, deleted",
    });

    // Version 3: drop sync-only tables (Supabase removed)
    this.version(3).stores({
      syncQueue: null,
      syncState: null,
    });
  }
}

export const db = new AppDatabase();

export function generateClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const dbOps = {
  async createConversation(conv: Omit<LocalConversation, 'deleted'>): Promise<LocalConversation> {
    const full: LocalConversation = { ...conv, deleted: false };
    await db.conversations.add(full);
    return full;
  },

  async updateConversation(id: string, updates: Partial<LocalConversation>): Promise<void> {
    await db.conversations.update(id, { ...updates, updatedAt: new Date() });
  },

  async deleteConversation(id: string): Promise<void> {
    await db.conversations.delete(id);
    await db.messages.where("conversationId").equals(id).delete();
  },

  async createMessage(msg: Omit<LocalMessage, 'deleted'>): Promise<LocalMessage> {
    const full: LocalMessage = { ...msg, deleted: false };
    await db.messages.add(full);
    return full;
  },

  async updateMessage(
    id: string,
    updates: Partial<Pick<LocalMessage, 'canvasDocId' | 'canvasIntro' | 'approvalStatus'>>
  ): Promise<void> {
    await db.messages.update(id, updates);
  },

  async getMessagesByConversation(conversationId: string): Promise<LocalMessage[]> {
    return db.messages
      .where("conversationId")
      .equals(conversationId)
      .and((m) => !m.deleted)
      .sortBy("createdAt");
  },

  async createProject(project: Omit<LocalProject, 'deleted'>): Promise<LocalProject> {
    const full: LocalProject = { ...project, deleted: false };
    await db.projects.add(full);
    return full;
  },

  async createContext(context: Omit<LocalContext, 'deleted'>): Promise<LocalContext> {
    const full: LocalContext = { ...context, deleted: false };
    await db.contexts.add(full);
    return full;
  },

  async createPersona(persona: Omit<LocalPersona, 'deleted'>): Promise<LocalPersona> {
    const full: LocalPersona = { ...persona, deleted: false };
    await db.personas.add(full);
    return full;
  },
};

export const canvasDbOps = {
  async createCanvasDocument(doc: LocalCanvasDocument): Promise<void> {
    await db.canvasDocuments.add(doc);
  },
  async updateCanvasDocument(id: string, updates: Partial<LocalCanvasDocument>): Promise<void> {
    await db.canvasDocuments.update(id, { ...updates, updatedAt: new Date() });
  },
  async deleteCanvasDocument(id: string): Promise<void> {
    await db.canvasDocuments.delete(id);
  },
  async getAllCanvasDocuments(): Promise<LocalCanvasDocument[]> {
    return db.canvasDocuments.toArray();
  },
};

export default db;
