# Obsidian Pro — Canvas Workspace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform AILocalMind into a premium "Obsidian Pro" desktop workspace with a Shell+Panels layout, Project Explorer sidebar, AI Canvas pane with auto-routing, and Living Brief context header.

**Architecture:** Introduce `WorkspaceLayout.tsx` as the new layout shell owning all panel orchestration. Replace the flat sidebar with a `ProjectExplorer` component. Wire `CanvasPanel` into the shell with a `useCanvas` hook managing open/close + content. Add `LivingBrief` as a collapsible header inside `ChatWindow`. Persist canvas documents as a new `CanvasDocument` entity in Dexie + Zustand.

**Tech Stack:** React 19, Tauri 2, Zustand (persist), Dexie (IndexedDB), Tailwind CSS v4, Lucide icons, react-markdown + remark-gfm (already installed), react-resizable-panels (new dep)

---

## Refinements Applied (v2)

| # | Refinement | Task |
|---|-----------|------|
| 1 | Resizable splitter (react-resizable-panels) replaces fixed `max-w-[50%]` | Task 4 |
| 2 | Ghost empty states with Template Shelf (actionable, persona-aware) | Task 5 & 7 |
| 3 | "Sync to Brief" button on CanvasPanel pushes canvas content → LivingBrief | Task 8 |
| 4 | Streaming Pulse (violet glow) on `📄` icon in ProjectExplorer during AI routing | Task 7 |
| + | Auto-routing "Dismiss" option so user can suppress canvas in quick-chat flow | Task 6 |
| + | Chevron animations use `cubic-bezier(0.16, 1, 0.3, 1)` in ProjectExplorer | Task 7 |
| + | `--shadow-glow-violet` kept subtle (opacity ≤ 0.3) to preserve Obsidian minimalism | Task 1 |

---

## Task 1: Obsidian Pro Design Tokens

**Files:**
- Modify: `apps/desktop/src/index.css`

**What this does:** Replaces the current color scheme with the Obsidian Pro palette — deep true-black background, L0/L1/L2 depth system, Sovereign Cyan + Iridescent Violet dual accents, tightened typography, standardized easing.

**Step 1: Replace CSS custom properties in `index.css`**

Replace the entire `:root` and `.dark` blocks with the following. Keep all animation/utility classes below them unchanged.

```css
/* Modern font - Inter */
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:wght@400;500&display=swap');

@import "tailwindcss";
@plugin "@tailwindcss/typography";

/* ─── Obsidian Pro Design Tokens ─────────────────────────────────────────── */
:root {
  /* Depth layers */
  --background: 220 15% 8%;        /* L0 — app shell */
  --surface-1: 220 15% 11%;        /* L1 — panels */
  --surface-2: 220 15% 14%;        /* L2 — cards / bubbles */

  /* Foreground */
  --foreground: 220 10% 92%;
  --foreground-muted: 220 8% 55%;
  --foreground-subtle: 220 8% 35%;

  /* Aliases (keep existing var names working) */
  --card: 220 15% 11%;
  --card-foreground: 220 10% 92%;
  --popover: 220 15% 13%;
  --popover-foreground: 220 10% 92%;

  /* Primary — Sovereign Cyan */
  --primary: 199 89% 58%;
  --primary-foreground: 220 15% 8%;

  /* Secondary — Iridescent Violet */
  --secondary: 220 15% 16%;
  --secondary-foreground: 220 10% 92%;
  --violet: 267 84% 71%;
  --violet-muted: 267 50% 40%;

  /* Muted */
  --muted: 220 15% 14%;
  --muted-foreground: 220 8% 50%;

  /* Accent */
  --accent: 220 15% 17%;
  --accent-foreground: 220 10% 92%;

  /* Destructive */
  --destructive: 0 70% 55%;
  --destructive-foreground: 220 10% 92%;

  /* Borders — separated by depth, not lines */
  --border: 220 15% 18%;
  --input: 220 15% 16%;
  --ring: 199 89% 58%;

  /* Radius */
  --radius: 0.75rem;

  /* Standardized easing */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

  /* Shadows — glow-based in dark */
  --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.4);
  --shadow: 0 4px 8px -2px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.4);
  --shadow-md: 0 8px 16px -4px rgb(0 0 0 / 0.6), 0 4px 8px -4px rgb(0 0 0 / 0.4);
  --shadow-lg: 0 20px 32px -8px rgb(0 0 0 / 0.7), 0 8px 16px -8px rgb(0 0 0 / 0.5);
  --shadow-glow-cyan: 0 0 20px -4px hsl(199 89% 58% / 0.35);
  --shadow-glow-violet: 0 0 20px -4px hsl(267 84% 71% / 0.3);

  /* Glass */
  --glass-border: 255 255 255 / 0.06;
}

/* Light mode override (keep available for AppearanceSettings) */
.light {
  --background: 220 14% 96%;
  --surface-1: 0 0% 100%;
  --surface-2: 220 14% 97%;
  --foreground: 222 47% 11%;
  --foreground-muted: 215 16% 47%;
  --foreground-subtle: 215 16% 65%;
  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;
  --popover: 0 0% 100%;
  --popover-foreground: 222 47% 11%;
  --primary: 199 89% 42%;
  --primary-foreground: 0 0% 100%;
  --secondary: 210 40% 96%;
  --secondary-foreground: 222 47% 11%;
  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;
  --accent: 210 40% 96%;
  --accent-foreground: 222 47% 11%;
  --border: 214 32% 91%;
  --input: 214 32% 91%;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05);
  --shadow-md: 0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.06);
  --shadow-lg: 0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.05);
  --glass-border: 0 0 0 / 0.06;
}
```

**Step 2: Update global body styles**

After the `:root` / `.light` blocks, add:

```css
/* Base */
html, body {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family: 'Inter', system-ui, sans-serif;
  font-feature-settings: 'cv11', 'ss01';
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  letter-spacing: -0.011em;
}

/* Scrollbar — thin, dark */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 99px; }
::-webkit-scrollbar-thumb:hover { background: hsl(var(--foreground-subtle)); }
```

