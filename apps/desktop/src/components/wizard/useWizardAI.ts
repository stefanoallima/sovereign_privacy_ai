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
 */
function buildSystemPrompt(): string {
  return `${wizardContext}

Remember: Keep responses to 2-4 sentences. Be warm and concise. Do not use markdown formatting. Never pressure the user — they are in control. Answer questions using the context above — you have all the information you need about Sovereign AI's features, privacy, and setup.`;
}

/**
 * Knowledge-based fallback answers for common wizard questions.
 * Used when the local model is unavailable so users still get helpful responses.
 */
const KNOWLEDGE_FALLBACKS: Array<{ patterns: RegExp[]; answer: string }> = [
  {
    patterns: [
      /zero.?data.?retention/i,
      /zero.?retention/i,
      /zdr/i,
      /data.?retention/i,
      /what.*(does|is).*(retention|stored|keep)/i,
    ],
    answer:
      "Zero data retention means the cloud provider processes your prompt to generate a response, then immediately discards it. Your data is never stored on their servers and never used to train their models. It's like a phone call — the conversation happens, but no recording is kept. Note that on Nebius, you need to enable this option in your account settings — it's not on by default.",
  },
  {
    patterns: [
      /privacy.?guard/i,
      /smart.?shield/i,
      /anonymiz/i,
      /pii/i,
      /strip.*personal/i,
      /redact/i,
    ],
    answer:
      "Smart Shield uses a local Privacy Guard (powered by GLiNER) to detect and strip personal information — names, addresses, phone numbers — from your prompts before they reach the cloud. The cloud AI only sees anonymized text. When the response comes back, your real data is restored locally. Your personal details never leave your device.",
  },
  {
    patterns: [
      /local.?only/i,
      /offline/i,
      /no.?internet/i,
      /airplane/i,
      /maximum.?privacy/i,
    ],
    answer:
      "In Local Only mode, everything runs on your device with no internet connection needed. The trade-off is that local models are smaller and less capable than cloud models, but your data stays completely private — like a personal diary that nobody else can read.",
  },
  {
    patterns: [
      /performance/i,
      /cloud.?mode/i,
      /fastest/i,
      /direct.?cloud/i,
    ],
    answer:
      "Performance mode sends your prompts directly to the cloud provider for maximum intelligence and speed. With zero data retention enabled, the provider processes your request and immediately discards it — no storage, no training. Make sure to enable zero retention in your provider's settings.",
  },
  {
    patterns: [
      /nebius/i,
      /provider/i,
      /which.?(cloud|api|service)/i,
    ],
    answer:
      "We recommend Nebius because they offer European infrastructure with GDPR-level protection and a zero data retention option. You can also use any OpenAI-compatible API provider — just review their privacy policy and data retention terms before connecting.",
  },
  {
    patterns: [
      /safe/i,
      /trust/i,
      /secure/i,
      /encrypt/i,
    ],
    answer:
      "Your local data is encrypted with ChaCha20-Poly1305 (military-grade encryption). The Privacy Guard detects personal information before it can reach any cloud service. You can also use Incognito mode for zero-trace conversations, or Airplane mode to go fully offline.",
  },
  {
    patterns: [
      /what.*(is|does).*(sovereign|this app|app do)/i,
      /how.*(work|does)/i,
      /tell.*(about|more)/i,
    ],
    answer:
      "Sovereign AI is a privacy-first desktop app that gives you your own team of specialized AI advisors — a psychologist, life coach, career coach, tax advisor, and more — all collaborating to help you with life decisions. You control how much data leaves your device: fully local, anonymized cloud, or direct cloud with zero retention.",
  },
  {
    patterns: [
      /change.*later/i,
      /switch/i,
      /can.?i.?(change|modify|update)/i,
    ],
    answer:
      "Absolutely! Every setting you choose during setup can be changed later in the Settings panel. You can switch privacy modes, add or remove cloud providers, and adjust persona preferences at any time.",
  },
];

/**
 * Find a knowledge-based answer for a user question.
 * Returns null if no matching topic is found.
 */
function findKnowledgeAnswer(question: string): string | null {
  for (const entry of KNOWLEDGE_FALLBACKS) {
    if (entry.patterns.some((p) => p.test(question))) {
      return entry.answer;
    }
  }
  return null;
}

/**
 * Hook that provides AI-powered commentary for the wizard.
 * Uses local model when available, falls back to knowledge-based answers.
 */
export function useWizardAI() {
  const { addChatMessage, setAiLoading, choices, chatMessages } =
    useWizardStore();
  const abortRef = useRef(false);

  const getAIResponse = useCallback(
    async (
      prompt: string,
      fallback: string,
      conversationHistory?: Array<{ role: string; content: string }>
    ): Promise<string> => {
      abortRef.current = false;

      // Try local model first
      try {
        const systemPrompt = buildSystemPrompt();

        // Build prompt with conversation history for context
        let fullPrompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n`;

        if (conversationHistory?.length) {
          for (const msg of conversationHistory) {
            fullPrompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
          }
        }

        fullPrompt += `<|im_start|>user\n${prompt}<|im_end|>\n<|im_start|>assistant\n`;

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

        // If response is empty or excessively long, use fallback
        if (!cleaned || cleaned.length > 600) {
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
        const prompt = `${context}\n\nThe user asks: "${question}"\n\nAnswer in 2-4 sentences using your knowledge about Sovereign AI. Be specific and helpful.`;

        // Use knowledge-based answer as fallback instead of generic "can't answer"
        const knowledgeAnswer = findKnowledgeAnswer(question);
        const fallback =
          knowledgeAnswer ??
          "That's a great question. I'd suggest checking the Settings panel after setup — it has detailed explanations for each option. You can also ask me about specific topics like privacy modes, zero data retention, or how Smart Shield works.";

        // Pass recent conversation history for context
        const recentHistory = chatMessages.slice(-6);
        const response = await getAIResponse(
          prompt,
          fallback,
          recentHistory
        );
        addChatMessage("assistant", response);
      } finally {
        setAiLoading(false);
      }
    },
    [
      getAIResponse,
      addChatMessage,
      setAiLoading,
      choices.privacyMode,
      chatMessages,
    ]
  );

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { generateCommentary, askQuestion, abort };
}
