import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useChatStore, useVoiceStore, usePersonasStore, useSettingsStore, useCanvasStore } from "@/stores";
import { useUserContextStore, selectActiveProfile } from "@/stores/userContext";
import { usePrivacyChat } from "@/hooks/usePrivacyChat";
import { useVoice } from "@/hooks/useVoice";
import { MessageBubble } from "./MessageBubble";
import { PromptReviewPanel } from "./PromptReviewPanel";
import { VoiceButton } from "./VoiceButton";
import { VoiceConversation } from "./VoiceConversation";
import { LivingBrief } from "./LivingBrief";
import { getNebiusClient } from "@/services/nebius";
import { invoke } from "@tauri-apps/api/core";
import {
  Send,
  Bot,
  AlertTriangle,
  Sparkles,
  Radio,
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
  FileText,
} from "lucide-react";

// Detect if AI response should auto-route to canvas
function shouldAutoCanvas(content: string): boolean {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const hasH1 = /^# /m.test(content);
  const hasTable = /^\|.+\|/m.test(content);
  const hasMultipleHeaders = (content.match(/^#{1,3} /gm) || []).length >= 2;
  return wordCount > 400 || hasH1 || hasTable || hasMultipleHeaders;
}

function extractCanvasTitle(content: string): string {
  const headingMatch = content.match(/^#+ (.+)/m);
  if (headingMatch) return headingMatch[1].trim();
  const firstLine = content.split('\n')[0].trim();
  return firstLine.length > 60 ? firstLine.slice(0, 57) + '...' : firstLine || 'Canvas Document';
}

type VoiceMode = 'local' | 'livekit';

interface ModelStatus {
  is_downloaded: boolean;
  is_loaded: boolean;
  download_progress: number;
  model_name: string;
  model_size_bytes: number;
}

export function ChatWindow() {
  const [input, setInput] = useState("");
  const [isConversationMode, setIsConversationMode] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('local');
  const [showLiveKitPanel, setShowLiveKitPanel] = useState(false);
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

  const {
    currentConversationId,
    conversations,
    getCurrentMessages,
    getCurrentConversation,
    isLoading,
    streamingContent,
    updateConversationTitle,
    createConversation,
    projects,
  } = useChatStore();

  const { createDocument } = useCanvasStore();

  const [canvasToast, setCanvasToast] = useState<{ title: string; content: string } | null>(null);
  const canvasToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissCanvasToast = useCallback(() => {
    if (canvasToastTimerRef.current) clearTimeout(canvasToastTimerRef.current);
    setCanvasToast(null);
    canvasToastTimerRef.current = null;
  }, []);

  const { settings, getEnabledModels, getDefaultModel, isAirplaneModeActive, setPrivacyMode, getActivePrivacyMode } = useSettingsStore();
  const { voiceInputEnabled } = useVoiceStore();
  const { personas, getPersonaById } = usePersonasStore();
  const { sendMessage, sendMultiPersonaMessage, privacyStatus, pendingReview, approveAndSend, cancelReview } = usePrivacyChat();
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
  const voiceModeEnabled = voiceInputEnabled && (hasApiKey || isAirplane);
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
  const { speak, startListening, stopListening, cancelSpeech } = useVoice();
  const lastMessageRef = useRef<string | null>(null);
  const isSpeakingRef = useRef(false);
  const conversationModeRef = useRef(isConversationMode);
  const wasConversationModeOnRef = useRef(false);
  const recordingTimeoutRef = useRef<number | null>(null);
  const RECORDING_DURATION_MS = 8000; // 8 seconds to speak

  // Keep ref in sync with state
  useEffect(() => {
    conversationModeRef.current = isConversationMode;
  }, [isConversationMode]);

  // Cleanup effect - only runs when conversation mode is turned OFF
  useEffect(() => {
    if (!isConversationMode && wasConversationModeOnRef.current) {
      // Clean up when conversation mode is disabled (was on, now off)
      cancelSpeech();
      stopListening();
      isSpeakingRef.current = false;
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
    }
    wasConversationModeOnRef.current = isConversationMode;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConversationMode]); // Only depend on isConversationMode

  // Function to start listening with auto-stop timeout
  const startConversationListening = useCallback(async () => {
    if (!conversationModeRef.current) return;

    // Clear any existing timeout
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }

    startListening();

    // Auto-stop after timeout
    recordingTimeoutRef.current = window.setTimeout(async () => {
      if (conversationModeRef.current) {
        await stopListening();
        // The transcription will be picked up by the auto-send effect below
      }
    }, RECORDING_DURATION_MS);
  }, [startListening, stopListening]);

  // Track if initial listen has started
  const initialListenStartedRef = useRef(false);

  // Start listening when conversation mode is first enabled
  useEffect(() => {
    if (isConversationMode && !initialListenStartedRef.current) {
      // Conversation mode just turned ON - start listening for first user input
      initialListenStartedRef.current = true;
      // Small delay to let UI update
      setTimeout(() => {
        startConversationListening();
      }, 500);
    } else if (!isConversationMode) {
      // Reset when mode is turned off
      initialListenStartedRef.current = false;
    }
  }, [isConversationMode, startConversationListening]);

  // Main conversation mode effect - handles speaking responses
  useEffect(() => {
    if (!isConversationMode) {
      return;
    }

    const messages = getCurrentMessages();
    const lastMessage = messages[messages.length - 1];

    // Check if we just finished receiving a NEW assistant message
    if (!isLoading && lastMessage?.role === "assistant" && lastMessage.id !== lastMessageRef.current) {
      // Prevent duplicate speak calls
      if (isSpeakingRef.current) {
        return;
      }

      lastMessageRef.current = lastMessage.id;
      isSpeakingRef.current = true;

      // 1. Speak the response
      speak(lastMessage.content, () => {
        isSpeakingRef.current = false;
        // 2. When speech ends, auto-start listening with timeout
        startConversationListening();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isConversationMode, messages.length]); // Minimal stable dependencies

  // Effect to handle conversation mode auto-send (the VoiceButton handles the listening part but we need to hook into it or replicate it)
  // Actually, VoiceButton handles one-off. For loop, we need a way to capture the result. 
  // Since we don't have direct access to 'onTranscription' from here easily without duplicating useVoice logic, 
  // we might need to rely on the fact that useVoiceStore updates lastTranscription.

  const { lastTranscription, voiceState, setTranscription } = useVoiceStore();
  const lastProcessedTranscriptionRef = useRef<string>("");

  useEffect(() => {
    // Only auto-send when:
    // 1. In conversation mode
    // 2. Voice state is idle (not recording, processing, or speaking)
    // 3. We have a transcription
    // 4. It's a new transcription we haven't processed yet
    // 5. We're not currently speaking (double check)
    if (
      isConversationMode &&
      voiceState === 'idle' &&
      !isSpeakingRef.current &&
      lastTranscription &&
      lastTranscription.trim() &&
      lastTranscription !== lastProcessedTranscriptionRef.current
    ) {
      lastProcessedTranscriptionRef.current = lastTranscription;

      // Auto-send
      setInput(lastTranscription);
      setTimeout(() => {
        sendMessage(lastTranscription);
        setInput("");
        setTranscription(""); // Clear to avoid double sends
      }, 500);
    }
  }, [isConversationMode, voiceState, lastTranscription, sendMessage, setTranscription]);

  // Handle input change to detect mentions
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInput(newValue);

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

  // Auto-route long-form AI responses to canvas
  const prevIsLoadingRef = useRef(false);
  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoading;

    if (wasLoading && !isLoading && currentConversationId) {
      const msgs = getCurrentMessages();
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg?.role === 'assistant' && shouldAutoCanvas(lastMsg.content)) {
        const title = extractCanvasTitle(lastMsg.content);
        const finalContent = lastMsg.content;
        setCanvasToast({ title, content: finalContent });
        canvasToastTimerRef.current = setTimeout(async () => {
          const projectId = conversations.find(c => c.id === currentConversationId)?.projectId;
          await createDocument({
            title,
            content: finalContent,
            projectId,
            conversationId: currentConversationId,
          });
          setCanvasToast(null);
          canvasToastTimerRef.current = null;
        }, 4000);
      }
    }
    return () => {
      if (canvasToastTimerRef.current) clearTimeout(canvasToastTimerRef.current);
    };
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
    console.log('[handleSend] input:', input?.substring(0, 30), 'conversationId:', currentConversationId, 'isLoading:', isLoading);
    if (!input.trim() || !currentConversationId || isLoading) return;

    const message = input.trim();
    const targetPersonas = [...mentionedPersonas]; // Copy before clearing
    setInput("");
    setMentionedPersonas([]);

    // If multiple personas mentioned, use multi-persona flow
    if (targetPersonas.length > 1) {
      await sendMultiPersonaMessage(message, targetPersonas);
    } else {
      // Single persona or no mention - use regular flow
      // Pass the single mentioned persona if available
      await sendMessage(message, targetPersonas.length === 1 ? targetPersonas : undefined);
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
  };

  // Welcome screen when no conversation selected
  if (!currentConversationId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center p-8 pattern-dots">
        <div className="mb-8 animate-fade-in">
          <div className="mx-auto h-20 w-20 rounded-3xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(162_78%_55%)] flex items-center justify-center text-white shadow-xl shadow-[hsl(var(--primary)/0.25)]">
            <Bot className="h-10 w-10" />
          </div>
        </div>
        <h2 className="mb-4 text-4xl font-bold text-gradient animate-fade-in">
          AI Private Personal Assistant
        </h2>
        <p className="max-w-md text-[hsl(var(--muted-foreground))] mb-10 text-lg leading-relaxed animate-fade-in">
          Your private AI companion for coaching, therapy, and brainstorming.
          {voiceModeEnabled && (
            <span className="block mt-2 text-sm">
              Press <kbd className="px-2 py-1 rounded-md bg-[hsl(var(--secondary))] text-xs font-mono">Ctrl+Space</kbd> to talk.
            </span>
          )}
        </p>

        {!hasApiKey && !isAirplane && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 max-w-md animate-slide-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="font-semibold text-amber-700 dark:text-amber-300">
                API Key Required
              </p>
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
              Enter your Nebius API key in Settings to start chatting, or enable Airplane Mode to use local models.
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

        {(hasApiKey || isAirplane) && (
          <div className="grid grid-cols-2 gap-4 max-w-lg w-full animate-slide-up">
            {personas.slice(0, 4).map((p, i) => (
              <button
                key={p.id}
                onClick={() => void createConversation(p.id, currentModel.id)}
                className="group flex items-start gap-4 p-5 rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card)/0.8)] backdrop-blur-sm hover:border-[hsl(var(--primary)/0.5)] hover:bg-[hsl(var(--accent)/0.5)] hover:shadow-lg transition-all text-left"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className="text-3xl group-hover:scale-110 transition-transform">{p.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold group-hover:text-[hsl(var(--primary))] transition-colors">{p.name}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 mt-1">{p.description}</p>
                </div>
              </button>
            ))}
            {/* Incognito Chat Card */}
            <button
              onClick={() => void createConversation(personas[0]?.id || "psychologist", currentModel.id, undefined, true)}
              className="group flex items-start gap-4 p-5 rounded-2xl border border-dashed border-purple-500/30 bg-purple-500/5 backdrop-blur-sm hover:border-purple-500/50 hover:bg-purple-500/10 hover:shadow-lg transition-all text-left col-span-2"
              style={{ animationDelay: `${4 * 50}ms` }}
            >
              <span className="text-3xl group-hover:scale-110 transition-transform flex items-center justify-center">
                <EyeOff className="h-8 w-8 text-purple-400" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold group-hover:text-purple-400 transition-colors">Incognito Chat</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 mt-1">Start a private conversation that won't be saved. Messages vanish when you close or leave.</p>
              </div>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[hsl(var(--background))] relative">
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
        <div className="flex items-center gap-3 px-6 py-2.5 bg-purple-500/10 border-b border-purple-500/20">
          <EyeOff className="h-4 w-4 text-purple-400 flex-shrink-0" />
          <span className="text-sm font-medium text-purple-300">
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
              <div className="h-20 w-20 mb-8 rounded-3xl bg-gradient-to-br from-[hsl(var(--secondary))] to-[hsl(var(--muted))] flex items-center justify-center text-5xl shadow-lg">
                {persona?.icon || "👋"}
              </div>
              <h2 className="text-3xl font-bold mb-3">
                {conversation?.title || "New Chat"}
              </h2>
              <p className="text-[hsl(var(--muted-foreground))] max-w-md text-lg leading-relaxed">
                {persona?.description || "Start a conversation to begin."}
              </p>
              <div className="flex items-center gap-2 mt-6 text-sm text-[hsl(var(--muted-foreground)/0.7)]">
                <Sparkles className="h-4 w-4" />
                <span>Powered by {currentModel.name}</span>
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

                return (
                  <div key={message.id}>
                    <MessageBubble
                      id={message.id}
                      role={message.role}
                      content={message.content}
                      timestamp={message.createdAt}
                      personaName={messagePersona?.name}
                      personaIcon={messagePersona?.icon}
                      personaBackendMode={getBackendMode(messagePersona)}
                      privacyLevel={message.privacyLevel}
                      piiTypesDetected={message.piiTypesDetected}
                      approvalStatus={message.approvalStatus}
                      onOpenCanvas={async (content) => {
                        const title = extractCanvasTitle(content);
                        const projectId = conversations.find(c => c.id === currentConversationId)?.projectId;
                        await createDocument({
                          title,
                          content,
                          projectId,
                          conversationId: currentConversationId ?? undefined,
                        });
                      }}
                    />
                  </div>
                );
              })}
              {streamingContent && (
                <div className="animate-fade-in">
                  <MessageBubble
                    role="assistant"
                    content={streamingContent}
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
            </div>
          )}
          <div ref={messagesEndRef} className="h-64 w-full flex-shrink-0" />
        </div>
      </div>

      {/* Input Area - Floating at Bottom Center */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[hsl(var(--background))] via-[hsl(var(--background)/0.95)] to-transparent pointer-events-none">
        <div className="mx-auto max-w-3xl w-full pointer-events-auto">
          {/* LiveKit Voice Panel */}
          {showLiveKitPanel && voiceMode === 'livekit' && (
            <div className="mb-4 rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] shadow-xl overflow-hidden animate-slide-up">
              <div className="px-4 py-2 border-b border-[hsl(var(--border)/0.3)] bg-[hsl(var(--secondary)/0.3)]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[hsl(var(--foreground))]">LiveKit Voice</span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Streaming conversation</span>
                </div>
              </div>
              <VoiceConversation
                onTranscription={(_text, _role) => {
                  // When LiveKit transcribes something, we could add it to the chat
                }}
              />
            </div>
          )}
          {/* Prompt Review Panel */}
          {pendingReview && (
            <div className="mb-4">
              <PromptReviewPanel
                originalMessage={pendingReview.originalMessage}
                processedPrompt={pendingReview.processedPrompt}
                contentMode={pendingReview.processed.content_mode}
                attributesCount={pendingReview.processed.attributes_count}
                privacyInfo={pendingReview.processed.info}
                onApprove={(editedPrompt) => void approveAndSend(editedPrompt)}
                onCancel={cancelReview}
              />
            </div>
          )}
          {/* Floating Input Box */}
          <div className={`relative border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] rounded-2xl focus-within:border-[hsl(var(--ring)/0.5)] focus-within:ring-1 focus-within:ring-[hsl(var(--ring)/0.15)] transition-all duration-120 shadow-[var(--shadow)] ${pendingReview ? 'opacity-40 pointer-events-none' : ''}`}>
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
            <div className="absolute -top-3 left-4 z-10 flex items-center gap-1" data-tour="model-selector">
              {([
                {
                  mode: 'local' as const, icon: Lock, label: 'Local',
                  activeCls: 'border-green-500/50 bg-green-500/15 text-green-600 dark:text-green-400',
                  modelLabel: (() => { const m = useSettingsStore.getState().ollamaModels.find(m => m.apiModelId === settings.localModeModel); return m?.name?.replace(/^Qwen3\s*/, '') || settings.localModeModel; })(),
                },
                {
                  mode: 'hybrid' as const, icon: ShieldCheck, label: 'Hybrid',
                  activeCls: 'border-blue-500/50 bg-blue-500/15 text-blue-600 dark:text-blue-400',
                  modelLabel: (() => { const m = useSettingsStore.getState().models.find(m => m.id === settings.hybridModeModel); return m?.name?.replace(/^Qwen3\s*/, '') || settings.hybridModeModel; })(),
                },
                {
                  mode: 'cloud' as const, icon: Zap, label: 'Cloud',
                  activeCls: 'border-amber-500/50 bg-amber-500/15 text-amber-600 dark:text-amber-400',
                  modelLabel: (() => { const m = useSettingsStore.getState().models.find(m => m.id === settings.cloudModeModel); return m?.name?.replace(/^Qwen3\s*/, '') || settings.cloudModeModel; })(),
                },
              ]).map(({ mode, icon: Icon, label, activeCls, modelLabel }) => {
                const isActive = activePrivacyMode === mode;
                const isDimmed = activePrivacyMode === 'custom';
                return (
                  <button
                    key={mode}
                    onClick={() => handlePrivacyModeSelect(mode)}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm transition-all ${
                      isActive
                        ? activeCls
                        : isDimmed
                          ? 'border-[hsl(var(--border)/0.3)] bg-[hsl(var(--card)/0.5)] text-[hsl(var(--muted-foreground)/0.5)] hover:text-[hsl(var(--muted-foreground))]'
                          : 'border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:border-[hsl(var(--ring)/0.5)]'
                    }`}
                    title={
                      mode === 'local' ? 'All processing on your device — maximum privacy' :
                      mode === 'hybrid' ? 'PII redacted locally, then sent to cloud LLM' :
                      'Direct to cloud API — fastest'
                    }
                  >
                    <Icon className="h-3 w-3" />
                    <span className="leading-none">{label}</span>
                    <span className="text-[9px] opacity-60 leading-none">{modelLabel}</span>
                  </button>
                );
              })}
              {activePrivacyMode === 'custom' && (
                <span className="flex items-center gap-1.5 rounded-full border border-purple-500/50 bg-purple-500/15 text-purple-600 dark:text-purple-400 px-2.5 py-1 text-[11px] font-medium shadow-sm">
                  <Settings2 className="h-3 w-3" />
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
                  <div className="flex items-center gap-1 rounded-lg bg-[hsl(var(--secondary)/0.5)] p-0.5 border border-[hsl(var(--border)/0.5)]">
                    {/* Voice Mode Toggle (Local vs LiveKit) */}
                    {voiceModeEnabled && (
                      <button
                        onClick={() => setVoiceMode(voiceMode === 'local' ? 'livekit' : 'local')}
                        className={`flex items-center justify-center h-10 px-2 rounded-lg transition-all text-xs font-medium ${voiceMode === 'livekit'
                            ? "bg-blue-500 text-white shadow-sm"
                            : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                          }`}
                        title={voiceMode === 'livekit' ? "Using LiveKit (streaming)" : "Using Local voice"}
                      >
                        <Radio className="h-4 w-4 mr-1" />
                        {voiceMode === 'livekit' ? 'LK' : 'Local'}
                      </button>
                    )}

                    {/* Standard Voice Button (Local mode) */}
                    {voiceModeEnabled && voiceMode === 'local' && !isConversationMode && (
                      <VoiceButton
                        onTranscription={(text) => {
                          setInput(text);
                          // Auto-send after voice input
                          setTimeout(() => {
                            if (text.trim()) {
                              sendMessage(text.trim());
                              setInput("");
                            }
                          }, 100);
                        }}
                      />
                    )}

                    {/* LiveKit Voice Button */}
                    {voiceModeEnabled && voiceMode === 'livekit' && (
                      <button
                        onClick={() => setShowLiveKitPanel(!showLiveKitPanel)}
                        className={`flex items-center justify-center h-10 w-10 rounded-lg transition-all ${showLiveKitPanel
                            ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm"
                            : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                          }`}
                        title={showLiveKitPanel ? "Hide LiveKit panel" : "Show LiveKit voice panel"}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" x2="12" y1="19" y2="22" />
                        </svg>
                      </button>
                    )}

                    {/* Conversation Mode Toggle (Local mode only) */}
                    {voiceModeEnabled && voiceMode === 'local' && (
                      <button
                        onClick={() => setIsConversationMode(!isConversationMode)}
                        className={`flex items-center justify-center h-10 w-10 rounded-lg transition-all ${isConversationMode
                          ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm animate-pulse"
                          : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                          }`}
                        title={isConversationMode ? "Stop conversation mode" : "Start hands-free conversation"}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                        </svg>
                      </button>
                    )}
                  </div>

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
                      privacyStatus.mode === 'processing' ? 'bg-blue-500/10 text-blue-400 animate-pulse' :
                      privacyStatus.mode === 'pending_review' ? 'bg-amber-500/10 text-amber-400 animate-pulse' :
                      privacyStatus.mode === 'local' ? 'bg-green-500/10 text-green-400' :
                      privacyStatus.mode === 'attributes_only' ? 'bg-green-500/10 text-green-400' :
                      privacyStatus.mode === 'anonymized' ? 'bg-blue-500/10 text-blue-400' :
                      privacyStatus.mode === 'blocked' ? 'bg-red-500/10 text-red-400' :
                      'bg-yellow-500/10 text-yellow-400'
                    }`} title={privacyStatus.explanation}>
                      <span>{privacyStatus.icon}</span>
                      <span>{privacyStatus.label}</span>
                    </span>
                  )}
                </div>

                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={`flex items-center justify-center h-10 w-10 rounded-xl transition-all duration-200 ${input.trim()
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 shadow-[var(--shadow-glow-cyan)] active:scale-95"
                    : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground)/0.5)] cursor-not-allowed"
                    }`}
                >
                  <Send className="h-4 w-4" />
                </button>
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

      {/* Canvas auto-route toast */}
      {canvasToast && (
        <div className="absolute bottom-28 right-4 z-30 flex items-center gap-3 px-4 py-3 rounded-xl
          bg-[hsl(var(--surface-2))] border border-[hsl(var(--violet)/0.4)]
          shadow-[var(--shadow-glow-violet)] animate-slide-in-right text-[12px]">
          <FileText className="h-4 w-4 text-[hsl(var(--violet))] flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-[hsl(var(--foreground))]">Routing to Canvas</p>
            <p className="text-[hsl(var(--muted-foreground))] truncate max-w-[180px]">{canvasToast.title}</p>
          </div>
          <button
            onClick={dismissCanvasToast}
            className="text-[11px] px-2 py-0.5 rounded-lg bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
