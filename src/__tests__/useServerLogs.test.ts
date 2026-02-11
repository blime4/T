import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { listen } from '@tauri-apps/api/event';
import { useServerLogs } from '@/lib/hooks/useServerLogs';
import { useServerLogStore } from '@/stores/studio/serverLogStore';

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  useServerLogStore.setState({ logs: [], nextId: 1, isAutoScroll: true, filter: '' });
});

describe('useServerLogs', () => {
  it('should call listen("server-log") on mount', () => {
    renderHook(() => useServerLogs());
    expect(listen).toHaveBeenCalledWith('server-log', expect.any(Function));
  });

  it('should call unlisten on unmount', async () => {
    const mockUnlisten = vi.fn();
    vi.mocked(listen).mockResolvedValueOnce(mockUnlisten);

    const { unmount } = renderHook(() => useServerLogs());
    // Wait for the listen promise to resolve
    await vi.waitFor(() => {
      expect(listen).toHaveBeenCalled();
    });

    unmount();
    await vi.waitFor(() => {
      expect(mockUnlisten).toHaveBeenCalled();
    });
  });

  it('should add a log entry when a server-log event fires', async () => {
    let capturedHandler: ((event: unknown) => void) | undefined;
    vi.mocked(listen).mockImplementationOnce(async (_event, handler) => {
      capturedHandler = handler;
      return vi.fn();
    });

    renderHook(() => useServerLogs());

    await vi.waitFor(() => {
      expect(capturedHandler).toBeDefined();
    });

    // Simulate Tauri event
    capturedHandler!({
      payload: {
        timestamp: 1000,
        level: 'info',
        message: 'Server started',
        source: 'stdout',
      },
    });

    const { logs } = useServerLogStore.getState();
    expect(logs).toHaveLength(1);
    expect(logs[0].message).toBe('Server started');
    expect(logs[0].level).toBe('info');
  });
});
