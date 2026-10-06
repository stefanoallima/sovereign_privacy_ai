import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useSettingsStore } from "@/stores";
import {
  fetchEndpointModels,
  ModelDiscoveryError,
  type DiscoveryProvider,
} from "@/services/model-discovery";

const PROVIDER_LABEL: Record<DiscoveryProvider, string> = {
  nebius: "Nebius AI (cloud)",
  normattiva: "Normattiva Legal AI",
};

const inputClass =
  "w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]";

/**
 * Lets the user add models their endpoint serves without an app update: type a model id,
 * or fetch the endpoint's model list and tick the ones to add.
 */
export function AddModelPanel() {
  const { settings, models, normattivaModels, addCustomModel, addModelsFromIds } =
    useSettingsStore();

  const [provider, setProvider] = useState<DiscoveryProvider>("nebius");
  const [apiModelId, setApiModelId] = useState("");
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState<string[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  const apiKey = provider === "normattiva" ? settings.normattivaApiKey : settings.nebiusApiKey;
  const endpoint =
    provider === "normattiva" ? settings.normattivaApiEndpoint : settings.nebiusApiEndpoint;
  const existing = useMemo(
    () =>
      new Set(
        (provider === "normattiva" ? normattivaModels : models).map((m) => m.apiModelId)
      ),
    [provider, models, normattivaModels]
  );

  const resetFetch = () => {
    setFetched(null);
    setFetchError(null);
    setSelected(new Set());
    setFilter("");
  };

  const changeProvider = (p: DiscoveryProvider) => {
    setProvider(p);
    setNotice(null);
    resetFetch();
  };

  const handleAdd = () => {
    const id = apiModelId.trim();
    if (!id) return;
    if (existing.has(id)) {
      setNotice({ kind: "error", text: `"${id}" is already in the ${PROVIDER_LABEL[provider]} list.` });
      return;
    }
    addCustomModel({
      provider,
      apiModelId: id,
      name: name.trim() || (id.split("/").pop() ?? id),
      contextWindow: 128000,
      speedTier: "medium",
      intelligenceTier: "high",
      inputCostPer1M: 0,
      outputCostPer1M: 0,
      isEnabled: true,
      isDefault: false,
    });
    setNotice({ kind: "ok", text: `Added "${id}".` });
    setApiModelId("");
    setName("");
  };

  const handleFetch = async () => {
    setFetching(true);
    resetFetch();
    setNotice(null);
    try {
      setFetched(await fetchEndpointModels(endpoint, apiKey));
    } catch (e) {
      setFetchError(
        e instanceof ModelDiscoveryError ? e.message : "Couldn't fetch the model list."
      );
    } finally {
      setFetching(false);
    }
  };

  const visible = (fetched ?? []).filter((id) =>
    id.toLowerCase().includes(filter.trim().toLowerCase())
  );
  const selectable = visible.filter((id) => !existing.has(id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleAddSelected = () => {
    const n = addModelsFromIds(provider, [...selected]);
    setNotice({ kind: "ok", text: `Added ${n} model${n === 1 ? "" : "s"}.` });
    setSelected(new Set());
  };

  return (
    <section
      data-testid="add-model-panel"
      className="space-y-4 rounded-lg border border-[hsl(var(--border))] p-4"
    >
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          Add a model
        </h3>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          Use any model your endpoint serves. No app update needed when a new one appears.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium" htmlFor="add-model-provider">
          Provider
        </label>
        <select
          id="add-model-provider"
          data-testid="add-model-provider"
          value={provider}
          onChange={(e) => changeProvider(e.target.value as DiscoveryProvider)}
          className={inputClass}
        >
          {(Object.keys(PROVIDER_LABEL) as DiscoveryProvider[]).map((p) => (
            <option key={p} value={p}>
              {PROVIDER_LABEL[p]}
            </option>
          ))}
        </select>
        <p className="mt-1 break-all text-[11px] text-[hsl(var(--muted-foreground))]">
          Endpoint: <span className="font-mono">{endpoint || "not set"}</span>
        </p>
      </div>

      {/* Manual entry */}
      <div className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="add-model-id">
              Model id (as the API expects it)
            </label>
            <input
              id="add-model-id"
              data-testid="add-model-id"
              type="text"
              value={apiModelId}
              onChange={(e) => {
                setApiModelId(e.target.value);
                setNotice(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="e.g. meta-llama/Llama-3.3-70B-Instruct"
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="add-model-name">
              Display name (optional)
            </label>
            <input
              id="add-model-name"
              data-testid="add-model-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Defaults to the model id"
              className={inputClass}
            />
          </div>
        </div>
        <button
          data-testid="add-model-submit"
          onClick={handleAdd}
          disabled={!apiModelId.trim()}
          className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))] disabled:opacity-50"
        >
          Add model
        </button>
      </div>

      {/* Fetch from endpoint */}
      <div className="space-y-3 border-t border-[hsl(var(--border))] pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-[hsl(var(--muted-foreground))]">
            Or fetch the list your endpoint offers and pick from it.
          </div>
          <button
            data-testid="fetch-models"
            onClick={handleFetch}
            disabled={fetching || !apiKey.trim()}
            title={apiKey.trim() ? undefined : "Add the API key for this provider first"}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[hsl(var(--accent))] disabled:opacity-40"
          >
            <RefreshCw className={`h-3 w-3 ${fetching ? "animate-spin" : ""}`} />
            {fetching ? "Fetching…" : "Fetch models"}
          </button>
        </div>

        {!apiKey.trim() && (
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
            Add the {provider === "normattiva" ? "Normattiva" : "Nebius"} API key to enable
            fetching.
          </p>
        )}

        {fetchError && (
          <p data-testid="fetch-error" className="text-xs text-red-500">
            {fetchError}
          </p>
        )}

        {fetched && fetched.length === 0 && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            The endpoint returned no models.
          </p>
        )}

        {fetched && fetched.length > 0 && (
          <div className="space-y-2" data-testid="fetched-models">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={`Filter ${fetched.length} models`}
                className={inputClass}
              />
              <button
                onClick={() => setSelected(new Set(selectable))}
                className="flex-shrink-0 rounded-lg border border-[hsl(var(--border))] px-2 py-1.5 text-xs hover:bg-[hsl(var(--accent))]"
              >
                Select all
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="flex-shrink-0 rounded-lg border border-[hsl(var(--border))] px-2 py-1.5 text-xs hover:bg-[hsl(var(--accent))]"
              >
                None
              </button>
            </div>
            <div className="max-h-56 divide-y divide-[hsl(var(--border))] overflow-y-auto rounded-lg border border-[hsl(var(--border))]">
              {visible.map((id) => {
                const added = existing.has(id);
                return (
                  <label
                    key={id}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs ${
                      added ? "opacity-50" : "cursor-pointer hover:bg-[hsl(var(--accent))]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={added}
                      checked={selected.has(id)}
                      onChange={() => toggle(id)}
                    />
                    <span className="break-all font-mono">{id}</span>
                    {added && <span className="ml-auto flex-shrink-0">Added</span>}
                  </label>
                );
              })}
              {visible.length === 0 && (
                <div className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                  No models match "{filter}".
                </div>
              )}
            </div>
            <button
              data-testid="add-selected-models"
              onClick={handleAddSelected}
              disabled={selected.size === 0}
              className="w-full rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
            >
              Add selected ({selected.size})
            </button>
          </div>
        )}
      </div>

      {notice && (
        <p
          data-testid="add-model-notice"
          className={`text-xs ${notice.kind === "ok" ? "text-green-600" : "text-red-500"}`}
        >
          {notice.text}
        </p>
      )}
    </section>
  );
}
