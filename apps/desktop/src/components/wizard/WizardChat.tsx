import { useState, useRef, useEffect } from "react";
import { useWizardStore } from "@/stores/wizard";
import { useWizardAI } from "./useWizardAI";
import { Bot, Send, Loader2 } from "lucide-react";

/**
 * AI chat panel shown on the right side of each wizard step.
 * Always visible — shows a welcome prompt when no messages yet.
 */
export function WizardChat() {
  const { chatMessages, isAiLoading } = useWizardStore();
  const { askQuestion } = useWizardAI();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isAiLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || isAiLoading) return;
    setInput("");
    await askQuestion(q);
  };

  const hasMessages = chatMessages.length > 0 || isAiLoading;

  return (
    <div className="flex flex-col h-full rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card)/0.5)] backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(var(--border)/0.3)]">
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(162_78%_50%)] flex items-center justify-center">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-medium">Sovereign AI Setup Assistant</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Supporting better informed choices — runs entirely on your device</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="h-12 w-12 rounded-2xl bg-[hsl(var(--secondary))] flex items-center justify-center mb-3">
              <Bot className="h-6 w-6 text-[hsl(var(--muted-foreground)/0.5)]" />
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Make a selection and I'll help you understand the trade-offs, or ask me any question about your setup.
            </p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground)/0.5)] mt-2">
              Powered by a local AI model — no data leaves your device
            </p>
          </div>
        )}
        {chatMessages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(162_78%_50%)] flex items-center justify-center mt-0.5">
                <Bot className="h-3.5 w-3.5 text-white" />
              </div>
            )}
            <div
              className={`rounded-xl px-3 py-2 text-sm max-w-[85%] ${
                msg.role === "user"
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))]"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isAiLoading && (
          <div className="flex gap-2 items-start">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(162_78%_50%)] flex items-center justify-center mt-0.5">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="rounded-xl px-3 py-2 bg-[hsl(var(--secondary))]">
              <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 p-3 border-t border-[hsl(var(--border)/0.3)]"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          disabled={isAiLoading}
          className="flex-1 rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.5)] px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground)/0.5)] focus:outline-none focus:border-[hsl(var(--ring)/0.5)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || isAiLoading}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
