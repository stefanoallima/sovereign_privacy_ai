import { create } from 'zustand';
import type { FormFill, FormField, FileAttachment } from '../types';
import { formFillDbOps, type LocalFormFill } from '../lib/db';

type PipelineStep =
  | 'idle'
  | 'parsing'
  | 'extracting'
  | 'matching'
  | 'gap-filling'
  | 'composing'
  | 'reviewing'
  | 'complete';

interface FormFillState {
  currentFormFill: FormFill | null;
  isProcessing: boolean;
  currentStep: PipelineStep;
  gapFields: FormField[];
  currentGapIndex: number;
  error: string | null;

  // Actions
  startFormFill: (
    conversationId: string,
    messageId: string,
    attachment: FileAttachment,
  ) => Promise<void>;
  setStep: (step: PipelineStep) => void;
  setFields: (fields: FormField[]) => void;
  updateFieldValue: (label: string, value: string, saveToProfile: boolean) => void;
  advanceGap: () => void;
  skipField: (label: string) => void;
  markComplete: () => void;
  reset: () => void;

  // Persistence
  saveToDb: () => Promise<void>;
  loadFromDb: (id: string) => Promise<void>;
  deleteFormFill: (id: string) => Promise<void>;
}

function toLocalFormFill(ff: FormFill): LocalFormFill {
  return {
    id: ff.id,
    conversationId: ff.conversationId,
    messageId: ff.messageId,
    templatePath: ff.templatePath,
    templateFilename: ff.templateFilename,
    fileType: ff.fileType,
    fieldMap: ff.fieldMap,
    status: ff.status,
    canvasDocId: ff.canvasDocId,
    createdAt: ff.createdAt,
    updatedAt: ff.updatedAt,
  };
}

