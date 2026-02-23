import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, Code, Eye, Edit2 } from 'lucide-react';
import { useCanvasStore } from '@/stores';

export function CanvasPanel() {
    const { closePanel, getActiveDocument, updateDocument } = useCanvasStore();
    const activeDoc = getActiveDocument();

    const [mode, setMode] = useState<'preview' | 'edit'>('preview');

    const content = activeDoc?.content ?? "# Canvas Document\n\nEdit this document and see the markdown rendered in real-time.";

    const handleContentChange = (value: string) => {
        if (activeDoc) {
            updateDocument(activeDoc.id, { content: value });
        }
    };

    return (
        <div className="flex flex-col h-full bg-[hsl(var(--card))] relative shadow-xl z-20">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card)/0.5)] backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <Code className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                        {activeDoc?.title ?? 'Artifact Canvas'}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex bg-[hsl(var(--secondary))] p-1 rounded-lg">
                        <button
                            onClick={() => setMode('preview')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${mode === 'preview' ? 'bg-[hsl(var(--background))] shadow-sm text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}
                        >
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                        </button>
                        <button
                            onClick={() => setMode('edit')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${mode === 'edit' ? 'bg-[hsl(var(--background))] shadow-sm text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}
                        >
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit
                        </button>
                    </div>

                    <button
                        onClick={closePanel}
                        className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-[hsl(var(--background)/0.5)]">
                {mode === 'preview' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {content}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <textarea
                        value={content}
                        onChange={(e) => handleContentChange(e.target.value)}
                        className="w-full h-full min-h-[500px] bg-transparent resize-none focus:outline-none text-sm font-mono text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground)/0.5)]"
                        placeholder="Type markdown here..."
                        spellCheck={false}
                    />
                )}
            </div>
        </div>
    );
}
