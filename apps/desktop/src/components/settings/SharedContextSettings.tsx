import { useState } from "react";
import { useChatStore } from "@/stores";

export function SharedContextSettings() {
    const { contexts, createContext, deleteContext, updateContext } = useChatStore();

    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        content: "",
    });

    const resetForm = () => {
        setFormData({ name: "", content: "" });
        setIsCreating(false);
        setEditingId(null);
    };

    const mapContextToForm = (ctx: any) => ({
        name: ctx.name,
        content: ctx.content,
    });

    const handleEdit = (ctx: any) => {
        setFormData(mapContextToForm(ctx));
        setEditingId(ctx.id);
        setIsCreating(true);
    };

    const handleSave = () => {
        if (editingId) {
            updateContext(editingId, {
                name: formData.name,
                content: formData.content,
                updatedAt: new Date()
            });
        } else {
            createContext(formData.name, formData.content);
        }
        resetForm();
    };

    if (isCreating) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-medium">
                        {editingId ? "Edit Context" : "Add Shared Context"}
                    </h3>
                    <button
                        onClick={resetForm}
                        className="text-xs text-[hsl(var(--muted-foreground))] hover:underline"
                    >
                        Cancel
                    </button>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="mb-1 block text-xs font-medium">Name</label>
                        <input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm"
                            placeholder="e.g. My Bio"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium">Content (Markdown)</label>
                        <textarea
                            value={formData.content}
                            onChange={(e) =>
                                setFormData({ ...formData, content: e.target.value })
                            }
                            className="h-48 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm font-mono"
                            placeholder="# Bio&#10;I am a software engineer..."
                        />
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={!formData.name}
                        className="w-full rounded-md bg-[hsl(var(--primary))] py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
                    >
                        Save Context
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Shared context available to all personas.
                </p>
                <button
                    onClick={() => setIsCreating(true)}
                    className="rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--primary-foreground))]"
                >
                    + Add Context
                </button>
            </div>

            <div className="space-y-2">
                {contexts.map((ctx) => (
                    <div
                        key={ctx.id}
                        className="group flex flex-col gap-2 rounded-lg border border-[hsl(var(--border))] p-3 transition-colors hover:bg-[hsl(var(--accent)/0.5)]"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <h4 className="font-medium text-sm">{ctx.name}</h4>
                                <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 mt-1">
                                    {ctx.content}
                                </p>
                                <span className="text-[10px] text-[hsl(var(--muted-foreground))] mt-2 block">
                                    {ctx.tokenCount} tokens
                                </span>
                            </div>
                            <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                    onClick={() => handleEdit(ctx)}
                                    className="rounded p-1 hover:bg-[hsl(var(--muted))]"
                                    title="Edit"
                                >
                                    <EditIcon />
                                </button>
                                <button
                                    onClick={() => deleteContext(ctx.id)}
                                    className="rounded p-1 text-red-500 hover:bg-red-500/10"
                                    title="Delete"
                                >
                                    <TrashIcon />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                {contexts.length === 0 && (
                    <div className="text-center py-6 text-sm text-[hsl(var(--muted-foreground))]">
                        No shared contexts yet.
                    </div>
                )}
            </div>
        </div>
    );
}

function EditIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        </svg>
    )
}

function TrashIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
    );
}
