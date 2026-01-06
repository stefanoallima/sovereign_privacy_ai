import { useSettingsStore } from "@/stores";

export function ModelSettings() {
    const { models, setDefaultModel, toggleModel } = useSettingsStore();

    return (
        <div className="space-y-4">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Select which models to show in the model selector.
            </p>
            {models.map((model) => (
                <div
                    key={model.id}
                    className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] p-4"
                >
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={model.isEnabled}
                            onChange={() => toggleModel(model.id)}
                            className="h-4 w-4 rounded"
                        />
                        <div>
                            <div className="font-medium">{model.name}</div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))]">
                                {model.contextWindow / 1000}K context • {model.speedTier}{" "}
                                • ${model.inputCostPer1M}/1M tokens
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setDefaultModel(model.id)}
                        className={`rounded px-3 py-1 text-xs ${model.isDefault
                                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                                : "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--accent))]"
                            }`}
                    >
                        {model.isDefault ? "Default" : "Set Default"}
                    </button>
                </div>
            ))}
        </div>
    );
}
