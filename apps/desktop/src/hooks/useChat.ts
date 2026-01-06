import { useCallback, useRef } from "react";
import { useChatStore, useSettingsStore, usePersonasStore } from "@/stores";
import { getNebiusClient, type ChatMessage } from "@/services/nebius";
import { getMem0Client, formatMemoriesAsContext } from "@/services/mem0";

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

  const sendMessage = useCallback(
    async (content: string) => {
      if (!currentConversationId || !content.trim()) return;

      const conversation = getCurrentConversation();
      if (!conversation) return;

      let targetPersona = getSelectedPersona();
      const model = getModelById(conversation.modelId || settings.defaultModelId);

      // Check for @mention to switch persona
      // We check this BEFORE sending the message so we can update the conversation state if needed
      if (content.trim().startsWith("@")) {
        // Sort personas by name length (desc is better to match "Life Coach" before "Life")
        const sortedPersonas = [...personas].sort((a, b) => b.name.length - a.name.length);

        for (const p of sortedPersonas) {
          // Check if content starts with @PersonaName
          // Case insensitive match
          if (content.toLowerCase().startsWith(`@${p.name.toLowerCase()}`)) {
            targetPersona = p;

            // If the conversation is currently using a different persona, switch it
            if (conversation.personaId !== p.id) {
              updateConversationPersona(currentConversationId, p.id);
            }
            break;
          }
        }
      }

      if (!settings.nebiusApiKey) {
        console.error("No API key configured");
        return;
      }

      // Add user message
      addMessage(currentConversationId, {
        conversationId: currentConversationId,
        role: "user",
        // We include the full content including @mention
        content: content.trim(),
        // We can tag the user message with the target persona too if we want, 
        // to show who they were talking to, but typically we just tag the assistant response.
        // Let's tag it for consistency if we update the UI to show "Sent into X"
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
      addMessage,
      updateStreamingContent,
      finalizeStreaming,
      setLoading,
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
    cancelStream,
  };
}
