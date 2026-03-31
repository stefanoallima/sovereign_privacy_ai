/**
 * Privacy-Aware Chat Hook
 *
 * Drop-in enhancement for useChat that adds privacy-first processing:
 * - Automatic routing based on persona configuration
 * - Attribute extraction for privacy-first mode
 * - Blocking when privacy requirements can't be met
 * - Privacy status indicators
 */

import { useCallback, useRef, useState } from "react";
import { useChatStore, useSettingsStore, usePersonasStore } from "@/stores";
import { useUserContextStore, selectActiveProfile } from "@/stores/userContext";
import { getNebiusClient, type ChatMessage } from "@/services/nebius";
import { getMem0Client, formatMemoriesAsContext } from "@/services/mem0";
import { previewPrivacyProcessing } from "@/services/privacy-chat-service";
import {
  processChatWithPrivacy,
  type ProcessedChatRequest,
} from "@/services/attribute-extraction-service";
import {
  makeBackendRoutingDecision,
  type BackendDecision,
} from "@/services/backend-routing-service";
import { invoke } from "@tauri-apps/api/core";
import type { Persona, FileAttachment } from "@/types";

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
  onEntitiesDetected?: (entities: DetectedEntity[]) => void
): Promise<{
  sanitized: string;
  mappings: Map<string, string>;
  entityCount: number;
}> {
  try {
    const entities = await invoke<DetectedEntity[]>("detect_pii_with_gliner", {
      text,
      confidenceThreshold: null,
      enabledLabels: null,
    });
    if (!entities || entities.length === 0) {
      return { sanitized: text, mappings: new Map(), entityCount: 0 };
    }
    if (onEntitiesDetected && entities.length > 0) {
      onEntitiesDetected(entities);
    }

    // Sort by position descending so replacements don't shift indices
    const sorted = [...entities].sort((a, b) => b.start - a.start);
    let sanitized = text;
    const mappings = new Map<string, string>();

    for (const entity of sorted) {
      const placeholder = `[PII_${entity.label.toUpperCase().replace(/\s+/g, "_")}]`;
      const original = sanitized.substring(entity.start, entity.end);
      // Only replace if text matches what GLiNER detected (sanity check)
      if (
        original
          .toLowerCase()
          .includes(entity.text.toLowerCase().substring(0, 3))
      ) {
        sanitized =
          sanitized.substring(0, entity.start) +
          placeholder +
          sanitized.substring(entity.end);
        mappings.set(placeholder, original);
      }
    }

    // Auto-persist detected PII to Privacy Shield custom redaction terms
    // so they're automatically redacted in all future messages
    try {
      const { useUserContextStore } = await import("@/stores/userContext");
      const { addCustomRedactTerm } = useUserContextStore.getState();
      const { selectActiveProfile } = await import("@/stores/userContext");
      const existingTerms =
        selectActiveProfile(useUserContextStore.getState())
          ?.customRedactTerms || [];
      const existingValues = new Set(
        existingTerms.map((t) => t.value.toLowerCase())
      );

      let added = 0;
      for (const entity of entities) {
        const value = entity.text.trim();
        // Skip very short values (likely false positives) and duplicates
        if (value.length < 3 || existingValues.has(value.toLowerCase()))
          continue;
        addCustomRedactTerm(entity.label, value);
        existingValues.add(value.toLowerCase());
        added++;
      }
      if (added > 0) {
        console.log(
          `[PII auto-persist] Added ${added} new term(s) to Privacy Shield`
        );
      }
    } catch (persistErr) {
      console.warn("[PII auto-persist] Failed (non-fatal):", persistErr);
    }

    return { sanitized, mappings, entityCount: entities.length };
  } catch (error) {
    console.warn(
      "GLiNER PII detection unavailable, proceeding without:",
      error
    );
    return { sanitized: text, mappings: new Map(), entityCount: 0 };
  }
}

/**
 * Rehydrate a response by replacing PII placeholders back with original values.
 */
function rehydrateResponse(
  text: string,
  mappings: Map<string, string>
): string {
  let result = text;
  for (const [placeholder, original] of mappings) {
    result = result.split(placeholder).join(original);
  }
  return result;
}

/**
 * Call the Rust redaction engine via Tauri invoke.
 * Falls back to a JS implementation if the Rust command is unavailable.
 */
async function rustRedact(
  text: string,
  terms: Array<{ label: string; value: string; replacement: string }>
): Promise<{
  text: string;
  mappings: Map<string, string>;
  count: number;
}> {
  try {
    const result = await invoke<{
      text: string;
      mappings: Record<string, string>;
      redaction_count: number;
    }>("redact_text_command", {
      text,
      terms: terms.map((t) => ({
        label: t.label,
        value: t.value,
        replacement: t.replacement,
      })),
    });
    return {
      text: result.text,
      mappings: new Map(Object.entries(result.mappings)),
      count: result.redaction_count,
    };
  } catch (err) {
    console.warn(
      "Rust redact_text_command unavailable, falling back to JS:",
      err
    );
    return jsFallbackRedact(text, terms);
  }
}

/**
 * JS fallback redaction (case-insensitive). Used only when Rust backend
 * is unavailable.
 */
function jsFallbackRedact(
  text: string,
  terms: Array<{ label: string; value: string; replacement: string }>
): { text: string; mappings: Map<string, string>; count: number } {
  const mappings = new Map<string, string>();
  let result = text;
  let count = 0;

  for (const term of terms) {
    if (!term.value || term.value.length < 2) continue;
    const escaped = term.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    const matches = result.match(regex);
    if (matches && matches.length > 0) {
      count += matches.length;
      result = result.replace(regex, term.replacement);
      mappings.set(term.replacement, term.value);
    }
  }

  return { text: result, mappings, count };
}

/**
 * Apply custom redaction terms via the Rust engine (with JS fallback).
 * Replaces each term's value with its replacement string.
 * The replacement strings are unique and can be mapped back to originals
 * for rehydration.
 */
async function applyCustomRedaction(
  text: string,
  terms: Array<{ label: string; value: string; replacement: string }>
): Promise<{ sanitized: string; mappings: Map<string, string> }> {
  const result = await rustRedact(text, terms);
  return { sanitized: result.text, mappings: result.mappings };
}

/**
 * Apply custom redaction terms to any text (case-insensitive) via the Rust
 * engine. Used for full-pipeline anonymization of context, history, canvas,
 * and memories.
 */
