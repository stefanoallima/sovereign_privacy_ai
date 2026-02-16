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

export interface PrivacyStatus {
  /** Current privacy mode */
  mode: 'idle' | 'processing' | 'attributes_only' | 'anonymized' | 'direct' | 'blocked' | 'local';
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

export function usePrivacyChat() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const [privacyStatus, setPrivacyStatus] = useState<PrivacyStatus>({
    mode: 'idle',
    icon: '⚡',
    label: 'Ready',
    explanation: 'Waiting for message',
    hadFallback: false,
  });

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
   * Send a message with privacy-first processing
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!currentConversationId || !content.trim()) return;

      const conversation = getCurrentConversation();
      if (!conversation) return;

      let targetPersona = getSelectedPersona();
      const model = getModelById(conversation.modelId || settings.defaultModelId);

      // Check for @mention to switch persona
      if (content.trim().startsWith('@')) {
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

      // Check airplane mode first - forces all requests to local Ollama
      const airplaneMode = isAirplaneModeActive();

      if (!airplaneMode && !settings.nebiusApiKey) {
        console.error('No API key configured and not in airplane mode');
        return;
      }

      // Add user message
      addMessage(currentConversationId, {
        conversationId: currentConversationId,
        role: 'user',
        content: content.trim(),
        personaId: targetPersona?.id,
      });

      setLoading(true);
      updateStreamingContent('');

      // Update privacy status to processing
      setPrivacyStatus({
        mode: 'processing',
        icon: '⏳',
        label: 'Processing',
        explanation: airplaneMode ? 'Processing locally (Airplane Mode)...' : 'Analyzing privacy requirements...',
        hadFallback: false,
      });

      // AIRPLANE MODE: Force all requests to local Ollama
      if (airplaneMode) {
        await sendLocalOnly(content, targetPersona, model);
        return;
      }

      // Check if persona has privacy-first configuration
      const hasPrivacyConfig =
        targetPersona?.enable_local_anonymizer ||
        targetPersona?.preferred_backend === 'ollama' ||
        targetPersona?.preferred_backend === 'hybrid';

      if (hasPrivacyConfig) {
        // Use privacy-aware processing
        await sendWithPrivacy(content, targetPersona, model);
      } else {
        // Use standard processing (faster, for non-privacy personas)
        await sendDirect(content, targetPersona, model);
      }
    },
    [
      currentConversationId,
      getCurrentConversation,
      getCurrentMessages,
      getSelectedPersona,
      getModelById,
      settings,
      personas,
      addMessage,
      updateStreamingContent,
      setLoading,
      contexts,
    ]
  );

  /**
   * Send locally only (Airplane Mode) - no cloud requests
   */
  const sendLocalOnly = async (content: string, targetPersona: any, _model: any) => {
    const startTime = Date.now();

    // Update privacy status for airplane mode
    setPrivacyStatus({
      mode: 'local',
      icon: '✈️',
      label: 'Airplane Mode',
      explanation: 'All processing on your machine - no cloud requests',
      hadFallback: false,
    });

    try {
      // Build the prompt with system message and context
      let fullPrompt = '';

      // Add system prompt from persona
      if (targetPersona?.systemPrompt) {
        fullPrompt += `System: ${targetPersona.systemPrompt}\n\n`;
      }

      // Add active contexts
      const conversation = getCurrentConversation();
      const activeContexts = contexts.filter((ctx) =>
        conversation?.activeContextIds.includes(ctx.id)
      );
      if (activeContexts.length > 0) {
        const contextContent = activeContexts
          .map((ctx) => `## ${ctx.name}\n${ctx.content}`)
          .join('\n\n');
        fullPrompt += `Context:\n${contextContent}\n\n`;
      }

      // Add conversation history (last few messages for context)
      const history = getCurrentMessages();
      const recentHistory = history.slice(-6); // Last 3 exchanges
      if (recentHistory.length > 0) {
        fullPrompt += 'Conversation:\n';
        for (const msg of recentHistory) {
          fullPrompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
        }
        fullPrompt += '\n';
      }

      // Add the current user message
      fullPrompt += `User: ${content.trim()}\n\nAssistant:`;

      // Send to local Ollama
      const { invoke } = await import('@tauri-apps/api/core');

      // Check if Ollama is available first
      const isAvailable = await invoke<boolean>('ollama_is_available');
      if (!isAvailable) {
        throw new Error('Ollama is not running. Please start Ollama with "ollama serve" to use Airplane Mode.');
      }

      // Get the selected model - check if it's an Ollama model
      const selectedModel = conversation?.modelId
        ? getModelById(conversation.modelId)
        : null;

      // Use the selected Ollama model or fall back to default
      const ollamaModel = selectedModel?.provider === 'ollama'
        ? selectedModel.apiModelId
        : settings.airplaneModeModel;

      const response = await invoke<string>('ollama_generate', {
        prompt: fullPrompt,
        model: ollamaModel,
      });

      const latencyMs = Date.now() - startTime;
      updateStreamingContent(response);

      finalizeStreaming(
        currentConversationId!,
        'local-ollama',
        Math.ceil(fullPrompt.length / 4),
        Math.ceil(response.length / 4),
        latencyMs,
        targetPersona?.id
      );

      // Reset privacy status
      setPrivacyStatus({
        mode: 'idle',
        icon: '✈️',
        label: 'Airplane Mode',
        explanation: 'Message processed locally',
        hadFallback: false,
      });
    } catch (error) {
      console.error('Airplane mode chat error:', error);
      setLoading(false);
      updateStreamingContent('');

      addMessage(currentConversationId!, {
        conversationId: currentConversationId!,
        role: 'assistant',
        content: `✈️ **Airplane Mode Error**\n\n${error instanceof Error ? error.message : 'Failed to process locally'}\n\nMake sure Ollama is running: \`ollama serve\``,
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
   * Send with privacy-first processing
   */
  const sendWithPrivacy = async (content: string, targetPersona: any, model: any) => {
    const startTime = Date.now();

    try {
      // Step 1: Process with privacy routing
      const processed = await processChatWithPrivacy(content, targetPersona);

      // Update privacy status based on decision
      updatePrivacyStatusFromProcessed(processed);

      // Step 2: Check if blocked
      if (!processed.is_safe) {
        setLoading(false);
        addMessage(currentConversationId!, {
          conversationId: currentConversationId!,
          role: 'assistant',
          content: `🚫 **Privacy Protection Active**\n\n${processed.info || 'Request blocked due to privacy requirements.'}\n\nThis persona requires privacy features that are currently unavailable. Please ensure Ollama is running or adjust persona settings.`,
          personaId: targetPersona?.id,
        });
        return;
      }

      // Step 3: Build messages array
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

      // Add conversation history
      const history = getCurrentMessages();
      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
      }

      // Add the processed prompt (may be attributes-only or full text)
      messages.push({ role: 'user', content: processed.prompt });

      // Step 4: Stream from appropriate backend
      if (processed.backend === 'ollama') {
        // Local processing - non-streaming for now
        const { invoke } = await import('@tauri-apps/api/core');
        const response = await invoke<string>('ollama_generate', {
          prompt: processed.prompt,
          model: processed.model || 'mistral:7b-instruct-q5_K_M',
        });

        const latencyMs = Date.now() - startTime;
        updateStreamingContent(response);

        finalizeStreaming(
          currentConversationId!,
          model?.id || settings.defaultModelId,
          Math.ceil(processed.prompt.length / 4),
          Math.ceil(response.length / 4),
          latencyMs,
          targetPersona?.id
        );
      } else {
        // Cloud processing (Nebius)
        const client = getNebiusClient(settings.nebiusApiKey, settings.nebiusApiEndpoint);
        const stream = client.streamChatCompletion({
          model: processed.model || model?.apiModelId || 'Qwen/Qwen3-32B-fast',
          messages,
          temperature: targetPersona?.temperature ?? 0.7,
          max_tokens: targetPersona?.maxTokens ?? 2000,
        });

        let fullContent = '';
        for await (const chunk of stream) {
          fullContent += chunk;
          updateStreamingContent(fullContent);
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
      messages.push({ role: 'user', content: content.trim() });

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
        updateStreamingContent(fullContent);
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
    cancelStream,
    checkPrivacyStatus,
    previewMessage,
    privacyStatus,
  };
}
