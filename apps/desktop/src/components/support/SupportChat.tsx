import { useState, useRef, useEffect } from 'react';
import { X, Send, LifeBuoy, ExternalLink, Lock, Loader2 } from 'lucide-react';
import { useSupportChat } from '@/hooks/useSupportChat';
import { openUrl } from '@tauri-apps/plugin-opener';

interface SupportChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupportChat({ isOpen, onClose }: SupportChatProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    phase,
    report,
    issueUrl,
    isLoading,
    error,
    sendMessage,
    submitReport,
    dismissReport,
    reset,
  } = useSupportChat();

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, phase]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && phase === 'chatting') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, phase]);

  // Reset on close
  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
      <div className="relative flex flex-col w-full max-w-lg h-[85vh] max-h-[700px] mx-4 bg-[hsl(var(--card))] rounded-3xl shadow-2xl border border-[hsl(var(--border)/0.5)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border)/0.5)]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-[15px]">Support</h2>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Powered by local AI</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Welcome message */}
          {messages.length === 0 && phase === 'chatting' && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white text-xs">
                <LifeBuoy className="h-4 w-4" />
              </div>
              <div className="rounded-2xl rounded-tl-md bg-[hsl(var(--secondary))] px-4 py-3 text-sm max-w-[85%]">
                <p>Hi! I'm your support assistant. Describe any issue you're having and I'll try to help.</p>
                <p className="mt-2 text-[hsl(var(--muted-foreground))] text-xs">
                  If I can't resolve it, I'll generate a report you can send to our team.
                </p>
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white text-xs">
                  <LifeBuoy className="h-4 w-4" />
                </div>
              )}
              <div
                className={`rounded-2xl px-4 py-3 text-sm max-w-[85%] ${
                  msg.role === 'user'
                    ? 'rounded-tr-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                    : 'rounded-tl-md bg-[hsl(var(--secondary))]'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && phase === 'chatting' && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white text-xs">
                <LifeBuoy className="h-4 w-4" />
              </div>
              <div className="rounded-2xl rounded-tl-md bg-[hsl(var(--secondary))] px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />
              </div>
            </div>
          )}

          {/* Report Card */}
          {phase === 'report_ready' && report && (
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-lg space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span>{report.type === 'bug' ? 'Bug Report' : 'Feature Request'}</span>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-[hsl(var(--muted-foreground))] text-xs font-medium uppercase tracking-wider">Title</span>
                  <p className="mt-1">{report.title}</p>
                </div>
                <div>
                  <span className="text-[hsl(var(--muted-foreground))] text-xs font-medium uppercase tracking-wider">Summary</span>
                  <p className="mt-1 text-[hsl(var(--muted-foreground))]">{report.summary}</p>
                </div>
                <div>
                  <span className="text-[hsl(var(--muted-foreground))] text-xs font-medium uppercase tracking-wider">Steps</span>
                  <p className="mt-1 text-[hsl(var(--muted-foreground))] whitespace-pre-wrap">{report.steps}</p>
                </div>
              </div>

              <div className="text-xs text-[hsl(var(--muted-foreground))] border-t border-[hsl(var(--border)/0.5)] pt-3">
                <p>{report.systemInfo}</p>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                <Lock className="h-3 w-3" />
                <span>No personal data included</span>
              </div>

              {error && (
                <p className="text-xs text-[hsl(var(--destructive))]">{error}</p>
              )}

              <div className="space-y-2 pt-1">
                <button
                  onClick={submitReport}
                  disabled={isLoading}
                  className="w-full rounded-xl bg-[hsl(var(--primary))] py-3 text-[hsl(var(--primary-foreground))] font-semibold text-base hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Send to Development Team'
                  )}
                </button>
                <button
                  onClick={dismissReport}
                  className="w-full text-center text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors py-1"
                >
                  don't send
                </button>
              </div>
            </div>
          )}

          {/* Submitted Confirmation */}
          {phase === 'submitted' && (
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-center space-y-3">
              <div className="text-2xl">Report sent!</div>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Thank you for helping us improve Sovereign AI.
              </p>
              {issueUrl && (
                <button
                  onClick={() => openUrl(issueUrl)}
                  className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--primary))] hover:underline"
                >
                  View on GitHub
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {phase === 'chatting' && (
          <div className="px-4 py-3 border-t border-[hsl(var(--border)/0.5)]">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your issue..."
                disabled={isLoading}
                className="flex-1 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.5)] px-4 py-2.5 text-sm placeholder:text-[hsl(var(--muted-foreground)/0.5)] focus:bg-[hsl(var(--background))] focus:border-[hsl(var(--ring)/0.5)] focus:outline-none transition-all disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-30"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
