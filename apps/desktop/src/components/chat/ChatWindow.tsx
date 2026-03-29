import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useChatStore, usePersonasStore, useSettingsStore, useCanvasStore } from "@/stores";
import { useUserContextStore, selectActiveProfile } from "@/stores/userContext";
import { usePrivacyChat } from "@/hooks/usePrivacyChat";
import { useFormFill } from "@/hooks/useFormFill";
import { useFormFillStore } from "@/stores/formFill";
import { useFirstSendTour } from "@/hooks/useAppTour";
import { MessageBubble } from "./MessageBubble";
import { FormFillProgress } from "./FormFillProgress";
import { GapFillPrompt } from "./GapFillPrompt";
import { PromptReviewPanel } from "./PromptReviewPanel";
import { LivingBrief } from "./LivingBrief";
import { AttachmentButton } from "./AttachmentButton";
import { AttachmentPreview } from "./AttachmentPreview";
import { getNebiusClient } from "@/services/nebius";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import type { FileAttachment } from "@/types";
import {
  Send,
  AlertTriangle,
  Sparkles,
  FolderKanban,
  ChevronRight,
  Download,
  CheckCircle2,
  Loader2,
  EyeOff,
  Lock,
  ShieldCheck,
  Zap,
  Settings2,
  Upload,
} from "lucide-react";