async function redactText(
  text: string,
  terms: Array<{ label: string; value: string; replacement: string }>
): Promise<{
  anonymized: string;
  mappings: Map<string, string>;
  categories: Map<string, number>;
}> {
  const result = await rustRedact(text, terms);

  // Derive per-label category counts from which terms matched
  const categories = new Map<string, number>();
  for (const [replacement] of result.mappings) {
    const matchedTerm = terms.find((t) => t.replacement === replacement);
    if (matchedTerm) {
      categories.set(
        matchedTerm.label,
        (categories.get(matchedTerm.label) || 0) + 1
      );
    }
  }

  return { anonymized: result.text, mappings: result.mappings, categories };
}

export interface PrivacyStatus {
  /** Current privacy mode */
  mode:
    | "idle"
    | "processing"
    | "attributes_only"
    | "anonymized"
    | "direct"
    | "blocked"
    | "local"
    | "pending_review";
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

export interface PiiCategoryCount {
  label: string;
  count: number;
}

export interface PiiContentSourceCount {
  source: string;
  redactionCount: number;
}

export interface PiiReport {
  totalRedactions: number;
  categories: PiiCategoryCount[];
  contentSources: PiiContentSourceCount[];
}

export interface PendingReview {
  originalMessage: string;
  processedPrompt: string;
  processed: ProcessedChatRequest;
  targetPersona: any;
  model: any;
  glinerMappings?: Map<string, string>;
  piiReport?: PiiReport;
}

const SUMMARY_INTERVAL = 5; // generate a summary every N assistant messages

async function maybeGenerateProjectSummary(
  conversationId: string,
  settings: { nebiusApiKey: string; nebiusApiEndpoint: string },
  model: { apiModelId?: string } | undefined
) {
  try {
    const { useChatStore } = await import("@/stores/chat");
    const { useCanvasStore } = await import("@/stores/canvas");
    const chatState = useChatStore.getState();
    const conversation = chatState.conversations.find(
      (c) => c.id === conversationId
    );
    if (!conversation) return;

    // Count only assistant messages
    const allMessages = chatState.messages[conversationId] ?? [];
    const assistantCount = allMessages.filter(
      (m) => m.role === "assistant"
    ).length;
    if (assistantCount === 0 || assistantCount % SUMMARY_INTERVAL !== 0) return;

    // Gather all conversation text (last 20 messages max to keep prompt small)
    const recent = allMessages.slice(-20);
    const transcript = recent
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    // Also include existing canvas docs as context
    const canvasState = useCanvasStore.getState();
    const convDocs = canvasState.getDocumentsByConversation(conversationId);
    const projectDocs = conversation.projectId
      ? canvasState.getDocumentsByProject(conversation.projectId)
      : [];
    const seen = new Set<string>();
    const allDocs = [...convDocs, ...projectDocs].filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
    const docsContext =
      allDocs.length > 0
        ? `\n\nExisting project documents:\n${allDocs.map((d) => `## ${d.title}\n${d.content}`).join("\n\n")}`
        : "";

    const { getNebiusClient } = await import("@/services/nebius");
    const client = getNebiusClient(
      settings.nebiusApiKey,
      settings.nebiusApiEndpoint
    );

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
      model: model?.apiModelId || "deepseek-ai/DeepSeek-V3",
      messages: [{ role: "user", content: summaryPrompt }],
      temperature: 0.3,
      max_tokens: 1024,
    });

    let summaryContent = "";
    for await (const chunk of stream) {
      summaryContent += chunk;
    }

    if (!summaryContent.trim()) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const title = `Project Minutes — ${dateStr} (msg ${assistantCount})`;

    await canvasState.createDocument({
      title,
      content: summaryContent.trim(),
      conversationId,
      projectId: conversation.projectId,
    });
  } catch (e) {
    // Non-critical — log and continue
    console.warn("[summary] Failed to generate project summary:", e);
  }
}

