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
