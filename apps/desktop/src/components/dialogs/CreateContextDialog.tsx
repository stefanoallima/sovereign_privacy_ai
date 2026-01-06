import { useState } from "react";
import { useChatStore } from "@/stores";

interface CreateContextDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateContextDialog({ isOpen, onClose }: CreateContextDialogProps) {
  const { createContext } = useChatStore();

  const [name, setName] = useState("");
  const [content, setContent] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;

    createContext(name.trim(), content.trim());

    // Reset form
    setName("");
    setContent("");
    onClose();
  };

  const tokenEstimate = Math.ceil(content.length / 4);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-[hsl(var(--card))] shadow-xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
            <h2 className="text-lg font-semibold">Add Personal Context</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 hover:bg-[hsl(var(--accent))]"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-4 p-6">
            <div>
              <label className="mb-1 block text-sm font-medium">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., My Background, Goals 2024, Health History"
                className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Content *</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write personal context that will be included in conversations when this context is selected. This could include your background, goals, preferences, or any relevant information..."
                rows={10}
                className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                required
              />
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Estimated tokens: ~{tokenEstimate}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-[hsl(var(--border))] px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm hover:bg-[hsl(var(--accent))]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !content.trim()}
              className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))] disabled:opacity-50"
            >
              Add Context
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
