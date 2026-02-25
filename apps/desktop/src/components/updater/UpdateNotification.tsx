import { useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type UpdateState =
  | { status: "idle" }
  | { status: "available"; version: string; notes: string | null }
  | { status: "downloading"; progress: number }
  | { status: "ready" }
  | { status: "error"; message: string };

export function UpdateNotification() {
  const [update, setUpdate] = useState<UpdateState>({ status: "idle" });

  useEffect(() => {
    // Check for updates 3 seconds after launch (non-blocking)
    const timer = setTimeout(async () => {
      try {
        const result = await check();
        if (result?.available) {
          setUpdate({
            status: "available",
            version: result.version,
            notes: result.body ?? null,
          });
        }
      } catch {
        // Silently ignore — network offline or endpoint unreachable
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleInstall = async () => {
    if (update.status !== "available") return;
    const version = update.version;
    const notes = update.notes;

    try {
      const result = await check();
      if (!result?.available) return;

      setUpdate({ status: "downloading", progress: 0 });

      await result.downloadAndInstall((event) => {
        if (event.event === "Progress") {
          // The plugin types only guarantee chunkLength; contentLength is optional at runtime
          const data = event.data as { chunkLength: number; contentLength?: number };
          const pct = data.contentLength
            ? Math.round((data.chunkLength / data.contentLength) * 100)
            : 0;
          setUpdate({ status: "downloading", progress: pct });
        } else if (event.event === "Finished") {
          setUpdate({ status: "ready" });
        }
      });

      void version; void notes;
    } catch (e) {
      setUpdate({ status: "error", message: String(e) });
    }
  };

  const handleRelaunch = async () => {
    await relaunch();
  };

  if (update.status === "idle") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full shadow-xl rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] p-4 animate-in slide-in-from-bottom-4">
      {update.status === "available" && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Update available — v{update.version}</p>
              {update.notes && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 line-clamp-2">
                  {update.notes}
                </p>
              )}
            </div>
            <button
              onClick={() => setUpdate({ status: "idle" })}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] shrink-0"
            >
              ✕
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="flex-1 py-1.5 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-xs font-medium hover:opacity-90 transition-opacity"
            >
              Install &amp; Relaunch
            </button>
            <button
              onClick={() => setUpdate({ status: "idle" })}
              className="py-1.5 px-3 rounded-lg text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
            >
              Later
            </button>
          </div>
        </>
      )}

      {update.status === "downloading" && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Downloading update…</p>
          <div className="w-full h-1.5 rounded-full bg-[hsl(var(--secondary))] overflow-hidden">
            <div
              className="h-full rounded-full bg-[hsl(var(--primary))] transition-all duration-300"
              style={{ width: `${update.progress}%` }}
            />
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{update.progress}%</p>
        </div>
      )}

      {update.status === "ready" && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">Update ready to install</p>
          <button
            onClick={handleRelaunch}
            className="w-full py-1.5 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Relaunch now
          </button>
        </div>
      )}

      {update.status === "error" && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-red-500">Update failed</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{update.message}</p>
          <button
            onClick={() => setUpdate({ status: "idle" })}
            className="text-xs text-[hsl(var(--muted-foreground))] hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
