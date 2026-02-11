import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { ServerLogPayload } from '@/lib/types/serverLog';
import { useServerLogStore } from '@/stores/studio/serverLogStore';

/**
 * Hook that listens to Tauri "server-log" events and feeds them into the store.
 * Call this once at the studio app level.
 */
export function useServerLogs() {
  const addLog = useServerLogStore((s) => s.addLog);

  useEffect(() => {
    let cancelled = false;
    const promise = listen<ServerLogPayload>('server-log', (event) => {
      if (!cancelled) {
        addLog(event.payload);
      }
    });

    return () => {
      cancelled = true;
      promise.then((unlisten) => unlisten());
    };
  }, [addLog]);
}
