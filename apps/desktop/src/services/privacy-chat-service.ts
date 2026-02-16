/**
 * Privacy-Aware Chat Service
 *
 * High-level service that integrates:
 * - Backend routing decisions
 * - Attribute extraction for privacy-first mode
 * - Anonymization for hybrid mode
 * - Direct cloud for standard mode
 *
 * Use this service instead of directly calling Nebius for privacy-aware personas.
 */

import { invoke } from '@tauri-apps/api/core';
import { getNebiusClient, type ChatMessage } from './nebius';
import {
  processChatWithPrivacy,
  extractTaxAttributes,
  type ProcessedChatRequest,
  type TaxAttributes,
} from './attribute-extraction-service';
import {
  makeBackendRoutingDecision,
  isRequestBlocked,
  requiresAttributesOnly,
  getDecisionExplanation,
  type BackendDecision,
} from './backend-routing-service';

// ==================== Types ====================

export interface PrivacyChatOptions {
  /** User's message */
  message: string;
  /** Persona configuration */
  persona: any;
  /** Previous conversation messages for context */
  history?: ChatMessage[];
  /** Nebius API key (for cloud backend) */
  apiKey?: string;
  /** Temperature for generation */
  temperature?: number;
  /** Max tokens to generate */
  maxTokens?: number;
}