export function usePrivacyChat() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const [privacyStatus, setPrivacyStatus] = useState<PrivacyStatus>({
    mode: "idle",
    icon: "⚡",
    label: "Ready",
    explanation: "Waiting for message",
    hadFallback: false,
  });
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(
    null
  );
  const [lastDetectedEntities, setLastDetectedEntities] = useState<
    DetectedEntity[]
  >([]);

  const {
    currentConversationId,
    getCurrentConversation,
    getCurrentMessages,
    addMessage,
    updateConversationPersona,
    updateConversationSummary,
    updateStreamingContent,
    finalizeStreaming,
    setLoading,
    contexts,
  } = useChatStore();

  const { settings, getModelById, getEnabledModels, isAirplaneModeActive } =
    useSettingsStore();
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
  const previewMessage = useCallback(async (content: string, persona: any) => {
    return previewPrivacyProcessing(content, persona);
  }, []);

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
        mode: "processing",
        icon: "⏳",
        label: "Processing",
        explanation:
          privacyMode === "local"
            ? "Processing locally..."
            : "Analyzing privacy requirements...",
        hadFallback: false,
      });

      // LOCAL MODEL: always route to local inference regardless of mode
      if (model?.provider === "ollama") {
        await sendLocalOnly(content, targetPersona, model);
        return;
      }

      // User's pill selection (privacyMode) controls routing.
      // enable_local_anonymizer on the persona still forces the privacy pipeline
      // even in cloud mode, as a safety net for privacy-sensitive personas.
      if (privacyMode === "local") {
        await sendLocalOnly(content, targetPersona, model);
      } else if (privacyMode === "hybrid") {
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
    [
      settings.privacyMode,
      settings,
      getModelById,
      getCurrentConversation,
      getCurrentMessages,
      contexts,
      currentConversationId,
      updateStreamingContent,
      finalizeStreaming,
      setLoading,
      addMessage,
    ]
  );

  /**
   * Send a message with privacy-first processing
   * Accepts optional mentionedPersonaIds for multi-persona routing
   */
  const sendMessage = useCallback(
    async (
      content: string,
      mentionedPersonaIds?: string[],
      attachments?: FileAttachment[]
    ) => {
      if (!currentConversationId || !content.trim()) return;

      const conversation = getCurrentConversation();
      if (!conversation) return;

      // If multiple personas mentioned, use multi-persona flow
      if (mentionedPersonaIds && mentionedPersonaIds.length > 1) {
        return sendMultiPersonaMessage(
          content,
          mentionedPersonaIds,
          attachments
        );
      }

      // Determine target persona
      let targetPersona =
        mentionedPersonaIds?.length === 1
          ? personas.find((p) => p.id === mentionedPersonaIds[0])
          : getSelectedPersona();

      // Prefer conversation-specific model (set via context panel), fall back to global default, then first enabled model
      const model =
        getModelById(conversation.modelId || settings.defaultModelId) ??
        getEnabledModels()[0];

      // Check for @mention to switch persona
      if (
        !targetPersona ||
        (content.trim().startsWith("@") && !mentionedPersonaIds)
      ) {
        const sortedPersonas = [...personas].sort(
          (a, b) => b.name.length - a.name.length
        );
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

      // Sync conversation persona when the user switches via the context panel
      if (targetPersona && conversation.personaId !== targetPersona.id) {
        updateConversationPersona(currentConversationId, targetPersona.id);
      }

      // Add user message
      addMessage(currentConversationId, {
        conversationId: currentConversationId,
        role: "user",
        content: content.trim(),
        personaId: targetPersona?.id,
        attachments,
      });

      setLoading(true);
      updateStreamingContent("");

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
    async (
      content: string,
      targetPersonaIds: string[],
      attachments?: FileAttachment[]
    ) => {
      if (!currentConversationId || !content.trim()) return;

      const conversation = getCurrentConversation();
      if (!conversation) return;

      const targetPersonas = targetPersonaIds
        .map((id) => personas.find((p) => p.id === id))
        .filter((p): p is Persona => p !== undefined);

      if (targetPersonas.length === 0) return;

      // Add user message
      addMessage(currentConversationId, {
        conversationId: currentConversationId,
        role: "user",
        content: content.trim(),
        personaId: targetPersonas[0]?.id,
        attachments,
      });

      setLoading(true);

      // Send to each persona sequentially through privacy pipeline
      for (const targetPersona of targetPersonas) {
        updateStreamingContent("");
        const model =
          getModelById(conversation.modelId || settings.defaultModelId) ??
          getEnabledModels()[0];
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

  // ---- Token budget helpers for local inference ----

  /** Rough token estimate for Qwen tokenizer (~3.5 chars per token) */
  const estimateTokens = (text: string) => Math.ceil(text.length / 3.5);

  /** ChatML overhead per message: <|im_start|>role\n...<|im_end|>\n ≈ 6 tokens */
  const CHATML_OVERHEAD = 6;

  /** Context sizes per model (must match Rust registry) */
  const MODEL_CTX: Record<string, number> = {
    "qwen3-0.6b": 4096,
    "qwen3-1.7b": 8192,
    "qwen3-4b": 8192,
    "qwen3.5-4b": 16384,
    "qwen3-8b": 16384,
  };
  const MAX_GEN: Record<string, number> = {
    "qwen3-0.6b": 1024,
    "qwen3-1.7b": 2048,
    "qwen3-4b": 2048,
    "qwen3.5-4b": 4096,
    "qwen3-8b": 4096,
  };

  /** Build a short system prompt from the persona */
  function buildSystemPrompt(persona: any): string {
    const name = persona?.name?.toLowerCase() || "";
    if (name.includes("tax"))
      return "You are a tax advisor. Give concise, accurate answers.";
    if (name.includes("legal"))
      return "You are a legal advisor. Give concise, accurate answers.";
    if (name.includes("health"))
      return "You are a health advisor. Give concise, accurate answers.";
    if (name.includes("finance"))
      return "You are a financial advisor. Give concise, accurate answers.";
    if (persona?.systemPrompt) {
      const first = persona.systemPrompt.split(/[.!?\n]/)[0];
      if (first && first.length < 200) return first.trim() + ".";
    }
    return "You are a helpful assistant. Be concise.";
  }

  /** Build a token-budgeted ChatML prompt for local inference */
  function buildLocalPrompt(params: {
    systemMsg: string;
    summary?: string;
    documentContent?: string;
    history: Array<{ role: string; content: string }>;
    userMessage: string;
    modelId: string;
  }): string {
    const ctxSize = MODEL_CTX[params.modelId] ?? 2048;
    const genReserve = MAX_GEN[params.modelId] ?? 384;
    let budget = ctxSize - genReserve;

    // Priority 1: System prompt (with optional summary)
    let sysContent = params.systemMsg;
    if (params.summary) {
      sysContent += `\n\nContext from earlier in this conversation:\n${params.summary}`;
    }
    const sysTokens = estimateTokens(sysContent) + CHATML_OVERHEAD;
    budget -= sysTokens;

    // Priority 2: Current user message (always full)
    const userTokens = estimateTokens(params.userMessage) + CHATML_OVERHEAD;
    budget -= userTokens;

    // Priority 3: Active documents (up to 50% of remaining budget)
    let docBlock = "";
    if (params.documentContent && budget > 100) {
      const docBudget = Math.floor(budget * 0.5);
      const docChars = Math.floor(docBudget * 3.5);
      docBlock =
        params.documentContent.length > docChars
          ? params.documentContent.slice(0, docChars) + "…"
          : params.documentContent;
      budget -= estimateTokens(docBlock) + CHATML_OVERHEAD;
    }

    // Priority 4: Recent history (fill remaining, newest first)
    const historyBlocks: string[] = [];
    const reversedHistory = [...params.history].reverse();
    for (const msg of reversedHistory) {
      if (msg.content.startsWith("**Airplane Mode Error**")) continue;
      const msgTokens = estimateTokens(msg.content) + CHATML_OVERHEAD;
      if (msgTokens > budget) {
        // Try truncating this message to fit
        const availChars = Math.floor((budget - CHATML_OVERHEAD) * 3.5);
        if (availChars > 50) {
          historyBlocks.unshift(
            `<|im_start|>${msg.role}\n${msg.content.slice(0, availChars)}…<|im_end|>\n`
          );
        }
        break;
      }
      historyBlocks.unshift(
        `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`
      );
      budget -= msgTokens;
    }

    // Assemble prompt
    let prompt = `<|im_start|>system\n${sysContent}<|im_end|>\n`;
    if (docBlock) {
      prompt += `<|im_start|>user\n[Reference document]\n${docBlock}<|im_end|>\n`;
    }
    prompt += historyBlocks.join("");
    prompt += `<|im_start|>user\n${params.userMessage} /no_think<|im_end|>\n`;
    prompt += `<|im_start|>assistant\n`;

    return prompt;
  }

  /** Trigger a rolling summary when conversation grows beyond threshold */
  async function maybeUpdateSummary(
    conversationId: string,
    messages: Array<{ role: string; content: string }>,
    modelId: string
  ) {
    // Count assistant messages — summarize every 4
    const assistantCount = messages.filter(
      (m) => m.role === "assistant"
    ).length;
    if (assistantCount < 4 || assistantCount % 4 !== 0) return;

    const { invoke } = await import("@tauri-apps/api/core");

    // Take last 8 messages for summarization
    const recentMsgs = messages.slice(-8);
    const transcript = recentMsgs
      .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
      .join("\n");

    const summaryPrompt =
      `<|im_start|>system\nSummarize this conversation in 2-3 sentences. Focus on key topics discussed, decisions made, and the user's situation. Be factual and concise. /no_think<|im_end|>\n` +
      `<|im_start|>user\n${transcript}<|im_end|>\n` +
      `<|im_start|>assistant\n`;

    try {
      const summary = await invoke<string>("ollama_generate", {
        prompt: summaryPrompt,
        model: modelId,
      });
      const cleaned = summary
        .replace(/<think>[\s\S]*?<\/think>/g, "")
        .replace(/<\/?think>/g, "")
        .trim();
      if (cleaned && cleaned.length > 10) {
        await updateConversationSummary(conversationId, cleaned);
        console.log(
          `[summary] updated (${cleaned.length} chars): ${cleaned.slice(0, 80)}…`
        );
      }
    } catch (err) {
      console.warn("[summary] generation failed (non-fatal):", err);
    }
  }

  /**
   * Send locally only (Airplane Mode) - no cloud requests
   */
  const sendLocalOnly = async (
    content: string,
    targetPersona: any,
    passedModel: any
  ) => {
    const startTime = Date.now();
    const t0 = performance.now();

    setPrivacyStatus({
      mode: "local",
      icon: "✈️",
      label: "Airplane Mode",
      explanation: "All processing on your machine - no cloud requests",
      hadFallback: false,
    });

    try {
      const { invoke } = await import("@tauri-apps/api/core");

      console.log(
        `[sendLocalOnly] checking availability… t=${(performance.now() - t0).toFixed(0)}ms`
      );
      const isAvailable = await invoke<boolean>("ollama_is_available");
      if (!isAvailable) {
        throw new Error(
          "No local AI model has been downloaded yet.\n\nTo use Airplane Mode:\n1. Go to Settings (gear icon)\n2. Find the Privacy Engine section\n3. Download a model\n\nOnce downloaded, Airplane Mode will work fully offline."
        );
      }

      const localModelId =
        passedModel?.provider === "ollama"
          ? passedModel.apiModelId
          : settings.airplaneModeModel;

      // Switch the active model in the Rust backend
      console.log(
        `[sendLocalOnly] setting active model: ${localModelId} t=${(performance.now() - t0).toFixed(0)}ms`
      );
      await invoke("set_active_local_model", { modelId: localModelId }).catch(
        (e: unknown) => {
          console.warn(
            "[sendLocalOnly] set_active_local_model failed (will use default):",
            e
          );
        }
      );

      // Gather context for token-budgeted prompt
      const conversation = getCurrentConversation();
      const history = getCurrentMessages();
      const activeContexts = contexts.filter((ctx) =>
        conversation?.activeContextIds?.includes(ctx.id)
      );
      const documentContent =
        activeContexts.length > 0
          ? activeContexts
              .map((ctx) => `## ${ctx.name}\n${ctx.content}`)
              .join("\n\n")
          : undefined;

      const fullPrompt = buildLocalPrompt({
        systemMsg: buildSystemPrompt(targetPersona),
        summary: conversation?.summary,
        documentContent,
        history: history.map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        })),
        userMessage: content.trim(),
        modelId: localModelId,
      });

      console.log(
        `[sendLocalOnly] prompt built: ${fullPrompt.length} chars (~${estimateTokens(fullPrompt)} tokens) model=${localModelId} t=${(performance.now() - t0).toFixed(0)}ms`
      );

      // Retry up to 2 times with increasing delay
      let response: string | undefined;
      let lastErr: unknown;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          response = await invoke<string>("ollama_generate", {
            prompt: fullPrompt,
            model: localModelId,
          });
          break;
        } catch (err) {
          lastErr = err;
          const errMsg = err instanceof Error ? err.message : String(err);
          console.warn(
            `[sendLocalOnly] attempt ${attempt}/3 failed: ${errMsg}`
          );
          if (attempt < 3) {
            const delay = attempt * 2000;
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
      cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      if (cleaned.startsWith("</think>")) {
        cleaned = cleaned.slice("</think>".length).trim();
      }
      if (!cleaned)
        cleaned =
          response.replace(/<\/?think>/g, "").trim() ||
          "(No response generated)";

      console.log(
        `[sendLocalOnly] response received, len=${response.length} cleaned=${cleaned.length} total=${(performance.now() - t0).toFixed(0)}ms`
      );

      const latencyMs = Date.now() - startTime;
      updateStreamingContent(cleaned);

      try {
        await finalizeStreaming(
          currentConversationId!,
          "local-ollama",
          estimateTokens(fullPrompt),
          estimateTokens(cleaned),
          latencyMs,
          targetPersona?.id
        );
      } catch (dbErr) {
        console.warn(
          "[sendLocalOnly] finalizeStreaming failed (non-fatal):",
          dbErr
        );
      }

      // Trigger rolling summary in background (non-blocking)
      if (currentConversationId) {
        const updatedMessages = getCurrentMessages();
        maybeUpdateSummary(
          currentConversationId,
          updatedMessages,
          localModelId
        ).catch(() => {});
      }

      setPrivacyStatus({
        mode: "idle",
        icon: "✈️",
        label: "Airplane Mode",
        explanation: "Message processed locally",
        hadFallback: false,
      });

      setLoading(false);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error("Airplane mode chat error:", errMsg, error);
      setLoading(false);
      updateStreamingContent("");

      addMessage(currentConversationId!, {
        conversationId: currentConversationId!,
        role: "assistant",
        content: `**Airplane Mode Error**\n\n${errMsg || "Failed to process locally. Go to Settings and download the Privacy Engine."}`,
      });

      setPrivacyStatus({
        mode: "idle",
        icon: "❌",
        label: "Error",
        explanation:
          error instanceof Error ? error.message : "Local processing failed",
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
    sendOpts?: { includeHistory?: boolean; includeCanvas?: boolean }
  ) => {
    const startTime = Date.now();
    const promptToSend = promptOverride ?? processed.prompt;

    try {
      // Build messages array
      const messages: ChatMessage[] = [];

      // -- Full-pipeline anonymization setup --
      // When autoRedactAllContent is enabled, redact PII from context, history,
      // canvas docs, and memories - not just the current user message.
      const { autoRedactAllContent } = useSettingsStore.getState().settings;
      const redactTerms =
        selectActiveProfile(useUserContextStore.getState())
          ?.customRedactTerms || [];
      const allMappings = new Map<string, string>(glinerMappings ?? []);
      const maybeRedact = async (text: string): Promise<string> => {
        if (!autoRedactAllContent || redactTerms.length === 0) return text;
        const { anonymized, mappings: newMappings } = await redactText(
          text,
          redactTerms
        );
        for (const [k, v] of newMappings) {
          allMappings.set(k, v);
        }
        return anonymized;
      };

      // System prompt with privacy notice for attributes-only mode
      if (targetPersona?.systemPrompt) {
        let systemPrompt = targetPersona.systemPrompt;
        if (processed.content_mode === "attributes_only") {
          systemPrompt +=
            "\n\n[Privacy Mode: User input has been converted to categorical attributes. No personal details are included.]";
        }
        messages.push({ role: "system", content: systemPrompt });
      }

      // Add contexts
      const conversation = getCurrentConversation();
      const activeContexts = contexts.filter((ctx) =>
        conversation?.activeContextIds.includes(ctx.id)
      );
      if (activeContexts.length > 0) {
        const contextParts = activeContexts.map(
          async (ctx) => `## ${ctx.name}\n${await maybeRedact(ctx.content)}`
        );
        const contextContent = (await Promise.all(contextParts)).join("\n\n");
        messages.push({
          role: "system",
          content: `Here is relevant personal context:\n\n${contextContent}`,
        });
      }

      // Add memories if enabled
      if (settings.enableMemory) {
        try {
          let memoryTexts: string[] = [];
          if (settings.useLocalMemory) {
            const results = await invoke<Array<{text: string; relevance_score: number | null}>>('search_memories', {
              query: content.trim(),
              topK: 5,
            });
            memoryTexts = results.map(m => m.text);
          } else if (settings.mem0ApiKey) {
            const mem0Client = getMem0Client(settings.mem0ApiKey);
            const memories = await mem0Client.searchMemories({
              query: content.trim(),
              limit: 5,
            });
            memoryTexts = memories.map(m => m.memory);
          }
          if (memoryTexts.length > 0) {
            const formattedMemories = memoryTexts.map((m, i) => `${i + 1}. ${m}`).join('\n');
            messages.push({
              role: "system",
              content: await maybeRedact(`Here are relevant memories about the user:\n\n${formattedMemories}`),
            });
          }
        } catch (error) {
          console.error("Failed to retrieve memories:", error);
        }
      }

      // Add conversation history (default: include unless explicitly excluded)
      if (sendOpts?.includeHistory !== false) {
        const history = getCurrentMessages();
        for (const msg of history) {
          messages.push({ role: msg.role, content: await maybeRedact(msg.content) });
        }
      }

      // Add canvas documents from this conversation and its project (default: include unless explicitly excluded)
      if (sendOpts?.includeCanvas !== false) {
        try {
          const { useCanvasStore } = await import("@/stores/canvas");
          const convId = currentConversationId;
          if (convId) {
            const canvasState = useCanvasStore.getState();
            const convDocs = canvasState.getDocumentsByConversation(convId);
            // Also include all docs from the project this conversation belongs to
            const projectId = getCurrentConversation()?.projectId;
            const projectDocs = projectId
              ? canvasState.getDocumentsByProject(projectId)
              : [];
            // Merge, deduplicate by id
            const seen = new Set<string>();
            const canvasDocs = [...convDocs, ...projectDocs].filter((d) => {
              if (seen.has(d.id)) return false;
              seen.add(d.id);
              return true;
            });
            if (canvasDocs.length > 0) {
              const canvasParts = canvasDocs.map(
                  async (doc) =>
                    `## Canvas: ${doc.title}\n${await maybeRedact(doc.content)}`
                );
              const canvasContent = (await Promise.all(canvasParts)).join("\n\n");
              messages.push({
                role: "system",
                content: `The following documents are available as project context:\n\n${canvasContent}`,
              });
            }
          }
        } catch (e) {
          // canvas store unavailable — skip silently
        }
      }

      // Add the prompt to send (may be edited by user during review)
      messages.push({ role: "user", content: promptToSend });

      // Stream from appropriate backend
      if (processed.backend === "ollama") {
        const { invoke } = await import("@tauri-apps/api/core");
        const response = await invoke<string>("ollama_generate", {
          prompt: promptToSend,
          model: processed.model || "mistral:7b-instruct-q5_K_M",
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
        const client = getNebiusClient(
          settings.nebiusApiKey,
          settings.nebiusApiEndpoint
        );
        const stream = client.streamChatCompletion({
          model:
            model?.apiModelId ||
            getEnabledModels().find((m) => m.provider !== "ollama")
              ?.apiModelId ||
            getEnabledModels()[0]?.apiModelId ||
            "",
          messages,
          temperature: targetPersona?.temperature ?? 0.7,
          max_tokens: targetPersona?.maxTokens ?? 4096,
        });

        let fullContent = "";
        for await (const chunk of stream) {
          fullContent += chunk;
          // Rehydrate streamed content using all collected mappings (GLiNER + custom redaction)
          const displayed =
            allMappings.size > 0
              ? rehydrateResponse(fullContent, allMappings)
              : fullContent;
          updateStreamingContent(displayed);
        }

        // Rehydrate final content using all collected mappings
        if (allMappings.size > 0) {
          fullContent = rehydrateResponse(fullContent, allMappings);
        }

        const latencyMs = Date.now() - startTime;
        const inputTokens = Math.ceil(
          messages.reduce((sum, m) => sum + m.content.length, 0) / 4
        );
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
        if (settings.enableMemory) {
          if (settings.useLocalMemory) {
            invoke('add_memory', {
              text: content.trim(),
              conversationId: currentConversationId,
              role: 'user',
            }).catch(() => {}); // non-blocking
            invoke('add_memory', {
              text: fullContent,
              conversationId: currentConversationId,
              role: 'assistant',
            }).catch(() => {}); // non-blocking
          } else if (settings.mem0ApiKey) {
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
        }
      }

      // Auto-generate project summary every 5 messages (non-blocking)
      void maybeGenerateProjectSummary(currentConversationId!, settings, model);

      // Reset privacy status
      setPrivacyStatus({
        mode: "idle",
        icon: "✓",
        label: "Complete",
        explanation: "Message sent with privacy protection",
        hadFallback: false,
      });
    } catch (error) {
      console.error("Privacy chat error:", error);
      setLoading(false);
      updateStreamingContent("");

      addMessage(currentConversationId!, {
        conversationId: currentConversationId!,
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
      });

      setPrivacyStatus({
        mode: "idle",
        icon: "❌",
        label: "Error",
        explanation:
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "Unknown error",
        hadFallback: false,
      });
    }
  };

  /**
   * Send with privacy-first processing
   */
  const sendWithPrivacy = async (
    content: string,
    targetPersona: any,
    model: any
  ) => {
    try {
      // Step 0: Apply GLiNER PII detection to redact personal data before any cloud sends
      const {
        sanitized: glinerSanitized,
        mappings: glinerMappings,
        entityCount: glinerEntityCount,
      } = await applyGlinerPiiRedaction(content, setLastDetectedEntities);

      if (glinerEntityCount > 0) {
        console.log(
          `GLiNER detected ${glinerEntityCount} PII entities, text redacted before privacy processing`
        );
      }

      // Apply PII vault entries (user-confirmed redactions)
      const { usePiiVaultStore } = await import("@/stores/piiVault");
      const vaultEntries = usePiiVaultStore.getState().entries;
      let textAfterGliner = glinerEntityCount > 0 ? glinerSanitized : content;
      if (vaultEntries.length > 0) {
        const vaultTerms = vaultEntries.map((e) => ({
          label: e.category,
          value: e.text,
          replacement: e.placeholder,
        }));
        const { sanitized: vaultSanitized, mappings: vaultMappings } =
          await applyCustomRedaction(textAfterGliner, vaultTerms);
        textAfterGliner = vaultSanitized;
        for (const [placeholder, original] of vaultMappings) {
          glinerMappings.set(placeholder, original);
        }
        if (vaultMappings.size > 0) {
          console.log(`PII vault applied ${vaultMappings.size} term(s)`);
          // Increment use counts for applied vault entries
          vaultMappings.forEach((original) => {
            const entry = vaultEntries.find((e) => e.text === original);
            if (entry) usePiiVaultStore.getState().incrementUseCount(entry.id);
          });
        }
      }

      // Apply custom redaction terms from user profile
      const customTerms = activeUserProfile?.customRedactTerms || [];
      if (customTerms.length > 0) {
        const { sanitized: customSanitized, mappings: customMappings } =
          await applyCustomRedaction(textAfterGliner, customTerms);
        textAfterGliner = customSanitized;
        // Merge custom mappings into GLiNER mappings for rehydration
        for (const [placeholder, original] of customMappings) {
          glinerMappings.set(placeholder, original);
        }
        if (customMappings.size > 0) {
          console.log(
            `Custom redaction applied ${customMappings.size} term(s)`
          );
        }
      }

      // Use the sanitized content for the rest of the pipeline
      const contentForProcessing = textAfterGliner;

      // Step 1: Process with privacy routing
      const processed = await processChatWithPrivacy(
        contentForProcessing,
        targetPersona
      );

      // Update privacy status based on decision
      updatePrivacyStatusFromProcessed(processed);

      // Step 2: Check if blocked
      if (!processed.is_safe) {
        setLoading(false);
        addMessage(currentConversationId!, {
          conversationId: currentConversationId!,
          role: "assistant",
          content: `**Privacy Protection Active**\n\n${processed.info || "Request blocked due to privacy requirements."}\n\nThis persona requires privacy features that are currently unavailable. Please download the privacy engine in Settings or adjust persona settings.`,
          personaId: targetPersona?.id,
        });
        return;
      }

      // Step 3: Check if this needs user review before cloud send
      const needsReview =
        !settings.skipCloudReview &&
        (processed.content_mode === "attributes_only" ||
          processed.backend === "hybrid");

      if (needsReview) {
        // Build comprehensive PII report covering ALL content sources
        const categoryMap = new Map<string, number>();
        const sourceCounts: PiiContentSourceCount[] = [];

        // 1. Current message redactions (GLiNER + PII Vault + Privacy Shield)
        const currentMsgRedactions = glinerMappings.size;
        if (currentMsgRedactions > 0) {
          const currentLabel: string[] = [];
          if (glinerEntityCount > 0) currentLabel.push("GLiNER");
          if (vaultEntries.length > 0) currentLabel.push("PII Vault");
          if (customTerms.length > 0) currentLabel.push("Privacy Shield");
          sourceCounts.push({
            source: `Current message${currentLabel.length > 0 ? ` (${currentLabel.join(", ")})` : ""}`,
            redactionCount: currentMsgRedactions,
          });
        }

        // Count GLiNER categories from placeholders
        for (const [placeholder] of glinerMappings) {
          const match = placeholder.match(/\[PII_(\w+)\]/);
          if (match) {
            const cat = match[1].replace(/_/g, " ");
            categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
          }
        }

        // 2. Dry-run redactText on other content sources (when autoRedactAllContent is on)
        const { autoRedactAllContent } = useSettingsStore.getState().settings;
        const dryRunRedactTerms = activeUserProfile?.customRedactTerms || [];

        if (autoRedactAllContent && dryRunRedactTerms.length > 0) {
          // History
          const history = getCurrentMessages();
          let historyRedactions = 0;
          for (const msg of history) {
            const { mappings } = await redactText(msg.content, dryRunRedactTerms);
            historyRedactions += mappings.size;
            for (const [, v] of mappings) {
              const matchedTerm = dryRunRedactTerms.find((t) => t.value === v);
              if (matchedTerm) {
                categoryMap.set(
                  matchedTerm.label,
                  (categoryMap.get(matchedTerm.label) || 0) + 1
                );
              }
            }
          }
          if (historyRedactions > 0) {
            sourceCounts.push({ source: "History", redactionCount: historyRedactions });
          }

          // Contexts
          const conversation = getCurrentConversation();
          const activeContexts = contexts.filter((ctx) =>
            conversation?.activeContextIds.includes(ctx.id)
          );
          let contextRedactions = 0;
          for (const ctx of activeContexts) {
            const { mappings } = await redactText(ctx.content, dryRunRedactTerms);
            contextRedactions += mappings.size;
            for (const [, v] of mappings) {
              const matchedTerm = dryRunRedactTerms.find((t) => t.value === v);
              if (matchedTerm) {
                categoryMap.set(
                  matchedTerm.label,
                  (categoryMap.get(matchedTerm.label) || 0) + 1
                );
              }
            }
          }
          if (contextRedactions > 0) {
            sourceCounts.push({ source: "Context", redactionCount: contextRedactions });
          }

          // Memories
          if (settings.enableMemory) {
            try {
              let memText = "";
              if (settings.useLocalMemory) {
                const results = await invoke<Array<{text: string; relevance_score: number | null}>>('search_memories', {
                  query: content.trim(),
                  topK: 5,
                });
                if (results.length > 0) {
                  memText = results.map((m, i) => `${i + 1}. ${m.text}`).join('\n');
                  memText = `Here are relevant memories about the user:\n\n${memText}`;
                }
              } else if (settings.mem0ApiKey) {
                const mem0Client = getMem0Client(settings.mem0ApiKey);
                const memories = await mem0Client.searchMemories({
                  query: content.trim(),
                  limit: 5,
                });
                if (memories.length > 0) {
                  memText = formatMemoriesAsContext(memories);
                }
              }
              if (memText) {
                const { mappings } = await redactText(memText, dryRunRedactTerms);
                if (mappings.size > 0) {
                  sourceCounts.push({ source: "Memories", redactionCount: mappings.size });
                  for (const [, v] of mappings) {
                    const matchedTerm = dryRunRedactTerms.find((t) => t.value === v);
                    if (matchedTerm) {
                      categoryMap.set(
                        matchedTerm.label,
                        (categoryMap.get(matchedTerm.label) || 0) + 1
                      );
                    }
                  }
                }
              }
            } catch {
              // memory preview failed silently
            }
          }

          // Canvas documents
          try {
            const { useCanvasStore } = await import("@/stores/canvas");
            const convId = currentConversationId;
            if (convId) {
              const canvasState = useCanvasStore.getState();
              const convDocs = canvasState.getDocumentsByConversation(convId);
              const projectId = getCurrentConversation()?.projectId;
              const projectDocs = projectId
                ? canvasState.getDocumentsByProject(projectId)
                : [];
              const allDocs = [
                ...convDocs,
                ...projectDocs.filter(
                  (pd) => !convDocs.some((cd) => cd.id === pd.id)
                ),
              ];
              let canvasRedactions = 0;
              for (const doc of allDocs) {
                const { mappings } = await redactText(doc.content, dryRunRedactTerms);
                canvasRedactions += mappings.size;
                for (const [, v] of mappings) {
                  const matchedTerm = dryRunRedactTerms.find((t) => t.value === v);
                  if (matchedTerm) {
                    categoryMap.set(
                      matchedTerm.label,
                      (categoryMap.get(matchedTerm.label) || 0) + 1
                    );
                  }
                }
              }
              if (canvasRedactions > 0) {
                sourceCounts.push({ source: "Canvas", redactionCount: canvasRedactions });
              }
            }
          } catch {
            // canvas preview failed silently
          }
        }

        const totalRedactions = sourceCounts.reduce(
          (sum, s) => sum + s.redactionCount,
          0
        );
        const piiReport: PiiReport | undefined =
          totalRedactions > 0
            ? {
                totalRedactions,
                categories: Array.from(categoryMap.entries()).map(
                  ([label, count]) => ({ label, count })
                ),
                contentSources: sourceCounts,
              }
            : undefined;

        // Pause for user review — set pending state
        setPendingReview({
          originalMessage: content,
          processedPrompt: processed.prompt,
          processed,
          targetPersona,
          model,
          glinerMappings: glinerMappings.size > 0 ? glinerMappings : undefined,
          piiReport,
        });
        setPrivacyStatus({
          mode: "pending_review",
          icon: "👁",
          label: "Review",
          explanation: "Review the prompt before sending to cloud",
          attributesCount: processed.attributes_count,
          hadFallback: false,
        });
        setLoading(false);
        return;
      }

      // Step 4: No review needed — send immediately
      await executePrivacySend(
        content,
        processed,
        targetPersona,
        model,
        undefined,
        glinerMappings
      );
    } catch (error) {
      console.error("Privacy chat error:", error);
      setLoading(false);
      updateStreamingContent("");

      addMessage(currentConversationId!, {
        conversationId: currentConversationId!,
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
      });

      setPrivacyStatus({
        mode: "idle",
        icon: "❌",
        label: "Error",
        explanation:
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "Unknown error",
        hadFallback: false,
      });
    }
  };

  /**
   * Approve a pending review and send to cloud (optionally with edited prompt and context opts)
   */
  const approveAndSend = useCallback(
    async (
      editedPrompt?: string,
      sendOpts?: { includeHistory?: boolean; includeCanvas?: boolean }
    ) => {
      if (!pendingReview) return;

      const {
        originalMessage,
        processedPrompt,
        processed,
        targetPersona,
        model,
        glinerMappings,
      } = pendingReview;
      const promptToSend = editedPrompt ?? processedPrompt;

      setPendingReview(null);
      setLoading(true);
      updateStreamingContent("");

      // Restore the privacy status from the processed result
      updatePrivacyStatusFromProcessed(processed);

      await executePrivacySend(
        originalMessage,
        processed,
        targetPersona,
        model,
        promptToSend,
        glinerMappings,
        sendOpts
      );
    },
    [pendingReview, setLoading, updateStreamingContent]
  );

  /**
   * Cancel a pending review — no cloud request is made
   */
  const cancelReview = useCallback(() => {
    setPendingReview(null);
    setPrivacyStatus({
      mode: "idle",
      icon: "⚡",
      label: "Ready",
      explanation: "Review cancelled — no data sent to cloud",
      hadFallback: false,
    });
  }, []);

  /**
   * Send directly without privacy processing (for non-privacy personas)
   */
  const sendDirect = async (
    content: string,
    targetPersona: any,
    model: any
  ) => {
    setPrivacyStatus({
      mode: "direct",
      icon: "⚡",
      label: "Direct",
      explanation: "Standard cloud processing",
      hadFallback: false,
    });

    const startTime = Date.now();

    // Apply custom redaction terms even in direct mode
    const customTerms = activeUserProfile?.customRedactTerms || [];
    let contentToSend = content;
    let directMappings = new Map<string, string>();
    if (customTerms.length > 0) {
      const { sanitized, mappings } = await applyCustomRedaction(
        content,
        customTerms
      );
      contentToSend = sanitized;
      directMappings = mappings;
      if (mappings.size > 0) {
        console.log(
          `Custom redaction (direct mode) applied ${mappings.size} term(s)`
        );
      }
    }

    // Full-pipeline anonymization for direct mode
    const { autoRedactAllContent } = useSettingsStore.getState().settings;
    const directRedactTerms =
      selectActiveProfile(useUserContextStore.getState())?.customRedactTerms ||
      [];
    const maybeRedactDirect = async (text: string): Promise<string> => {
      if (!autoRedactAllContent || directRedactTerms.length === 0) return text;
      const { anonymized, mappings: newMappings } = await redactText(
        text,
        directRedactTerms
      );
      for (const [k, v] of newMappings) {
        directMappings.set(k, v);
      }
      return anonymized;
    };

    try {
      const messages: ChatMessage[] = [];

      if (targetPersona?.systemPrompt) {
        messages.push({ role: "system", content: targetPersona.systemPrompt });
      }

      const conversation = getCurrentConversation();
      const activeContexts = contexts.filter((ctx) =>
        conversation?.activeContextIds.includes(ctx.id)
      );
      if (activeContexts.length > 0) {
        const contextParts = activeContexts.map(
          async (ctx) => `## ${ctx.name}\n${await maybeRedactDirect(ctx.content)}`
        );
        const contextContent = (await Promise.all(contextParts)).join("\n\n");
        messages.push({
          role: "system",
          content: `Here is relevant personal context:\n\n${contextContent}`,
        });
      }

      if (settings.enableMemory) {
        try {
          let memoryTexts: string[] = [];
          if (settings.useLocalMemory) {
            const results = await invoke<Array<{text: string; relevance_score: number | null}>>('search_memories', {
              query: content.trim(),
              topK: 5,
            });
            memoryTexts = results.map(m => m.text);
          } else if (settings.mem0ApiKey) {
            const mem0Client = getMem0Client(settings.mem0ApiKey);
            const memories = await mem0Client.searchMemories({
              query: content.trim(),
              limit: 5,
            });
            memoryTexts = memories.map(m => m.memory);
          }
          if (memoryTexts.length > 0) {
            const formattedMemories = memoryTexts.map((m, i) => `${i + 1}. ${m}`).join('\n');
            messages.push({
              role: "system",
              content: await maybeRedactDirect(`Here are relevant memories about the user:\n\n${formattedMemories}`),
            });
          }
        } catch (error) {
          console.error("Failed to retrieve memories:", error);
        }
      }

      const history = getCurrentMessages();
      for (const msg of history) {
        messages.push({
          role: msg.role,
          content: await maybeRedactDirect(msg.content),
        });
      }
      messages.push({ role: "user", content: contentToSend.trim() });

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
        const displayed =
          directMappings.size > 0
            ? rehydrateResponse(fullContent, directMappings)
            : fullContent;
        updateStreamingContent(displayed);
      }

      // Rehydrate final content
      if (directMappings.size > 0) {
        fullContent = rehydrateResponse(fullContent, directMappings);
      }

      const latencyMs = Date.now() - startTime;
      const inputTokens = Math.ceil(
        messages.reduce((sum, m) => sum + m.content.length, 0) / 4
      );
      const outputTokens = Math.ceil(fullContent.length / 4);

      finalizeStreaming(
        currentConversationId!,
        model?.id || settings.defaultModelId,
        inputTokens,
        outputTokens,
        latencyMs,
        targetPersona?.id
      );

      if (settings.enableMemory) {
        if (settings.useLocalMemory) {
          invoke('add_memory', {
            text: content.trim(),
            conversationId: currentConversationId,
            role: 'user',
          }).catch(() => {}); // non-blocking
          invoke('add_memory', {
            text: fullContent,
            conversationId: currentConversationId,
            role: 'assistant',
          }).catch(() => {}); // non-blocking
        } else if (settings.mem0ApiKey) {
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
      }

      setPrivacyStatus({
        mode: "idle",
        icon: "✓",
        label: "Complete",
        explanation: "Message sent",
        hadFallback: false,
      });
    } catch (error) {
      console.error("Chat error:", error);
      setLoading(false);
      updateStreamingContent("");

      addMessage(currentConversationId!, {
        conversationId: currentConversationId!,
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
      });
    }
  };

  const updatePrivacyStatusFromProcessed = (
    processed: ProcessedChatRequest
  ) => {
    if (!processed.is_safe) {
      setPrivacyStatus({
        mode: "blocked",
        icon: "🚫",
        label: "Blocked",
        explanation: processed.info || "Privacy requirements cannot be met",
        hadFallback: false,
      });
    } else if (processed.content_mode === "attributes_only") {
      setPrivacyStatus({
        mode: "attributes_only",
        icon: "🔒",
        label: "Max Privacy",
        explanation: `${processed.attributes_count || 0} attributes extracted, no full text sent`,
        attributesCount: processed.attributes_count,
        hadFallback: processed.info?.includes("Fallback") || false,
      });
    } else if (processed.backend === "ollama") {
      setPrivacyStatus({
        mode: "local",
        icon: "🔒",
        label: "Local Only",
        explanation: "All processing on your machine",
        hadFallback: false,
      });
    } else if (processed.backend === "hybrid") {
      setPrivacyStatus({
        mode: "anonymized",
        icon: "🔐",
        label: "Anonymized",
        explanation: "PII removed before cloud processing",
        hadFallback: processed.info?.includes("Fallback") || false,
      });
    } else {
      setPrivacyStatus({
        mode: "direct",
        icon: "⚡",
        label: "Direct",
        explanation: "Standard cloud processing",
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
    updateStreamingContent("");
    setPrivacyStatus({
      mode: "idle",
      icon: "⚡",
      label: "Ready",
      explanation: "Waiting for message",
      hadFallback: false,
    });
  }, [setLoading, updateStreamingContent]);

  const clearDetectedEntities = useCallback(() => {
    setLastDetectedEntities([]);
  }, []);

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
    lastDetectedEntities,
    clearDetectedEntities,
  };
}
