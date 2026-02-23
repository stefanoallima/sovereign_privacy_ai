import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Conversation, Message, Project, PersonalContext } from "@/types";
import { db, dbOps, type LocalConversation, type LocalMessage, type LocalProject, type LocalContext } from "@/lib/db";
import { useAuthStore } from "./auth";

interface ChatStore {
  // Data
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  projects: Project[];
  contexts: PersonalContext[];

  // Current state
  currentConversationId: string | null;
  isLoading: boolean;
  streamingContent: string;
  isInitialized: boolean;

  // Initialization
  initialize: () => Promise<void>;

  // Conversation actions
  createConversation: (
    personaId: string,
    modelId: string,
    projectId?: string,
    isIncognito?: boolean
  ) => Promise<string>;
  selectConversation: (id: string | null) => void;
  deleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
  moveToProject: (conversationId: string, projectId: string | null) => Promise<void>;
  updateConversationModel: (id: string, modelId: string) => Promise<void>;
  updateConversationPersona: (id: string, personaId: string) => Promise<void>;
  toggleConversationContext: (conversationId: string, contextId: string) => Promise<void>;

  // Message actions
  addMessage: (conversationId: string, message: Omit<Message, "id" | "createdAt">) => Promise<void>;
  updateStreamingContent: (content: string) => void;
  finalizeStreaming: (conversationId: string, modelId: string, inputTokens: number, outputTokens: number, latencyMs: number, personaId?: string) => Promise<void>;
  approveMessage: (messageId: string) => Promise<void>;
  linkMessageToCanvas: (messageId: string, canvasDocId: string, canvasIntro: string) => Promise<void>;
  setLoading: (loading: boolean) => void;

  // Project actions
  createProject: (name: string, description: string, color: string) => Promise<string>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // Context actions
  createContext: (name: string, content: string) => Promise<string>;
  updateContext: (id: string, updates: Partial<PersonalContext>) => Promise<void>;
  deleteContext: (id: string) => Promise<void>;

  // Selectors
  getCurrentConversation: () => Conversation | undefined;
  getCurrentMessages: () => Message[];
  getConversationsByProject: (projectId: string | null) => Conversation[];
}

// Helper to get current userId
function getUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

// Convert LocalConversation to Conversation
function toConversation(local: LocalConversation): Conversation {
  return {
    id: local.id,
    projectId: local.projectId,
    personaId: local.personaId,
    modelId: local.modelId,
    title: local.title,
    activeContextIds: local.activeContextIds,
    totalTokensUsed: local.totalTokensUsed,
    createdAt: local.createdAt,
    updatedAt: local.updatedAt,
  };
}

// Convert LocalMessage to Message
function toMessage(local: LocalMessage): Message {
  return {
    id: local.id,
    conversationId: local.conversationId,
    role: local.role,
    content: local.content,
    audioPath: local.audioPath,
    modelId: local.modelId,
    personaId: local.personaId,
    inputTokens: local.inputTokens,
    outputTokens: local.outputTokens,
    latencyMs: local.latencyMs,
    createdAt: local.createdAt || new Date(),
    privacyLevel: local.privacyLevel,
    piiTypesDetected: local.piiTypesDetected,
    approvalStatus: local.approvalStatus,
    canvasDocId: local.canvasDocId,
    canvasIntro: local.canvasIntro,
  };
}

// Convert LocalProject to Project
function toProject(local: LocalProject): Project {
  return {
    id: local.id,
    name: local.name,
    description: local.description,
    color: local.color,
    defaultPersonaId: local.defaultPersonaId,
    defaultContextIds: local.defaultContextIds,
    createdAt: local.createdAt,
    updatedAt: local.updatedAt,
  };
}

