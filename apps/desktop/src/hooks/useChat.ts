import { useCallback, useRef } from "react";
import { useChatStore, useSettingsStore, usePersonasStore } from "@/stores";
import { getNebiusClient, type ChatMessage } from "@/services/nebius";
import { getMem0Client, formatMemoriesAsContext } from "@/services/mem0";
import type { Persona } from "@/types";

export function useChat() {
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const { settings, getModelById } = useSettingsStore();
  const { getSelectedPersona, personas } = usePersonasStore();

  // Parse all @mentions from message text
  const parseMentions = useCallback((text: string): string[] => {
    const mentionRegex = /@(\w+(?:[-\s]\w+)*)/gi;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionName = match[1].toLowerCase().replace(/-/g, ' ');

      // Check for special mentions
      if (mentionName === 'here') {
        // @here = current conversation persona (could expand to all active personas)
        const conv = getCurrentConversation();
        if (conv?.personaId && !mentions.includes(conv.personaId)) {
          mentions.push(conv.personaId);
        }
      } else if (mentionName === 'all') {
        // @all = all personas
        personas.forEach(p => {
          if (!mentions.includes(p.id)) {
            mentions.push(p.id);
          }
        });
      } else {
        // Find matching persona by name (case insensitive)
        const matchedPersona = personas.find(p =>
          p.name.toLowerCase() === mentionName ||
          p.name.toLowerCase().replace(/\s+/g, '-') === mentionName.replace(/\s+/g, '-') ||
          p.name.toLowerCase().startsWith(mentionName)
        );
        if (matchedPersona && !mentions.includes(matchedPersona.id)) {
          mentions.push(matchedPersona.id);
        }
      }
    }

    return mentions;
  }, [personas, getCurrentConversation]);

  // Send message to a specific persona and stream the response
  const sendToPersona = useCallback(async (
    content: string,
    targetPersona: Persona,
    conversationId: string,
    otherPersonasContext: string[] = []
  ): Promise<string> => {
    const conversation = getCurrentConversation();
    if (!conversation) return '';

    const model = getModelById(conversation.modelId || settings.defaultModelId);

    // Build messages array
    const messages: ChatMessage[] = [];

    // System prompt from target persona
    if (targetPersona?.systemPrompt) {
      messages.push({
        role: "system",
        content: targetPersona.systemPrompt,
      });
    }

    // Add group chat awareness if multiple personas are involved
    if (otherPersonasContext.length > 0) {
      const otherNames = otherPersonasContext
        .map(id => personas.find(p => p.id === id)?.name)
        .filter(Boolean)
        .join(', ');

      messages.push({
        role: "system",
        content: `You are in a group chat conversation. Other participants in this discussion: ${otherNames}. Respond naturally, and you may reference what others have said if relevant.`,
      });
    }

    // Add selected personal contexts
    const activeContexts = contexts.filter((ctx) =>
      conversation.activeContextIds.includes(ctx.id)
    );
    if (activeContexts.length > 0) {
      const contextContent = activeContexts
        .map((ctx) => `## ${ctx.name}\n${ctx.content}`)
        .join("\n\n");
      messages.push({
        role: "system",
        content: `Here is relevant personal context:\n\n${contextContent}`,
      });
    }

    // Retrieve relevant memories from mem0 if enabled
    if (settings.enableMemory && settings.mem0ApiKey) {
      try {
        const mem0Client = getMem0Client(settings.mem0ApiKey);
        const memories = await mem0Client.searchMemories({
          query: content.trim(),
          limit: 5,
        });

        if (memories.length > 0) {
          const memoryContext = formatMemoriesAsContext(memories);
          messages.push({
            role: "system",
            content: memoryContext,
          });
        }
      } catch (error) {
        console.error("Failed to retrieve memories:", error);
      }
    }

    // Add conversation history
    const history = getCurrentMessages();
    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add current message
    messages.push({
      role: "user",
      content: content.trim(),
    });

    const startTime = Date.now();
    let fullContent = "";

    try {
      const client = getNebiusClient(
        settings.nebiusApiKey,
        settings.nebiusApiEndpoint
      );

      const stream = client.streamChatCompletion({
        model: model?.apiModelId || "Qwen/Qwen3-32B-fast",
        messages,
        temperature: targetPersona?.temperature ?? 0.7,
        max_tokens: targetPersona?.maxTokens ?? 2000,
      });

      for await (const chunk of stream) {
        fullContent += chunk;
        updateStreamingContent(fullContent);
      }

      const latencyMs = Date.now() - startTime;

      // Estimate tokens (rough: ~4 chars per token)
      const inputTokens = Math.ceil(
        messages.reduce((sum, m) => sum + m.content.length, 0) / 4
      );
      const outputTokens = Math.ceil(fullContent.length / 4);

      // Finalize the message
      await finalizeStreaming(
        conversationId,
        model?.id || settings.defaultModelId,
        inputTokens,
        outputTokens,
        latencyMs,
        targetPersona?.id
      );

      // Store the conversation in mem0 for future memory if enabled
      if (settings.enableMemory && settings.mem0ApiKey) {
        try {
          const mem0Client = getMem0Client(settings.mem0ApiKey);
          await mem0Client.addMemories({
            messages: [
              { role: "user", content: content.trim() },
              { role: "assistant", content: fullContent },
            ],
          });
        } catch (error) {
          console.error("Failed to store memories:", error);
        }
      }

      return fullContent;
    } catch (error) {
      console.error("Chat error:", error);
      updateStreamingContent("");

      // Add error message
      await addMessage(conversationId, {
        conversationId,
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
        personaId: targetPersona?.id,
      });
      return '';
    }
  }, [
    getCurrentConversation,
    getCurrentMessages,
    getModelById,
    settings,
    contexts,
    personas,
    updateStreamingContent,
    finalizeStreaming,
    addMessage,
  ]);

  // Send message to multiple personas (multi-persona chat)
  const sendMultiPersonaMessage = useCallback(
    async (content: string, targetPersonaIds: string[]) => {
      if (!currentConversationId || !content.trim()) return;

      const conversation = getCurrentConversation();
      if (!conversation) return;

      if (!settings.nebiusApiKey) {
        console.error("No API key configured");
        return;
      }

      // Get target personas (maintain order)
      const targetPersonas = targetPersonaIds
        .map(id => personas.find(p => p.id === id))
        .filter((p): p is Persona => p !== undefined);

      if (targetPersonas.length === 0) {
        console.error("No valid personas found for IDs:", targetPersonaIds);
        return;
      }

      // Add user message (tagged with all target personas)
      await addMessage(currentConversationId, {
        conversationId: currentConversationId,
        role: "user",
        content: content.trim(),
        personaId: targetPersonas[0]?.id, // Primary persona
      });

      setLoading(true);

      // Send to each persona sequentially
      for (let i = 0; i < targetPersonas.length; i++) {
        const targetPersona = targetPersonas[i];
        const otherPersonaIds = targetPersonaIds.filter(id => id !== targetPersona.id);

        updateStreamingContent("");

        // Send to this persona
        await sendToPersona(content, targetPersona, currentConversationId, otherPersonaIds);
      }

      setLoading(false);
    },
    [
      currentConversationId,
      getCurrentConversation,
      personas,
      settings.nebiusApiKey,
      addMessage,
      setLoading,
      updateStreamingContent,
      sendToPersona,
    ]
  );

  const sendMessage = useCallback(
    async (content: string, mentionedPersonaIds?: string[]) => {
      if (!currentConversationId || !content.trim()) return;

      const conversation = getCurrentConversation();
      if (!conversation) return;

      // If mentionedPersonaIds provided and has multiple, use multi-persona flow
      if (mentionedPersonaIds && mentionedPersonaIds.length > 1) {
        return sendMultiPersonaMessage(content, mentionedPersonaIds);
      }

      // Parse mentions from content if not provided
      const parsedMentions = mentionedPersonaIds || parseMentions(content);

      // If multiple mentions found, use multi-persona flow
      if (parsedMentions.length > 1) {
        return sendMultiPersonaMessage(content, parsedMentions);
      }

      // Single persona flow (original logic)
      let targetPersona = parsedMentions.length === 1
        ? personas.find(p => p.id === parsedMentions[0])
        : getSelectedPersona();

      const model = getModelById(conversation.modelId || settings.defaultModelId);

      // Fallback: Check for @mention to switch persona (legacy behavior)
      if (!targetPersona && content.trim().startsWith("@")) {
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

      // Final fallback to selected persona
      if (!targetPersona) {
        targetPersona = getSelectedPersona();
      }

      if (!settings.nebiusApiKey) {
        console.error("No API key configured");
        return;
      }

      // Add user message
      await addMessage(currentConversationId, {
        conversationId: currentConversationId,
        role: "user",
        content: content.trim(),
        personaId: targetPersona?.id
      });

      setLoading(true);
      updateStreamingContent("");

      // Build messages array
      const messages: ChatMessage[] = [];

      // System prompt from target persona
      if (targetPersona?.systemPrompt) {
        messages.push({
          role: "system",
          content: targetPersona.systemPrompt,
        });
      }

      // Add selected personal contexts
      const activeContexts = contexts.filter((ctx) =>
        conversation.activeContextIds.includes(ctx.id)
      );
      if (activeContexts.length > 0) {
        const contextContent = activeContexts
          .map((ctx) => `## ${ctx.name}\n${ctx.content}`)
          .join("\n\n");
        messages.push({
          role: "system",
          content: `Here is relevant personal context:\n\n${contextContent}`,
        });
      }

      // Retrieve relevant memories from mem0 if enabled
      if (settings.enableMemory && settings.mem0ApiKey) {
        try {
          const mem0Client = getMem0Client(settings.mem0ApiKey);
          const memories = await mem0Client.searchMemories({
            query: content.trim(),
            limit: 5,
          });

          if (memories.length > 0) {
            const memoryContext = formatMemoriesAsContext(memories);
            messages.push({
              role: "system",
              content: memoryContext,
            });
          }
        } catch (error) {
          console.error("Failed to retrieve memories:", error);
          // Continue without memories - don't block the conversation
        }
      }

      // Add conversation history
      const history = getCurrentMessages();
      for (const msg of history) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }

      // Add current message
      messages.push({
        role: "user",
        content: content.trim(),
      });

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      const startTime = Date.now();

      try {
        const client = getNebiusClient(
          settings.nebiusApiKey,
          settings.nebiusApiEndpoint
        );

        const stream = client.streamChatCompletion({
          model: model?.apiModelId || "Qwen/Qwen3-32B-fast",
          messages,
          temperature: targetPersona?.temperature ?? 0.7,
          max_tokens: targetPersona?.maxTokens ?? 2000,
        });

        let fullContent = "";

        for await (const chunk of stream) {
          fullContent += chunk;
          updateStreamingContent(fullContent);
        }

        const latencyMs = Date.now() - startTime;

        // Estimate tokens (rough: ~4 chars per token)
        const inputTokens = Math.ceil(
          messages.reduce((sum, m) => sum + m.content.length, 0) / 4
        );
        const outputTokens = Math.ceil(fullContent.length / 4);

        // Finalize the message
        finalizeStreaming(
          currentConversationId,
          model?.id || settings.defaultModelId,
          inputTokens,
          outputTokens,
          latencyMs,
          targetPersona?.id // Pass the persona ID
        );

        // Store the conversation in mem0 for future memory if enabled
        if (settings.enableMemory && settings.mem0ApiKey) {
          try {
            const mem0Client = getMem0Client(settings.mem0ApiKey);
            await mem0Client.addMemories({
              messages: [
                { role: "user", content: content.trim() },
                { role: "assistant", content: fullContent },
              ],
            });
          } catch (error) {
            console.error("Failed to store memories:", error);
            // Don't throw - memory storage failure shouldn't affect user experience
          }
        }
      } catch (error) {
        console.error("Chat error:", error);
        setLoading(false);
        updateStreamingContent("");

        // Add error message
        addMessage(currentConversationId, {
          conversationId: currentConversationId,
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
        });
      }
    },
    [
      currentConversationId,
      getCurrentConversation,
      getCurrentMessages,
      getSelectedPersona,
      getModelById,
      settings,
      contexts,
      personas,
      addMessage,
      updateConversationPersona,
      updateStreamingContent,
      finalizeStreaming,
      setLoading,
      parseMentions,
      sendMultiPersonaMessage,
    ]
  );

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    updateStreamingContent("");
  }, [setLoading, updateStreamingContent]);

  return {
    sendMessage,
    sendMultiPersonaMessage,
    parseMentions,
    cancelStream,
  };
}
