import React from 'react';
import { FileText, File, X, Send, ClipboardPaste } from 'lucide-react';
import type { FileAttachment } from '../../types';

interface AttachmentPreviewProps {
  attachment: FileAttachment;
  onRemove: () => void;
  onSendAsContext: () => void;
  onFillForm: () => void;
}

function getFileIcon(fileType: FileAttachment['fileType']) {
  switch (fileType) {
    case 'txt':
    case 'md':
    case 'docx':
    case 'doc':
      return FileText;
    case 'pdf':
    default:
      return File;
  }
}

function getTypeBadgeStyle(fileType: FileAttachment['fileType']): string {
  switch (fileType) {
    case 'pdf':
      return 'bg-red-500/10 text-red-500';
    case 'docx':
    case 'doc':
      return 'bg-blue-500/10 text-blue-500';
    case 'md':
      return 'bg-green-500/10 text-green-500';
    case 'txt':
    default:
      return 'bg-[hsl(var(--muted-foreground)/0.1)] text-[hsl(var(--muted-foreground))]';
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncateFilename(name: string, maxLen = 32): string {
  if (name.length <= maxLen) return name;
  const ext = name.lastIndexOf('.');
  if (ext > 0) {
    const extension = name.slice(ext);
    const base = name.slice(0, maxLen - extension.length - 3);
    return `${base}...${extension}`;
  }
  return name.slice(0, maxLen - 3) + '...';
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  attachment,
  onRemove,
  onSendAsContext,
  onFillForm,
}) => {
  const IconComponent = getFileIcon(attachment.fileType);
  const badgeStyle = getTypeBadgeStyle(attachment.fileType);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 shadow-sm">
      {/* File icon */}
      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-[hsl(var(--secondary))] flex-shrink-0">
        <IconComponent className="h-4.5 w-4.5 text-[hsl(var(--muted-foreground))]" />
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
            {truncateFilename(attachment.filename)}
          </span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${badgeStyle}`}>
            {attachment.fileType}
          </span>
        </div>
        <span className="text-[11px] text-[hsl(var(--muted-foreground)/0.6)]">
          {formatFileSize(attachment.fileSize)}
          {attachment.structure?.page_count
            ? ` · ${attachment.structure.page_count} page${attachment.structure.page_count !== 1 ? 's' : ''}`
            : ''}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={onSendAsContext}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.2)] transition-colors"
          title="Attach file content as context with your message"
        >
          <Send className="h-3 w-3" />
          <span className="hidden sm:inline">Context</span>
        </button>

        <button
          onClick={onFillForm}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-[hsl(var(--violet)/0.1)] text-[hsl(var(--violet))] hover:bg-[hsl(var(--violet)/0.2)] transition-colors"
          title="Use AI to fill out this form"
        >
          <ClipboardPaste className="h-3 w-3" />
          <span className="hidden sm:inline">Fill form</span>
        </button>

        <button
          onClick={onRemove}
          className="flex items-center justify-center h-7 w-7 rounded-lg text-[hsl(var(--muted-foreground)/0.5)] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
          title="Remove attachment"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export default AttachmentPreview;
