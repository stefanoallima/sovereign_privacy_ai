import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CanvasDocument } from '@/types';
import { db, generateClientId } from '@/lib/db';

interface CanvasStore {
  // State
  documents: CanvasDocument[];
  activeDocumentId: string | null;
  isPanelOpen: boolean;
  streamingDocId: string | null;
  isInitialized: boolean;

  // Init
  initialize: () => Promise<void>;

  // Panel
  openPanel: (documentId?: string) => void;
  closePanel: () => void;

  // Streaming pulse
  setStreamingDocId: (id: string | null) => void;

  // CRUD
  createDocument: (opts: {
    title: string;
    content: string;
    projectId?: string;
    conversationId?: string;
  }) => Promise<string>;
  updateDocument: (id: string, updates: Partial<Pick<CanvasDocument, 'title' | 'content' | 'projectId'>>) => Promise<void>;
  /** Move all canvas documents that belong to a conversation to a new project (or clear projectId). */
  moveConversationDocuments: (conversationId: string, projectId: string | null) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;

  // Selectors
  getActiveDocument: () => CanvasDocument | undefined;
  getDocumentsByProject: (projectId: string) => CanvasDocument[];
  getDocumentsByConversation: (conversationId: string) => CanvasDocument[];
}

export const useCanvasStore = create<CanvasStore>()(
  persist(
    (set, get) => ({
      documents: [],
      activeDocumentId: null,
      isPanelOpen: false,
      streamingDocId: null,
      isInitialized: false,

      initialize: async () => {
        if (get().isInitialized) return;
        try {
          const rows = await db.canvasDocuments.toArray();
          const documents: CanvasDocument[] = rows.map(r => ({
            id: r.id,
            projectId: r.projectId,
            conversationId: r.conversationId,
            title: r.title,
            content: r.content,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          }));
          set({ documents, isInitialized: true });
        } catch (error) {
          console.error('Failed to initialize canvas store from IndexedDB:', error);
          set({ isInitialized: true });
        }
      },

      openPanel: (documentId) => {
        set(s => ({
          isPanelOpen: true,
          activeDocumentId: documentId ?? s.activeDocumentId,
        }));
      },

      closePanel: () => set({ isPanelOpen: false }),

      setStreamingDocId: (id) => set({ streamingDocId: id }),

      createDocument: async ({ title, content, projectId, conversationId }) => {
        const id = generateClientId();
        const now = new Date();
        await db.canvasDocuments.add({ id, title, content, projectId, conversationId, createdAt: now, updatedAt: now });
        const doc: CanvasDocument = { id, title, content, projectId, conversationId, createdAt: now, updatedAt: now };
        set(s => ({ documents: [...s.documents, doc], activeDocumentId: id, isPanelOpen: true }));
        return id;
      },

      updateDocument: async (id, updates) => {
        const exists = get().documents.some(d => d.id === id);
        if (!exists) return;
        const now = new Date();
        await db.canvasDocuments.update(id, { ...updates, updatedAt: now });
        set(s => ({
          documents: s.documents.map(d =>
            d.id === id ? { ...d, ...updates, updatedAt: now } : d
          ),
        }));
      },

      moveConversationDocuments: async (conversationId, projectId) => {
        const docs = get().documents.filter(d => d.conversationId === conversationId);
        for (const doc of docs) {
          await get().updateDocument(doc.id, { projectId: projectId ?? undefined });
        }
      },

      deleteDocument: async (id) => {
        await db.canvasDocuments.delete(id);
        set(s => ({
          documents: s.documents.filter(d => d.id !== id),
          activeDocumentId: s.activeDocumentId === id ? null : s.activeDocumentId,
          isPanelOpen: s.activeDocumentId === id ? false : s.isPanelOpen,
        }));
      },

      getActiveDocument: () => {
        const { documents, activeDocumentId } = get();
        return documents.find(d => d.id === activeDocumentId);
      },

      getDocumentsByProject: (projectId) => {
        return get().documents.filter(d => d.projectId === projectId);
      },

      getDocumentsByConversation: (conversationId) => {
        return get().documents.filter(d => d.conversationId === conversationId);
      },
    }),
    {
      name: 'canvas-store',
      partialize: (s) => ({ activeDocumentId: s.activeDocumentId }),
    }
  )
);
