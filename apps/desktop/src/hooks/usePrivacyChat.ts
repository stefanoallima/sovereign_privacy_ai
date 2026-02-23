/**
 * Privacy-Aware Chat Hook
 *
 * Drop-in enhancement for useChat that adds privacy-first processing:
 * - Automatic routing based on persona configuration
 * - Attribute extraction for privacy-first mode
 * - Blocking when privacy requirements can't be met
 * - Privacy status indicators
 */

import { useCallback, useRef, useState } from 'react';
import { useChatStore, useSettingsStore, usePersonasStore } from '@/stores';
import { useUserContextStore, selectActiveProfile } from '@/stores/userContext';
import { getNebiusClient, type ChatMessage } from '@/services/nebius';
import { getMem0Client, formatMemoriesAsContext } from '@/services/mem0';
import {
  previewPrivacyProcessing,
} from '@/services/privacy-chat-service';
import {
  processChatWithPrivacy,
  type ProcessedChatRequest,
} from '@/services/attribute-extraction-service';
import { makeBackendRoutingDecision, type BackendDecision } from '@/services/backend-routing-service';
import { invoke } from '@tauri-apps/api/core';
import type { Persona } from '@/types';

interface DetectedEntity {
  text: string;
  label: string;
  confidence: number;
  start: number;
  end: number;
}

/**
 * Apply GLiNER PII detection to sanitize text before cloud sends.
 * Returns the sanitized text and a mapping of placeholders to original values.
 */
async function applyGlinerPiiRedaction(
  text: string,
): Promise<{ sanitized: string; mappings: Map<string, string>; entityCount: number }> {
  try {
    const entities = await invoke<DetectedEntity[]>('detect_pii_with_gliner', { text });
    if (!entities || entities.length === 0) {
      return { sanitized: text, mappings: new Map(), entityCount: 0 };
    }

    // Sort by position descending so replacements don't shift indices
    const sorted = [...entities].sort((a, b) => b.start - a.start);
    let sanitized = text;
    const mappings = new Map<string, string>();

    for (const entity of sorted) {
      const placeholder = `[PII_${entity.label.toUpperCase().replace(/\s+/g, '_')}]`;
      const original = sanitized.substring(entity.start, entity.end);
      // Only replace if text matches what GLiNER detected (sanity check)
      if (original.toLowerCase().includes(entity.text.toLowerCase().substring(0, 3))) {
        sanitized = sanitized.substring(0, entity.start) + placeholder + sanitized.substring(entity.end);
        mappings.set(placeholder, original);
      }
    }

    return { sanitized, mappings, entityCount: entities.length };
  } catch (error) {
    console.warn('GLiNER PII detection unavailable, proceeding without:', error);
    return { sanitized: text, mappings: new Map(), entityCount: 0 };
  }
}

/**
 * Rehydrate a response by replacing PII placeholders back with original values.
 */
function rehydrateResponse(text: string, mappings: Map<string, string>): string {
  let result = text;
  for (const [placeholder, original] of mappings) {
    result = result.split(placeholder).join(original);
  }
  return result;
}

/**
 * Apply custom redaction terms: replace each term's value with its same-length
 * replacement string. This preserves text structure (character count, line breaks)
 * while making the content safe for cloud. The replacement strings are unique
 * and can be mapped back to originals for rehydration.
 */
function applyCustomRedaction(
  text: string,
  terms: Array<{ label: string; value: string; replacement: string }>,
): { sanitized: string; mappings: Map<string, string> } {
  const mappings = new Map<string, string>();
  let sanitized = text;
  for (const term of terms) {
    if (!term.value || !term.replacement) continue;
    if (sanitized.includes(term.value)) {
      sanitized = sanitized.split(term.value).join(term.replacement);
      mappings.set(term.replacement, term.value);
    }
  }
  return { sanitized, mappings };
}

export interface PrivacyStatus {
  /** Current privacy mode */
  mode: 'idle' | 'processing' | 'attributes_only' | 'anonymized' | 'direct' | 'blocked' | 'local' | 'pending_review';
  /** Icon for display */
  icon: string;
  /** Short label */
  label: string;
  /** Detailed explanation */
  explanation: string;
  /** Number of attributes extracted (if applicable) */
  attributesCount?: number;
  /** Whether a fallback occurred */
  hadFallback: boolean;
}

export interface PendingReview {
  originalMessage: string;
  processedPrompt: string;
  processed: ProcessedChatRequest;
  targetPersona: any;
  model: any;
  glinerMappings?: Map<string, string>;
}

const SUMMARY_INTERVAL = 5; // generate a summary every N assistant messages

