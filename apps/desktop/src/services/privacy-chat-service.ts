/**
 * Privacy-Aware Chat Service
 *
 * Preview helper for privacy-aware processing. It reports what the privacy
 * pipeline *would* do for a given message + persona (which backend, whether
 * the request would be blocked, an attributes-only preview) so the UI can
 * explain the decision before anything is sent.
 *
 * The actual cloud-send path lives in `hooks/usePrivacyChat.ts`
 * (`executePrivacySend`), which redacts ALL cloud-bound content (current
 * message, history, context, memories, KB, canvas).
 *
 * NOTE (pii-pipeline-v3, T1): the former privacy-aware send/stream helpers
 * were removed. They assembled the cloud `messages` array with raw,
 * unredacted conversation history (`...history`) and had no caller — a latent
 * footgun that could silently leak history to the cloud.
 */

import {
  extractTaxAttributes,
  type TaxAttributes,
} from './attribute-extraction-service';
import {
  makeBackendRoutingDecision,
  isRequestBlocked,
  requiresAttributesOnly,
  getDecisionExplanation,
  type BackendDecision,
} from './backend-routing-service';

/**
 * Preview what privacy processing would happen for a message
 * Use this to show the user what will happen before sending
 */
export async function previewPrivacyProcessing(
  message: string,
  persona: any
): Promise<{
  decision: BackendDecision;
  wouldBlock: boolean;
  explanation: string;
  attributesPreview?: TaxAttributes;
}> {
  const decision = await makeBackendRoutingDecision(persona);
  const wouldBlock = isRequestBlocked(decision);
  const explanation = getDecisionExplanation(decision);

  // If attributes-only mode, extract attributes for preview
  let attributesPreview: TaxAttributes | undefined;
  if (requiresAttributesOnly(decision)) {
    const extractionResult = await extractTaxAttributes(message);
    if (extractionResult.success && extractionResult.attributes) {
      attributesPreview = extractionResult.attributes;
    }
  }

  return {
    decision,
    wouldBlock,
    explanation,
    attributesPreview,
  };
}