export interface PrivacyChatResult {
  /** Whether the chat was successful */
  success: boolean;
  /** The response content */
  response?: string;
  /** Error message if failed */
  error?: string;
  /** Privacy processing information */
  privacyInfo: PrivacyProcessingInfo;
  /** Token usage (if available) */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface PrivacyProcessingInfo {
  /** Which backend was used */
  backend: string;
  /** How content was processed */
  contentMode: string;
  /** Was the request blocked? */
  wasBlocked: boolean;
  /** Was there a fallback? */
  hadFallback: boolean;
  /** Number of attributes extracted (if applicable) */
  attributesExtracted?: number;
  /** Explanation for the user */
  explanation: string;
  /** Privacy indicator icon */
  icon: string;
}

// ==================== Main Functions ====================

/**
 * Send a chat message with privacy-first processing
 *
 * This function:
 * 1. Gets routing decision based on persona config
 * 2. Processes message according to content_mode
 * 3. Routes to appropriate backend
 * 4. Returns response with privacy info
 *
 * @param options Chat options including message, persona, and settings
 * @returns Chat result with response and privacy info
 */
export async function sendPrivacyAwareChat(
  options: PrivacyChatOptions
): Promise<PrivacyChatResult> {
  const { message, persona, history = [], apiKey, temperature = 0.7, maxTokens = 2048 } = options;

  try {
    // Step 1: Process message with privacy-first routing
    const processed = await processChatWithPrivacy(message, persona);

    // Build privacy info
    const privacyInfo: PrivacyProcessingInfo = {
      backend: processed.backend,
      contentMode: processed.content_mode,
      wasBlocked: !processed.is_safe,
      hadFallback: processed.info?.includes('Fallback') || false,
      attributesExtracted: processed.attributes_count,
      explanation: processed.info || 'Standard processing',
      icon: getPrivacyIndicatorIcon(processed),
    };

    // Step 2: Check if blocked
    if (!processed.is_safe) {
      return {
        success: false,
        error: processed.info || 'Request blocked due to privacy requirements',
        privacyInfo,
      };
    }

    // Step 3: Route to appropriate backend
    let response: string;
    let usage: { inputTokens: number; outputTokens: number } | undefined;

    switch (processed.backend) {
      case 'ollama':
        // Full local processing
        const ollamaResult = await processWithOllama(processed.prompt, persona.local_ollama_model);
        response = ollamaResult.response;
        break;

      case 'nebius':
      case 'hybrid':
        // Cloud processing (hybrid already anonymized via processed.prompt)
        if (!apiKey) {
          return {
            success: false,
            error: 'Nebius API key required for cloud processing',
            privacyInfo,
          };
        }
        const cloudResult = await processWithNebius(
          processed.prompt,
          history,
          persona.system_prompt || '',
          processed.model || persona.preferred_model_id,
          apiKey,
          temperature,
          maxTokens
        );
        response = cloudResult.response;
        usage = cloudResult.usage;
        break;

      default:
        return {
          success: false,
          error: `Unknown backend: ${processed.backend}`,
          privacyInfo,
        };
    }

    return {
      success: true,
      response,
      privacyInfo,
      usage,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      privacyInfo: {
        backend: 'unknown',
        contentMode: 'error',
        wasBlocked: false,
        hadFallback: false,
        explanation: 'Processing failed',
        icon: '❌',
      },
    };
  }
}

/**
 * Stream a chat response with privacy-first processing
 *
 * Similar to sendPrivacyAwareChat but yields chunks for streaming UI
 */
export async function* streamPrivacyAwareChat(
  options: PrivacyChatOptions
): AsyncGenerator<
  { type: 'chunk'; content: string } | { type: 'info'; info: PrivacyProcessingInfo },
  PrivacyChatResult
> {
  const { message, persona, history = [], apiKey, temperature = 0.7, maxTokens = 2048 } = options;

  try {
    // Step 1: Process message with privacy-first routing
    const processed = await processChatWithPrivacy(message, persona);

    // Build privacy info and emit it first
    const privacyInfo: PrivacyProcessingInfo = {
      backend: processed.backend,
      contentMode: processed.content_mode,
      wasBlocked: !processed.is_safe,
      hadFallback: processed.info?.includes('Fallback') || false,
      attributesExtracted: processed.attributes_count,
      explanation: processed.info || 'Standard processing',
      icon: getPrivacyIndicatorIcon(processed),
    };

    yield { type: 'info', info: privacyInfo };

    // Step 2: Check if blocked
    if (!processed.is_safe) {
      return {
        success: false,
        error: processed.info || 'Request blocked due to privacy requirements',
        privacyInfo,
      };
    }

    // Step 3: Route to appropriate backend
    let fullResponse = '';
    let usage: { inputTokens: number; outputTokens: number } | undefined;

    switch (processed.backend) {
      case 'ollama':
        // Ollama doesn't support streaming in our current implementation
        const ollamaResult = await processWithOllama(processed.prompt, persona.local_ollama_model);
        fullResponse = ollamaResult.response;
        yield { type: 'chunk', content: fullResponse };
        break;

      case 'nebius':
      case 'hybrid':
        if (!apiKey) {
          return {
            success: false,
            error: 'Nebius API key required for cloud processing',
            privacyInfo,
          };
        }

        // Stream from Nebius
        const client = getNebiusClient(apiKey);
        const messages: ChatMessage[] = [
          ...(persona.system_prompt
            ? [{ role: 'system' as const, content: persona.system_prompt }]
            : []),
          ...history,
          { role: 'user' as const, content: processed.prompt },
        ];

        const stream = client.streamChatCompletion({
          model: processed.model || persona.preferred_model_id,
          messages,
          temperature,
          max_tokens: maxTokens,
        });

        for await (const chunk of stream) {
          fullResponse += chunk;
          yield { type: 'chunk', content: chunk };
        }

        // Get token counts from stream return value
        const streamResult = await stream.next();
        if (streamResult.done && streamResult.value) {
          usage = streamResult.value;
        }
        break;

      default:
        return {
          success: false,
          error: `Unknown backend: ${processed.backend}`,
          privacyInfo,
        };
    }

    return {
      success: true,
      response: fullResponse,
      privacyInfo,
      usage,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      privacyInfo: {
        backend: 'unknown',
        contentMode: 'error',
        wasBlocked: false,
        hadFallback: false,
        explanation: 'Processing failed',
        icon: '❌',
      },
    };
  }
}

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

// ==================== Helper Functions ====================

async function processWithOllama(
  prompt: string,
  model?: string
): Promise<{ response: string }> {
  const response = await invoke<string>('ollama_generate', {
    prompt,
    model: model || 'mistral:7b-instruct-q5_K_M',
  });
  return { response };
}

async function processWithNebius(
  userMessage: string,
  history: ChatMessage[],
  systemPrompt: string,
  model: string,
  apiKey: string,
  temperature: number,
  maxTokens: number
): Promise<{ response: string; usage: { inputTokens: number; outputTokens: number } }> {
  const client = getNebiusClient(apiKey);

  const messages: ChatMessage[] = [
    ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
    ...history,
    { role: 'user' as const, content: userMessage },
  ];

  const result = await client.chatCompletion({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });

  return {
    response: result.choices[0]?.message?.content || '',
    usage: {
      inputTokens: result.usage?.prompt_tokens || 0,
      outputTokens: result.usage?.completion_tokens || 0,
    },
  };
}

function getPrivacyIndicatorIcon(processed: ProcessedChatRequest): string {
  if (!processed.is_safe) return '🚫';
  if (processed.content_mode === 'attributes_only') return '🔒';
  if (processed.backend === 'ollama') return '🔒';
  if (processed.backend === 'hybrid') return '🔐';
  return '⚡';
}

// ==================== Exports ====================

export {
  processChatWithPrivacy,
  extractTaxAttributes,
  makeBackendRoutingDecision,
  isRequestBlocked,
  requiresAttributesOnly,
  getDecisionExplanation,
};
