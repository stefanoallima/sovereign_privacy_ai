import { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SpeakButton } from "./VoiceButton";
import { Bot, Brain, Copy, Check, ShieldAlert, Send } from "lucide-react";
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

export function MessageBubble({
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
}: MessageBubbleProps) {
  const isUser = role === "user";
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const { approveMessage } = useChatStore();
  const backendPrivacy = getBackendPrivacyIcon(personaBackendMode);

  // Parse content for thinking blocks
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
            <div className={`rounded-2xl rounded-br-md px-5 py-3 text-sm shadow-md transition-all ${approvalStatus === 'pending'
                ? "bg-amber-100 text-amber-900 border border-amber-200"
                : "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[hsl(var(--primary)/0.15)]"
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
          <div className="text-sm text-[hsl(var(--foreground))] leading-7 w-full">
            {/* Persona Name + Privacy Badge */}
            <div className="flex items-center gap-2 mb-2">
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

            {/* Thinking Block */}
            {thinking && (
              /* ... (Existing thinking block logic - abbreviated for replace tool) ... */
              <div className="mb-4 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--muted)/0.2)] overflow-hidden">
                <button
                  onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted)/0.3)] transition-colors"
                >
                  <Brain className="h-4 w-4" />
                  <span>Thinking Process</span>
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-[hsl(var(--muted))]">
                    {isThinkingExpanded ? "Hide" : "Show"}
                  </span>
                </button>
                {isThinkingExpanded && (
                  <div className="px-4 py-3 border-t border-[hsl(var(--border)/0.5)] text-sm text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted)/0.1)]">
                    <div className="prose prose-sm dark:prose-invert max-w-none opacity-80">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {thinking}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Markdown Content */}
            <div className="prose prose-neutral dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-3 prose-headings:font-semibold prose-headings:mt-6 prose-headings:mb-3 prose-pre:bg-[hsl(var(--secondary))] prose-pre:border prose-pre:border-[hsl(var(--border)/0.5)] prose-pre:rounded-xl prose-pre:shadow-sm prose-code:text-[13px] prose-ul:my-3 prose-ol:my-3 prose-li:my-1">
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
              <div className="flex flex-wrap items-center gap-3 mt-4">
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
                </div>
                {privacyLevel && (
                  <PrivacyIndicator level={privacyLevel} piiTypesDetected={piiTypesDetected} />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