// Convert LocalContext to PersonalContext
function toContext(local: LocalContext): PersonalContext {
  return {
    id: local.id,
    name: local.name,
    content: local.content,
    tokenCount: local.tokenCount,
    isDefault: local.isDefault,
    createdAt: local.createdAt,
    updatedAt: local.updatedAt,
  };
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      conversations: [],
      messages: {},
      projects: [],
      contexts: [],
      currentConversationId: null,
      isLoading: false,
      streamingContent: "",
      isInitialized: false,

      // Initialize: Load data from IndexedDB
      initialize: async () => {
        if (get().isInitialized) return;

        try {
          const userId = getUserId();

          // First, try to migrate from localStorage if needed
          await dbOps.migrateFromLocalStorage(userId);

          // Load all data from IndexedDB
          const [convs, projs, ctxs] = await Promise.all([
            db.conversations.filter(c => !c.deleted).toArray(),
            db.projects.filter(p => !p.deleted).toArray(),
            db.contexts.filter(c => !c.deleted).toArray(),
          ]);

          // Load messages for all conversations
          const messagesMap: Record<string, Message[]> = {};
          for (const conv of convs) {
            const msgs = await dbOps.getMessagesByConversation(conv.id);
            messagesMap[conv.id] = msgs.map(toMessage);
          }

          set({
            conversations: convs.map(toConversation).sort((a, b) =>
              b.updatedAt.getTime() - a.updatedAt.getTime()
            ),
            messages: messagesMap,
            projects: projs.map(toProject),
            contexts: ctxs.map(toContext),
            isInitialized: true,
          });
        } catch (error) {
          console.error("Failed to initialize chat store from IndexedDB:", error);
          set({ isInitialized: true });
        }
      },

      // Conversation actions
      createConversation: async (personaId, modelId, projectId, isIncognito) => {
        const id = `conv-${Date.now()}`;
        const now = new Date();
        const userId = getUserId();

        const conversation: Conversation = {
          id,
          personaId,
          modelId,
          projectId,
          title: isIncognito ? "Incognito Chat" : "New Conversation",
          activeContextIds: [],
          totalTokensUsed: 0,
          isIncognito,
          createdAt: now,
          updatedAt: now,
        };

        // Skip persistence for incognito conversations
        if (!isIncognito) {
          await dbOps.createConversation(
            {
              id,
              projectId,
              personaId,
              modelId,
              title: "New Conversation",
              activeContextIds: [],
              totalTokensUsed: 0,
              createdAt: now,
              updatedAt: now,
            },
            userId
          );
        }

        set((state) => ({
          conversations: [conversation, ...state.conversations],
          messages: { ...state.messages, [id]: [] },
          currentConversationId: id,
        }));

        return id;
      },

      selectConversation: (id) => set({ currentConversationId: id }),

      deleteConversation: async (id) => {
        const conv = get().conversations.find(c => c.id === id);
        if (!conv?.isIncognito) {
          const userId = getUserId();
          await dbOps.deleteConversation(id, userId);
        }

        set((state) => {
          const { [id]: _, ...remainingMessages } = state.messages;
          return {
            conversations: state.conversations.filter((c) => c.id !== id),
            messages: remainingMessages,
            currentConversationId:
              state.currentConversationId === id
                ? null
                : state.currentConversationId,
          };
        });
      },

      updateConversationTitle: async (id, title) => {
        const conv = get().conversations.find(c => c.id === id);
        if (!conv?.isIncognito) {
          const userId = getUserId();
          await dbOps.updateConversation(id, { title }, userId);
        }

        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: new Date() } : c
          ),
        }));
      },

      moveToProject: async (conversationId, projectId) => {
        const userId = getUserId();
        await dbOps.updateConversation(
          conversationId,
          { projectId: projectId ?? undefined },
          userId
        );

        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, projectId: projectId ?? undefined, updatedAt: new Date() }
              : c
          ),
        }));

        // Move any canvas documents linked to this conversation to the same project
        const { moveConversationDocuments } = await import('./canvas').then(m => m.useCanvasStore.getState());
        await moveConversationDocuments(conversationId, projectId);
      },

      updateConversationModel: async (id, modelId) => {
        const userId = getUserId();
        await dbOps.updateConversation(id, { modelId }, userId);

        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, modelId, updatedAt: new Date() } : c
          ),
        }));
      },

      updateConversationPersona: async (id: string, personaId: string) => {
        const userId = getUserId();
        await dbOps.updateConversation(id, { personaId }, userId);

        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, personaId, updatedAt: new Date() } : c
          ),
        }));
      },

      toggleConversationContext: async (conversationId, contextId) => {
        const conv = get().conversations.find(c => c.id === conversationId);
        if (!conv) return;

        const hasContext = conv.activeContextIds.includes(contextId);
        const newContextIds = hasContext
          ? conv.activeContextIds.filter((id) => id !== contextId)
          : [...conv.activeContextIds, contextId];

        const userId = getUserId();
        await dbOps.updateConversation(
          conversationId,
          { activeContextIds: newContextIds },
          userId
        );

        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            return {
              ...c,
              activeContextIds: newContextIds,
              updatedAt: new Date(),
            };
          }),
        }));
      },

      // Message actions
      addMessage: async (conversationId, message) => {
        const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const now = new Date();

        const newMessage: Message = {
          ...message,
          id,
          createdAt: now,
        };

        // Skip persistence for incognito conversations
        const conv = get().conversations.find(c => c.id === conversationId);
        if (!conv?.isIncognito) {
          const userId = getUserId();
          await dbOps.createMessage(
            {
              id,
              conversationId,
              role: message.role,
              content: message.content,
              audioPath: message.audioPath,
              modelId: message.modelId,
              personaId: message.personaId,
              inputTokens: message.inputTokens,
              outputTokens: message.outputTokens,
              latencyMs: message.latencyMs,
              createdAt: now,
              privacyLevel: message.privacyLevel,
              piiTypesDetected: message.piiTypesDetected,
              approvalStatus: message.approvalStatus,
            },
            userId
          );

          // Update conversation timestamp
          await dbOps.updateConversation(conversationId, {}, userId);
        }

        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: [
              ...(state.messages[conversationId] || []),
              newMessage,
            ],
          },
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, updatedAt: new Date() } : c
          ),
        }));
      },

      updateStreamingContent: (content) => set({ streamingContent: content }),

      finalizeStreaming: async (conversationId, modelId, inputTokens, outputTokens, latencyMs, personaId) => {
        const { streamingContent } = get();
        if (!streamingContent) return;

        const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const now = new Date();

        const newMessage: Message = {
          id,
          conversationId,
          role: "assistant",
          content: streamingContent,
          modelId,
          personaId,
          inputTokens,
          outputTokens,
          latencyMs,
          createdAt: now,
        };

        // Skip persistence for incognito conversations
        const conv = get().conversations.find(c => c.id === conversationId);
        if (!conv?.isIncognito) {
          const userId = getUserId();
          await dbOps.createMessage(
            {
              id,
              conversationId,
              role: "assistant",
              content: streamingContent,
              modelId,
              personaId,
              inputTokens,
              outputTokens,
              latencyMs,
              createdAt: now,
            },
            userId
          );

          // Update conversation with new token count
          if (conv) {
            await dbOps.updateConversation(
              conversationId,
              { totalTokensUsed: conv.totalTokensUsed + inputTokens + outputTokens },
              userId
            );
          }
        }

        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: [
              ...(state.messages[conversationId] || []),
              newMessage,
            ],
          },
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                ...c,
                totalTokensUsed: c.totalTokensUsed + inputTokens + outputTokens,
                updatedAt: new Date(),
              }
              : c
          ),
          streamingContent: "",
          isLoading: false,
        }));
      },

      approveMessage: async (messageId) => {
        await db.messages.update(messageId, { approvalStatus: 'approved' });

        // Update State
        set((state) => {
          const newMessages = { ...state.messages };
          for (const convoId in newMessages) {
            newMessages[convoId] = newMessages[convoId].map(msg =>
              msg.id === messageId ? { ...msg, approvalStatus: 'approved' } : msg
            );
          }
          return { messages: newMessages };
        });
      },

      linkMessageToCanvas: async (messageId, canvasDocId, canvasIntro) => {
        await dbOps.updateMessage(messageId, { canvasDocId, canvasIntro });
        set((state) => {
          const newMessages = { ...state.messages };
          for (const convoId in newMessages) {
            newMessages[convoId] = newMessages[convoId].map(msg =>
              msg.id === messageId ? { ...msg, canvasDocId, canvasIntro } : msg
            );
          }
          return { messages: newMessages };
        });
      },

      setLoading: (loading) => set({ isLoading: loading }),

      // Project actions
      createProject: async (name, description, color) => {
        const id = `proj-${Date.now()}`;
        const now = new Date();
        const userId = getUserId();

        const project: Project = {
          id,
          name,
          description,
          color,
          defaultContextIds: [],
          createdAt: now,
          updatedAt: now,
        };

        // Save to IndexedDB
        await dbOps.createProject(
          {
            id,
            name,
            description,
            color,
            defaultContextIds: [],
            createdAt: now,
            updatedAt: now,
          },
          userId
        );

        set((state) => ({
          projects: [...state.projects, project],
        }));

        return id;
      },

      updateProject: async (id, updates) => {
        const userId = getUserId();

        // Update in IndexedDB
        const now = new Date();
        await db.projects.update(id, {
          ...updates,
          updatedAt: now,
          pendingSync: Boolean(userId),
        });

        if (userId) {
          await db.syncQueue.add({
            entityType: "project",
            entityId: id,
            operation: "update",
            data: updates,
            createdAt: now,
            retryCount: 0,
          });
        }

        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: now } : p
          ),
        }));
      },

      deleteProject: async (id) => {
        const userId = getUserId();

        if (userId) {
          // Soft delete for sync
          await db.projects.update(id, {
            deleted: true,
            pendingSync: true,
            updatedAt: new Date(),
          });
          await db.syncQueue.add({
            entityType: "project",
            entityId: id,
            operation: "delete",
            createdAt: new Date(),
            retryCount: 0,
          });
        } else {
          // Hard delete for offline mode
          await db.projects.delete(id);
        }

        // Update conversations that were in this project
        const convs = await db.conversations.where("projectId").equals(id).toArray();
        for (const conv of convs) {
          await db.conversations.update(conv.id, { projectId: undefined });
        }

        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          conversations: state.conversations.map((c) =>
            c.projectId === id ? { ...c, projectId: undefined } : c
          ),
        }));
      },

      // Context actions
      createContext: async (name, content) => {
        const id = `ctx-${Date.now()}`;
        const now = new Date();
        const userId = getUserId();
        // Rough token estimate: ~4 chars per token
        const tokenCount = Math.ceil(content.length / 4);

        const context: PersonalContext = {
          id,
          name,
          content,
          tokenCount,
          isDefault: false,
          createdAt: now,
          updatedAt: now,
        };

        // Save to IndexedDB
        await dbOps.createContext(
          {
            id,
            name,
            content,
            tokenCount,
            isDefault: false,
            createdAt: now,
            updatedAt: now,
          },
          userId
        );

        set((state) => ({
          contexts: [...state.contexts, context],
        }));

        return id;
      },

      updateContext: async (id, updates) => {
        const userId = getUserId();
        const ctx = get().contexts.find(c => c.id === id);
        if (!ctx) return;

        const newContent = updates.content ?? ctx.content;
        const tokenCount = Math.ceil(newContent.length / 4);
        const now = new Date();

        // Update in IndexedDB
        await db.contexts.update(id, {
          ...updates,
          tokenCount,
          updatedAt: now,
          pendingSync: Boolean(userId),
        });

        if (userId) {
          await db.syncQueue.add({
            entityType: "context",
            entityId: id,
            operation: "update",
            data: { ...updates, tokenCount },
            createdAt: now,
            retryCount: 0,
          });
        }

        set((state) => ({
          contexts: state.contexts.map((c) => {
            if (c.id !== id) return c;
            return { ...c, ...updates, tokenCount, updatedAt: now };
          }),
        }));
      },

      deleteContext: async (id) => {
        const userId = getUserId();

        if (userId) {
          // Soft delete for sync
          await db.contexts.update(id, {
            deleted: true,
            pendingSync: true,
            updatedAt: new Date(),
          });
          await db.syncQueue.add({
            entityType: "context",
            entityId: id,
            operation: "delete",
            createdAt: new Date(),
            retryCount: 0,
          });
        } else {
          // Hard delete for offline mode
          await db.contexts.delete(id);
        }

        // Remove context from any conversations
        const convs = await db.conversations.toArray();
        for (const conv of convs) {
          if (conv.activeContextIds.includes(id)) {
            await db.conversations.update(conv.id, {
              activeContextIds: conv.activeContextIds.filter(cid => cid !== id),
            });
          }
        }

        set((state) => ({
          contexts: state.contexts.filter((c) => c.id !== id),
          conversations: state.conversations.map((conv) => ({
            ...conv,
            activeContextIds: conv.activeContextIds.filter((cid) => cid !== id),
          })),
        }));
      },

      // Selectors
      getCurrentConversation: () => {
        const { conversations, currentConversationId } = get();
        return conversations.find((c) => c.id === currentConversationId);
      },

      getCurrentMessages: () => {
        const { messages, currentConversationId } = get();
        if (!currentConversationId) return [];
        return messages[currentConversationId] || [];
      },

      getConversationsByProject: (projectId) => {
        const { conversations } = get();
        return conversations.filter((c) =>
          projectId === null ? !c.projectId : c.projectId === projectId
        );
      },
    }),
    {
      name: "assistant-chat",
      // Only persist UI state, not data (data is in IndexedDB)
      partialize: (state) => ({
        currentConversationId: state.currentConversationId,
      }),
    }
  )
);
