import { useState } from "react";
import { usePersonasStore, useSettingsStore } from "@/stores";

export function PersonaSettings() {
    const { personas, createPersona, deletePersona, updatePersona } = usePersonasStore();
    const { models } = useSettingsStore();

    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        icon: "🤖",
        systemPrompt: "",
        voiceId: "",
        preferredModelId: "",
    });

    const resetForm = () => {
        setFormData({
            name: "",
            description: "",
            icon: "🤖",
            systemPrompt: "",
            voiceId: "",
            preferredModelId: "",
        });
        setIsCreating(false);
        setEditingId(null);
    };

    const mapPersonaToForm = (persona: any) => ({
        name: persona.name,
        description: persona.description,
        icon: persona.icon || "🤖",
        systemPrompt: persona.systemPrompt,
        voiceId: persona.voiceId,
        preferredModelId: persona.preferredModelId || "",
    });

    const handleEdit = (persona: any) => {
        setFormData(mapPersonaToForm(persona));
        setEditingId(persona.id);
        setIsCreating(true);
    };

    const handleSave = () => {
        if (editingId) {
            updatePersona(editingId, formData);
        } else {
            createPersona({
                ...formData,
                knowledgeBaseIds: [],
                temperature: 0.7,
                maxTokens: 2048,
            });
        }
        resetForm();
    };

    if (isCreating) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-medium">
                        {editingId ? "Edit Persona" : "Create Persona"}
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
                            placeholder="e.g. Code Reviewer"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium">Description</label>
                        <input
                            value={formData.description}
                            onChange={(e) =>
                                setFormData({ ...formData, description: e.target.value })
                            }
                            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm"
                            placeholder="Helps review code changes..."
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium">
                            System Prompt
                        </label>
                        <textarea
                            value={formData.systemPrompt}
                            onChange={(e) =>
                                setFormData({ ...formData, systemPrompt: e.target.value })
                            }
                            className="h-32 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm"
                            placeholder="You are an expert software engineer..."
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium">Voice ID</label>
                        <input
                            value={formData.voiceId}
                            onChange={(e) =>
                                setFormData({ ...formData, voiceId: e.target.value })
                            }
                            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm"
                            placeholder="e.g. en_US-hfc_female-medium"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium">Preferred Model</label>
                        <select
                            value={formData.preferredModelId}
                            onChange={(e) =>
                                setFormData({ ...formData, preferredModelId: e.target.value })
                            }
                            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm"
                        >
                            <option value="">Use Global Default</option>
                            {models.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={!formData.name}
                        className="w-full rounded-md bg-[hsl(var(--primary))] py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
                    >
                        Save Persona
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Manage your AI personas.
                </p>
                <button
                    onClick={() => setIsCreating(true)}
                    className="rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--primary-foreground))]"
                >
                    + New Persona
                </button>
            </div>

            <div className="space-y-2">
                {personas.map((persona) => (
                    <div
                        key={persona.id}
                        className="group flex flex-col gap-2 rounded-lg border border-[hsl(var(--border))] p-3 transition-colors hover:bg-[hsl(var(--accent)/0.5)]"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-sm">{persona.name}</h4>
                                    {persona.isBuiltIn && <span className="text-[10px] bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded text-[hsl(var(--muted-foreground))]">Built-in</span>}
                                </div>

                                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                    {persona.description}
                                </p>
                            </div>
                            <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                    onClick={() => handleEdit(persona)}
                                    className="rounded p-1Hover:bg-[hsl(var(--muted))]"
                                    title="Edit"
                                >
                                    <EditIcon />
                                </button>
                                {!persona.isBuiltIn && (
                                    <button
                                        onClick={() => deletePersona(persona.id)}
                                        className="rounded p-1 text-red-500 hover:bg-red-500/10"
                                        title="Delete"
                                    >
                                        <TrashIcon />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
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