export const useFormFillStore = create<FormFillState>()((set, get) => ({
  currentFormFill: null,
  isProcessing: false,
  currentStep: 'idle' as PipelineStep,
  gapFields: [],
  currentGapIndex: 0,
  error: null,

  startFormFill: async (conversationId, messageId, attachment) => {
    const now = new Date();
    const id = `ff-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const formFill: FormFill = {
      id,
      conversationId,
      messageId,
      templatePath: attachment.filePath,
      templateFilename: attachment.filename,
      fileType: attachment.fileType,
      fieldMap: [],
      status: 'extracting',
      createdAt: now,
      updatedAt: now,
    };

    set({
      currentFormFill: formFill,
      isProcessing: true,
      currentStep: 'extracting',
      gapFields: [],
      currentGapIndex: 0,
      error: null,
    });

    // Persist to IndexedDB
    try {
      await formFillDbOps.createFormFill(toLocalFormFill(formFill));
    } catch (err) {
      console.error('Failed to persist new FormFill to IndexedDB:', err);
    }
  },

  setStep: (step) => {
    const statusMap: Record<PipelineStep, FormFill['status']> = {
      idle: 'extracting',
      parsing: 'extracting',
      extracting: 'extracting',
      matching: 'filling',
      'gap-filling': 'filling',
      composing: 'filling',
      reviewing: 'reviewing',
      complete: 'complete',
    };

    set((state) => {
      const formFill = state.currentFormFill;
      if (!formFill) return { currentStep: step };

      return {
        currentStep: step,
        isProcessing: step !== 'idle' && step !== 'complete',
        currentFormFill: {
          ...formFill,
          status: statusMap[step],
          updatedAt: new Date(),
        },
      };
    });

    // Auto-save to DB
    void get().saveToDb();
  },

  setFields: (fields) => {
    // Assign stable IDs to fields for React keys (Rust backend does not provide them)
    const fieldsWithIds = fields.map((f, i) => ({
      ...f,
      id: f.id || 'ff-' + i + '-' + f.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30),
    }));

    const gaps = fieldsWithIds.filter(
      (f) => !f.value && f.type === 'simple' && f.source !== 'profile',
    );

    set((state) => {
      const formFill = state.currentFormFill;
      if (!formFill) return {};

      return {
        currentFormFill: {
          ...formFill,
          fieldMap: fieldsWithIds,
          updatedAt: new Date(),
        },
        gapFields: gaps,
        currentGapIndex: 0,
      };
    });

    void get().saveToDb();
  },

  updateFieldValue: (label, value, saveToProfile) => {
    set((state) => {
      const formFill = state.currentFormFill;
      if (!formFill) return {};

      const updatedFields = formFill.fieldMap.map((f) =>
        f.label === label
          ? { ...f, value, source: 'user-input' as FormField['source'] }
          : f,
      );

      return {
        currentFormFill: {
          ...formFill,
          fieldMap: updatedFields,
          updatedAt: new Date(),
        },
      };
    });

    // If saveToProfile, persist the value to the user profile store
    if (saveToProfile) {
      void (async () => {
        try {
          const { useUserProfileStore } = await import('./userProfile');
          const profileStore = useUserProfileStore.getState();
          await profileStore.addCustomField(label, value);
        } catch (err) {
          console.warn('Failed to save field to user profile:', err);
        }
      })();
    }

    void get().saveToDb();
  },

  skipField: (label: string) => {
    set(state => ({
      currentFormFill: state.currentFormFill ? {
        ...state.currentFormFill,
        fieldMap: state.currentFormFill.fieldMap.map(f =>
          f.label === label ? { ...f, value: '', source: 'skipped' as FormField['source'] } : f
        ),
      } : null,
    }));
    void get().saveToDb();
  },
  advanceGap: () => {
    set((state) => ({
      currentGapIndex: Math.min(
        state.currentGapIndex + 1,
        state.gapFields.length,
      ),
    }));
  },

  markComplete: () => {
    set((state) => {
      const formFill = state.currentFormFill;
      if (!formFill) return {};

      return {
        currentStep: 'complete' as PipelineStep,
        isProcessing: false,
        currentFormFill: {
          ...formFill,
          status: 'complete' as const,
          updatedAt: new Date(),
        },
      };
    });

    void get().saveToDb();
  },

  reset: () => {
    set({
      currentFormFill: null,
      isProcessing: false,
      currentStep: 'idle' as PipelineStep,
      gapFields: [],
      currentGapIndex: 0,
      error: null,
    });
  },

  saveToDb: async () => {
    const { currentFormFill } = get();
    if (!currentFormFill) return;

    try {
      await formFillDbOps.updateFormFill(
        currentFormFill.id,
        toLocalFormFill(currentFormFill),
      );
    } catch (err) {
      console.error('Failed to persist FormFill to IndexedDB:', err);
    }
  },

  deleteFormFill: async (id: string) => {
    try {
      await formFillDbOps.deleteFormFill(id);
    } catch (err) {
      console.error('Failed to delete FormFill from IndexedDB:', err);
    }
    // Clear current if it matches
    const { currentFormFill } = get();
    if (currentFormFill && currentFormFill.id === id) {
      set({
        currentFormFill: null,
        isProcessing: false,
        currentStep: 'idle' as PipelineStep,
        gapFields: [],
        currentGapIndex: 0,
        error: null,
      });
    }
  },

  loadFromDb: async (id: string) => {
    try {
      const record = await formFillDbOps.getFormFill(id);
      if (!record) {
        set({ error: `FormFill ${id} not found in DB` });
        return;
      }

      const formFill: FormFill = {
        id: record.id,
        conversationId: record.conversationId,
        messageId: record.messageId,
        templatePath: record.templatePath,
        templateFilename: record.templateFilename,
        fileType: record.fileType,
        fieldMap: record.fieldMap,
        status: record.status,
        canvasDocId: record.canvasDocId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      };

      const statusToStep: Record<FormFill['status'], PipelineStep> = {
        extracting: 'extracting',
        filling: 'gap-filling',
        reviewing: 'reviewing',
        complete: 'complete',
      };

      const gaps = formFill.fieldMap.filter(
        (f) => !f.value && f.type === 'simple' && f.source !== 'profile',
      );

      set({
        currentFormFill: formFill,
        currentStep: statusToStep[formFill.status],
        isProcessing: formFill.status !== 'complete',
        gapFields: gaps,
        currentGapIndex: 0,
        error: null,
      });
    } catch (err) {
      console.error('Failed to load FormFill from IndexedDB:', err);
      set({ error: String(err) });
    }
  },
}));