**Step 3: Update `.glass`, `.glass-subtle`, `.glass-heavy` to use new vars**

```css
.glass {
  background: hsl(var(--popover) / 0.85);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(var(--glass-border));
}
.glass-subtle {
  background: hsl(var(--surface-1) / 0.7);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(var(--glass-border));
}
.glass-heavy {
  background: hsl(var(--surface-1) / 0.95);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
}
```

**Step 4: Add new utility classes**

```css
/* Sovereign gradient text (violet→cyan) */
.text-sovereign {
  background: linear-gradient(135deg, hsl(var(--violet)) 0%, hsl(var(--primary)) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Glow effects */
.glow-cyan { box-shadow: var(--shadow-glow-cyan); }
.glow-violet { box-shadow: var(--shadow-glow-violet); }

/* Panel slide — used by all panels */
.panel-slide-enter { animation: slide-in-right 240ms var(--ease-out-expo) forwards; }
.panel-slide-exit  { animation: slide-out-right 200ms var(--ease-in-out) forwards; }

@keyframes slide-out-right {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(16px); }
}
```

**Step 5: Verify Vite reloads without errors**

Run: `pnpm tauri dev` (or check running instance hot-reload)
Expected: App loads, background is near-black (`#0e1015`), no console errors.

**Step 6: Commit**

```bash
git add apps/desktop/src/index.css
git commit -m "feat: apply Obsidian Pro design tokens"
```

---

## Task 2: CanvasDocument Data Model

**Files:**
- Modify: `apps/desktop/src/types/index.ts`
- Modify: `apps/desktop/src/lib/db.ts`

**What this does:** Adds `CanvasDocument` as a first-class entity — persisted in Dexie, linked to a project and optionally a conversation.

**Step 1: Add `CanvasDocument` type to `src/types/index.ts`**

At the end of the file, add:

```typescript
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
```

**Step 2: Add `LocalCanvasDocument` to `src/lib/db.ts`**

After `LocalContext`:

```typescript
export interface LocalCanvasDocument extends SyncMeta {
  id: string;
  projectId?: string;
  conversationId?: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Step 3: Add `canvasDocuments` table to `AppDatabase`**

In `AppDatabase`, add the table property:

```typescript
canvasDocuments!: Table<LocalCanvasDocument>;
```

Add a new database version (bump to 2) to avoid breaking existing data:

```typescript
this.version(2).stores({
  canvasDocuments: 'id, clientId, userId, projectId, conversationId, updatedAt, pendingSync, deleted',
});
```

Keep the existing `version(1)` block unchanged.

**Step 4: Add `dbOps` helpers for canvas documents**

In `db.ts`, find the `dbOps` export (or add if it's inline) and add:

```typescript
// Canvas document operations
async createCanvasDocument(doc: Omit<LocalCanvasDocument, 'clientId' | 'userId' | 'syncedAt' | 'pendingSync'>): Promise<void> {
  await db.canvasDocuments.add({ ...doc, ...createSyncMeta(getUserId()) });
},
async updateCanvasDocument(id: string, updates: Partial<LocalCanvasDocument>): Promise<void> {
  await db.canvasDocuments.update(id, { ...updates, updatedAt: new Date(), pendingSync: true });
},
async deleteCanvasDocument(id: string): Promise<void> {
  await db.canvasDocuments.update(id, { deleted: true, pendingSync: true });
},
async getCanvasDocumentsByProject(projectId: string): Promise<LocalCanvasDocument[]> {
  return db.canvasDocuments.where('projectId').equals(projectId).and(d => !d.deleted).toArray();
},
async getAllCanvasDocuments(): Promise<LocalCanvasDocument[]> {
  return db.canvasDocuments.filter(d => !d.deleted).toArray();
},
```

**Step 5: Commit**

```bash
git add apps/desktop/src/types/index.ts apps/desktop/src/lib/db.ts
git commit -m "feat: add CanvasDocument data model and Dexie table"
```

---

## Task 3: Canvas Zustand Store

**Files:**
- Create: `apps/desktop/src/stores/canvas.ts`
- Modify: `apps/desktop/src/stores/index.ts`

**What this does:** Creates a `useCanvasStore` that manages all canvas document state — open/close, active document, CRUD.

**Step 1: Create `src/stores/canvas.ts`**

```typescript
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
  isInitialized: boolean;

  // Init
  initialize: () => Promise<void>;

  // Panel
  openPanel: (documentId?: string) => void;
  closePanel: () => void;

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
      isInitialized: false,

      initialize: async () => {
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
      },

      openPanel: (documentId) => {
        set(s => ({
          isPanelOpen: true,
          activeDocumentId: documentId ?? s.activeDocumentId,
        }));
      },

      closePanel: () => set({ isPanelOpen: false }),

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
```

**Step 2: Export from `src/stores/index.ts`**

Add at the end:

```typescript
export { useCanvasStore } from './canvas';
```

**Step 3: Commit**

```bash
git add apps/desktop/src/stores/canvas.ts apps/desktop/src/stores/index.ts
git commit -m "feat: add canvas Zustand store"
```

---

## Task 4: WorkspaceLayout Shell with Resizable Splitter

**Files:**
- Create: `apps/desktop/src/components/layout/WorkspaceLayout.tsx`
- Modify: `apps/desktop/src/App.tsx`

**What this does:** Introduces the new shell with `react-resizable-panels` so users can drag the chat/canvas split point freely (e.g. shrink chat to 20% to maximize canvas reading space). ContextPanel hides when canvas opens.

**Step 1: Install react-resizable-panels**

```bash
cd apps/desktop && pnpm add react-resizable-panels
```

Expected: Package added to `package.json`, no peer dep errors.

**Step 2: Create `src/components/layout/WorkspaceLayout.tsx`**

```tsx
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { useCanvasStore } from '@/stores';
import { CanvasPanel } from '@/components/chat/CanvasPanel';

