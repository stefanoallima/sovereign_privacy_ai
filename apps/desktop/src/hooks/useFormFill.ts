import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useFormFillStore } from '../stores/formFill';
import { useUserProfileStore } from '../stores/userProfile';
import { useCanvasStore } from '../stores/canvas';
import type { FileAttachment, FormField, UserProfile } from '../types';

/**
 * Match result returned by the Rust match_form_fields_to_profile command.
 */
interface MatchResult {
  matched: FormField[];
  gaps: FormField[];
  reasoning: FormField[];
}



/**
 * Build a markdown preview of the filled form.
 */
function buildPreviewMarkdown(fields: FormField[], filename: string): string {
  let md = '# ' + filename + '\n\n';

  for (const field of fields) {
    const value = field.source === 'skipped'
      ? '_[skipped]_'
      : field.value || '_[not filled]_';
    let sourceTag = '';
    if (field.source === 'profile') {
      sourceTag = ' `auto`';
    } else if (field.source === 'llm-composed') {
      sourceTag = ' `composed`';
    } else if (field.source === 'skipped') {
      sourceTag = ' `skipped`';
    }
    md += '**' + field.label + '**' + sourceTag + '\n' + value + '\n\n';
  }

  return md;
}

/**
 * Core orchestration hook for the form-fill pipeline.
 *
 * Runs the 5-step pipeline:
 *   1. Extract fields from form text (LLM call via Rust)
 *   2. Match fields to user profile (local, no LLM)
 *   3. Gap-filling: ask user for missing simple fields
 *   4. Compose reasoning fields (LLM call via Rust)
 *   5. Assemble filled form and show preview in Canvas
 */
