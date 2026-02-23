import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CanvasDocument } from '@/types';
import { db, generateClientId, createSyncMeta } from '@/lib/db';
import { useAuthStore } from './auth';

function getUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

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
  updateDocument: (id: string, updates: Partial<Pick<CanvasDocument, 'title' | 'content'>>) => Promise<void>;
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
          const rows = await db.canvasDocuments.filter(d => !d.deleted).toArray();
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
        const local = {
          id,
          title,
          content,
          projectId,
          conversationId,
          createdAt: now,
          updatedAt: now,
          ...createSyncMeta(getUserId()),
        };
        await db.canvasDocuments.add(local);
        const doc: CanvasDocument = { id, title, content, projectId, conversationId, createdAt: now, updatedAt: now };
        set(s => ({ documents: [...s.documents, doc], activeDocumentId: id, isPanelOpen: true }));
        return id;
      },

      updateDocument: async (id, updates) => {
        const exists = get().documents.some(d => d.id === id);
        if (!exists) return;
        const now = new Date();
        await db.canvasDocuments.update(id, { ...updates, updatedAt: now, pendingSync: true });
        set(s => ({
          documents: s.documents.map(d =>
            d.id === id ? { ...d, ...updates, updatedAt: now } : d
          ),
        }));
      },

      deleteDocument: async (id) => {
        await db.canvasDocuments.update(id, { deleted: true, pendingSync: true });
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
