import React, { useState } from 'react';
import { Paperclip } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import type { FileAttachment } from '../../types';

interface ParsedDocumentDto {
  filename: string;
  file_type: string;
  text_content: string;
  page_count: number;
  document_type: string | null;
}

interface AttachmentButtonProps {
  onFileSelected: (attachment: FileAttachment) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

export const AttachmentButton: React.FC<AttachmentButtonProps> = ({
  onFileSelected,
  onError,
  disabled = false,
}) => {
  const [isParsing, setIsParsing] = useState(false);

  const handleClick = async () => {
    if (disabled || isParsing) return;

    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Documents',
          extensions: ['pdf', 'docx', 'doc', 'md', 'txt'],
        }],
      });

      if (!selected) return;

      const filePath = typeof selected === 'string' ? selected : selected[0];
      if (!filePath) return;

      setIsParsing(true);

      const parsed = await invoke<ParsedDocumentDto>('parse_document', {
        filePath: filePath,
      });

      const fileType = parsed.file_type.toLowerCase() as FileAttachment['fileType'];

      const attachment: FileAttachment = {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        filename: parsed.filename,
        fileType,
        filePath,
        fileSize: parsed.text_content.length, // approximate from text length
        textContent: parsed.text_content,
        structure: {
          page_count: parsed.page_count,
          has_tables: false,
          document_type: parsed.document_type ?? undefined,
        },
      };

      onFileSelected(attachment);
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Failed to parse file';
      console.error('Failed to select/parse file:', msg);
      onError?.(msg);
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isParsing}
      className={`flex items-center justify-center h-10 w-10 rounded-xl transition-colors ${
        disabled || isParsing
          ? 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground)/0.4)] cursor-not-allowed'
          : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] active:scale-93'
      }`}
      title="Attach document"
    >
      {isParsing ? (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <Paperclip className="h-4 w-4" />
      )}
    </button>
  );
};

export default AttachmentButton;