interface WorkspaceLayoutProps {
  sidebar: React.ReactNode;
  chat: React.ReactNode;
  contextPanel: React.ReactNode;
}

export function WorkspaceLayout({ sidebar, chat, contextPanel }: WorkspaceLayoutProps) {
  const { isPanelOpen } = useCanvasStore();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[hsl(var(--background))]">
      {/* Left: Project Explorer — fixed width, not resizable */}
      <div className="flex-shrink-0">
        {sidebar}
      </div>

      {/* Center + Right: resizable */}
      <div className="flex flex-1 overflow-hidden">
        {isPanelOpen ? (
          <PanelGroup direction="horizontal" className="flex-1">
            {/* Chat panel — min 20%, default 55% */}
            <Panel defaultSize={55} minSize={20} className="flex flex-col overflow-hidden">
              {chat}
            </Panel>

            {/* Drag handle */}
            <PanelResizeHandle className="w-1 bg-transparent hover:bg-[hsl(var(--primary)/0.4)] active:bg-[hsl(var(--primary)/0.6)] transition-colors cursor-col-resize group relative">
              {/* Visual indicator dot */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-[hsl(var(--border))] group-hover:bg-[hsl(var(--primary)/0.6)] transition-colors" />
            </PanelResizeHandle>

            {/* Canvas panel — min 25%, default 45% */}
            <Panel defaultSize={45} minSize={25} className="flex flex-col overflow-hidden">
              <CanvasPanel />
            </Panel>
          </PanelGroup>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            <main className="flex flex-1 flex-col overflow-hidden">
              {chat}
            </main>
            <div className="flex-shrink-0">
              {contextPanel}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Update desktop layout in `src/App.tsx`**

Replace the desktop `return` block with:

```tsx
// Desktop Layout
return (
  <>
    <WorkspaceLayout
      sidebar={
        <Sidebar
          onSettingsClick={() => setIsSettingsOpen(true)}
          onSupportClick={() => setIsSupportOpen(true)}
        />
      }
      chat={<ChatWindow />}
      contextPanel={<ContextPanel />}
    />

    {/* Overlays — unchanged */}
    <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    <SupportChat isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
    {isUploadModalOpen && (/* ... keep existing upload modal JSX ... */)}
  </>
);
```

Add imports:
```tsx
import { WorkspaceLayout } from '@/components/layout/WorkspaceLayout';
import { useCanvasStore } from '@/stores';
```

Initialize canvas store in `MainApp`:
```tsx
const { initialize: initCanvas, isInitialized: canvasInitialized } = useCanvasStore();
useEffect(() => {
  if (!canvasInitialized) initCanvas();
}, [canvasInitialized, initCanvas]);
```

**Step 4: Verify layout + splitter**

Run the dev app. Send a message, click "Open in Canvas." Expected: panel opens at ~55/45 split. Drag the handle — both panels resize smoothly. Drag chat to ~20% — canvas fills remaining space.

**Step 5: Commit**

```bash
git add apps/desktop/src/components/layout/WorkspaceLayout.tsx apps/desktop/src/App.tsx apps/desktop/package.json apps/desktop/pnpm-lock.yaml
git commit -m "feat: WorkspaceLayout shell with react-resizable-panels splitter"
```

---

## Task 5: Rebuild CanvasPanel

**Files:**
- Modify: `apps/desktop/src/components/chat/CanvasPanel.tsx`

**What this does:** Completely rewrites the stub CanvasPanel to use `useCanvasStore`, adds title editing, save-to-project, delete, and the Obsidian Pro visual treatment.

**Step 1: Replace `CanvasPanel.tsx` entirely**

```tsx
import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, Eye, Edit2, FileText, Trash2, Save, FolderPlus } from 'lucide-react';
import { useCanvasStore, useChatStore } from '@/stores';

export function CanvasPanel() {
  const { getActiveDocument, updateDocument, deleteDocument, closePanel } = useCanvasStore();
  const { projects } = useChatStore();
  const doc = getActiveDocument();

  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [editContent, setEditContent] = useState(doc?.content ?? '');
  const [editTitle, setEditTitle] = useState(doc?.title ?? '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const handleSave = useCallback(async () => {
    if (!doc) return;
    await updateDocument(doc.id, { content: editContent, title: editTitle });
    setIsDirty(false);
  }, [doc, editContent, editTitle, updateDocument]);

  const handleDelete = useCallback(async () => {
    if (!doc) return;
    await deleteDocument(doc.id);
  }, [doc, deleteDocument]);

  // Ghost empty state with Template Shelf
  if (!doc) {
    return (
      <CanvasEmptyState />
    );
  }

  return (
    <div className="w-[480px] flex-shrink-0 border-l border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] flex flex-col h-full panel-slide-enter">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText className="h-4 w-4 text-[hsl(var(--violet))] flex-shrink-0" />
          {isEditingTitle ? (
            <input
              autoFocus
              value={editTitle}
              onChange={e => { setEditTitle(e.target.value); setIsDirty(true); }}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={e => e.key === 'Enter' && setIsEditingTitle(false)}
              className="flex-1 text-sm font-semibold bg-transparent border-none outline-none text-[hsl(var(--foreground))] min-w-0"
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] transition-colors truncate text-left"
            >
              {doc.title}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Preview / Edit toggle */}
          <div className="flex bg-[hsl(var(--surface-2))] p-0.5 rounded-lg mr-1">
            <button
              onClick={() => setMode('preview')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-120 ${
                mode === 'preview'
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))] shadow-sm'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              <Eye className="h-3 w-3" /> Preview
            </button>
            <button
              onClick={() => setMode('edit')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-120 ${
                mode === 'edit'
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))] shadow-sm'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              <Edit2 className="h-3 w-3" /> Edit
            </button>
          </div>

          {isDirty && (
            <button
              onClick={handleSave}
              className="p-1.5 rounded-lg bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.25)] transition-colors"
              title="Save"
            >
              <Save className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={handleDelete}
            className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] transition-colors"
            title="Delete document"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          <button
            onClick={closePanel}
            className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Project badge */}
      {doc.projectId && (
        <div className="px-4 py-1.5 border-b border-[hsl(var(--border))] flex items-center gap-1.5">
          <FolderPlus className="h-3 w-3 text-[hsl(var(--violet))]" />
          <span className="text-[11px] text-[hsl(var(--muted-foreground))] tracking-wide uppercase font-medium">
            {projects.find(p => p.id === doc.projectId)?.name ?? 'Project'}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {mode === 'preview' ? (
          <div className="prose prose-sm prose-invert max-w-none
            prose-headings:text-[hsl(var(--foreground))] prose-headings:font-semibold
            prose-p:text-[hsl(var(--foreground-muted))]
            prose-code:text-[hsl(var(--primary))] prose-code:bg-[hsl(var(--surface-2))]
            prose-pre:bg-[hsl(var(--surface-2))] prose-pre:border prose-pre:border-[hsl(var(--border))]
            prose-a:text-[hsl(var(--primary))]
            prose-strong:text-[hsl(var(--foreground))]
            prose-th:text-[hsl(var(--foreground))] prose-td:text-[hsl(var(--foreground-muted))]
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {doc.content}
            </ReactMarkdown>
          </div>
        ) : (
          <textarea
            value={editContent}
            onChange={e => { setEditContent(e.target.value); setIsDirty(true); }}
            className="w-full h-full min-h-[600px] bg-transparent resize-none focus:outline-none
              text-sm font-mono leading-relaxed
              text-[hsl(var(--foreground-muted))] placeholder:text-[hsl(var(--foreground-subtle))]"
            placeholder="Write markdown here..."
            spellCheck={false}
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[hsl(var(--border))] flex items-center justify-between flex-shrink-0">
        <span className="text-[11px] text-[hsl(var(--foreground-subtle))]">
          {doc.content.split(/\s+/).filter(Boolean).length} words
        </span>
        <span className="text-[11px] text-[hsl(var(--foreground-subtle))]">
          Updated {new Date(doc.updatedAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
```

**Step 2: Create `CanvasEmptyState` component (inline in CanvasPanel.tsx or separate)**

```tsx
// Ghost Template Shelf — actionable empty state
const CANVAS_TEMPLATES = [
  { icon: '📊', label: 'Draft Tax Strategy', prompt: 'Create a structured tax strategy document for my situation, with sections for income overview, deduction opportunities, and risk areas.' },
  { icon: '📝', label: 'CBT Journal Entry', prompt: 'Help me structure a CBT journal entry for today, with sections for situation, automatic thoughts, emotions, evidence for/against, and balanced perspective.' },
  { icon: '📋', label: 'Project Brief', prompt: 'Create a professional project brief document with sections for objective, scope, stakeholders, timeline, and success criteria.' },
  { icon: '⚖️', label: 'Legal Risk Summary', prompt: 'Produce a structured legal risk summary document with identified risks, likelihood ratings, impact assessment, and mitigation recommendations.' },
];

function CanvasEmptyState() {
  const { sendMessage } = usePrivacyChatOrSimilar(); // use whichever send hook is available in scope
  const { closePanel } = useCanvasStore();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
      <div className="text-center">
        <div className="h-12 w-12 rounded-2xl bg-[hsl(var(--violet)/0.15)] border border-[hsl(var(--violet)/0.3)] flex items-center justify-center mx-auto mb-4">
          <FileText className="h-6 w-6 text-[hsl(var(--violet))]" />
        </div>
        <h3 className="text-[14px] font-semibold text-[hsl(var(--foreground))] mb-1">Canvas is empty</h3>
        <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
          Ask the AI to create a document, or start from a template
        </p>
      </div>

      {/* Template shelf */}
      <div className="w-full max-w-sm space-y-2">
        {CANVAS_TEMPLATES.map(t => (
          <button
            key={t.label}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
              bg-[hsl(var(--surface-2))] border border-[hsl(var(--border))]
              hover:border-[hsl(var(--violet)/0.4)] hover:bg-[hsl(var(--violet)/0.05)]
              text-left transition-all duration-120 group opacity-70 hover:opacity-100"
            onClick={() => {
              // Fire the template prompt to the active chat
              // Implementation: dispatch to ChatWindow's sendMessage via a custom event or shared store
              window.dispatchEvent(new CustomEvent('canvas:template-prompt', { detail: t.prompt }));
            }}
          >
            <span className="text-lg">{t.icon}</span>
            <div>
              <p className="text-[12px] font-medium text-[hsl(var(--foreground-muted))] group-hover:text-[hsl(var(--foreground))]">{t.label}</p>
              <p className="text-[11px] text-[hsl(var(--foreground-subtle))] truncate max-w-[220px]">{t.prompt.slice(0, 55)}…</p>
            </div>
          </button>
        ))}
      </div>

      <button onClick={closePanel} className="text-[11px] text-[hsl(var(--foreground-subtle))] hover:text-[hsl(var(--muted-foreground))] transition-colors">
        Close panel
      </button>
    </div>
  );
}
```

In `ChatWindow.tsx`, listen for the template event:
```typescript
useEffect(() => {
  const handler = (e: CustomEvent) => setInput(e.detail as string);
  window.addEventListener('canvas:template-prompt', handler as EventListener);
  return () => window.removeEventListener('canvas:template-prompt', handler as EventListener);
}, []);
```

**Step 3: Commit**

```bash
git add apps/desktop/src/components/chat/CanvasPanel.tsx
git commit -m "feat: rebuild CanvasPanel with store integration, Obsidian Pro styling, and template shelf"
```

---

## Task 6: AI Canvas Auto-routing in ChatWindow

**Files:**
- Modify: `apps/desktop/src/components/chat/ChatWindow.tsx`

**What this does:** After each AI response, detects if the content is a long-form document (>400 words OR contains `# ` heading OR contains a markdown table) and auto-creates a canvas document. Adds a manual "Open in Canvas" button to every assistant message bubble.

**Step 1: Add canvas detection utility (inline in ChatWindow)**

At the top of `ChatWindow.tsx`, after imports:

```typescript
// Detect if AI response should auto-route to canvas
function shouldAutoCanvas(content: string): boolean {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const hasH1 = /^# /m.test(content);
  const hasTable = /^\|.+\|/m.test(content);
  const hasMultipleHeaders = (content.match(/^#{1,3} /gm) || []).length >= 2;
  return wordCount > 400 || hasH1 || hasTable || hasMultipleHeaders;
}

// Extract a title from the first markdown heading, or use first line
function extractCanvasTitle(content: string): string {
  const headingMatch = content.match(/^#+ (.+)/m);
  if (headingMatch) return headingMatch[1].trim();
  const firstLine = content.split('\n')[0].trim();
  return firstLine.length > 60 ? firstLine.slice(0, 57) + '...' : firstLine || 'Canvas Document';
}
```

**Step 2: Import `useCanvasStore` in ChatWindow**

Add to the existing import:
```typescript
import { useCanvasStore } from '@/stores';
```

**Step 3: Use canvas store in ChatWindow component**

Inside `ChatWindow()`, add:
```typescript
const { createDocument, openPanel } = useCanvasStore();
```

**Step 4: Auto-route after AI response finalizes — with Dismiss toast**

Find the `finalizeStreaming` call in `ChatWindow`. After the `finalizeStreaming` call, add:

```typescript
// Auto-route long-form content to canvas
if (shouldAutoCanvas(streamingContent)) {
  const title = extractCanvasTitle(streamingContent);
  // Show non-blocking toast first; only create if not dismissed within 4s
  setCanvasToast({ title, content: streamingContent });
  const timer = setTimeout(async () => {
    await createDocument({
      title,
      content: streamingContent,
      projectId: conversationProjectId,
      conversationId: currentConversationId ?? undefined,
    });
    setCanvasToast(null);
  }, 4000);
  setCanvasToastTimer(timer);
}
```

Add state for the toast:
```typescript
const [canvasToast, setCanvasToast] = useState<{ title: string; content: string } | null>(null);
const [canvasToastTimer, setCanvasToastTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

const dismissCanvasToast = () => {
  if (canvasToastTimer) clearTimeout(canvasToastTimer);
  setCanvasToast(null);
  setCanvasToastTimer(null);
};
```

Render the toast (fixed bottom-right, above input bar):
```tsx
{canvasToast && (
  <div className="absolute bottom-28 right-4 z-30 flex items-center gap-3 px-4 py-3 rounded-xl
    bg-[hsl(var(--surface-2))] border border-[hsl(var(--violet)/0.4)]
    shadow-[var(--shadow-glow-violet)] animate-slide-in-right text-[12px]">
    <FileText className="h-4 w-4 text-[hsl(var(--violet))] flex-shrink-0" />
    <div className="min-w-0">
      <p className="font-medium text-[hsl(var(--foreground))]">Routing to Canvas</p>
      <p className="text-[hsl(var(--muted-foreground))] truncate max-w-[180px]">{canvasToast.title}</p>
    </div>
    <button
      onClick={dismissCanvasToast}
      className="text-[11px] px-2 py-0.5 rounded-lg bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors flex-shrink-0"
    >
      Dismiss
    </button>
  </div>
)}
```

**Step 5: Add "Open in Canvas" button to MessageBubble**

In `MessageBubble.tsx`, add an `onOpenCanvas?: (content: string) => void` prop and render a small button on assistant messages:

```tsx
// In MessageBubble props interface:
onOpenCanvas?: (content: string) => void;

// In the assistant message render, after the content:
{onOpenCanvas && message.role === 'assistant' && (
  <button
    onClick={() => onOpenCanvas(message.content)}
    className="mt-2 flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors opacity-0 group-hover:opacity-100"
  >
    <FileText className="h-3 w-3" />
    Open in Canvas
  </button>
)}
```

In `ChatWindow.tsx`, pass `onOpenCanvas` to each `MessageBubble`:

```tsx
onOpenCanvas={async (content) => {
  const title = extractCanvasTitle(content);
  await createDocument({
    title,
    content,
    projectId: conversationProjectId,
    conversationId: currentConversationId ?? undefined,
  });
}}
```

**Step 6: Commit**

```bash
git add apps/desktop/src/components/chat/ChatWindow.tsx apps/desktop/src/components/chat/MessageBubble.tsx
git commit -m "feat: auto-route AI responses to canvas + manual Open in Canvas button"
```

---

## Task 7: Project Explorer Sidebar

**Files:**
- Create: `apps/desktop/src/components/layout/ProjectExplorer.tsx`
- Modify: `apps/desktop/src/components/chat/Sidebar.tsx`

**What this does:** Adds a project tree section at the top of the sidebar showing `📁 Project → 💬 Chat | 📄 Canvas Doc` hierarchy. Clicking a canvas doc opens it in the panel directly without opening the chat.

**Step 1: Create `src/components/layout/ProjectExplorer.tsx`**

```tsx
import { useState } from 'react';
import { FolderOpen, Folder, MessageSquare, FileText, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useChatStore, useCanvasStore } from '@/stores';

export function ProjectExplorer() {
  const { projects, conversations, selectConversation, createProject } = useChatStore();
  const { documents, openPanel, createDocument } = useCanvasStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="px-2 py-3">
      {/* Header */}
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-[11px] font-semibold tracking-widest uppercase text-[hsl(var(--foreground-subtle))]">
          Projects
        </span>
        <button
          onClick={() => {/* open CreateProjectDialog */}}
          className="p-1 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {projects.length === 0 && (
        <p className="px-2 text-[12px] text-[hsl(var(--foreground-subtle))] italic">No projects yet</p>
      )}

      {projects.map(project => {
        const isExpanded = expanded.has(project.id);
        const projectChats = conversations.filter(c => c.projectId === project.id);
        const projectDocs = documents.filter(d => d.projectId === project.id);
        const hasChildren = projectChats.length > 0 || projectDocs.length > 0;

        return (
          <div key={project.id} className="mb-0.5">
            {/* Project row */}
            <button
              onClick={() => toggle(project.id)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left
                text-[13px] font-medium text-[hsl(var(--foreground-muted))]
                hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]
                transition-colors group"
            >
              {hasChildren
                ? <ChevronRight
                    className="h-3 w-3 flex-shrink-0 text-[hsl(var(--foreground-subtle))] transition-transform"
                    style={{
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                      transitionDuration: '200ms',
                    }}
                  />
                : <span className="w-3 flex-shrink-0" />
              }
              {isExpanded
                ? <FolderOpen className="h-4 w-4 flex-shrink-0" style={{ color: project.color }} />
                : <Folder className="h-4 w-4 flex-shrink-0" style={{ color: project.color }} />
              }
              <span className="truncate">{project.name}</span>
            </button>

            {/* Children */}
            {isExpanded && (
              <div className="ml-5 border-l border-[hsl(var(--border))] pl-2 mt-0.5 space-y-0.5">
                {projectChats.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => selectConversation(chat.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left
                      text-[12px] text-[hsl(var(--foreground-subtle))]
                      hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]
                      transition-colors"
                  >
                    <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-[hsl(var(--muted-foreground))]" />
                    <span className="truncate">{chat.title}</span>
                  </button>
                ))}

                {projectDocs.map(doc => {
                  // Streaming pulse: glow when this doc is actively being written by AI
                  const isStreaming = streamingDocId === doc.id;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => openPanel(doc.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left
                        text-[12px] text-[hsl(var(--foreground-subtle))]
                        hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]
                        transition-colors"
                    >
                      <FileText
                        className={`h-3.5 w-3.5 flex-shrink-0 transition-all ${
                          isStreaming
                            ? 'text-[hsl(var(--violet))] drop-shadow-[0_0_6px_hsl(267_84%_71%/0.8)] animate-pulse'
                            : 'text-[hsl(var(--violet))]'
                        }`}
                      />
                      <span className="truncate">{doc.title}</span>
                      {isStreaming && (
                        <span className="ml-auto text-[10px] text-[hsl(var(--violet))] animate-pulse flex-shrink-0">writing…</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Integrate into `Sidebar.tsx`**

Import and render `ProjectExplorer` above the conversations list in `Sidebar.tsx`:

```tsx
import { ProjectExplorer } from '@/components/layout/ProjectExplorer';

// At the top of the sidebar return, before the conversations section:
<ProjectExplorer />
<div className="border-t border-[hsl(var(--border))] my-1" />
// ...rest of conversations list
```

**Step 3: Apply Obsidian Pro sidebar styles**

In `Sidebar.tsx`, update the root wrapper:

```tsx
// From:
<div className="w-64 flex-shrink-0 ...">
// To:
<div className="w-[220px] flex-shrink-0 bg-[hsl(var(--surface-1))] border-r border-[hsl(var(--border))] flex flex-col h-full">
```

**Step 4: Expose `streamingDocId` from canvas store**

In `canvas.ts`, add to `CanvasStore`:
```typescript
streamingDocId: string | null;
setStreamingDocId: (id: string | null) => void;
```
In the store implementation:
```typescript
streamingDocId: null,
setStreamingDocId: (id) => set({ streamingDocId: id }),
```

In `ChatWindow.tsx`, set the streaming doc ID during auto-routing:
```typescript
// Before the 4s timer fires:
setStreamingDocId(newDocId); // after createDocument resolves
// After the timer fires and doc is created:
setStreamingDocId(null);
```

Pass `streamingDocId` into `ProjectExplorer` via `useCanvasStore`:
```typescript
const { streamingDocId } = useCanvasStore();
```

**Step 5: Ghost empty state for Project Explorer**

When `projects.length === 0`, replace the `<p>No projects yet</p>` with:

```tsx
{projects.length === 0 && (
  <div className="px-2 py-4 space-y-1.5">
    {[
      { icon: '📁', label: 'Q1 Tax Preparation', sub: 'Ghost project' },
      { icon: '📁', label: 'Career Planning', sub: 'Ghost project' },
    ].map(ghost => (
      <div
        key={ghost.label}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg opacity-25 pointer-events-none"
      >
        <span className="text-sm">{ghost.icon}</span>
        <span className="text-[12px] text-[hsl(var(--foreground-subtle))] italic">{ghost.label}</span>
      </div>
    ))}
    <button
      className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg
        border border-dashed border-[hsl(var(--border))] text-[11px] text-[hsl(var(--foreground-subtle))]
        hover:border-[hsl(var(--primary)/0.4)] hover:text-[hsl(var(--primary))] transition-colors"
      onClick={() => {/* open CreateProjectDialog */}}
    >
      <Plus className="h-3.5 w-3.5" />
      Create your first project
    </button>
  </div>
)}
```

**Step 6: Commit**

```bash
git add apps/desktop/src/components/layout/ProjectExplorer.tsx apps/desktop/src/components/chat/Sidebar.tsx apps/desktop/src/stores/canvas.ts
git commit -m "feat: ProjectExplorer — tree hierarchy, streaming pulse, chevron animation, ghost empty state"
```

---

## Task 8: Living Brief — Context Header

**Files:**
- Create: `apps/desktop/src/components/chat/LivingBrief.tsx`
- Modify: `apps/desktop/src/components/chat/ChatWindow.tsx`

**What this does:** A collapsible header at the top of the chat that shows a bullet-list summary of "Facts Established" and "Decisions Made" in the current conversation. Populated manually at first (user can edit), auto-generated in a future sprint.

**Step 1: Create `src/components/chat/LivingBrief.tsx`**

```tsx
import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Edit2, Check, X } from 'lucide-react';

interface LivingBriefProps {
  conversationId: string;
}

// Store brief content in localStorage per conversation (lightweight, no DB needed yet)
function getBrief(conversationId: string): string {
  return localStorage.getItem(`brief:${conversationId}`) ?? '';
}

function saveBrief(conversationId: string, content: string): void {
  localStorage.setItem(`brief:${conversationId}`, content);
}

export function LivingBrief({ conversationId }: LivingBriefProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(() => getBrief(conversationId));
  const [draft, setDraft] = useState('');

  const hasBrief = content.trim().length > 0;

  const startEdit = () => {
    setDraft(content);
    setIsEditing(true);
    setIsExpanded(true);
  };

  const saveEdit = () => {
    saveBrief(conversationId, draft);
    setContent(draft);
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraft('');
  };

  if (!hasBrief && !isEditing) {
    return (
      <button
        onClick={startEdit}
        className="flex items-center gap-2 px-4 py-2 text-[11px] text-[hsl(var(--foreground-subtle))] hover:text-[hsl(var(--primary))] transition-colors border-b border-[hsl(var(--border))]"
      >
        <BookOpen className="h-3.5 w-3.5" />
        <span>Add context brief...</span>
      </button>
    );
  }

  return (
    <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-2">
        <button
          onClick={() => setIsExpanded(e => !e)}
          className="flex items-center gap-2 text-[11px] font-semibold tracking-widest uppercase text-[hsl(var(--violet))] hover:text-[hsl(var(--primary))] transition-colors"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Context Brief
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <button onClick={saveEdit} className="p-1 rounded text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))]"><Check className="h-3.5 w-3.5" /></button>
              <button onClick={cancelEdit} className="p-1 rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"><X className="h-3.5 w-3.5" /></button>
            </>
          ) : (
            <button onClick={startEdit} className="p-1 rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]">
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-3">
          {isEditing ? (
            <textarea
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={4}
              className="w-full text-[12px] bg-[hsl(var(--surface-2))] border border-[hsl(var(--border))] rounded-lg p-2
                text-[hsl(var(--foreground-muted))] font-mono resize-none focus:outline-none
                focus:border-[hsl(var(--ring))] focus:ring-1 focus:ring-[hsl(var(--ring)/0.3)]"
              placeholder="• Revenue discussed: ~€85k&#10;• Priority: minimize deductions risk&#10;• Model recommended: hybrid"
            />
          ) : (
            <div className="text-[12px] text-[hsl(var(--foreground-muted))] whitespace-pre-line leading-relaxed">
              {content}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Integrate `LivingBrief` into `ChatWindow.tsx`**

Import:
```tsx
import { LivingBrief } from './LivingBrief';
```

Add after the incognito banner and before the messages area:
```tsx
{currentConversationId && !conversation?.isIncognito && (
  <LivingBrief conversationId={currentConversationId} />
)}
```

**Step 3: Add "Sync to Brief" button in `CanvasPanel.tsx`**

Add a prop or use `currentConversationId` from `useChatStore` to find the conversation's Living Brief. Add a button in the CanvasPanel footer:

```tsx
// In CanvasPanel footer, alongside word count:
<button
  onClick={() => {
    if (!doc || !currentConversationId) return;
    // Extract a brief summary from the canvas doc (first 3 bullet points or first 300 chars)
    const briefContent = extractBriefFromCanvas(doc.content);
    // Dispatch to LivingBrief via localStorage + custom event
    localStorage.setItem(`brief:${currentConversationId}`, briefContent);
    window.dispatchEvent(new CustomEvent('brief:updated', { detail: { conversationId: currentConversationId } }));
  }}
  className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--foreground-subtle))]
    hover:text-[hsl(var(--violet))] transition-colors px-2 py-1 rounded-lg hover:bg-[hsl(var(--violet)/0.08)]"
  title="Push canvas key points to Living Brief"
>
  <BookOpen className="h-3.5 w-3.5" />
  Sync to Brief
</button>
```

Add the helper:
```typescript
function extractBriefFromCanvas(content: string): string {
  // Grab all bullet points and headings, max 10 items
  const lines = content.split('\n').filter(l => /^([-*•]|#{1,3}) /.test(l.trim()));
  const items = lines.slice(0, 10).map(l => l.replace(/^#{1,3} /, '• ').replace(/^[-*•] /, '• '));
  return items.join('\n') || content.slice(0, 300);
}
```

In `LivingBrief.tsx`, listen for the `brief:updated` event to refresh content:
```typescript
useEffect(() => {
  const handler = (e: CustomEvent) => {
    if (e.detail.conversationId === conversationId) {
      setContent(getBrief(conversationId));
    }
  };
  window.addEventListener('brief:updated', handler as EventListener);
  return () => window.removeEventListener('brief:updated', handler as EventListener);
}, [conversationId]);
```

**Step 4: Commit**

```bash
git add apps/desktop/src/components/chat/LivingBrief.tsx apps/desktop/src/components/chat/ChatWindow.tsx apps/desktop/src/components/chat/CanvasPanel.tsx
git commit -m "feat: LivingBrief + Sync to Brief button in CanvasPanel"
```

---

## Task 9: Polish Sidebar + ChatWindow Header

**Files:**
- Modify: `apps/desktop/src/components/chat/Sidebar.tsx`
- Modify: `apps/desktop/src/components/chat/ChatWindow.tsx`

**What this does:** Applies Obsidian Pro visual treatment to the sidebar (typography, depth, hover states) and ChatWindow top bar (persona badge, privacy mode indicator, model pill).

**Step 1: Update sidebar item styles in `Sidebar.tsx`**

Find all conversation list items and update to:
```tsx
className={`group flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-left transition-all duration-120
  ${isActive
    ? 'bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] font-medium'
    : 'text-[hsl(var(--foreground-subtle))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]'
  }`}
```

Section headers:
```tsx
className="px-2 mb-1 text-[11px] font-semibold tracking-widest uppercase text-[hsl(var(--foreground-subtle))]"
```

**Step 2: Update ChatWindow header bar**

Find the top bar of `ChatWindow` that shows the persona/model info. Apply:
```tsx
// Header wrapper
className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] flex-shrink-0"

// Persona badge
className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[hsl(var(--surface-2))] border border-[hsl(var(--border))]"

// Model pill
className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[hsl(var(--violet)/0.15)] text-[hsl(var(--violet))] border border-[hsl(var(--violet)/0.3)]"
```

**Step 3: Update input bar**

Find the bottom input area in `ChatWindow`. Apply:
```tsx
// Input wrapper
className="border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] rounded-2xl
  focus-within:border-[hsl(var(--ring)/0.5)] focus-within:ring-1 focus-within:ring-[hsl(var(--ring)/0.15)]
  transition-all duration-120 shadow-[var(--shadow)]"

// Send button (active)
className="h-8 w-8 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]
  hover:opacity-90 active:scale-95 transition-all shadow-[var(--shadow-glow-cyan)]"
```

**Step 4: Update message bubbles in `MessageBubble.tsx`**

User bubble:
```tsx
className="max-w-[75%] ml-auto px-4 py-2.5 rounded-2xl rounded-tr-sm
  bg-[hsl(var(--primary)/0.15)] border border-[hsl(var(--primary)/0.2)]
  text-[hsl(var(--foreground))] text-[13px] leading-relaxed"
```

Assistant bubble:
```tsx
className="max-w-[85%] px-4 py-3 rounded-2xl rounded-tl-sm
  bg-[hsl(var(--surface-2))] border border-[hsl(var(--border))]
  text-[hsl(var(--foreground-muted))] text-[13px] leading-relaxed"
```

**Step 5: Commit**

```bash
git add apps/desktop/src/components/chat/Sidebar.tsx apps/desktop/src/components/chat/ChatWindow.tsx apps/desktop/src/components/chat/MessageBubble.tsx
git commit -m "feat: apply Obsidian Pro visual polish to sidebar, chat header, input bar, bubbles"
```

---

## Task 10: Polish ContextPanel

**Files:**
- Modify: `apps/desktop/src/components/contexts/ContextPanel.tsx`

**What this does:** Applies Obsidian Pro depth + typography to the right panel — section headers, persona cards, model selector pill, privacy mode badge.

**Step 1: Update panel root wrapper**

```tsx
// From current card-style
className="w-72 flex-shrink-0 border-l border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] flex flex-col h-full"
```

**Step 2: Update section labels**

```tsx
className="text-[11px] font-semibold tracking-widest uppercase text-[hsl(var(--foreground-subtle))] px-3 mb-2"
```

**Step 3: Update persona selector items**

Active persona:
```tsx
className="flex items-center gap-3 px-3 py-2.5 rounded-xl
  bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.25)]
  cursor-pointer transition-all"
```

Inactive:
```tsx
className="flex items-center gap-3 px-3 py-2.5 rounded-xl
  hover:bg-[hsl(var(--accent))] transition-colors cursor-pointer"
```

**Step 4: Update privacy mode badge**

```tsx
// Local mode
className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold
  bg-[hsl(var(--violet)/0.15)] text-[hsl(var(--violet))] border border-[hsl(var(--violet)/0.3)]"

// Cloud mode
className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold
  bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.25)]"
```

**Step 5: Commit**

```bash
git add apps/desktop/src/components/contexts/ContextPanel.tsx
git commit -m "feat: apply Obsidian Pro polish to ContextPanel"
```

---

## Task 11: Smoke Test & Final Integration Check

**What this does:** Verifies all features work end-to-end before declaring the sprint complete.

**Checklist:**

1. **Design tokens** — Background is near-black, cyan/violet accents visible, sidebar and panels have correct depth separation
2. **WorkspaceLayout** — 3-column layout renders, no regressions in desktop view, mobile still uses Drawer layout
3. **Canvas store** — `useCanvasStore` initializes on app load (check console for errors)
4. **CanvasPanel** — Click "Open in Canvas" on a message → panel slides in from right → ContextPanel hides → document shows with title, content, word count
5. **Auto-routing** — Send a message that returns a long report → canvas panel opens automatically
6. **Project Explorer** — Create a project → conversations in that project appear under the folder → canvas docs appear as `📄` items → clicking a doc opens canvas without changing chat
7. **Living Brief** — Open a conversation → "Add context brief..." prompt visible → click → textarea opens → type notes → save → brief persists on refresh
8. **Persistence** — Refresh the app → canvas documents survive (Dexie), Living Brief survives (localStorage), panel state resets (intentional, per `partialize`)

**Run the app:**
```bash
export CARGO_TARGET_DIR="C:/tmp/tb" && export CMAKE="C:/Program Files/CMake/bin/cmake.exe" && export PATH="/c/Program Files/CMake/bin:$PATH" && cd apps/desktop && pnpm tauri dev
```

**Step 2: Final commit**

```bash
git add .
git commit -m "feat: complete Obsidian Pro workspace — canvas, project explorer, living brief"
```

---

## Summary of New Files

| File | Purpose |
|------|---------|
| `src/components/layout/WorkspaceLayout.tsx` | Panel orchestration shell |
| `src/components/layout/ProjectExplorer.tsx` | Project/chat/canvas tree |
| `src/components/chat/LivingBrief.tsx` | Collapsible context header |
| `src/stores/canvas.ts` | Canvas document state |

## Summary of Modified Files

| File | Change |
|------|--------|
| `src/index.css` | Obsidian Pro design tokens |
| `src/types/index.ts` | `CanvasDocument` type |
| `src/lib/db.ts` | `canvasDocuments` Dexie table (v2) |
| `src/stores/index.ts` | Export `useCanvasStore` |
| `src/App.tsx` | Use `WorkspaceLayout`, init canvas store |
| `src/components/chat/CanvasPanel.tsx` | Full rebuild |
| `src/components/chat/ChatWindow.tsx` | Auto-routing + LivingBrief |
| `src/components/chat/MessageBubble.tsx` | "Open in Canvas" button |
| `src/components/chat/Sidebar.tsx` | ProjectExplorer integration + polish |
| `src/components/contexts/ContextPanel.tsx` | Obsidian Pro polish |