export function useFormFill() {
  // Do not destructure stores at hook level -- use getState() inside callbacks
  const canvasStore = useCanvasStore();

  /**
   * Compose reasoning fields using LLM with profile placeholders.
   */
  const composeReasoningFields = useCallback(
    async (fields: FormField[], profile: UserProfile) => {
      useFormFillStore.getState().setStep('composing');

      for (const field of fields) {
        try {
          const composedValue = await invoke<string>('compose_reasoning_field', {
            field,
            profile,
          });
          useFormFillStore.getState().updateFieldValue(field.label, composedValue, false);
        } catch (err) {
          console.error('Failed to compose reasoning field ' + JSON.stringify(field.label) + ':', err);
          useFormFillStore.getState().updateFieldValue(
            field.label,
            '[Composition failed: ' + String(err) + ']',
            false,
          );
        }
      }
    },
    [],
  );

  /**
   * Assemble the filled form and show it in the Canvas panel for preview.
   */
  const assembleAndPreview = useCallback(
    async (conversationId: string, filename: string) => {
      useFormFillStore.getState().setStep('reviewing');

      const formFill = useFormFillStore.getState().currentFormFill;
      if (!formFill) return;

      const previewContent = buildPreviewMarkdown(formFill.fieldMap, filename);

      // createDocument also opens the panel (sets isPanelOpen and activeDocumentId)
      const docId = await canvasStore.createDocument({
        title: 'Filled: ' + filename,
        content: previewContent,
        conversationId,
      });

      // Store the canvas doc ID on the form fill record
      const ffStore = useFormFillStore.getState();
      if (ffStore.currentFormFill) {
        useFormFillStore.setState(state => ({
          currentFormFill: state.currentFormFill ? {
            ...state.currentFormFill,
            canvasDocId: docId,
          } : null,
        }));
        // Persist to DB
        await useFormFillStore.getState().saveToDb();
      }

      useFormFillStore.getState().markComplete();
    },
    [canvasStore],
  );

  /**
   * Start the form-fill pipeline for an attachment.
   * Called when user clicks "Fill this form" on an attachment.
   */
  const startPipeline = useCallback(
    async (
      conversationId: string,
      messageId: string,
      attachment: FileAttachment,
    ) => {
      const formFillStore = useFormFillStore.getState();
      const profileStore = useUserProfileStore.getState();

      // Initialize the form-fill record
      await formFillStore.startFormFill(conversationId, messageId, attachment);

      // Ensure profile is loaded
      if (!profileStore.profile) {
        await useUserProfileStore.getState().loadProfile();
      }

      try {
        // Step 1: Extract fields from form (LLM call, no PII)
        useFormFillStore.getState().setStep('extracting');
        const fields = await invoke<FormField[]>('extract_form_fields', {
          formText: attachment.textContent,
        });

        // Guard: empty extraction means no fillable fields detected
        if (!fields || fields.length === 0) {
          useFormFillStore.getState().setStep('idle');
          useFormFillStore.setState({
            error: 'No fillable fields were detected in this document. It may not be a form, or the format is not recognized.',
            isProcessing: false,
          });
          return;
        }

        // Step 2: Match against profile (local, no LLM)
        const profile = useUserProfileStore.getState().profile;
        if (!profile) {
          useFormFillStore.getState().setStep('idle');
          useFormFillStore.setState({
            error: 'User profile not available. Please set up your profile in Settings → My Info first.',
            isProcessing: false,
          });
          return;
        }
        useFormFillStore.getState().setStep('matching');
        const matchResult = await invoke<MatchResult>(
          'match_form_fields_to_profile',
          {
            fields,
            profile,
          },
        );

        // Combine results
        const allFields: FormField[] = [
          ...matchResult.matched,
          ...matchResult.gaps,
          ...matchResult.reasoning,
        ];
        useFormFillStore.getState().setFields(allFields);

        // Step 3: If there are gaps, enter gap-filling mode
        if (matchResult.gaps.length > 0) {
          useFormFillStore.getState().setStep('gap-filling');
          // The ChatWindow will render GapFillPrompt components
          // and call updateFieldValue when user provides answers.
          // Pipeline pauses here and resumes via continueAfterGaps().
          return;
        }

        // Step 4: Compose reasoning fields
        if (matchResult.reasoning.length > 0) {
          await composeReasoningFields(matchResult.reasoning, profile);
        }

        // Step 5: Assembly and preview
        await assembleAndPreview(conversationId, attachment.filename);
      } catch (error: any) {
        console.error('Form-fill pipeline failed:', error);
        useFormFillStore.getState().setStep('idle');
        useFormFillStore.setState({
          error: error?.message || String(error) || 'Form fill failed',
          isProcessing: false,
        });
      }
    },
    [composeReasoningFields, assembleAndPreview],
  );

  /**
   * Continue pipeline after all gaps are filled by user.
   */
  const continueAfterGaps = useCallback(async () => {
    const profile = useUserProfileStore.getState().profile;
    if (!profile) {
      console.error('Cannot continue after gaps: user profile not loaded');
      return;
    }

    const formFill = useFormFillStore.getState().currentFormFill;
    if (!formFill) {
      console.error('Cannot continue after gaps: no active form-fill');
      return;
    }

    try {
      // Get reasoning fields that still need composition
      const reasoningFields = formFill.fieldMap.filter(
        (f) => f.type === 'reasoning' && !f.value,
      );

      if (reasoningFields.length > 0) {
        await composeReasoningFields(reasoningFields, profile);
      }

      await assembleAndPreview(formFill.conversationId, formFill.templateFilename);
    } catch (error: any) {
      console.error('Form-fill pipeline failed during post-gap processing:', error);
      useFormFillStore.getState().setStep('idle');
      useFormFillStore.setState({
        error: error?.message || String(error) || 'Form fill failed',
        isProcessing: false,
      });
    }
  }, [composeReasoningFields, assembleAndPreview]);

  /**
   * Export the filled form as DOCX via Rust backend.
   */
  const exportDocx = useCallback(async () => {
    const formFill = useFormFillStore.getState().currentFormFill;
    if (!formFill) {
      console.error('Cannot export: no active form-fill');
      return;
    }

    // Collect field values -- include skipped fields with empty value
    const fieldValues: Record<string, string> = {};
    for (const field of formFill.fieldMap) {
      if (field.value || field.source === 'skipped') {
        fieldValues[field.label] = field.value ?? '';
      }
    }

    try {
      // Ask user where to save via native save dialog
      const { save } = await import('@tauri-apps/plugin-dialog');
      const filePath = await save({
        defaultPath: formFill.templateFilename.replace(/\.[^.]+$/, '_filled.docx'),
        filters: [{ name: 'Word Document', extensions: ['docx'] }],
      });

      if (!filePath) return; // user cancelled

      // Export through Rust backend (writes the file directly to the chosen path)
      if (formFill.fileType === 'docx' || formFill.fileType === 'doc') {
        try {
          // Try filling the original template
          await invoke('export_filled_docx', {
            templatePath: formFill.templatePath,
            fieldValues,
            outputPath: filePath,
          });
        } catch (templateError) {
          // Template not found or corrupted -- fall back to generating new DOCX
          console.warn('Template not found, generating new DOCX:', templateError);
          const fields = formFill.fieldMap
            .filter((f) => f.value || f.source === 'skipped')
            .map((f) => [f.label, f.value ?? ''] as [string, string]);
          await invoke('generate_new_docx', {
            title: formFill.templateFilename,
            fields,
            outputPath: filePath,
          });
        }
      } else {
        const fields = formFill.fieldMap
          .filter((f) => f.value || f.source === 'skipped')
          .map((f) => [f.label, f.value ?? ''] as [string, string]);

        await invoke('generate_new_docx', {
          title: formFill.templateFilename,
          fields,
          outputPath: filePath,
        });
      }
    } catch (err) {
      console.error('DOCX export failed:', err);
      useFormFillStore.setState({ error: `Export failed: ${err instanceof Error ? err.message : String(err)}` });
    }
  }, []);

  // Use selectors for render-relevant state -- avoids re-renders from unrelated store changes
  const currentStep = useFormFillStore(s => s.currentStep);
  const currentFormFill = useFormFillStore(s => s.currentFormFill);
  const gapFields = useFormFillStore(s => s.gapFields);
  const currentGapIndex = useFormFillStore(s => s.currentGapIndex);
  const isProcessing = useFormFillStore(s => s.isProcessing);
  const error = useFormFillStore(s => s.error);

  return {
    startPipeline,
    continueAfterGaps,
    exportDocx,
    currentStep,
    currentFormFill,
    gapFields,
    currentGapIndex,
    isProcessing,
    error,
    reset: useFormFillStore.getState().reset,
    updateFieldValue: useFormFillStore.getState().updateFieldValue,
    advanceGap: useFormFillStore.getState().advanceGap,
  };
}
