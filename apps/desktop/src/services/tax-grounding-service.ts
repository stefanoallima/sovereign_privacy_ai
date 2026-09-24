/**
 * Tax Grounding Service
 *
 * Wraps the Tauri `build_tax_grounding` command. When the persona is
 * tax-tagged and the user message contains Dutch tax keywords, the backend
 * prepends a "## Tax Concepts Available" block to the message and returns
 * the consulted concept IDs so the UI can render a "Sources" strip.
 */

import { invoke } from '@tauri-apps/api/core';

export interface TaxConceptDto {
  term: string;
  definition: string;
  english_term?: string | null;
  why_needed: string;
  related_boxes: string[];
  applicable_year?: number | null;
  box_number?: string | null;
  evidence_required: string[];
}

export interface TaxGroundingBlock {
  augmented_message: string;
  consulted_concept_ids: string[];
  concepts_used: TaxConceptDto[];
  injected: boolean;
}

/**
 * Build a tax-grounding block for the given message and persona.
 * If the persona is not tax-tagged or no keywords match, returns
 * `{ injected: false, augmented_message: <original> }`.
 */
export async function buildTaxGrounding(
  message: string,
  persona: { name?: string; system_prompt?: string; systemPrompt?: string }
): Promise<TaxGroundingBlock> {
  const personaName = persona?.name ?? '';
  const personaSystemPrompt = persona?.system_prompt ?? persona?.systemPrompt ?? '';
  return invoke<TaxGroundingBlock>('build_tax_grounding', {
    message,
    personaName,
    personaSystemPrompt,
  });
}

export interface TaxGroundingContext {
  /** The "## Tax Concepts Available" block alone — public reference text, no user content. */
  context: string;
  consultedConceptIds: string[];
  consultedConcepts: TaxConceptDto[];
}

/**
 * Grounding for the live send paths. Keyword matching runs locally on the raw
 * message; only the concept block is returned (the message suffix the backend
 * appends is stripped) so callers can add it as a system message while the
 * user's text keeps going through the normal redaction pipeline.
 * Never throws: returns null when not applicable or on failure.
 */
export async function getTaxGroundingContext(
  message: string,
  persona: { name?: string; system_prompt?: string; systemPrompt?: string } | null | undefined
): Promise<TaxGroundingContext | null> {
  if (!persona || !message.trim()) return null;
  try {
    const block = await buildTaxGrounding(message, persona);
    if (!block.injected) return null;
    const suffix = `\n\n---\n\n${message}`;
    const context = block.augmented_message.endsWith(suffix)
      ? block.augmented_message.slice(0, -suffix.length)
      : null;
    // If the backend format ever changes, refuse rather than risk sending the
    // raw message outside the redaction pipeline.
    if (!context) return null;
    return {
      context,
      consultedConceptIds: block.consulted_concept_ids,
      consultedConcepts: block.concepts_used,
    };
  } catch (e) {
    console.warn('[tax-grounding] failed, continuing without grounding:', e);
    return null;
  }
}
