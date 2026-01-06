import { useSettingsStore } from "@/stores";

export function AppearanceSettings() {
    const { settings, updateSettings } = useSettingsStore();

    return (
        <div className="space-y-6">
            <div>
                <label className="mb-2 block text-sm font-medium">Theme</label>
                <div className="flex gap-2">
                    {(["light", "dark", "system"] as const).map((theme) => (
                        <button
                            key={theme}
                            onClick={() => updateSettings({ theme })}
                            className={`flex-1 rounded-lg border px-4 py-2 text-sm capitalize ${settings.theme === theme
                                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                                    : "border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]"
                                }`}
                        >
                            {theme}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <div className="font-medium">Show Token Counts</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        Display token counts and cost estimates
                    </div>
                </div>
                <input
                    type="checkbox"
                    checked={settings.showTokenCounts}
                    onChange={(e) =>
                        updateSettings({ showTokenCounts: e.target.checked })
                    }
                    className="h-4 w-4 rounded"
                />
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <div className="font-medium">Quick Model Selector</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        Show model selector in chat header
                    </div>
                </div>
                <input
                    type="checkbox"
                    checked={settings.showModelSelector}
                    onChange={(e) =>
                        updateSettings({ showModelSelector: e.target.checked })
                    }
                    className="h-4 w-4 rounded"
                />
            </div>
        </div>
    );
}