async function maybeGenerateProjectSummary(
  conversationId: string,
  settings: { nebiusApiKey: string; nebiusApiEndpoint: string },
  model: { apiModelId?: string } | undefined,
) {
  try {
    const { useChatStore } = await import('@/stores/chat');
    const { useCanvasStore } = await import('@/stores/canvas');
    const chatState = useChatStore.getState();
    const conversation = chatState.conversations.find(c => c.id === conversationId);
    if (!conversation) return;

    // Count only assistant messages
    const allMessages = chatState.messages[conversationId] ?? [];
    const assistantCount = allMessages.filter(m => m.role === 'assistant').length;
    if (assistantCount === 0 || assistantCount % SUMMARY_INTERVAL !== 0) return;

    // Gather all conversation text (last 20 messages max to keep prompt small)
    const recent = allMessages.slice(-20);
    const transcript = recent
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    // Also include existing canvas docs as context
    const canvasState = useCanvasStore.getState();
    const convDocs = canvasState.getDocumentsByConversation(conversationId);
    const projectDocs = conversation.projectId ? canvasState.getDocumentsByProject(conversation.projectId) : [];
    const seen = new Set<string>();
    const allDocs = [...convDocs, ...projectDocs].filter(d => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
    const docsContext = allDocs.length > 0
      ? `\n\nExisting project documents:\n${allDocs.map(d => `## ${d.title}\n${d.content}`).join('\n\n')}`
      : '';

    const { getNebiusClient } = await import('@/services/nebius');
    const client = getNebiusClient(settings.nebiusApiKey, settings.nebiusApiEndpoint);

    const summaryPrompt = `You are a project secretary. Based on the conversation transcript below, write a concise project minutes document in Markdown. Include:
- Key decisions made
- Action items or next steps
- Important facts or agreements
- Open questions

Keep it brief and structured. Use ## headings. Do NOT include filler text.${docsContext}

---
Transcript:
${transcript}`;

    const stream = client.streamChatCompletion({
      model: model?.apiModelId || 'deepseek-ai/DeepSeek-V3',
      messages: [{ role: 'user', content: summaryPrompt }],
      temperature: 0.3,
      max_tokens: 1024,
    });

    let summaryContent = '';
    for await (const chunk of stream) {
      summaryContent += chunk;
    }

    if (!summaryContent.trim()) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const title = `Project Minutes — ${dateStr} (msg ${assistantCount})`;

    await canvasState.createDocument({
      title,
      content: summaryContent.trim(),
      conversationId,
      projectId: conversation.projectId,
    });
  } catch (e) {
    // Non-critical — log and continue
    console.warn('[summary] Failed to generate project summary:', e);
  }
}

export function usePrivacyChat() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const [privacyStatus, setPrivacyStatus] = useState<PrivacyStatus>({
    mode: 'idle',
    icon: '⚡',
    label: 'Ready',
    explanation: 'Waiting for message',
    hadFallback: false,
  });
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null);

  const {
    currentConversationId,
    getCurrentConversation,
    getCurrentMessages,
    addMessage,
    updateConversationPersona,
    updateStreamingContent,
    finalizeStreaming,
    setLoading,
    contexts,
  } = useChatStore();

  const { settings, getModelById, isAirplaneModeActive } = useSettingsStore();
  const { getSelectedPersona, personas } = usePersonasStore();
  const activeUserProfile = useUserContextStore(selectActiveProfile);

  /**
   * Check privacy status for a persona before sending
   * Use this to show users what will happen
   */
  const checkPrivacyStatus = useCallback(
    async (persona: any): Promise<BackendDecision> => {
      return makeBackendRoutingDecision(persona);
    },
    []
  );

  /**
   * Preview what privacy processing would happen for a message
   */
  const previewMessage = useCallback(
    async (content: string, persona: any) => {
      return previewPrivacyProcessing(content, persona);
    },
    []
  );

  /**
   * Send a single message to one persona with privacy-first processing.
   * Routing priority:
   *   1. If model is local (provider === 'ollama') → always local inference
   *   2. If persona has custom backend override → use persona config
   *   3. Otherwise use global privacyMode from settings
   */
  const sendSingleMessage = useCallback(
    async (content: string, targetPersona: any, model: any) => {
      const privacyMode = settings.privacyMode;

      // Update privacy status to processing
      setPrivacyStatus({
        mode: 'processing',
        icon: '⏳',
        label: 'Processing',
        explanation: privacyMode === 'local' ? 'Processing locally...' : 'Analyzing privacy requirements...',
        hadFallback: false,
      });

      // LOCAL MODEL: always route to local inference regardless of mode
      if (model?.provider === 'ollama') {
        await sendLocalOnly(content, targetPersona, model);
        return;
      }

      // User's pill selection (privacyMode) controls routing.
      // enable_local_anonymizer on the persona still forces the privacy pipeline
      // even in cloud mode, as a safety net for privacy-sensitive personas.
      if (privacyMode === 'local') {
        await sendLocalOnly(content, targetPersona, model);
      } else if (privacyMode === 'hybrid') {
        await sendWithPrivacy(content, targetPersona, model);
      } else {
        // Cloud mode — still run privacy pipeline if persona requires anonymization
        if (targetPersona?.enable_local_anonymizer) {
          await sendWithPrivacy(content, targetPersona, model);
        } else {
          await sendDirect(content, targetPersona, model);
        }
      }
    },
    [settings.privacyMode, settings, getModelById, getCurrentConversation, getCurrentMessages, contexts, currentConversationId, updateStreamingContent, finalizeStreaming, setLoading, addMessage]
  );

  /**
   * Send a message with privacy-first processing
   * Accepts optional mentionedPersonaIds for multi-persona routing
   */
  const sendMessage = useCallback(
    async (content: string, mentionedPersonaIds?: string[]) => {
      if (!currentConversationId || !content.trim()) return;

      const conversation = getCurrentConversation();
      if (!conversation) return;

      // If multiple personas mentioned, use multi-persona flow
      if (mentionedPersonaIds && mentionedPersonaIds.length > 1) {
        return sendMultiPersonaMessage(content, mentionedPersonaIds);
      }

      // Determine target persona
      let targetPersona = mentionedPersonaIds?.length === 1
        ? personas.find(p => p.id === mentionedPersonaIds[0])
        : getSelectedPersona();

      // Prefer conversation-specific model (set via context panel), fall back to global default, then first enabled model
      const model = getModelById(conversation.modelId || settings.defaultModelId) ?? getEnabledModels()[0];

      // Check for @mention to switch persona
      if (!targetPersona || (content.trim().startsWith('@') && !mentionedPersonaIds)) {
        const sortedPersonas = [...personas].sort((a, b) => b.name.length - a.name.length);
        for (const p of sortedPersonas) {
          if (content.toLowerCase().startsWith(`@${p.name.toLowerCase()}`)) {
            targetPersona = p;
            if (conversation.personaId !== p.id) {
              updateConversationPersona(currentConversationId, p.id);
            }
            break;
          }
        }
      }

      if (!targetPersona) {
        targetPersona = getSelectedPersona();
      }

      // Check airplane mode and model provider
      const airplaneMode = isAirplaneModeActive();
      const isLocalModel = model?.provider === 'ollama';

      // Add user message
      addMessage(currentConversationId, {
        conversationId: currentConversationId,
        role: 'user',
        content: content.trim(),
        personaId: targetPersona?.id,
      });

      setLoading(true);
      updateStreamingContent('');

      await sendSingleMessage(content, targetPersona, model);
    },
    [
      currentConversationId,
      getCurrentConversation,
      getSelectedPersona,
      getModelById,
      settings,
      personas,
      addMessage,
      updateConversationPersona,
      updateStreamingContent,
      setLoading,
      isAirplaneModeActive,
      sendSingleMessage,
    ]
  );

  /**
   * Send message to multiple personas sequentially with privacy processing
   */
  const sendMultiPersonaMessage = useCallback(
    async (content: string, targetPersonaIds: string[]) => {
      if (!currentConversationId || !content.trim()) return;

      const conversation = getCurrentConversation();
      if (!conversation) return;

      const targetPersonas = targetPersonaIds
        .map(id => personas.find(p => p.id === id))
        .filter((p): p is Persona => p !== undefined);

      if (targetPersonas.length === 0) return;

      // Add user message
      addMessage(currentConversationId, {
        conversationId: currentConversationId,
        role: 'user',
        content: content.trim(),
        personaId: targetPersonas[0]?.id,
      });

      setLoading(true);

      // Send to each persona sequentially through privacy pipeline
      for (const targetPersona of targetPersonas) {
        updateStreamingContent('');
        const model = getModelById(conversation.modelId || settings.defaultModelId) ?? getEnabledModels()[0];
        await sendSingleMessage(content, targetPersona, model);
      }

      setLoading(false);
    },
    [
      currentConversationId,
      getCurrentConversation,
      personas,
      settings,
      addMessage,
      setLoading,
      updateStreamingContent,
      getModelById,
      isAirplaneModeActive,
      sendSingleMessage,
    ]
  );

  /**
   * Send locally only (Airplane Mode) - no cloud requests
   */
  const sendLocalOnly = async (content: string, targetPersona: any, passedModel: any) => {
    const startTime = Date.now();
    const t0 = performance.now();

    // Update privacy status for airplane mode
    setPrivacyStatus({
      mode: 'local',
      icon: '✈️',
      label: 'Airplane Mode',
      explanation: 'All processing on your machine - no cloud requests',
      hadFallback: false,
    });

    try {
      // Build a COMPACT ChatML prompt for local inference.
      // Every token costs CPU time, so we minimize prompt size:
      // - Short system prompt (1-2 sentences, not paragraphs)
      // - Only last 4 messages of history (not 6+)
      // - ChatML tags that Qwen3 models understand natively

      // Short system instruction based on persona
      const personaName = targetPersona?.name?.toLowerCase() || '';
      let sysMsg = 'You are a helpful assistant. Be concise.';
      if (personaName.includes('tax')) sysMsg = 'You are a tax advisor. Give concise, accurate answers.';
      else if (personaName.includes('legal')) sysMsg = 'You are a legal advisor. Give concise, accurate answers.';
      else if (personaName.includes('health')) sysMsg = 'You are a health advisor. Give concise, accurate answers.';
      else if (personaName.includes('finance')) sysMsg = 'You are a financial advisor. Give concise, accurate answers.';
      else if (targetPersona?.systemPrompt) {
        // Use first sentence of the persona's system prompt to keep it short
        const firstSentence = targetPersona.systemPrompt.split(/[.!?\n]/)[0];
        if (firstSentence && firstSentence.length < 200) sysMsg = firstSentence.trim() + '.';
      }

      let fullPrompt = `<|im_start|>system\n${sysMsg}<|im_end|>\n`;

      // Add recent conversation history, keeping total prompt under ~1500 chars
      // to stay well within the 1.7B model's context window
      const history = getCurrentMessages();
      const recentHistory = history.slice(-4);
      let historyChars = 0;
      const maxHistoryChars = 1000;
      for (const msg of recentHistory) {
        const role = msg.role === 'user' ? 'user' : 'assistant';
        // Skip error messages from previous failures
        if (msg.content.startsWith('**Airplane Mode Error**')) continue;
        const truncated = msg.content.length > 300 ? msg.content.slice(0, 300) + '…' : msg.content;
        if (historyChars + truncated.length > maxHistoryChars) break;
        fullPrompt += `<|im_start|>${role}\n${truncated}<|im_end|>\n`;
        historyChars += truncated.length;
      }

      fullPrompt += `<|im_start|>user\n${content.trim()}<|im_end|>\n`;
      fullPrompt += `<|im_start|>assistant\n`;

      // Send to local llama.cpp backend
      const { invoke } = await import('@tauri-apps/api/core');

      console.log(`[sendLocalOnly] checking availability… t=${(performance.now()-t0).toFixed(0)}ms`);
      const isAvailable = await invoke<boolean>('ollama_is_available');
      if (!isAvailable) {
        throw new Error('No local AI model has been downloaded yet.\n\nTo use Airplane Mode:\n1. Go to Settings (gear icon)\n2. Find the Privacy Engine section\n3. Download a model\n\nOnce downloaded, Airplane Mode will work fully offline.');
      }

      // Use the model passed from sendMessage (already resolved to user's current default)
      const localModelId = passedModel?.provider === 'ollama'
        ? passedModel.apiModelId
        : settings.airplaneModeModel;

      // Switch the active model in the Rust backend (no-op if already active)
      console.log(`[sendLocalOnly] setting active model: ${localModelId} t=${(performance.now()-t0).toFixed(0)}ms`);
      await invoke('set_active_local_model', { modelId: localModelId }).catch((e: unknown) => {
        console.warn('[sendLocalOnly] set_active_local_model failed (will use default):', e);
      });

      console.log(`[sendLocalOnly] invoking inference, prompt_len=${fullPrompt.length} model=${localModelId} t=${(performance.now()-t0).toFixed(0)}ms`);
      // Retry up to 2 times with increasing delay — handles cold-start race
      // where set_active_local_model returns before the model is fully loaded
      let response: string | undefined;
      let lastErr: unknown;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          response = await invoke<string>('ollama_generate', {
            prompt: fullPrompt,
            model: localModelId,
          });
          break; // success
        } catch (err) {
          lastErr = err;
          const errMsg = err instanceof Error ? err.message : String(err);
          console.warn(`[sendLocalOnly] attempt ${attempt}/3 failed: ${errMsg}`);
          if (attempt < 3) {
            const delay = attempt * 2000; // 2s, then 4s
            console.log(`[sendLocalOnly] retrying in ${delay}ms…`);
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }
      if (response === undefined) {
        throw lastErr;
      }
      // Strip Qwen3 thinking tags from the response
      let cleaned = response;
      // Remove <think>...</think> blocks (model's internal reasoning)
      cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      // Remove orphaned </think> tag at start (if model started thinking before response)
      if (cleaned.startsWith('</think>')) {
        cleaned = cleaned.slice('</think>'.length).trim();
      }
      // Fallback: if stripping removed everything, use original
      if (!cleaned) cleaned = response.replace(/<\/?think>/g, '').trim() || '(No response generated)';

      console.log(`[sendLocalOnly] response received, len=${response.length} cleaned=${cleaned.length} total=${(performance.now()-t0).toFixed(0)}ms`);

      const latencyMs = Date.now() - startTime;
      updateStreamingContent(cleaned);

      try {
        await finalizeStreaming(
          currentConversationId!,
          'local-ollama',
          Math.ceil(fullPrompt.length / 4),
          Math.ceil(cleaned.length / 4),
          latencyMs,
          targetPersona?.id
        );
      } catch (dbErr) {
        console.warn('[sendLocalOnly] finalizeStreaming failed (non-fatal):', dbErr);
        // Non-fatal: the response was already shown via updateStreamingContent
      }

      // Reset privacy status
      setPrivacyStatus({
        mode: 'idle',
        icon: '✈️',
        label: 'Airplane Mode',
        explanation: 'Message processed locally',
        hadFallback: false,
      });

      setLoading(false);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('Airplane mode chat error:', errMsg, error);
      setLoading(false);
      updateStreamingContent('');

      addMessage(currentConversationId!, {
        conversationId: currentConversationId!,
        role: 'assistant',
        content: `**Airplane Mode Error**\n\n${errMsg || 'Failed to process locally. Go to Settings and download the Privacy Engine.'}`,
      });

      setPrivacyStatus({
        mode: 'idle',
        icon: '❌',
        label: 'Error',
        explanation: error instanceof Error ? error.message : 'Local processing failed',
        hadFallback: false,
      });
    }
  };

  /**
   * Execute the cloud send for a processed privacy request.
   * Used by both sendWithPrivacy (for non-review paths) and approveAndSend (after review).
   */
  const executePrivacySend = async (
    content: string,
    processed: ProcessedChatRequest,
    targetPersona: any,
    model: any,
    promptOverride?: string,
    glinerMappings?: Map<string, string>,
    sendOpts?: { includeHistory?: boolean; includeCanvas?: boolean },
  ) => {
    const startTime = Date.now();
    const promptToSend = promptOverride ?? processed.prompt;

    try {
      // Build messages array
      const messages: ChatMessage[] = [];

      // System prompt with privacy notice for attributes-only mode
      if (targetPersona?.systemPrompt) {
        let systemPrompt = targetPersona.systemPrompt;
        if (processed.content_mode === 'attributes_only') {
          systemPrompt += '\n\n[Privacy Mode: User input has been converted to categorical attributes. No personal details are included.]';
        }
        messages.push({ role: 'system', content: systemPrompt });
      }

      // Add contexts
      const conversation = getCurrentConversation();
      const activeContexts = contexts.filter((ctx) =>
        conversation?.activeContextIds.includes(ctx.id)
      );
      if (activeContexts.length > 0) {
        const contextContent = activeContexts
          .map((ctx) => `## ${ctx.name}\n${ctx.content}`)
          .join('\n\n');
        messages.push({
          role: 'system',
          content: `Here is relevant personal context:\n\n${contextContent}`,
        });
      }

      // Add memories if enabled
      if (settings.enableMemory && settings.mem0ApiKey) {
        try {
          const mem0Client = getMem0Client(settings.mem0ApiKey);
          const memories = await mem0Client.searchMemories({
            query: content.trim(),
            limit: 5,
          });
          if (memories.length > 0) {
            messages.push({
              role: 'system',
              content: formatMemoriesAsContext(memories),
            });
          }
        } catch (error) {
          console.error('Failed to retrieve memories:', error);
        }
      }

      // Add conversation history (default: include unless explicitly excluded)
      if (sendOpts?.includeHistory !== false) {
        const history = getCurrentMessages();
        for (const msg of history) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }

      // Add canvas documents from this conversation and its project (default: include unless explicitly excluded)
      if (sendOpts?.includeCanvas !== false) {
        try {
          const { useCanvasStore } = await import('@/stores/canvas');
          const convId = currentConversationId;
          if (convId) {
            const canvasState = useCanvasStore.getState();
            const convDocs = canvasState.getDocumentsByConversation(convId);
            // Also include all docs from the project this conversation belongs to
            const projectId = getCurrentConversation()?.projectId;
            const projectDocs = projectId ? canvasState.getDocumentsByProject(projectId) : [];
            // Merge, deduplicate by id
            const seen = new Set<string>();
            const canvasDocs = [...convDocs, ...projectDocs].filter(d => {
              if (seen.has(d.id)) return false;
              seen.add(d.id);
              return true;
            });
            if (canvasDocs.length > 0) {
              const canvasContent = canvasDocs
                .map(doc => `## Canvas: ${doc.title}\n${doc.content}`)
                .join('\n\n');
              messages.push({
                role: 'system',
                content: `The following documents are available as project context:\n\n${canvasContent}`,
              });
            }
          }
        } catch (e) {
          // canvas store unavailable — skip silently
        }
      }

      // Add the prompt to send (may be edited by user during review)
      messages.push({ role: 'user', content: promptToSend });

      // Stream from appropriate backend
      if (processed.backend === 'ollama') {
        const { invoke } = await import('@tauri-apps/api/core');
        const response = await invoke<string>('ollama_generate', {
          prompt: promptToSend,
          model: processed.model || 'mistral:7b-instruct-q5_K_M',
        });

        const latencyMs = Date.now() - startTime;
        updateStreamingContent(response);

        finalizeStreaming(
          currentConversationId!,
          model?.id || settings.defaultModelId,
          Math.ceil(promptToSend.length / 4),
          Math.ceil(response.length / 4),
          latencyMs,
          targetPersona?.id
        );
      } else {
        const client = getNebiusClient(settings.nebiusApiKey, settings.nebiusApiEndpoint);
        const stream = client.streamChatCompletion({
          model: model?.apiModelId || getEnabledModels().find(m => m.provider !== 'ollama')?.apiModelId || getEnabledModels()[0]?.apiModelId || '',
          messages,
          temperature: targetPersona?.temperature ?? 0.7,
          max_tokens: targetPersona?.maxTokens ?? 4096,
        });

        let fullContent = '';
        for await (const chunk of stream) {
          fullContent += chunk;
          // Rehydrate streamed content if GLiNER mappings exist
          const displayed = glinerMappings && glinerMappings.size > 0
            ? rehydrateResponse(fullContent, glinerMappings)
            : fullContent;
          updateStreamingContent(displayed);
        }

        // Rehydrate final content
        if (glinerMappings && glinerMappings.size > 0) {
          fullContent = rehydrateResponse(fullContent, glinerMappings);
        }

        const latencyMs = Date.now() - startTime;
        const inputTokens = Math.ceil(messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
        const outputTokens = Math.ceil(fullContent.length / 4);

        finalizeStreaming(
          currentConversationId!,
          model?.id || settings.defaultModelId,
          inputTokens,
          outputTokens,
          latencyMs,
          targetPersona?.id
        );

        // Store memories if enabled
        if (settings.enableMemory && settings.mem0ApiKey) {
          try {
            const mem0Client = getMem0Client(settings.mem0ApiKey);
            await mem0Client.addMemories({
              messages: [
                { role: 'user', content: content.trim() },
                { role: 'assistant', content: fullContent },
              ],
            });
          } catch (error) {
            console.error('Failed to store memories:', error);
          }
        }
      }

      // Auto-generate project summary every 5 messages (non-blocking)
      void maybeGenerateProjectSummary(currentConversationId!, settings, model);

      // Reset privacy status
      setPrivacyStatus({
        mode: 'idle',
        icon: '✓',
        label: 'Complete',
        explanation: 'Message sent with privacy protection',
        hadFallback: false,
      });
    } catch (error) {
      console.error('Privacy chat error:', error);
      setLoading(false);
      updateStreamingContent('');

      addMessage(currentConversationId!, {
        conversationId: currentConversationId!,
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
      });

      setPrivacyStatus({
        mode: 'idle',
        icon: '❌',
        label: 'Error',
        explanation: error instanceof Error ? error.message : 'Unknown error',
        hadFallback: false,
      });
    }
  };

  /**
   * Send with privacy-first processing
   */
  const sendWithPrivacy = async (content: string, targetPersona: any, model: any) => {
    try {
      // Step 0: Apply GLiNER PII detection to redact personal data before any cloud sends
      const { sanitized: glinerSanitized, mappings: glinerMappings, entityCount: glinerEntityCount } =
        await applyGlinerPiiRedaction(content);

      if (glinerEntityCount > 0) {
        console.log(`GLiNER detected ${glinerEntityCount} PII entities, text redacted before privacy processing`);
      }

      // Apply custom redaction terms from user profile
      const customTerms = activeUserProfile?.customRedactTerms || [];
      let textAfterGliner = glinerEntityCount > 0 ? glinerSanitized : content;
      if (customTerms.length > 0) {
        const { sanitized: customSanitized, mappings: customMappings } = applyCustomRedaction(textAfterGliner, customTerms);
        textAfterGliner = customSanitized;
        // Merge custom mappings into GLiNER mappings for rehydration
        for (const [placeholder, original] of customMappings) {
          glinerMappings.set(placeholder, original);
        }
        if (customMappings.size > 0) {
          console.log(`Custom redaction applied ${customMappings.size} term(s)`);
        }
      }

      // Use the sanitized content for the rest of the pipeline
      const contentForProcessing = textAfterGliner;

      // Step 1: Process with privacy routing
      const processed = await processChatWithPrivacy(contentForProcessing, targetPersona);

      // Update privacy status based on decision
      updatePrivacyStatusFromProcessed(processed);

      // Step 2: Check if blocked
      if (!processed.is_safe) {
        setLoading(false);
        addMessage(currentConversationId!, {
          conversationId: currentConversationId!,
          role: 'assistant',
          content: `**Privacy Protection Active**\n\n${processed.info || 'Request blocked due to privacy requirements.'}\n\nThis persona requires privacy features that are currently unavailable. Please download the privacy engine in Settings or adjust persona settings.`,
          personaId: targetPersona?.id,
        });
        return;
      }

      // Step 3: Check if this needs user review before cloud send
      const needsReview =
        !settings.skipCloudReview &&
        (processed.content_mode === 'attributes_only' || processed.backend === 'hybrid');

      if (needsReview) {
        // Pause for user review — set pending state
        setPendingReview({
          originalMessage: content,
          processedPrompt: processed.prompt,
          processed,
          targetPersona,
          model,
          glinerMappings: glinerMappings.size > 0 ? glinerMappings : undefined,
        });
        setPrivacyStatus({
          mode: 'pending_review',
          icon: '👁',
          label: 'Review',
          explanation: 'Review the prompt before sending to cloud',
          attributesCount: processed.attributes_count,
          hadFallback: false,
        });
        setLoading(false);
        return;
      }

      // Step 4: No review needed — send immediately
      await executePrivacySend(content, processed, targetPersona, model, undefined, glinerMappings);
    } catch (error) {
      console.error('Privacy chat error:', error);
      setLoading(false);
      updateStreamingContent('');

      addMessage(currentConversationId!, {
        conversationId: currentConversationId!,
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
      });

      setPrivacyStatus({
        mode: 'idle',
        icon: '❌',
        label: 'Error',
        explanation: error instanceof Error ? error.message : 'Unknown error',
        hadFallback: false,
      });
    }
  };

  /**
   * Approve a pending review and send to cloud (optionally with edited prompt and context opts)
   */
  const approveAndSend = useCallback(
    async (editedPrompt?: string, sendOpts?: { includeHistory?: boolean; includeCanvas?: boolean }) => {
      if (!pendingReview) return;

      const { originalMessage, processedPrompt, processed, targetPersona, model, glinerMappings } = pendingReview;
      const promptToSend = editedPrompt ?? processedPrompt;

      setPendingReview(null);
      setLoading(true);
      updateStreamingContent('');

      // Restore the privacy status from the processed result
      updatePrivacyStatusFromProcessed(processed);

      await executePrivacySend(originalMessage, processed, targetPersona, model, promptToSend, glinerMappings, sendOpts);
    },
    [pendingReview, setLoading, updateStreamingContent]
  );

  /**
   * Cancel a pending review — no cloud request is made
   */
  const cancelReview = useCallback(() => {
    setPendingReview(null);
    setPrivacyStatus({
      mode: 'idle',
      icon: '⚡',
      label: 'Ready',
      explanation: 'Review cancelled — no data sent to cloud',
      hadFallback: false,
    });
  }, []);

  /**
   * Send directly without privacy processing (for non-privacy personas)
   */
  const sendDirect = async (content: string, targetPersona: any, model: any) => {
    setPrivacyStatus({
      mode: 'direct',
      icon: '⚡',
      label: 'Direct',
      explanation: 'Standard cloud processing',
      hadFallback: false,
    });

    const startTime = Date.now();

    // Apply custom redaction terms even in direct mode
    const customTerms = activeUserProfile?.customRedactTerms || [];
    let contentToSend = content;
    let directMappings = new Map<string, string>();
    if (customTerms.length > 0) {
      const { sanitized, mappings } = applyCustomRedaction(content, customTerms);
      contentToSend = sanitized;
      directMappings = mappings;
      if (mappings.size > 0) {
        console.log(`Custom redaction (direct mode) applied ${mappings.size} term(s)`);
      }
    }

    try {
      const messages: ChatMessage[] = [];

      if (targetPersona?.systemPrompt) {
        messages.push({ role: 'system', content: targetPersona.systemPrompt });
      }

      const conversation = getCurrentConversation();
      const activeContexts = contexts.filter((ctx) =>
        conversation?.activeContextIds.includes(ctx.id)
      );
      if (activeContexts.length > 0) {
        const contextContent = activeContexts
          .map((ctx) => `## ${ctx.name}\n${ctx.content}`)
          .join('\n\n');
        messages.push({
          role: 'system',
          content: `Here is relevant personal context:\n\n${contextContent}`,
        });
      }

      if (settings.enableMemory && settings.mem0ApiKey) {
        try {
          const mem0Client = getMem0Client(settings.mem0ApiKey);
          const memories = await mem0Client.searchMemories({
            query: content.trim(),
            limit: 5,
          });
          if (memories.length > 0) {
            messages.push({
              role: 'system',
              content: formatMemoriesAsContext(memories),
            });
          }
        } catch (error) {
          console.error('Failed to retrieve memories:', error);
        }
      }

      const history = getCurrentMessages();
      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
      }
      messages.push({ role: 'user', content: contentToSend.trim() });

      const client = getNebiusClient(settings.nebiusApiKey, settings.nebiusApiEndpoint);
      const stream = client.streamChatCompletion({
        model: model?.apiModelId || 'Qwen/Qwen3-32B-fast',
        messages,
        temperature: targetPersona?.temperature ?? 0.7,
        max_tokens: targetPersona?.maxTokens ?? 2000,
      });

      let fullContent = '';
      for await (const chunk of stream) {
        fullContent += chunk;
        const displayed = directMappings.size > 0
          ? rehydrateResponse(fullContent, directMappings)
          : fullContent;
        updateStreamingContent(displayed);
      }

      // Rehydrate final content
      if (directMappings.size > 0) {
        fullContent = rehydrateResponse(fullContent, directMappings);
      }

      const latencyMs = Date.now() - startTime;
      const inputTokens = Math.ceil(messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
      const outputTokens = Math.ceil(fullContent.length / 4);

      finalizeStreaming(
        currentConversationId!,
        model?.id || settings.defaultModelId,
        inputTokens,
        outputTokens,
        latencyMs,
        targetPersona?.id
      );

      if (settings.enableMemory && settings.mem0ApiKey) {
        try {
          const mem0Client = getMem0Client(settings.mem0ApiKey);
          await mem0Client.addMemories({
            messages: [
              { role: 'user', content: content.trim() },
              { role: 'assistant', content: fullContent },
            ],
          });
        } catch (error) {
          console.error('Failed to store memories:', error);
        }
      }

      setPrivacyStatus({
        mode: 'idle',
        icon: '✓',
        label: 'Complete',
        explanation: 'Message sent',
        hadFallback: false,
      });
    } catch (error) {
      console.error('Chat error:', error);
      setLoading(false);
      updateStreamingContent('');

      addMessage(currentConversationId!, {
        conversationId: currentConversationId!,
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
      });
    }
  };

  const updatePrivacyStatusFromProcessed = (processed: ProcessedChatRequest) => {
    if (!processed.is_safe) {
      setPrivacyStatus({
        mode: 'blocked',
        icon: '🚫',
        label: 'Blocked',
        explanation: processed.info || 'Privacy requirements cannot be met',
        hadFallback: false,
      });
    } else if (processed.content_mode === 'attributes_only') {
      setPrivacyStatus({
        mode: 'attributes_only',
        icon: '🔒',
        label: 'Max Privacy',
        explanation: `${processed.attributes_count || 0} attributes extracted, no full text sent`,
        attributesCount: processed.attributes_count,
        hadFallback: processed.info?.includes('Fallback') || false,
      });
    } else if (processed.backend === 'ollama') {
      setPrivacyStatus({
        mode: 'local',
        icon: '🔒',
        label: 'Local Only',
        explanation: 'All processing on your machine',
        hadFallback: false,
      });
    } else if (processed.backend === 'hybrid') {
      setPrivacyStatus({
        mode: 'anonymized',
        icon: '🔐',
        label: 'Anonymized',
        explanation: 'PII removed before cloud processing',
        hadFallback: processed.info?.includes('Fallback') || false,
      });
    } else {
      setPrivacyStatus({
        mode: 'direct',
        icon: '⚡',
        label: 'Direct',
        explanation: 'Standard cloud processing',
        hadFallback: false,
      });
    }
  };

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    updateStreamingContent('');
    setPrivacyStatus({
      mode: 'idle',
      icon: '⚡',
      label: 'Ready',
      explanation: 'Waiting for message',
      hadFallback: false,
    });
  }, [setLoading, updateStreamingContent]);

  return {
    sendMessage,
    sendMultiPersonaMessage,
    cancelStream,
    checkPrivacyStatus,
    previewMessage,
    privacyStatus,
    pendingReview,
    approveAndSend,
    cancelReview,
  };
}
