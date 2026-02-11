import { useEffect, useState } from 'react';
import { usePlatform } from '@/platform/PlatformContext';
import { useServerStore } from '@/stores/studio/serverStore';
import { apiClient } from '@/lib/api/client';

type ConnectionState = 'idle' | 'starting' | 'connected' | 'error';

/**
 * Auto-starts the local server when the Studio window mounts,
 * then polls /health until the server is ready.
 */
export function useAutoConnect() {
  const platform = usePlatform();
  const mode = useServerStore((s) => s.mode);
  const setServerUrl = useServerStore((s) => s.setServerUrl);
  const setIsConnected = useServerStore((s) => s.setIsConnected);

  const [state, setState] = useState<ConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // For remote mode, just check health directly
    if (mode === 'remote') {
      checkHealth();
      return;
    }

    // Local mode: start server via Tauri command
    let cancelled = false;

    async function boot() {
      setState('starting');
      setError(null);

      try {
        // start_server returns the URL (e.g. "http://127.0.0.1:17493")
        const url = await platform.lifecycle.startServer();
        if (cancelled) return;

        setServerUrl(url);

        // Poll health until ready (server may still be loading models)
        await pollHealth(cancelled);
        if (cancelled) return;

        setIsConnected(true);
        setState('connected');
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setState('error');
        setIsConnected(false);
      }
    }

    boot();

    return () => {
      cancelled = true;
    };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function checkHealth() {
    setState('starting');
    try {
      await apiClient.getHealth();
      setIsConnected(true);
      setState('connected');
    } catch {
      setError('Cannot reach server');
      setState('error');
      setIsConnected(false);
    }
  }

  async function retry() {
    setState('idle');
    setError(null);
    // Re-trigger by toggling mode back (or just re-run boot)
    if (mode === 'remote') {
      await checkHealth();
    } else {
      try {
        setState('starting');
        const url = await platform.lifecycle.startServer();
        setServerUrl(url);
        await pollHealth(false);
        setIsConnected(true);
        setState('connected');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setState('error');
        setIsConnected(false);
      }
    }
  }

  return { state, error, retry };
}

/** Poll /health every 1s, up to 120s (model loading can be slow) */
async function pollHealth(cancelled: boolean): Promise<void> {
  const maxAttempts = 120;
  for (let i = 0; i < maxAttempts; i++) {
    if (cancelled) throw new Error('Cancelled');
    try {
      await apiClient.getHealth();
      return; // success
    } catch {
      await sleep(1000);
    }
  }
  throw new Error('Server did not become healthy within 120 seconds');
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
