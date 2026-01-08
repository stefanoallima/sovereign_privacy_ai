import { useState, useRef, useEffect, useCallback } from "react";
import { useChatStore, useVoiceStore, usePersonasStore, useSettingsStore } from "@/stores";
import { useChat } from "@/hooks/useChat";
import { useVoice } from "@/hooks/useVoice";
import { MessageBubble } from "./MessageBubble";
import { VoiceButton } from "./VoiceButton";
import { VoiceConversation } from "./VoiceConversation";
import { getNebiusClient } from "@/services/nebius";
import {
  Send,
  Bot,
  AlertTriangle,
  ChevronDown,
  Check,
  Sparkles,
  Radio,
} from "lucide-react";

type VoiceMode = 'local' | 'livekit';

const AVAILABLE_MODELS = [
  { id: "Qwen/Qwen3-235B-A22B", name: "Qwen3 235B", description: "Most capable" },
  { id: "Qwen/Qwen3-30B-A3B", name: "Qwen3 30B", description: "Fast & efficient" },
  { id: "meta-llama/Llama-3.3-70B-Instruct", name: "Llama 3.3 70B", description: "Meta's best" },
  { id: "deepseek-ai/DeepSeek-V3", name: "DeepSeek V3", description: "Reasoning expert" },
];

export function ChatWindow() {
  const [input, setInput] = useState("");
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [isConversationMode, setIsConversationMode] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('local');
  const [showLiveKitPanel, setShowLiveKitPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const generatingTitleRef = useRef(false);

  // Mention state
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);

  const {
    currentConversationId,
    getCurrentMessages,
    getCurrentConversation,
    isLoading,
    streamingContent,
    updateConversationTitle,
    createConversation,
  } = useChatStore();

  const { settings, updateSettings } = useSettingsStore();
  const { voiceInputEnabled } = useVoiceStore();
  const { personas, getPersonaById } = usePersonasStore();
  const { sendMessage } = useChat();

  const messages = getCurrentMessages();
  const conversation = getCurrentConversation();
  const persona = personas.find((p) => p.id === conversation?.personaId);
  const hasApiKey = !!settings.nebiusApiKey;
  const voiceModeEnabled = voiceInputEnabled && hasApiKey;
  const currentModel = AVAILABLE_MODELS.find((m) => m.id === settings.defaultModelId) || AVAILABLE_MODELS[0];

  // Filtered personas for mention menu
  const filteredPersonas = showMentionMenu
    ? personas.filter(p =>
      p.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(mentionQuery.toLowerCase())
    )
    : [];

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

  // Close model selector on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(e.target as Node)) {
        setShowModelSelector(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      console.log("[ConversationMode] Mode disabled, cleaning up");
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

    console.log("[ConversationMode] Starting to listen for user input...");
    startListening();

    // Auto-stop after timeout
    recordingTimeoutRef.current = window.setTimeout(async () => {
      if (conversationModeRef.current) {
        console.log("[ConversationMode] Recording timeout, stopping and transcribing...");
        const transcription = await stopListening();
        console.log("[ConversationMode] Got transcription:", transcription);
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
      console.log("[ConversationMode] Mode enabled, starting initial listen...");
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
        console.log("[ConversationMode] Already speaking, skipping duplicate");
        return;
      }

      lastMessageRef.current = lastMessage.id;
      isSpeakingRef.current = true;

      // 1. Speak the response
      console.log("[ConversationMode] Speaking assistant message...");
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

      console.log("[ConversationMode] Auto-sending transcription:", lastTranscription);

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
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInput(newValue);

    // Simple mention detection
    // Find the last "@" before cursor
    const cursorPos = e.target.selectionStart;
    setCursorPosition(cursorPos);

    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtRateIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtRateIndex !== -1) {
      // Check if it's the start of line or preceded by space
      const isStartOrSpace = lastAtRateIndex === 0 || textBeforeCursor[lastAtRateIndex - 1] === ' ';

      if (isStartOrSpace) {
        // Check filtering query (text after @)
        const query = textBeforeCursor.substring(lastAtRateIndex + 1);
        // Only trigger if no spaces in query yet (simple name matching)
        if (!query.includes(" ")) {
          setMentionQuery(query);
          setShowMentionMenu(true);
          setMentionIndex(0);
          return;
        }
      }
    }

    setShowMentionMenu(false);
  };

  const selectMention = (persona: any) => {
    if (!textareaRef.current) return;

    const textBeforeCursor = input.substring(0, cursorPosition);
    const lastAtRateIndex = textBeforeCursor.lastIndexOf("@");

    const prefix = input.substring(0, lastAtRateIndex);
    const suffix = input.substring(cursorPosition);

    const newInput = `${prefix}@${persona.name} ${suffix}`;
    setInput(newInput);
    setShowMentionMenu(false);

    // Focus back on textarea
    textareaRef.current.focus();
  };

  // Auto-generate title
  useEffect(() => {
    const generateTitle = async () => {
      if (!currentConversationId || !settings.nebiusApiKey || generatingTitleRef.current) return;

      const msgs = getCurrentMessages();
      const conv = getCurrentConversation();

      if (!isLoading && msgs.length === 2 && conv?.title === "New Conversation") {
        generatingTitleRef.current = true;

        try {
          const client = getNebiusClient(settings.nebiusApiKey, settings.nebiusApiEndpoint);
          const response = await client.chatCompletion({
            model: "Qwen/Qwen3-32B-fast",
            messages: [
              { role: "system", content: "You are a helpful assistant. Generate a short, concise title (max 5 words) for this conversation based on the user's first message and objective. Do not wrap in quotes." },
              { role: "user", content: msgs[0].content },
              { role: "assistant", content: msgs[1].content }
            ],
            temperature: 0.5,
            max_tokens: 20
          });

          const title = response.choices[0]?.message.content?.trim();
          if (title) {
            await updateConversationTitle(currentConversationId, title.replace(/^["']|["']$/g, ''));
          }
        } catch (error) {
          console.error("Failed to generate title:", error);
        } finally {
          generatingTitleRef.current = false;
        }
      }
    };

    generateTitle();
  }, [messages.length, isLoading, currentConversationId, settings.nebiusApiKey]);

  const handleSend = async () => {
    if (!input.trim() || !currentConversationId || isLoading) return;

    const message = input.trim();
    setInput("");
    await sendMessage(message);
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

  const handleModelSelect = (modelId: string) => {
    updateSettings({ defaultModelId: modelId });
    setShowModelSelector(false);
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

        {!hasApiKey && (
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
              Enter your Nebius API key in Settings to start chatting with your private AI assistant.
            </p>
          </div>
        )}

        {hasApiKey && (
          <div className="grid grid-cols-2 gap-4 max-w-lg w-full animate-slide-up">
            {personas.slice(0, 4).map((p, i) => (
              <button
                key={p.id}
                onClick={() => void createConversation(p.id, settings.defaultModelId || AVAILABLE_MODELS[0].id)}
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
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[hsl(var(--background))] relative">
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
              {messages.map((message, idx) => {
                // Determine persona for this message
                const messagePersona = message.personaId
                  ? getPersonaById(message.personaId)
                  : persona;

                return (
                  <div key={message.id} className="animate-fade-in" style={{ animationDelay: `${idx * 30}ms` }}>
                    <MessageBubble
                      role={message.role}
                      content={message.content}
                      timestamp={message.createdAt}
                      personaName={messagePersona?.name}
                      personaIcon={messagePersona?.icon}
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
                onTranscription={(text, role) => {
                  // When LiveKit transcribes something, we could add it to the chat
                  console.log(`[LiveKit] ${role}: ${text}`);
                }}
              />
            </div>
          )}
          {/* Floating Input Box */}
          <div className="relative rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] shadow-xl shadow-black/5 focus-within:shadow-2xl focus-within:shadow-[hsl(var(--primary)/0.05)] focus-within:border-[hsl(var(--ring)/0.5)] transition-all duration-300">
            {/* Mention Menu */}
            {showMentionMenu && filteredPersonas.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl overflow-hidden animate-slide-up z-20">
                <div className="p-1 max-h-48 overflow-y-auto">
                  {filteredPersonas.map((p, i) => (
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
                        <p className="font-medium truncate">{p.name}</p>
                        <p className="text-xs opacity-60 truncate">{p.description}</p>
                      </div>
                      {i === mentionIndex && <span className="text-xs opacity-50">Enter</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Model Selector Pill */}
            <div className="absolute -top-3 left-4 z-10" ref={modelSelectorRef}>
              <button
                onClick={() => setShowModelSelector(!showModelSelector)}
                className="flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:border-[hsl(var(--ring)/0.5)] shadow-sm hover:shadow-md transition-all"
              >
                <Sparkles className="h-3 w-3 text-[hsl(var(--primary))]" />
                {currentModel.name}
                <ChevronDown className={`h-3 w-3 transition-transform ${showModelSelector ? "rotate-180" : ""}`} />
              </button>

              {showMentionMenu && filteredPersonas.length > 0 ? null : showModelSelector && (
                <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl overflow-hidden animate-slide-up">
                  <div className="p-2">
                    {AVAILABLE_MODELS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => handleModelSelect(m.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex justify-between items-center transition-all ${m.id === settings.defaultModelId
                          ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
                          : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]"
                          }`}
                      >
                        <div>
                          <span className="font-medium">{m.name}</span>
                          <span className="block text-xs opacity-70 mt-0.5">{m.description}</span>
                        </div>
                        {m.id === settings.defaultModelId && (
                          <Check className="h-4 w-4 text-[hsl(var(--primary))]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col">
              <textarea
                ref={textareaRef}
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
                        className={`flex items-center justify-center h-10 px-2 rounded-lg transition-all text-xs font-medium ${
                          voiceMode === 'livekit'
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
                        className={`flex items-center justify-center h-10 w-10 rounded-lg transition-all ${
                          showLiveKitPanel
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

                  <span className="text-[10px] text-[hsl(var(--muted-foreground)/0.4)] hidden sm:block">
                    Shift+Enter for new line
                  </span>
                </div>

                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={`flex items-center justify-center h-10 w-10 rounded-xl transition-all duration-200 ${input.trim()
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 shadow-md shadow-[hsl(var(--primary)/0.25)] active:scale-95"
                    : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground)/0.5)] cursor-not-allowed"
                    }`}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] text-[hsl(var(--muted-foreground)/0.5)]">
            AI can make mistakes. Please verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
