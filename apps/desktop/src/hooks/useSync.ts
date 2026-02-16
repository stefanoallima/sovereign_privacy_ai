import { useEffect, useRef, useCallback, useState } from "react";
import { useAuthStore } from "@/stores";
import { syncService, type SyncResult } from "@/services/sync";
import { useOnlineStatus } from "./useOnlineStatus";
import { isSupabaseConfigured } from "@/lib/supabase";

const SYNC_INTERVAL_MS = 30000; // 30 seconds

export function useSync() {
  const { user, isOfflineMode } = useAuthStore();
  const { isOnline, wasOffline, clearWasOffline } = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initialSyncDone = useRef(false);

  const performSync = useCallback(async () => {
    if (!user || isOfflineMode || !isOnline || !isSupabaseConfigured()) {
      return;
    }

    if (syncService.getIsSyncing()) {
      return; // Already syncing
    }

    setIsSyncing(true);
    try {
      const result = await syncService.sync(user.id);
      setLastSyncResult(result);

      if (result.errors.length > 0) {
        console.warn("Sync completed with errors:", result.errors);
      } else {
      }
    } catch (error) {
      console.error("Sync failed:", error);
      setLastSyncResult({
        success: false,
        pushed: 0,
        pulled: 0,
        errors: [error instanceof Error ? error.message : "Unknown sync error"],
      });
    } finally {
      setIsSyncing(false);
    }
  }, [user, isOfflineMode, isOnline]);

  // Initial sync on login
  useEffect(() => {
    if (user && !isOfflineMode && isOnline && !initialSyncDone.current) {
      initialSyncDone.current = true;
      performSync();
    }

    // Reset initial sync flag when user logs out
    if (!user) {
      initialSyncDone.current = false;
    }
  }, [user, isOfflineMode, isOnline, performSync]);

  // Sync when coming back online
  useEffect(() => {
    if (wasOffline && isOnline && user && !isOfflineMode) {
      performSync();
      clearWasOffline();
    }
  }, [wasOffline, isOnline, user, isOfflineMode, performSync, clearWasOffline]);

  // Periodic sync
  useEffect(() => {
    if (!user || isOfflineMode || !isOnline) {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      return;
    }

    syncIntervalRef.current = setInterval(performSync, SYNC_INTERVAL_MS);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [user, isOfflineMode, isOnline, performSync]);

  // Manual sync trigger
  const triggerSync = useCallback(() => {
    if (user && !isOfflineMode && isOnline) {
      performSync();
    }
  }, [user, isOfflineMode, isOnline, performSync]);

  return {
    isSyncing,
    isOnline,
    lastSyncResult,
    lastSyncAt: syncService.getLastSyncAt(),
    triggerSync,
  };
}
