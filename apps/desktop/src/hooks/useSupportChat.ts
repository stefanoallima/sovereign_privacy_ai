import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { useSettingsStore } from '@/stores';

interface SupportMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SupportReport {
  type: 'bug' | 'feature';
  title: string;
  summary: string;
  steps: string;
  systemInfo: string;
}

type Phase = 'chatting' | 'report_ready' | 'submitted';

const SUPPORT_SYSTEM_PROMPT = `You are a support assistant for Sovereign AI, a privacy-first AI desktop app.

RULES:
- Help the user resolve their issue with troubleshooting steps
- Common issues: model download fails, local inference errors, API key problems, privacy mode confusion
- If you cannot resolve the issue after 2-3 exchanges, say EXACTLY: [ESCALATE] followed by a one-line summary
- NEVER include personal names, addresses, financial data, or any PII in your responses
- Be concise and friendly`;

function stripThinkTags(text: string): string {
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  if (cleaned.startsWith('</think>')) {
    cleaned = cleaned.slice('</think>'.length).trim();
  }
  return cleaned || text.replace(/<\/?think>/g, '').trim() || '(No response)';
}

async function gatherSystemInfo(): Promise<string> {
  const parts: string[] = [];

  try {
    const version = await getVersion();
    parts.push(`v${version}`);
  } catch {
    parts.push('v0.1.0');
  }

  // OS from user agent
  const ua = navigator.userAgent;
  if (ua.includes('Windows')) parts.push('Windows');
  else if (ua.includes('Mac')) parts.push('macOS');
  else if (ua.includes('Linux')) parts.push('Linux');

  // Privacy mode
  const privacyMode = useSettingsStore.getState().settings.privacyMode;
  parts.push(`${privacyMode.charAt(0).toUpperCase() + privacyMode.slice(1)} mode`);

  // Downloaded models
  try {
    const models = await invoke<Array<{ id: string; is_downloaded: boolean }>>('list_local_models');
    const downloaded = models.filter(m => m.is_downloaded).map(m => m.id);
    if (downloaded.length > 0) {
      parts.push(downloaded.join(', ') + ' downloaded');
    } else {
      parts.push('No local models');
    }
  } catch {
    parts.push('Models unknown');
  }

  return parts.join(' \u00b7 ');
}

function parseReport(text: string, systemInfo: string): SupportReport | null {
  const typeMatch = text.match(/TYPE:\s*(bug|feature)/i);
  const titleMatch = text.match(/TITLE:\s*(.+)/i);
  const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=\nSTEPS:|$)/i);
  const stepsMatch = text.match(/STEPS:\s*([\s\S]*?)$/i);

  if (!titleMatch) return null;

  return {
    type: (typeMatch?.[1]?.toLowerCase() === 'feature' ? 'feature' : 'bug') as 'bug' | 'feature',
    title: titleMatch[1].trim(),
    summary: summaryMatch?.[1]?.trim() || 'No summary provided.',
    steps: stepsMatch?.[1]?.trim() || 'No steps provided.',
    systemInfo,
  };
}

export function useSupportChat() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [phase, setPhase] = useState<Phase>('chatting');
  const [report, setReport] = useState<SupportReport | null>(null);
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: SupportMessage = { role: 'user', content: content.trim() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setError(null);

    try {
      // Build ChatML prompt with support system prompt + last 4 messages
      const allMessages = [...messages, userMsg];
      const recent = allMessages.slice(-4);

      let prompt = `<|im_start|>system\n${SUPPORT_SYSTEM_PROMPT}<|im_end|>\n`;
      for (const msg of recent) {
        const role = msg.role === 'user' ? 'user' : 'assistant';
        prompt += `<|im_start|>${role}\n${msg.content}<|im_end|>\n`;
      }
      prompt += `<|im_start|>assistant\n`;

      // Check if local model is available
      const isAvailable = await invoke<boolean>('ollama_is_available');
      if (!isAvailable) {
        const assistantMsg: SupportMessage = {
          role: 'assistant',
          content: 'I need a local AI model to help you. Please go to Settings and download a model first, then come back here.',
        };
        setMessages(prev => [...prev, assistantMsg]);
        setIsLoading(false);
        return;
      }

      const response = await invoke<string>('ollama_generate', {
        prompt,
        model: useSettingsStore.getState().settings.airplaneModeModel,
      });

      const cleaned = stripThinkTags(response);
      const assistantMsg: SupportMessage = { role: 'assistant', content: cleaned };
      setMessages(prev => [...prev, assistantMsg]);

      // Check for escalation
      if (cleaned.includes('[ESCALATE]')) {
        await requestReport([...allMessages, assistantMsg]);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
      const assistantMsg: SupportMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errMsg}. Please try again or use the GitHub Issues page directly.`,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  const requestReport = useCallback(async (conversationMessages: SupportMessage[]) => {
    setIsLoading(true);

    try {
      const systemInfo = await gatherSystemInfo();

      // Build report-generation prompt
      const conversationText = conversationMessages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      const reportPrompt = `<|im_start|>system
You are a support bot. Summarize the following support conversation into a structured report.
Format your response EXACTLY as:
TYPE: bug or feature
TITLE: one-line title
SUMMARY: 2-3 sentence summary of the issue
STEPS: numbered steps to reproduce (if bug) or description (if feature)

NEVER include any personal information, names, addresses, or financial data.<|im_end|>
<|im_start|>user
${conversationText}<|im_end|>
<|im_start|>assistant
`;

      const response = await invoke<string>('ollama_generate', {
        prompt: reportPrompt,
        model: useSettingsStore.getState().settings.airplaneModeModel,
      });

      const cleaned = stripThinkTags(response);
      const parsed = parseReport(cleaned, systemInfo);

      if (parsed) {
        setReport(parsed);
        setPhase('report_ready');
      } else {
        // Fallback: create a basic report from the conversation
        setReport({
          type: 'bug',
          title: 'Support request from in-app chat',
          summary: conversationMessages
            .filter(m => m.role === 'user')
            .map(m => m.content)
            .join(' '),
          steps: 'See summary above.',
          systemInfo,
        });
        setPhase('report_ready');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitReport = useCallback(async () => {
    if (!report) return;

    setIsLoading(true);
    setError(null);

    const body = `## Support Report

**Type**: ${report.type === 'bug' ? 'Bug' : 'Feature Request'}
**${report.systemInfo}**

## Summary
${report.summary}

## Steps to Reproduce
${report.steps}

---
*Submitted from Sovereign AI in-app support*`;

    const labels = ['support'];
    if (report.type === 'bug') labels.push('bug');
    else labels.push('enhancement');

    try {
      const url = await invoke<string>('submit_support_issue', {
        issue: {
          title: report.title,
          body,
          labels,
        },
      });
      setIssueUrl(url);
      setPhase('submitted');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [report]);

  const dismissReport = useCallback(() => {
    setReport(null);
    setPhase('chatting');
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setPhase('chatting');
    setReport(null);
    setIssueUrl(null);
    setIsLoading(false);
    setError(null);
  }, []);

  return {
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
  };
}
