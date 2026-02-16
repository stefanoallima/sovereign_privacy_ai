import Dexie, { type Table } from "dexie";

// Sync metadata added to all entities
export interface SyncMeta {
  clientId: string; // Original ID created on client
  userId?: string; // Supabase user ID (null for offline-only)
  syncedAt?: Date; // Last successful sync timestamp
  pendingSync: boolean; // Needs to be pushed to server
  deleted?: boolean; // Soft delete flag for sync
}

// Local database entities (extend app types with sync metadata)
export interface LocalConversation extends SyncMeta {
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

export interface LocalMessage extends SyncMeta {
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
  createdAt?: Date;
}

export interface LocalProject extends SyncMeta {
  id: string;
  name: string;
  description: string;
  color: string;
  defaultPersonaId?: string;
  defaultContextIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalContext extends SyncMeta {
  id: string;
  name: string;
  content: string;
  tokenCount: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalPersona extends SyncMeta {
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

// Sync queue for tracking pending operations
export interface SyncQueueItem {
  id?: number; // Auto-incremented
  entityType: "conversation" | "message" | "project" | "context" | "persona";
  entityId: string;
  operation: "create" | "update" | "delete";
  data?: any; // Entity data for create/update
  createdAt: Date;
  retryCount: number;
  lastError?: string;
}

// Sync state tracking
export interface SyncState {
  id: string; // "global"
  lastSyncAt?: Date;
  isSyncing: boolean;
  lastError?: string;
}

// Dexie database class
export class AppDatabase extends Dexie {
  conversations!: Table<LocalConversation>;
  messages!: Table<LocalMessage>;
  projects!: Table<LocalProject>;
  contexts!: Table<LocalContext>;
  personas!: Table<LocalPersona>;
  syncQueue!: Table<SyncQueueItem>;
  syncState!: Table<SyncState>;

  constructor() {
    super("PrivateAssistantDB");

    this.version(1).stores({
      // Primary key, then indexed fields
      conversations:
        "id, clientId, userId, projectId, updatedAt, pendingSync, deleted",
      messages:
        "id, clientId, conversationId, userId, createdAt, pendingSync, deleted",
      projects: "id, clientId, userId, updatedAt, pendingSync, deleted",
      contexts: "id, clientId, userId, updatedAt, pendingSync, deleted",
      personas: "id, clientId, userId, isBuiltIn, updatedAt, pendingSync, deleted",
      syncQueue: "++id, entityType, entityId, operation, createdAt",
      syncState: "id",
    });
  }
}

// Singleton database instance
export const db = new AppDatabase();

// Helper to generate unique client IDs
export function generateClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Helper to create sync metadata
export function createSyncMeta(userId?: string): SyncMeta {
  const clientId = generateClientId();
  return {
    clientId,
    userId,
    pendingSync: Boolean(userId), // Only mark for sync if user is logged in
    deleted: false,
  };
}

// Database operations with sync awareness
export const dbOps = {
  // Conversations
  async createConversation(
    conv: Omit<LocalConversation, keyof SyncMeta>,
    userId?: string
  ): Promise<LocalConversation> {
    const syncMeta = createSyncMeta(userId);
    const fullConv: LocalConversation = { ...conv, ...syncMeta };
    await db.conversations.add(fullConv);

    if (userId) {
      await db.syncQueue.add({
        entityType: "conversation",
        entityId: conv.id,
        operation: "create",
        data: fullConv,
        createdAt: new Date(),
        retryCount: 0,
      });
    }

    return fullConv;
  },

  async updateConversation(
    id: string,
    updates: Partial<LocalConversation>,
    userId?: string
  ): Promise<void> {
    const now = new Date();
    await db.conversations.update(id, {
      ...updates,
      updatedAt: now,
      pendingSync: Boolean(userId),
    });

    if (userId) {
      await db.syncQueue.add({
        entityType: "conversation",
        entityId: id,
        operation: "update",
        data: updates,
        createdAt: now,
        retryCount: 0,
      });
    }
  },

  async deleteConversation(id: string, userId?: string): Promise<void> {
    if (userId) {
      // Soft delete for sync
      await db.conversations.update(id, {
        deleted: true,
        pendingSync: true,
        updatedAt: new Date(),
      });
      await db.syncQueue.add({
        entityType: "conversation",
        entityId: id,
        operation: "delete",
        createdAt: new Date(),
        retryCount: 0,
      });
    } else {
      // Hard delete for offline mode
      await db.conversations.delete(id);
      await db.messages.where("conversationId").equals(id).delete();
    }
  },

  // Messages
  async createMessage(
    msg: Omit<LocalMessage, keyof SyncMeta>,
    userId?: string
  ): Promise<LocalMessage> {
    const syncMeta = createSyncMeta(userId);
    const fullMsg: LocalMessage = { ...msg, ...syncMeta };
    await db.messages.add(fullMsg);

    if (userId) {
      await db.syncQueue.add({
        entityType: "message",
        entityId: msg.id,
        operation: "create",
        data: fullMsg,
        createdAt: new Date(),
        retryCount: 0,
      });
    }

    return fullMsg;
  },

  async getMessagesByConversation(
    conversationId: string
  ): Promise<LocalMessage[]> {
    return db.messages
      .where("conversationId")
      .equals(conversationId)
      .and((m) => !m.deleted)
      .sortBy("createdAt");
  },

  // Projects
  async createProject(
    project: Omit<LocalProject, keyof SyncMeta>,
    userId?: string
  ): Promise<LocalProject> {
    const syncMeta = createSyncMeta(userId);
    const fullProject: LocalProject = { ...project, ...syncMeta };
    await db.projects.add(fullProject);

    if (userId) {
      await db.syncQueue.add({
        entityType: "project",
        entityId: project.id,
        operation: "create",
        data: fullProject,
        createdAt: new Date(),
        retryCount: 0,
      });
    }

    return fullProject;
  },

  // Contexts
  async createContext(
    context: Omit<LocalContext, keyof SyncMeta>,
    userId?: string
  ): Promise<LocalContext> {
    const syncMeta = createSyncMeta(userId);
    const fullContext: LocalContext = { ...context, ...syncMeta };
    await db.contexts.add(fullContext);

    if (userId) {
      await db.syncQueue.add({
        entityType: "context",
        entityId: context.id,
        operation: "create",
        data: fullContext,
        createdAt: new Date(),
        retryCount: 0,
      });
    }

    return fullContext;
  },

  // Personas (custom only - built-ins stay local)
  async createPersona(
    persona: Omit<LocalPersona, keyof SyncMeta>,
    userId?: string
  ): Promise<LocalPersona> {
    const syncMeta = createSyncMeta(userId);
    const fullPersona: LocalPersona = { ...persona, ...syncMeta };
    await db.personas.add(fullPersona);

    // Only sync custom personas
    if (userId && !persona.isBuiltIn) {
      await db.syncQueue.add({
        entityType: "persona",
        entityId: persona.id,
        operation: "create",
        data: fullPersona,
        createdAt: new Date(),
        retryCount: 0,
      });
    }

    return fullPersona;
  },

  // Sync operations
  async getPendingSync(
    entityType: SyncQueueItem["entityType"]
  ): Promise<SyncQueueItem[]> {
    return db.syncQueue
      .where("entityType")
      .equals(entityType)
      .sortBy("createdAt");
  },

  async markSynced(entityType: string, entityId: string): Promise<void> {
    const now = new Date();

    // Update entity
    const table = db.table(entityType + "s"); // conversations, messages, etc.
    await table.update(entityId, {
      syncedAt: now,
      pendingSync: false,
    });

    // Remove from queue
    await db.syncQueue
      .where("entityId")
      .equals(entityId)
      .and((item) => item.entityType === entityType)
      .delete();
  },

  async getSyncState(): Promise<SyncState | undefined> {
    return db.syncState.get("global");
  },

  async updateSyncState(updates: Partial<SyncState>): Promise<void> {
    const existing = await db.syncState.get("global");
    if (existing) {
      await db.syncState.update("global", updates);
    } else {
      await db.syncState.add({ id: "global", isSyncing: false, ...updates });
    }
  },

  // Migration from localStorage
  async migrateFromLocalStorage(userId?: string): Promise<void> {
    // Check if already migrated
    const existingConvs = await db.conversations.count();
    if (existingConvs > 0) {
      return;
    }

    // Migrate chat data
    const chatData = localStorage.getItem("assistant-chat");
    if (chatData) {
      try {
        const parsed = JSON.parse(chatData);
        const state = parsed.state || parsed;

        // Migrate conversations
        if (state.conversations) {
          for (const conv of state.conversations) {
            await dbOps.createConversation(
              {
                id: conv.id,
                projectId: conv.projectId,
                personaId: conv.personaId,
                modelId: conv.modelId,
                title: conv.title,
                activeContextIds: conv.activeContextIds || [],
                totalTokensUsed: conv.totalTokensUsed || 0,
                createdAt: new Date(conv.createdAt),
                updatedAt: new Date(conv.updatedAt),
              },
              userId
            );
          }
        }

        // Migrate messages
        if (state.messages) {
          for (const [convId, msgs] of Object.entries(state.messages)) {
            for (const msg of msgs as any[]) {
              await dbOps.createMessage(
                {
                  id: msg.id,
                  conversationId: convId,
                  role: msg.role,
                  content: msg.content,
                  audioPath: msg.audioPath,
                  modelId: msg.modelId,
                  personaId: msg.personaId,
                  inputTokens: msg.inputTokens,
                  outputTokens: msg.outputTokens,
                  latencyMs: msg.latencyMs,
                  createdAt: new Date(msg.createdAt),
                },
                userId
              );
            }
          }
        }

        // Migrate projects
        if (state.projects) {
          for (const proj of state.projects) {
            await dbOps.createProject(
              {
                id: proj.id,
                name: proj.name,
                description: proj.description || "",
                color: proj.color,
                defaultPersonaId: proj.defaultPersonaId,
                defaultContextIds: proj.defaultContextIds || [],
                createdAt: new Date(proj.createdAt),
                updatedAt: new Date(proj.updatedAt),
              },
              userId
            );
          }
        }

        // Migrate contexts
        if (state.contexts) {
          for (const ctx of state.contexts) {
            await dbOps.createContext(
              {
                id: ctx.id,
                name: ctx.name,
                content: ctx.content,
                tokenCount: ctx.tokenCount || 0,
                isDefault: ctx.isDefault || false,
                createdAt: new Date(ctx.createdAt),
                updatedAt: new Date(ctx.updatedAt),
              },
              userId
            );
          }
        }

      } catch (err) {
        console.error("Failed to migrate from localStorage:", err);
      }
    }

    // Migrate personas (custom only)
    const personasData = localStorage.getItem("assistant-personas");
    if (personasData) {
      try {
        const parsed = JSON.parse(personasData);
        const state = parsed.state || parsed;

        if (state.personas) {
          for (const persona of state.personas) {
            // Skip built-in personas, they're already in the app
            if (!persona.isBuiltIn) {
              await dbOps.createPersona(
                {
                  id: persona.id,
                  name: persona.name,
                  description: persona.description,
                  icon: persona.icon || "🤖",
                  systemPrompt: persona.systemPrompt,
                  voiceId: persona.voiceId,
                  preferredModelId: persona.preferredModelId,
                  knowledgeBaseIds: persona.knowledgeBaseIds || [],
                  temperature: persona.temperature,
                  maxTokens: persona.maxTokens,
                  isBuiltIn: false,
                  createdAt: new Date(persona.createdAt),
                  updatedAt: new Date(persona.updatedAt),
                },
                userId
              );
            }
          }
        }
      } catch (err) {
        console.error("Failed to migrate personas from localStorage:", err);
      }
    }
  },
};

export default db;
