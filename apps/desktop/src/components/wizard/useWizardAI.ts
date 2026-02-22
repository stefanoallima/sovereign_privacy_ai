import { useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useWizardStore } from "@/stores/wizard";
// Bundled at build time via Vite's ?raw import
import wizardContext from "./wizard-context.md?raw";

/**
 * Strip Qwen3 <think> tags from model responses.
 */
function stripThinkTags(text: string): string {
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (cleaned.startsWith("</think>")) {
    cleaned = cleaned.slice("</think>".length).trim();
  }
  if (!cleaned) {
    cleaned = text.replace(/<\/?think>/g, "").trim() || "";
  }
  return cleaned;
}

/**
 * Build the system prompt from the wizard context markdown.
 * Keeps it concise for small local models by trimming to essentials.
 */
function buildSystemPrompt(): string {
  return `${wizardContext}

Remember: Keep responses to 1-2 sentences. Be warm and concise. Do not use markdown formatting. Never pressure the user — they are in control.`;
}

/**
 * Hook that provides AI-powered commentary for the wizard.
 * Falls back to hardcoded text if model is unavailable.
 */
export function useWizardAI() {
  const { addChatMessage, setAiLoading, choices } = useWizardStore();
  const abortRef = useRef(false);

  const getAIResponse = useCallback(
    async (prompt: string, fallback: string): Promise<string> => {
      abortRef.current = false;

      // Try local model first
      try {
        const systemPrompt = buildSystemPrompt();

        const fullPrompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${prompt}<|im_end|>\n<|im_start|>assistant\n`;

        // Use the default wizard model (smallest available)
        const response = await Promise.race([
          invoke<string>("ollama_generate", {
            prompt: fullPrompt,
            model: "qwen3-0.6b",
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 15000)
          ),
        ]);

        if (abortRef.current) return fallback;

        const cleaned = stripThinkTags(response);

        // If response is empty or too long (> 300 chars), use fallback
        if (!cleaned || cleaned.length > 300) {
          return fallback;
        }

        return cleaned;
      } catch {
        // Model unavailable — use fallback
        return fallback;
      }
    },
    []
  );

  /**
   * Generate AI commentary for a wizard step choice and add it as a chat message.
   */
  const generateCommentary = useCallback(
    async (prompt: string, fallback: string) => {
      setAiLoading(true);
      try {
        const response = await getAIResponse(prompt, fallback);
        addChatMessage("assistant", response);
      } finally {
        setAiLoading(false);
      }
    },
    [getAIResponse, addChatMessage, setAiLoading]
  );

  /**
   * Handle a free-text user question in the wizard chat.
   */
  const askQuestion = useCallback(
    async (question: string) => {
      addChatMessage("user", question);
      setAiLoading(true);
      try {
        const context = choices.privacyMode
          ? `The user chose "${choices.privacyMode}" privacy mode.`
          : "The user is setting up the app for the first time.";
        const prompt = `${context}\n\nThe user asks: "${question}"\n\nAnswer briefly in 1-2 sentences. Do not pressure the user — explain trade-offs honestly and let them decide.`;
        const fallback =
          "I'm not able to answer that right now, but you can explore the Settings panel after setup for more details.";
        const response = await getAIResponse(prompt, fallback);
        addChatMessage("assistant", response);
      } finally {
        setAiLoading(false);
      }
    },
    [getAIResponse, addChatMessage, setAiLoading, choices.privacyMode]
  );

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { generateCommentary, askQuestion, abort };
}
