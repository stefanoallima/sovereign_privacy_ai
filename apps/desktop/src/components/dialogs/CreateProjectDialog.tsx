import { useState } from "react";
import { useChatStore } from "@/stores";

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROJECT_COLORS = [
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#22C55E", // green
  "#14B8A6", // teal
  "#3B82F6", // blue
  "#8B5CF6", // purple
  "#EC4899", // pink
];

export function CreateProjectDialog({ isOpen, onClose }: CreateProjectDialogProps) {
  const { createProject } = useChatStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createProject(name.trim(), description.trim(), color);

    // Reset form
    setName("");
    setDescription("");
    setColor(PROJECT_COLORS[0]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-[hsl(var(--card))] shadow-xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
            <h2 className="text-lg font-semibold">Create Project</h2>
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
                placeholder="e.g., Personal Growth, Career 2024, Health Journey"
                className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project about?"
                rows={3}
                className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Color</label>
              <div className="flex gap-2">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-8 w-8 rounded-full transition-transform ${
                      color === c ? "scale-110 ring-2 ring-offset-2 ring-[hsl(var(--ring))]" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
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
              disabled={!name.trim()}
              className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))] disabled:opacity-50"
            >
              Create
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
