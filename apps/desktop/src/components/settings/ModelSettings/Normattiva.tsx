/**
 * Normattiva ModelSettings stub.
 *
 * The Normattiva build uses the dedicated Normattiva NLP cloud service and
 * has no local models to download. The Models tab in the settings dialog
 * is hidden entirely on the Normattiva build (see SettingsDialog.tsx), so
 * this component is effectively unreachable — but it is exported under the
 * same name as the Sovereign component so SettingsDialog can import it
 * uniformly.
 */
export function ModelSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Models</h3>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          This build uses the Normattiva NLP cloud service. Local model management is not available.
        </p>
      </div>
    </div>
  );
}
