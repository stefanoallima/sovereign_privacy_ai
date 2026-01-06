import { useState } from "react";
import { usePersonasStore, useSettingsStore } from "@/stores";

interface CreatePersonaDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePersonaDialog({ isOpen, onClose }: CreatePersonaDialogProps) {
  const { createPersona } = usePersonasStore();
  const { models } = useSettingsStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [preferredModelId, setPreferredModelId] = useState("qwen3-32b-fast");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !systemPrompt.trim()) return;

    createPersona({
      name: name.trim(),
      description: description.trim(),
      icon: "🤖",
      systemPrompt: systemPrompt.trim(),
      voiceId: "en_US-lessac-medium",
      preferredModelId,
      knowledgeBaseIds: [],
      temperature,
      maxTokens,
    });

    // Reset form
    setName("");
    setDescription("");
    setSystemPrompt("");
    setTemperature(0.7);
    setMaxTokens(2000);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-[hsl(var(--card))] shadow-xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
            <h2 className="text-lg font-semibold">Create Persona</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 hover:bg-[hsl(var(--accent))]"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[60vh] space-y-4 overflow-y-auto p-6">
            <div>
              <label className="mb-1 block text-sm font-medium">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Financial Advisor"
                className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description of this persona"
                className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">System Prompt *</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Describe the persona's role, expertise, and how they should respond..."
                rows={6}
                className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Temperature ({temperature})
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Lower = more focused, Higher = more creative
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Max Tokens</label>
                <input
                  type="number"
                  min="100"
                  max="8000"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                  className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Preferred Model</label>
              <select
                value={preferredModelId}
                onChange={(e) => setPreferredModelId(e.target.value)}
                className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.contextWindow / 1000}K context)
                  </option>
                ))}
              </select>
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
              disabled={!name.trim() || !systemPrompt.trim()}
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
