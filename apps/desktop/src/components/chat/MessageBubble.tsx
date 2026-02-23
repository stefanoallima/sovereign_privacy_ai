import React, { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SpeakButton } from "./VoiceButton";
import { Bot, Copy, Check, ShieldAlert, Send, FileText } from "lucide-react";
import { PrivacyIndicator, PrivacyLevel } from "./PrivacyIndicator";
import { useChatStore } from "@/stores";

// Backend privacy modes for personas
export type BackendPrivacyMode = 'local' | 'hybrid' | 'cloud';

interface MessageBubbleProps {
  id?: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
  isStreaming?: boolean;
  personaName?: string;
  personaIcon?: string;
  personaBackendMode?: BackendPrivacyMode; // Persona's LLM backend privacy mode
  privacyLevel?: PrivacyLevel;
  piiTypesDetected?: string[];
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  onOpenCanvas?: (content: string) => void;
  /** If set, this message was routed to canvas */
  canvasDocTitle?: string;
  /** Conversational intro text that precedes the canvas content (shown in chat) */
  canvasIntro?: string;
  onViewCanvas?: () => void;
}

// Helper to get privacy icon for backend mode
function getBackendPrivacyIcon(mode?: BackendPrivacyMode): { icon: string; label: string; color: string } {
  switch (mode) {
    case 'local':
      return { icon: '🔒', label: 'Local (Built-in)', color: 'text-green-600' };
    case 'hybrid':
      return { icon: '🔐', label: 'Hybrid (Anonymized)', color: 'text-blue-600' };
    case 'cloud':
    default:
      return { icon: '⚡', label: 'Cloud (Nebius)', color: 'text-amber-600' };
  }
}

// ... (parseThinkingContent function remains same) ...
// Parse content to extract thinking blocks
function parseThinkingContent(content: string): { thinking: string | null; mainContent: string } {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
  const matches = content.match(thinkRegex);

  if (!matches) {
    return { thinking: null, mainContent: content };
  }

  // Extract thinking content (combine multiple blocks if any)
  const thinkingParts: string[] = [];
  matches.forEach((match) => {
    const innerContent = match.replace(/<\/?think>/gi, "").trim();
    if (innerContent) {
      thinkingParts.push(innerContent);
    }
  });

  // Remove thinking blocks from main content
  const mainContent = content.replace(thinkRegex, "").trim();

  return {
    thinking: thinkingParts.length > 0 ? thinkingParts.join("\n\n") : null,
    mainContent,
  };
}

