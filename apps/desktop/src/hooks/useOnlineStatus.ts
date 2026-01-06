import { useState, useEffect, useCallback } from "react";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);

  const handleOnline = useCallback(() => {
    if (!isOnline) {
      setWasOffline(true);
    }
    setIsOnline(true);
  }, [isOnline]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
  }, []);

  const clearWasOffline = useCallback(() => {
    setWasOffline(false);
  }, []);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return {
    isOnline,
    wasOffline,
    clearWasOffline,
  };
}