// A paragraph is "structural" when its first non-empty line looks like a step,
// header, code block, table, or list — including emoji-prefixed formats.
const STRUCTURAL_PARAGRAPH_FIRST_LINE =
  /^(#{1,6} |```|\|.+\||\d+\.\s|[-*+] |\*\*Step|\*\*\d|Step \d|[\p{Emoji_Presentation}\p{Extended_Pictographic}])/u;

// LLM preamble patterns — short conversational lines before the actual content.
// When the FIRST paragraph matches this, everything after it is the document.
const LLM_PREAMBLE =
  /^(certainly|sure|of course|here('s| is| are)|below is|i('ve| have)|absolutely|great|okay|no problem|got it|alright)/i;

// LLM closing-remark patterns that should NOT be included in canvas documents.
const LLM_CLOSING_REMARK =
  /^(let me know|feel free|hope this|i('d| would) (be happy|love) to|would you like|if you('d| would) like|don't hesitate|i can also|want me to|shall i|happy to help|is there anything|do you want|need any|further adjust|any questions|just let|reach out|glad to|note[s:])/i;

/**
 * Split a message into { intro, canvas }.
 * Strategy:
 * 1. If first paragraph is an LLM preamble ("Sure! Here's..."), split right after it.
 *    The rest is the document regardless of format (email, plain text, etc.).
 * 2. Otherwise, split at the first markdown-structural paragraph (header, list, code).
 * 3. Strip trailing LLM closing remarks from the canvas portion.
 */
function splitForCanvas(content: string): { intro: string; canvas: string } {
  const paragraphs = content.split(/\n\n+/);
  if (paragraphs.length < 2) return { intro: '', canvas: content.trim() };

  // Strategy 1: detect LLM preamble as the first paragraph
  // A preamble is a short conversational intro (< 200 chars, matches common patterns)
  let docStart = -1;
  const firstPara = paragraphs[0].trim();
  if (firstPara.length < 200 && LLM_PREAMBLE.test(firstPara)) {
    docStart = 1;
  }

  // Strategy 2: fall back to first structural paragraph
  if (docStart === -1) {
    for (let i = 0; i < paragraphs.length; i++) {
      const firstLine = paragraphs[i].trimStart().split('\n')[0];
      if (STRUCTURAL_PARAGRAPH_FIRST_LINE.test(firstLine)) {
        docStart = i;
        break;
      }
    }
  }

  if (docStart === -1) {
    // No split point found — all canvas
    return { intro: '', canvas: content.trim() };
  }

  // Strip trailing LLM closing remarks from document
  let docEnd = paragraphs.length;
  for (let i = paragraphs.length - 1; i > docStart; i--) {
    const para = paragraphs[i].trim();
    const firstLine = para.split('\n')[0].trimStart();
    // Keep structural paragraphs
    if (STRUCTURAL_PARAGRAPH_FIRST_LINE.test(firstLine)) break;
    // Strip known closing remarks
    if (LLM_CLOSING_REMARK.test(para)) {
      docEnd = i;
    } else {
      break;
    }
  }

  const intro = docStart > 0 ? paragraphs.slice(0, docStart).join('\n\n').trim() : '';
  const canvas = paragraphs.slice(docStart, docEnd).join('\n\n').trim();

  return { intro, canvas: canvas || content.trim() };
}

function shouldAutoCanvas(content: string): boolean {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const hasHeader = /^#{1,6} /m.test(content);
  const hasTable = /^\|.+\|/m.test(content);
  const hasCodeBlock = /^```/m.test(content);
  const hasList = /^[-*+] /m.test(content) || /^\d+\. /m.test(content);
  const hasMultipleParagraphs = content.split(/\n\n+/).length >= 3;
  // Emoji-step format: "📌 Step 1:", "✅ Step 2:", etc.
  const hasEmojiStep = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}].*(step|tip|note|\d+)/umi.test(content);
  return wordCount > 100 || hasHeader || hasTable || hasCodeBlock || hasMultipleParagraphs
    || (hasList && wordCount > 50) || hasEmojiStep;
}

function extractCanvasTitle(content: string): string {
  const headingMatch = content.match(/^#+ (.+)/m);
  if (headingMatch) return headingMatch[1].trim();
  // First non-empty non-emoji line
  for (const line of content.split('\n')) {
    const t = line.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/u, '').trim();
    if (t.length > 3) return t.length > 60 ? t.slice(0, 57) + '...' : t;
  }
  return 'Canvas Document';
}

interface ModelStatus {
  is_downloaded: boolean;
  is_loaded: boolean;
  download_progress: number;
  model_name: string;
  model_size_bytes: number;
}

interface ParsedDocumentDto {
  filename: string;
  file_type: string;
  text_content: string;
  page_count: number;
  document_type: string | null;
}

export function ChatWindow() {
  const [input, setInput] = useState("");
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [isDownloadingModel, setIsDownloadingModel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const generatingTitleRef = useRef(false);

  // Mention state
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionedPersonas, setMentionedPersonas] = useState<string[]>([]); // Track mentioned persona IDs

  // Attachment state
  const [pendingAttachment, setPendingAttachment] = useState<FileAttachment | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  const {
    currentConversationId,
    conversations,
    getCurrentMessages,
    getCurrentConversation,
    isLoading,
    streamingContent,
    updateConversationTitle,
    updateConversationModel,
    createConversation,
    projects,
    linkMessageToCanvas,
    addMessage,
  } = useChatStore();

  const { createDocument, openPanel, getDocumentsByConversation } = useCanvasStore();


  const { settings, getEnabledModels, getDefaultModel, isAirplaneModeActive, setPrivacyMode, getActivePrivacyMode } = useSettingsStore();
  const { personas, getPersonaById } = usePersonasStore();
  const { sendMessage, sendMultiPersonaMessage, privacyStatus, pendingReview, approveAndSend, cancelReview } = usePrivacyChat();
  const { startFirstSendTour } = useFirstSendTour();
  const formFill = useFormFill();
  const activeUserProfile = useUserContextStore(selectActiveProfile);
  const customTermsCount = activeUserProfile?.customRedactTerms?.length || 0;

  const messages = getCurrentMessages();
  const conversation = getCurrentConversation();
  const conversationPersonaId = conversation?.personaId;
  const conversationProjectId = conversation?.projectId;
  const persona = useMemo(() => personas.find((p) => p.id === conversationPersonaId), [personas, conversationPersonaId]);
  const project = useMemo(() => projects.find((p) => p.id === conversationProjectId), [projects, conversationProjectId]);
  const hasApiKey = !!settings.nebiusApiKey;
  const isAirplane = isAirplaneModeActive();
  const availableModels = useMemo(() => getEnabledModels(), [settings.enabledModelIds, settings.privacyMode]);
  const defaultModel = useMemo(() => getDefaultModel(), [settings.defaultModelId, settings.privacyMode, settings.localModeModel, settings.hybridModeModel, settings.cloudModeModel]);
  const currentModel = useMemo(() => defaultModel || availableModels[0] || { id: "unknown", name: "No model", provider: "nebius" as const }, [defaultModel, availableModels]);
  const activePrivacyMode = useMemo(() => getActivePrivacyMode(persona), [settings.privacyMode, persona]);

  // Filtered personas for mention menu (includes @here and @all)
  const filteredPersonas = useMemo(() => {
    if (!showMentionMenu) return [];
    const specialMentions = [
      { id: '_here', name: 'here', icon: '📍', description: 'All active personas in this thread', isSpecial: true },
      { id: '_all', name: 'all', icon: '📢', description: 'All available personas', isSpecial: true },
    ];
    const q = mentionQuery.toLowerCase();
    return [
      ...personas.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)),
      ...specialMentions.filter(s => s.name.toLowerCase().includes(q)),
    ];
  }, [showMentionMenu, mentionQuery, personas]);

  // Helper to get privacy icon for a persona
  const getPrivacyIcon = (p: any) => {
    if (p.preferred_backend === 'ollama') return '🔒';
    if (p.preferred_backend === 'hybrid' || p.enable_local_anonymizer) return '🔐';
    return '⚡';
  };

  // Helper to get backend privacy mode for a persona (for MessageBubble)
  const getBackendMode = (p: any): 'local' | 'hybrid' | 'cloud' | undefined => {
    if (!p) return undefined;
    if (p.preferred_backend === 'ollama') return 'local';
    if (p.preferred_backend === 'hybrid' || p.enable_local_anonymizer) return 'hybrid';
    return 'cloud';
  };

  // Parse all @mentions from input text
  const parseMentionsFromInput = (text: string): string[] => {
    const mentionRegex = /@(\w+(?:\s+\w+)?)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionName = match[1].toLowerCase();

      // Check for special mentions
      if (mentionName === 'here') {
        // @here = all personas that have participated in this thread
        // For now, just use the current persona
        if (persona) mentions.push(persona.id);
      } else if (mentionName === 'all') {
        // @all = all personas
        personas.forEach(p => mentions.push(p.id));
      } else {
        // Find matching persona by name
        const matchedPersona = personas.find(p =>
          p.name.toLowerCase() === mentionName ||
          p.name.toLowerCase().startsWith(mentionName)
        );
        if (matchedPersona && !mentions.includes(matchedPersona.id)) {
          mentions.push(matchedPersona.id);
        }
      }
    }

    return mentions;
  };

  // Update mentioned personas when input changes (debounced to avoid lag)
  useEffect(() => {
    if (!input.includes('@')) {
      if (mentionedPersonas.length > 0) setMentionedPersonas([]);
      return;
    }
    const timer = setTimeout(() => {
      const parsed = parseMentionsFromInput(input);
      setMentionedPersonas(parsed);
    }, 300);
    return () => clearTimeout(timer);
  }, [input, personas]);

  // Check privacy engine model status on mount
  useEffect(() => {
    invoke<ModelStatus>('get_model_status')
      .then(setModelStatus)
      .catch((err) => console.error('Failed to get model status:', err));
  }, []);

  // Poll during model download
  useEffect(() => {
    if (!isDownloadingModel) return;
    const interval = setInterval(async () => {
      try {
        const status = await invoke<ModelStatus>('get_model_status');
        setModelStatus(status);
        if (status.is_downloaded) setIsDownloadingModel(false);
      } catch { /* ignore polling errors */ }
    }, 1000);
    return () => clearInterval(interval);
  }, [isDownloadingModel]);

  const handleDownloadModel = async () => {
    setIsDownloadingModel(true);
    try {
      await invoke('download_default_model');
      const status = await invoke<ModelStatus>('get_model_status');
      setModelStatus(status);
    } catch (err) {
      console.error('Model download failed:', err);
    } finally {
      setIsDownloadingModel(false);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 192)}px`;
    }
  }, [input]);

  // (model selector removed — replaced by privacy mode pills)

  // Hands-Free Conversation Mode Logic

  // Handle input change to detect mentions
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInput(newValue);

    // Detect /fill command
    if (newValue.trim() === '/fill') {
      openAttachmentDialog();
      return;
    }

    // Simple mention detection — only do work if @ is present
    const cursorPos = e.target.selectionStart;
    if (!newValue.includes('@')) {
      setShowMentionMenu(false);
      return;
    }

    setCursorPosition(cursorPos);
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtRateIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtRateIndex !== -1) {
      const isStartOrSpace = lastAtRateIndex === 0 || textBeforeCursor[lastAtRateIndex - 1] === ' ';

      if (isStartOrSpace) {
        const query = textBeforeCursor.substring(lastAtRateIndex + 1);
        if (!query.includes(" ")) {
          setMentionQuery(query);
          setShowMentionMenu(true);
          setMentionIndex(0);
          return;
        }
      }
    }

    setShowMentionMenu(false);
  }, []);

  const selectMention = (selectedItem: any) => {
    if (!textareaRef.current) return;

    const textBeforeCursor = input.substring(0, cursorPosition);
    const lastAtRateIndex = textBeforeCursor.lastIndexOf("@");

    const prefix = input.substring(0, lastAtRateIndex);
    const suffix = input.substring(cursorPosition);

    // Use the name for the mention text
    const mentionText = selectedItem.isSpecial ? selectedItem.name : selectedItem.name;
    const newInput = `${prefix}@${mentionText} ${suffix}`;
    setInput(newInput);
    setShowMentionMenu(false);

    // Focus back on textarea and set cursor after the mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = lastAtRateIndex + mentionText.length + 2; // +2 for @ and space
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Strip <think>...</think> blocks from any string
  const stripThinking = (text: string) =>
    text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Core title generator — takes any conv ID + first user/assistant messages
  const generateTitleFor = useCallback(async (convId: string, userMsg: string, assistantMsg: string) => {
    if (!settings.nebiusApiKey) return;
    try {
      const client = getNebiusClient(settings.nebiusApiKey, settings.nebiusApiEndpoint);
      const response = await client.chatCompletion({
        model: "Qwen/Qwen3-32B-fast",
        messages: [
          { role: "system", content: "Generate a short, concise title (max 5 words) for this conversation. Reply with ONLY the title, no quotes, no thinking." },
          { role: "user", content: userMsg.slice(0, 400) },
          { role: "assistant", content: stripThinking(assistantMsg).slice(0, 400) }
        ],
        temperature: 0.3,
        max_tokens: 20
      });
      const raw = response.choices[0]?.message.content ?? '';
      const title = stripThinking(raw).replace(/^["']|["']$/g, '').trim();
      if (title) await updateConversationTitle(convId, title);
    } catch (error) {
      console.error("Failed to generate title:", error);
    }
  }, [settings.nebiusApiKey, settings.nebiusApiEndpoint, updateConversationTitle]);

  // Auto-generate title for active conversation after first exchange
  useEffect(() => {
    if (!currentConversationId || generatingTitleRef.current) return;
    const msgs = getCurrentMessages();
    const conv = getCurrentConversation();
    if (!isLoading && msgs.length >= 2 && conv?.title === "New Conversation") {
      generatingTitleRef.current = true;
      const userMsg = msgs.find(m => m.role === 'user')?.content ?? '';
      const assistantMsg = msgs.find(m => m.role === 'assistant')?.content ?? '';
      generateTitleFor(currentConversationId, userMsg, assistantMsg)
        .finally(() => { generatingTitleRef.current = false; });
    }
  }, [messages.length, isLoading, currentConversationId, generateTitleFor]);

  // Hourly catch-up: retitle any "New Conversation" that has messages
  useEffect(() => {
    const retitleStale = async () => {
      if (!settings.nebiusApiKey) return;
      const { conversations: allConvs } = useChatStore.getState();
      const stale = allConvs.filter(c => c.title === 'New Conversation' && !c.isIncognito);
      for (const conv of stale) {
        try {
          const { db } = await import('@/lib/db');
          const msgs = await db.messages.where('conversationId').equals(conv.id).sortBy('createdAt');
          const userMsg = msgs.find(m => m.role === 'user')?.content ?? '';
          const assistantMsg = msgs.find(m => m.role === 'assistant')?.content ?? '';
          if (userMsg && assistantMsg) {
            await generateTitleFor(conv.id, userMsg, assistantMsg);
          }
        } catch { /* ignore per-conv errors */ }
      }
    };
    retitleStale();
    const interval = setInterval(retitleStale, 60 * 60 * 1000); // every hour
    return () => clearInterval(interval);
  }, [settings.nebiusApiKey, generateTitleFor]);

  // Auto-route structured AI responses to canvas
  const prevIsLoadingRef = useRef(false);
  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoading;

    if (wasLoading && !isLoading && currentConversationId) {
      const msgs = getCurrentMessages();
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg?.role === 'assistant' && lastMsg.id && shouldAutoCanvas(lastMsg.content)) {
        const { intro, canvas } = splitForCanvas(lastMsg.content);
        const title = extractCanvasTitle(canvas || lastMsg.content);
        const msgId = lastMsg.id;
        const projectId = conversations.find(c => c.id === currentConversationId)?.projectId;
        createDocument({
          title,
          content: canvas || lastMsg.content,
          projectId,
          conversationId: currentConversationId,
        }).then(docId => {
          linkMessageToCanvas(msgId, docId, intro);
        });
      }
    }
  }, [isLoading, currentConversationId]);

  // Listen for canvas:template-prompt events from CanvasPanel
  useEffect(() => {
    const handler = (e: CustomEvent<{ prompt: string }>) => {
      setInput(e.detail.prompt);
    };
    window.addEventListener('canvas:template-prompt', handler as EventListener);
    return () => window.removeEventListener('canvas:template-prompt', handler as EventListener);
  }, []);

  const handleSend = async () => {
    if ((!input.trim() && !pendingAttachment) || !currentConversationId || isLoading) return;

    // If input is /fill with optional text, open file dialog
    const fillMatch = input.trim().match(/^\/fill\s*(.*)/);
    if (fillMatch && !pendingAttachment) {
      const remainingText = fillMatch[1]?.trim() || '';
      if (remainingText) setInput(remainingText);
      else setInput('');
      openAttachmentDialog();
      return;
    }

    let message = input.trim();
    const targetPersonas = [...mentionedPersonas]; // Copy before clearing

    // ---------- Form-fill path (local only -- PII never leaves the machine) ----------
    if (formFill.isProcessing) {
      return; // Already processing a form
    }

    if (pendingAttachment?.isFormFill) {
      const attachment = pendingAttachment;
      const userContent = message || `Fill this form: ${attachment.filename}`;

      // Add a user message to the chat so the user sees their request
      await addMessage(currentConversationId, {
        conversationId: currentConversationId,
        role: 'user',
        content: userContent,
        privacyLevel: 'local-only',
        attachments: [attachment],
      });

      setInput('');
      setPendingAttachment(null);

      // Start form-fill pipeline (runs async, errors handled via store.error state)
      const msgs = useChatStore.getState().messages;
      const userMsgs = msgs[currentConversationId]?.filter(m => m.role === 'user') || [];
      const lastUserMsgId = userMsgs[userMsgs.length - 1]?.id || 'unknown';
      formFill.startPipeline(currentConversationId, lastUserMsgId, attachment);
      return; // Skip regular sendMessage flow -- no data sent to cloud
    }

    // If non-form-fill attachment is present, include its content with the message
    const attachment = pendingAttachment;
    const attachmentForMessage = attachment ? [attachment] : undefined;
    if (attachment) {
      // Context mode: append document content
      message = `${message}

---
Attached document (${attachment.filename}):
${attachment.textContent}`;
      setPendingAttachment(null);
    }

    setInput("");
    setMentionedPersonas([]);

    // Trigger first-send tour after a short delay so the message appears first
    setTimeout(() => startFirstSendTour(), 600);

    // If multiple personas mentioned, use multi-persona flow
    if (targetPersonas.length > 1) {
      await sendMultiPersonaMessage(message, targetPersonas, attachmentForMessage);
    } else {
      // Single persona or no mention - use regular flow
      // Pass the single mentioned persona if available
      await sendMessage(message, targetPersonas.length === 1 ? targetPersonas : undefined, attachmentForMessage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle menu navigation
    if (showMentionMenu && filteredPersonas.length > 0) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(prev => (prev > 0 ? prev - 1 : filteredPersonas.length - 1));
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex(prev => (prev < filteredPersonas.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(filteredPersonas[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        setShowMentionMenu(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Privacy mode pill handler
  const handlePrivacyModeSelect = (mode: 'local' | 'hybrid' | 'cloud') => {
    setPrivacyMode(mode);
    // Also sync the current conversation's modelId to the model for this mode
    if (currentConversationId) {
      const { settings: s, ollamaModels } = useSettingsStore.getState();
      const modelId =
        mode === 'local'
          ? (ollamaModels.find(m => m.apiModelId === s.localModeModel)?.id ?? ollamaModels[0]?.id)
          : mode === 'hybrid'
          ? s.hybridModeModel
          : s.cloudModeModel;
      if (modelId) updateConversationModel(currentConversationId, modelId);
    }
  };

  // --- Attachment & drag-drop handlers ---

  const parseAndAttach = useCallback(async (filePath: string) => {
    try {
      const parsed = await invoke<ParsedDocumentDto>('parse_document', { filePath: filePath });
      const fileType = parsed.file_type.toLowerCase() as FileAttachment['fileType'];
      const attachment: FileAttachment = {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        filename: parsed.filename,
        fileType,
        filePath,
        fileSize: parsed.text_content.length,
        textContent: parsed.text_content,
        structure: {
          page_count: parsed.page_count,
          has_tables: false,
          document_type: parsed.document_type ?? undefined,
        },
      };
      setPendingAttachment(attachment);
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Failed to parse file';
      console.error('Failed to parse dropped file:', msg);
      setAttachError(msg);
    }
  }, []);

  const openAttachmentDialog = useCallback(async () => {
    try {
      const selected = await openFileDialog({
        multiple: false,
        filters: [{ name: 'Documents', extensions: ['pdf', 'docx', 'doc', 'md', 'txt'] }],
      });
      if (!selected) return;
      const filePath = typeof selected === 'string' ? selected : selected[0];
      if (filePath) await parseAndAttach(filePath);
    } catch (err) {
      console.error('File dialog error:', err);
    }
  }, [parseAndAttach]);

  // Native Tauri v2 drag-drop: gives us real file paths (browser File.path is unavailable)
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    getCurrentWebviewWindow().onDragDropEvent((event) => {
      if (event.payload.type === 'enter') {
        setIsDragging(true);
      } else if (event.payload.type === 'drop') {
        setIsDragging(false);
        const paths = event.payload.paths;
        if (paths.length > 0) {
          const supportedExts = ['pdf', 'docx', 'doc', 'md', 'txt'];
          const filePath = paths[0];
          const ext = filePath.split('.').pop()?.toLowerCase() || '';
          if (supportedExts.includes(ext)) {
            parseAndAttach(filePath);
          }
        }
      } else if (event.payload.type === 'leave') {
        setIsDragging(false);
      }
    }).then(fn => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, [parseAndAttach]);

  const handleAttachmentSendAsContext = useCallback(() => {
    if (!pendingAttachment) return;
    // Keep attachment as context — it will be appended to message on send
    setPendingAttachment(prev => prev ? { ...prev, isFormFill: false } : null);
  }, [pendingAttachment]);

  const handleAttachmentFillForm = useCallback(() => {
    if (!pendingAttachment) return;
    setPendingAttachment(prev => prev ? { ...prev, isFormFill: true } : null);
  }, [pendingAttachment]);

  // Welcome screen when no conversation selected
  if (!currentConversationId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
        {/* Shield Emblem */}
        <div className="mb-10 animate-emblem-enter">
          <div className="relative mx-auto h-24 w-24">
            {/* Outer ring — slow pulse */}
            <div className="absolute inset-0 rounded-2xl border-2 border-[hsl(var(--primary)/0.15)] animate-[pulse_3s_ease-in-out_infinite]" />
            {/* Core shield */}
            <div className="absolute inset-1 rounded-xl bg-[hsl(var(--primary))] flex items-center justify-center shadow-lg shadow-[hsl(var(--primary)/0.3)]">
              <Lock className="h-10 w-10 text-[hsl(var(--primary-foreground))]" strokeWidth={1.8} />
            </div>
            {/* Gold corner accent */}
            <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[hsl(var(--violet))] shadow-md shadow-[hsl(var(--violet)/0.3)] flex items-center justify-center">
              <ShieldCheck className="h-3 w-3 text-[hsl(var(--primary-foreground))]" />
            </div>
          </div>
        </div>

        <h2 className="mb-3 text-4xl heading-display text-[hsl(var(--foreground))] animate-fade-in">
          Your AI.<br />
          <span className="text-[hsl(var(--primary))]">Your rules.</span>
        </h2>
        <p className="max-w-sm text-[hsl(var(--muted-foreground))] mb-10 text-base leading-relaxed animate-fade-in">
          Private coaching, therapy, and brainstorming — nothing leaves your device unless you say so.
        </p>

        {!hasApiKey && !isAirplane && (
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 py-3 max-w-md animate-slide-up flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-[hsl(var(--foreground-muted))]">
              Add your <span className="font-medium text-[hsl(var(--foreground))]">Nebius API key</span> in Settings to enable cloud models.
            </p>
          </div>
        )}

        {/* Privacy Engine Setup Card */}
        {modelStatus && !modelStatus.is_downloaded && (
          <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card)/0.8)] backdrop-blur-sm p-6 max-w-md mb-6 animate-slide-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.15)]">
                <Download className="h-5 w-5 text-[hsl(var(--primary))]" />
              </div>
              <div>
                <p className="font-semibold text-[hsl(var(--foreground))]">
                  Privacy Engine
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Built-in local AI for maximum privacy
                </p>
              </div>
            </div>
            {isDownloadingModel ? (
              <div className="space-y-2">
                <div className="w-full h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[hsl(var(--primary))] transition-all duration-500"
                    style={{ width: `${modelStatus.download_progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Downloading...
                  </span>
                  <span>{modelStatus.download_progress}%</span>
                </div>
              </div>
            ) : (
              <button
                onClick={handleDownloadModel}
                className="w-full py-2.5 px-4 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium text-sm hover:opacity-90 transition-opacity"
              >
                Download Privacy Engine (~{(modelStatus.model_size_bytes / (1024 * 1024 * 1024)).toFixed(1)} GB)
              </button>
            )}
          </div>
        )}

        {modelStatus?.is_downloaded && (
          <div className="flex items-center gap-2 mb-6 px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20 animate-fade-in">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              Privacy Engine Ready
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 max-w-lg w-full stagger-children">
            {personas.slice(0, 4).map((p) => (
              <button
                key={p.id}
                onClick={() => void createConversation(p.id, currentModel.id)}
                className="group flex items-start gap-3 p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/0.4)] hover:shadow-md text-left active:scale-[0.98]"
              >
                <span className="text-2xl shrink-0 mt-0.5 group-hover:scale-110 transition-transform">{p.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold group-hover:text-[hsl(var(--primary))]">{p.name}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 mt-0.5 leading-relaxed">{p.description}</p>
                </div>
              </button>
            ))}
            {/* Incognito Chat Card */}
            <button
              onClick={() => void createConversation(personas[0]?.id || "psychologist", currentModel.id, undefined, true)}
              className="group flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-[hsl(var(--violet)/0.25)] bg-[hsl(var(--violet)/0.04)] hover:border-[hsl(var(--violet)/0.5)] hover:bg-[hsl(var(--violet)/0.08)] text-left col-span-2 active:scale-[0.98]"
            >
              <div className="shrink-0 h-9 w-9 rounded-lg bg-[hsl(var(--violet)/0.12)] flex items-center justify-center group-hover:bg-[hsl(var(--violet)/0.2)]">
                <EyeOff className="h-4.5 w-4.5 text-[hsl(var(--violet))]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold group-hover:text-[hsl(var(--violet))]">Incognito Chat</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Messages vanish when you close or leave.</p>
              </div>
            </button>
          </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-1 flex-col overflow-hidden bg-[hsl(var(--background))] relative ${
      activePrivacyMode === 'local' ? 'privacy-tint-local' :
      activePrivacyMode === 'hybrid' ? 'privacy-tint-hybrid' :
      activePrivacyMode === 'cloud' ? 'privacy-tint-cloud' : ''
    }`}>
      {/* Chat Header - Project Breadcrumb */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] flex-shrink-0">
        <div className="flex items-center gap-2">
          {project ? (
            <>
              <FolderKanban className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                {project.name}
              </span>
              <ChevronRight className="h-3 w-3 text-[hsl(var(--muted-foreground)/0.5)]" />
            </>
          ) : (
            <>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]">
                Quick Chat
              </span>
              <ChevronRight className="h-3 w-3 text-[hsl(var(--muted-foreground)/0.5)]" />
            </>
          )}
          <div className="flex items-center gap-2">
            {persona && (
              <span className="text-lg">{persona.icon}</span>
            )}
            <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
              {conversation?.title || "New Chat"}
            </span>
          </div>
        </div>
        {persona && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[hsl(var(--violet)/0.15)] text-[hsl(var(--violet))] border border-[hsl(var(--violet)/0.3)]">
            {persona.name}
          </span>
        )}
      </div>

      {/* Incognito Banner */}
      {conversation?.isIncognito && (
        <div className="flex items-center gap-3 px-6 py-2.5 bg-[hsl(var(--violet)/0.1)] border-b border-[hsl(var(--violet)/0.2)]">
          <EyeOff className="h-4 w-4 text-[hsl(var(--violet))] flex-shrink-0" />
          <span className="text-sm font-medium text-[hsl(var(--violet-muted))]">
            Incognito Mode — This conversation won't be saved
          </span>
        </div>
      )}

      {/* Living Brief Context Header */}
      {currentConversationId && !conversation?.isIncognito && (
        <LivingBrief conversationId={currentConversationId} />
      )}

      {/* Messages Area - Centered */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl w-full min-h-full flex flex-col pt-8 pb-64">
          {!messages.length ? (
            // Empty State
            <div className="flex-col items-center justify-center flex-1 text-center px-4 animate-fade-in flex">
              <div className="h-16 w-16 mb-6 rounded-2xl bg-[hsl(var(--secondary))] flex items-center justify-center text-4xl">
                {persona?.icon || "👋"}
              </div>
              <h2 className="text-2xl heading-display mb-2">
                {persona?.name || "New Chat"}
              </h2>
              <p className="text-[hsl(var(--muted-foreground))] max-w-sm text-sm leading-relaxed">
                {persona?.description || "Start a conversation to begin."}
              </p>
              <div className="flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-lg bg-[hsl(var(--secondary)/0.6)] text-xs text-[hsl(var(--muted-foreground))]">
                <Sparkles className="h-3 w-3" />
                <span>{currentModel.name}</span>
                <span className="opacity-40">·</span>
                <span className="capitalize">{activePrivacyMode}</span>
              </div>
            </div>
          ) : (
            // Messages
            <div className="space-y-6 px-4">
              {messages.map((message) => {
                // Determine persona for this message
                const messagePersona = message.personaId
                  ? getPersonaById(message.personaId)
                  : persona;

                // Derive canvas entry from persisted message fields
                const canvasDocId = message.canvasDocId;
                const canvasTitle = canvasDocId
                  ? (getDocumentsByConversation(currentConversationId ?? '').find(d => d.id === canvasDocId)?.title ?? 'Canvas Document')
                  : undefined;
                return (
                  <div key={message.id}>
                    <MessageBubble
                      id={message.id}
                      role={message.role}
                      attachments={message.attachments}
                      content={message.content}
                      timestamp={message.createdAt}
                      personaName={messagePersona?.name}
                      personaIcon={messagePersona?.icon}
                      personaBackendMode={getBackendMode(messagePersona)}
                      privacyLevel={message.privacyLevel}
                      piiTypesDetected={message.piiTypesDetected}
                      approvalStatus={message.approvalStatus}
                      canvasDocTitle={canvasTitle}
                      canvasIntro={message.canvasIntro}
                      onViewCanvas={canvasDocId ? () => openPanel(canvasDocId) : undefined}
                      onOpenCanvas={canvasDocId ? undefined : async (content) => {
                        const { intro, canvas } = splitForCanvas(content);
                        const canvasContent = canvas || content;
                        const title = extractCanvasTitle(canvasContent);
                        const projectId = conversations.find(c => c.id === currentConversationId)?.projectId;
                        const docId = await createDocument({
                          title,
                          content: canvasContent,
                          projectId,
                          conversationId: currentConversationId ?? undefined,
                        });
                        if (message.id) {
                          linkMessageToCanvas(message.id, docId, intro);
                        }
                      }}
                    />
                  </div>
                );
              })}
              {streamingContent && (
                <div className="animate-fade-in">
                  <MessageBubble
                    role="assistant"
                    content={streamingContent.replace(/<think>[\s\S]*?<\/think>/gi, '')}
                    isStreaming
                    personaName={persona?.name}
                    personaIcon={persona?.icon}
                    personaBackendMode={getBackendMode(persona)}
                  />
                </div>
              )}
              {isLoading && !streamingContent && (
                <div className="flex gap-4 px-4 py-3 animate-fade-in">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[hsl(var(--secondary))] to-[hsl(var(--muted))] flex items-center justify-center text-lg">
                    {persona?.icon || "🤖"}
                  </div>
                  <div className="flex items-center gap-1.5 pt-3">
                    <div className="h-2 w-2 bg-[hsl(var(--primary))] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="h-2 w-2 bg-[hsl(var(--primary))] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="h-2 w-2 bg-[hsl(var(--primary))] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              {/* Form Fill Progress */}
              {formFill.isProcessing && formFill.currentFormFill && (
                <div className="animate-fade-in">
                  <FormFillProgress
                    currentStep={formFill.currentStep}
                    filename={formFill.currentFormFill.templateFilename}
                  />
                </div>
              )}
              {/* Form Fill Error */}
              {formFill.error && !formFill.isProcessing && (
                <div className="flex justify-start px-6 mb-4">
                  <div className="max-w-[85%] flex items-start gap-3 p-4 rounded-2xl border border-red-500/30 bg-red-500/5">
                    <span className="text-red-500 text-lg flex-shrink-0">!</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-400">Form fill failed</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{formFill.error}</p>
                    </div>
                    <button 
                      onClick={() => useFormFillStore.getState().reset()} 
                      className="text-xs px-3 py-1 rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
              {/* Gap Fill Prompt */}
              {formFill.currentStep === 'gap-filling' && formFill.gapFields.length > 0 && formFill.currentGapIndex < formFill.gapFields.length && (
                <div className="animate-fade-in">
                  <GapFillPrompt
                    key={formFill.gapFields[formFill.currentGapIndex]?.id || formFill.currentGapIndex}
                    field={formFill.gapFields[formFill.currentGapIndex]}
                    onSubmit={(value, saveToProfile) => {
                      formFill.updateFieldValue(
                        formFill.gapFields[formFill.currentGapIndex].label,
                        value,
                        saveToProfile,
                      );
                      formFill.advanceGap();
                      // Check updated index from store (not stale closure)
                      const { currentGapIndex, gapFields } = useFormFillStore.getState();
                      if (currentGapIndex >= gapFields.length) {
                        void formFill.continueAfterGaps();
                      }
                    }}
                    onSkip={() => {
                      const store = useFormFillStore.getState();
                      const field = store.gapFields[store.currentGapIndex];
                      if (field) store.skipField(field.label);
                      store.advanceGap();
                      const { currentGapIndex, gapFields } = useFormFillStore.getState();
                      if (currentGapIndex >= gapFields.length) {
                        void formFill.continueAfterGaps();
                      }
                    }}
                  />
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} className="h-64 w-full flex-shrink-0" />
        </div>
      </div>

      {/* Input Area - Floating at Bottom Center */}
      <div
        className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[hsl(var(--background))] via-[hsl(var(--background)/0.95)] to-transparent pointer-events-none"

      >
        <div className="mx-auto max-w-3xl w-full pointer-events-auto">
          {/* Prompt Review Panel */}
          {pendingReview && (
            <div className="mb-4">
              <PromptReviewPanel
                originalMessage={pendingReview.originalMessage}
                processedPrompt={pendingReview.processedPrompt}
                contentMode={pendingReview.processed.content_mode}
                attributesCount={pendingReview.processed.attributes_count}
                privacyInfo={pendingReview.processed.info}
                historyMessages={getCurrentMessages().map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))}
                canvasDocs={currentConversationId ? getDocumentsByConversation(currentConversationId).map(d => ({ id: d.id, title: d.title })) : []}
                onApprove={(editedPrompt, opts) => void approveAndSend(editedPrompt, opts)}
                onCancel={cancelReview}
              />
            </div>
          )}
          {/* Drag-drop overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)] backdrop-blur-sm pointer-events-none">
              <div className="flex flex-col items-center gap-2 text-[hsl(var(--primary))]">
                <Upload className="h-8 w-8" />
                <span className="text-sm font-medium">Drop file to attach</span>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">PDF, DOCX, DOC, MD, TXT</span>
              </div>
            </div>
          )}

          {/* Attachment Error */}
          {attachError && (
            <div className="mb-2 flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/30 bg-red-500/5 text-sm">
              <span className="text-red-500">!</span>
              <span className="text-red-400 flex-1">{attachError}</span>
              <button onClick={() => setAttachError(null)} className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">Dismiss</button>
            </div>
          )}

          {/* Attachment Preview */}
          {pendingAttachment && (
            <div className="mb-2">
              <AttachmentPreview
                attachment={pendingAttachment}
                onRemove={() => setPendingAttachment(null)}
                onSendAsContext={handleAttachmentSendAsContext}
                onFillForm={handleAttachmentFillForm}
              />
            </div>
          )}

          {/* Floating Input Box */}
          <div className={`relative border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] rounded-2xl focus-within:border-[hsl(var(--ring)/0.4)] focus-within:ring-2 focus-within:ring-[hsl(var(--ring)/0.08)] focus-within:shadow-[var(--shadow-md)] shadow-[var(--shadow)] ${pendingReview ? 'opacity-40 pointer-events-none' : ''}`}>
            {/* Mentioned Personas Bar */}
            {mentionedPersonas.length > 0 && (
              <div className="absolute -top-10 left-0 right-0 flex items-center gap-2 px-4">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Sending to:</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {mentionedPersonas.map(id => {
                    const p = personas.find(persona => persona.id === id);
                    if (!p) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] text-xs font-medium"
                      >
                        <span>{p.icon}</span>
                        <span>{p.name}</span>
                        <span className="opacity-60">{getPrivacyIcon(p)}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mention Menu */}
            {showMentionMenu && filteredPersonas.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl overflow-hidden animate-slide-up z-20">
                <div className="px-3 py-2 border-b border-[hsl(var(--border)/0.5)] bg-[hsl(var(--secondary)/0.3)]">
                  <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Mention a persona</span>
                </div>
                <div className="p-1 max-h-64 overflow-y-auto">
                  {filteredPersonas.map((p: any, i) => (
                    <button
                      key={p.id}
                      onClick={() => selectMention(p)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-3 transition-colors ${i === mentionIndex
                        ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
                        : "hover:bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))]"
                        }`}
                    >
                      <span className="text-lg">{p.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{p.name}</span>
                          {!p.isSpecial && (
                            <span className="text-xs opacity-60">{getPrivacyIcon(p)}</span>
                          )}
                        </div>
                        <p className="text-xs opacity-60 truncate">{p.description}</p>
                      </div>
                      {i === mentionIndex && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--secondary))] opacity-70">↵</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Privacy Mode Pills */}
            <div className="absolute -top-4 left-4 z-10 flex items-center gap-1.5" data-tour="model-selector">
              {([
                {
                  mode: 'local' as const, icon: Lock, label: 'Local',
                  activeCls: 'border-green-600/40 bg-green-500/12 text-green-700 dark:text-green-400 dark:border-green-500/40 privacy-pill-active',
                  modelLabel: (() => { const m = useSettingsStore.getState().ollamaModels.find(m => m.apiModelId === settings.localModeModel); return m?.name?.replace(/^Qwen3(?:\.\d+)?\s*/, '') || settings.localModeModel; })(),
                },
                {
                  mode: 'hybrid' as const, icon: ShieldCheck, label: 'Hybrid',
                  activeCls: 'border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] privacy-pill-active',
                  modelLabel: (() => { const m = useSettingsStore.getState().models.find(m => m.id === settings.hybridModeModel); return m?.name?.replace(/^Qwen3\s*/, '') || settings.hybridModeModel; })(),
                },
                {
                  mode: 'cloud' as const, icon: Zap, label: 'Cloud',
                  activeCls: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:border-amber-500/40 privacy-pill-active',
                  modelLabel: (() => { const m = useSettingsStore.getState().models.find(m => m.id === settings.cloudModeModel); return m?.name?.replace(/^Qwen3\s*/, '') || settings.cloudModeModel; })(),
                },
              ]).map(({ mode, icon: Icon, label, activeCls, modelLabel }) => {
                const isActive = activePrivacyMode === mode;
                const isDimmed = activePrivacyMode === 'custom';
                return (
                  <button
                    key={mode}
                    onClick={() => handlePrivacyModeSelect(mode)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm active:scale-[0.97] ${
                      isActive
                        ? activeCls
                        : isDimmed
                          ? 'border-[hsl(var(--border)/0.3)] bg-[hsl(var(--card)/0.5)] text-[hsl(var(--muted-foreground)/0.4)] hover:text-[hsl(var(--muted-foreground))]'
                          : 'border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:border-[hsl(var(--ring)/0.4)] hover:shadow-md'
                    }`}
                    title={
                      mode === 'local' ? 'All processing on your device — maximum privacy' :
                      mode === 'hybrid' ? 'PII redacted locally, then sent to cloud LLM' :
                      'Direct to cloud API — fastest'
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="leading-none">{label}</span>
                    <span className="text-[10px] opacity-50 leading-none font-medium">{modelLabel}</span>
                  </button>
                );
              })}
              {activePrivacyMode === 'custom' && (
                <span className="flex items-center gap-1.5 rounded-lg border-2 border-[hsl(var(--violet)/0.4)] bg-[hsl(var(--violet)/0.1)] text-[hsl(var(--violet))] px-3 py-1.5 text-xs font-semibold shadow-sm privacy-pill-active">
                  <Settings2 className="h-3.5 w-3.5" />
                  <span className="leading-none">Custom</span>
                </span>
              )}
            </div>

            <div className="flex flex-col">
              <textarea
                ref={textareaRef}
                data-tour="chat-input"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Message your assistant... (Type @ to mention)"
                className="w-full max-h-48 bg-transparent px-5 py-5 pt-6 text-sm focus:outline-none resize-none placeholder:text-[hsl(var(--muted-foreground)/0.4)]"
                rows={1}
                style={{ minHeight: "64px" }}
              />

              <div className="flex items-center justify-between px-4 pb-4">

                <div className="flex items-center gap-2">
                  {/* Redaction badge + hint (always visible when idle) */}
                  {privacyStatus.mode === 'idle' && (
                    <div className="hidden sm:flex items-center gap-1.5 flex-wrap" data-tour="privacy-badge">
                      {/* Custom redaction terms badge */}
                      {customTermsCount > 0 && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-pink-500/10 text-pink-500"
                          title={`${customTermsCount} custom redaction term${customTermsCount !== 1 ? 's' : ''} will be applied before cloud sends`}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                          </svg>
                          <span>{customTermsCount}</span>
                        </span>
                      )}

                      <span className="text-[10px] text-[hsl(var(--muted-foreground)/0.3)]">Shift+Enter new line</span>
                    </div>
                  )}

                  {/* Privacy Status Indicator (during processing) */}
                  {privacyStatus.mode !== 'idle' && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                      privacyStatus.mode === 'processing' ? 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] animate-pulse' :
                      privacyStatus.mode === 'pending_review' ? 'bg-amber-500/10 text-amber-400 animate-pulse' :
                      privacyStatus.mode === 'local' ? 'bg-green-500/10 text-green-400' :
                      privacyStatus.mode === 'attributes_only' ? 'bg-green-500/10 text-green-400' :
                      privacyStatus.mode === 'anonymized' ? 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]' :
                      privacyStatus.mode === 'blocked' ? 'bg-red-500/10 text-red-400' :
                      'bg-yellow-500/10 text-yellow-400'
                    }`} title={privacyStatus.explanation}>
                      <span>{privacyStatus.icon}</span>
                      <span>{privacyStatus.label}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <AttachmentButton
                    onFileSelected={(att) => { setAttachError(null); setPendingAttachment(att); }}
                    onError={(msg) => setAttachError(msg)}
                    disabled={isLoading}
                  />

                  <button
                    onClick={handleSend}
                    disabled={(!input.trim() && !pendingAttachment) || isLoading}
                    className={`flex items-center justify-center h-10 w-10 rounded-xl ${input.trim() || pendingAttachment
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-md shadow-[hsl(var(--primary)/0.25)] hover:shadow-lg hover:shadow-[hsl(var(--primary)/0.3)] active:scale-93 active:shadow-sm"
                    : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground)/0.4)] cursor-not-allowed"
                    }`}
                >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] text-[hsl(var(--muted-foreground)/0.5)]">
            {activePrivacyMode === 'local' ? '🔒 Local — all data stays on your machine' :
             activePrivacyMode === 'hybrid' ? '🛡️ Hybrid — PII redacted locally, then cloud LLM' :
             activePrivacyMode === 'custom' ? '⚙️ Custom — persona-specific routing' :
             '⚡ Cloud — direct to Nebius'}
            {customTermsCount > 0 && (
              <span className="text-pink-500"> · {customTermsCount} custom redaction{customTermsCount !== 1 ? 's' : ''} active</span>
            )}
            {' · '}AI can make mistakes. Please verify important information.
          </p>
        </div>
      </div>

    </div>
  );
}
