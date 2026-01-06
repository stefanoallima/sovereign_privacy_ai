import { useState } from "react";
// import { useKnowledgeStore } from "@/stores"; // TODO: Implement Knowledge Store

export function KnowledgeBaseSettings() {
    // Placeholder state until store is implemented
    const [knowledgeBases] = useState<any[]>([
        { id: "1", name: "CBT Techniques", documentCount: 12, totalChunks: 450 },
        { id: "2", name: "Project Specs", documentCount: 5, totalChunks: 120 },
    ]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Manage document collections for RAG.
                </p>
                <button
                    className="rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--primary-foreground))]"
                >
                    + New Collection
                </button>
            </div>

            <div className="space-y-2">
                {knowledgeBases.map((kb) => (
                    <div
                        key={kb.id}
                        className="group flex items-center justify-between rounded-lg border border-[hsl(var(--border))] p-3 transition-colors hover:bg-[hsl(var(--accent)/0.5)]"
                    >
                        <div>
                            <h4 className="font-medium text-sm">{kb.name}</h4>
                            <div className="flex gap-3 mt-1">
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">{kb.documentCount} documents</span>
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">{kb.totalChunks} chunks</span>
                            </div>
                        </div>

                        <button
                            className="opacity-0 group-hover:opacity-100 rounded-md border border-[hsl(var(--border))] px-2 py-1 text-xs hover:bg-[hsl(var(--background))]"
                        >
                            Manage Files
                        </button>
                    </div>
                ))}
            </div>

            <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-8 text-center">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Drag and drop files here to upload to a new collection
                </p>
            </div>
        </div>
    );
}