export const MessageBubble = React.memo(function MessageBubble({
  id,
  role,
  content,
  isStreaming,
  personaName,
  personaIcon,
  personaBackendMode,
  privacyLevel,
  piiTypesDetected,
  approvalStatus,
  onOpenCanvas,
  canvasDocTitle,
  canvasIntro,
  onViewCanvas,
}: MessageBubbleProps) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const { approveMessage } = useChatStore();
  const backendPrivacy = getBackendPrivacyIcon(personaBackendMode);

  const { thinking, mainContent } = useMemo(
    () => parseThinkingContent(content),
    [content]
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(mainContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApprove = async () => {
    if (id) {
      await approveMessage(id);
    }
  };

  return (
    <div
      className={`group relative flex gap-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--secondary))] to-[hsl(var(--muted))] shadow-sm text-lg">
            {personaIcon ? <span>{personaIcon}</span> : <Bot className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />}
          </div>
        </div>
      )}

      {/* Content Container */}
      <div className={`flex flex-col max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>

        {/* User Bubble (Right) */}
        {isUser ? (
          <div className="flex flex-col items-end gap-1">
            <div className={`transition-all ${approvalStatus === 'pending'
                ? "max-w-[75%] ml-auto px-4 py-2.5 rounded-2xl rounded-tr-sm bg-amber-100 border border-amber-200 text-amber-900 text-[13px] leading-relaxed"
                : "max-w-[75%] ml-auto px-4 py-2.5 rounded-2xl rounded-tr-sm bg-[hsl(var(--primary)/0.15)] border border-[hsl(var(--primary)/0.2)] text-[hsl(var(--foreground))] text-[13px] leading-relaxed"
              }`}>
              {mainContent}
            </div>
            {privacyLevel && (
              <PrivacyIndicator level={privacyLevel} piiTypesDetected={piiTypesDetected} />
            )}

            {/* Approval UI for User Message (e.g. proposed prompt to send) */}
            {approvalStatus === 'pending' && (
              <div className="bg-white border border-amber-200 rounded-lg p-3 mt-1 shadow-sm w-full max-w-md">
                <div className="flex items-start gap-2 mb-2">
                  <ShieldAlert className="text-amber-500 shrink-0" size={16} />
                  <div className="text-xs text-gray-600">
                    <strong>Approval Required:</strong> The Local LLM anonymized this request. Review the content above before sending to Cloud.
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors">
                    Edit
                  </button>
                  <button
                    onClick={handleApprove}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded transition-colors shadow-sm"
                  >
                    <Send size={12} />
                    Approve & Send
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Assistant Content (Left) */
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[hsl(var(--surface-2))] border border-[hsl(var(--border))] text-[hsl(var(--foreground-muted))] text-[13px] leading-relaxed w-full overflow-hidden">
            {/* Persona Name + Privacy Badge */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              <span className="font-semibold text-[13px] text-[hsl(var(--foreground)/0.9)]">
                {personaName || "Assistant"}
              </span>
              {personaBackendMode && (
                <span
                  className={`text-xs ${backendPrivacy.color} opacity-80`}
                  title={backendPrivacy.label}
                >
                  {backendPrivacy.icon}
                </span>
              )}
            </div>

            {/* Thinking block — foldable */}
            {thinking && (
              <div className="mx-4 mb-2">
                <button
                  onClick={() => setShowThinking(v => !v)}
                  className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground)/0.6)] hover:text-[hsl(var(--muted-foreground))] transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12" height="12"
                    viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: showThinking ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span>{showThinking ? 'Hide' : 'Show'} thinking</span>
                </button>
                {showThinking && (
                  <div className="mt-1.5 rounded-lg bg-[hsl(var(--muted)/0.4)] border border-[hsl(var(--border)/0.5)] px-3 py-2 text-[11.5px] text-[hsl(var(--muted-foreground)/0.7)] font-mono leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {thinking}
                  </div>
                )}
              </div>
            )}

            {/* Canvas-routed message: show intro prose + inline canvas link */}
            {canvasDocTitle ? (
              <>
                {/* Intro text (conversational part before the structured content) */}
                {canvasIntro && (
                  <div className="px-4 pb-2 prose prose-neutral dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-0 text-[13px]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {canvasIntro}
                    </ReactMarkdown>
                  </div>
                )}
                {/* Compact canvas reference pill */}
                <div className="mx-3 mb-3 flex items-center gap-3 px-3 py-2 rounded-xl
                  bg-[hsl(var(--violet)/0.07)] border border-[hsl(var(--violet)/0.2)]">
                  <FileText className="h-3.5 w-3.5 flex-shrink-0 text-[hsl(var(--violet))]" />
                  <p className="flex-1 min-w-0 text-[12px] font-medium text-[hsl(var(--foreground-muted))] truncate">
                    {canvasDocTitle}
                  </p>
                  {onViewCanvas && (
                    <button
                      onClick={onViewCanvas}
                      className="flex-shrink-0 text-[11px] px-2.5 py-1 rounded-lg
                        bg-[hsl(var(--violet)/0.12)] text-[hsl(var(--violet))]
                        hover:bg-[hsl(var(--violet)/0.22)] transition-colors font-medium"
                    >
                      Open →
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Markdown Content */}
                <div className="px-4 pb-3 prose prose-neutral dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-3 prose-headings:font-semibold prose-headings:mt-6 prose-headings:mb-3 prose-pre:bg-[hsl(var(--secondary))] prose-pre:border prose-pre:border-[hsl(var(--border)/0.5)] prose-pre:rounded-xl prose-pre:shadow-sm prose-code:text-[13px] prose-ul:my-3 prose-ol:my-3 prose-li:my-1">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code: ({ className, children, ...props }) => {
                        const isInline = !className;
                        return isInline ? (
                          <code className="bg-[hsl(var(--secondary))] px-1.5 py-0.5 rounded-md text-[13px] font-medium" {...props}>
                            {children}
                          </code>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                      a: ({ children, href }) => (
                        <a
                          href={href}
                          className="text-[hsl(var(--primary))] font-medium hover:underline decoration-[hsl(var(--primary)/0.3)] underline-offset-2"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {children}
                        </a>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-[hsl(var(--primary)/0.3)] pl-4 italic text-[hsl(var(--muted-foreground))]">
                          {children}
                        </blockquote>
                      ),
                    }}
                  >
                    {mainContent}
                  </ReactMarkdown>
                </div>

                {/* Action Buttons */}
                {!isStreaming && mainContent && (
                  <div className="flex flex-wrap items-center gap-3 px-4 pb-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <SpeakButton text={mainContent} />
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
                        title="Copy message"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      {onOpenCanvas && (
                        <button
                          onClick={() => onOpenCanvas(mainContent)}
                          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--primary))] transition-colors"
                          title="Open in Canvas"
                        >
                          <FileText className="h-3 w-3" />
                          <span>Open in Canvas</span>
                        </button>
                      )}
                    </div>
                    {privacyLevel && (
                      <PrivacyIndicator level={privacyLevel} piiTypesDetected={piiTypesDetected} />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
