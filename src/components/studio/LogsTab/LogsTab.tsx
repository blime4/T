import { useRef, useEffect, useMemo } from 'react';
import { useServerLogStore } from '@/stores/studio/serverLogStore';

/**
 * LogsTab — terminal-style server log viewer.
 */
export function LogsTab() {
  const allLogs = useServerLogStore((s) => s.logs);
  const filter = useServerLogStore((s) => s.filter);
  const isAutoScroll = useServerLogStore((s) => s.isAutoScroll);
  const setFilter = useServerLogStore((s) => s.setFilter);
  const setAutoScroll = useServerLogStore((s) => s.setAutoScroll);
  const clearLogs = useServerLogStore((s) => s.clearLogs);

  const logs = useMemo(() => {
    if (!filter) return allLogs;
    const lower = filter.toLowerCase();
    return allLogs.filter(
      (log) =>
        log.message.toLowerCase().includes(lower) ||
        log.level.toLowerCase().includes(lower),
    );
  }, [allLogs, filter]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAutoScroll && bottomRef.current) {
      bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }
  }, [logs.length, isAutoScroll]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, padding: 8, alignItems: 'center' }}>
        <input
          placeholder="Filter logs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ flex: 1 }}
        />
        <label>
          <input
            type="checkbox"
            checked={isAutoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            aria-label="Auto-scroll"
          />
          Auto-scroll
        </label>
        <button onClick={clearLogs}>Clear</button>
      </div>

      {/* Log area */}
      <div style={{ flex: 1, overflow: 'auto', fontFamily: 'monospace', fontSize: 12, padding: 8 }}>
        {logs.length === 0 ? (
          <div>No logs yet.</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} style={{ whiteSpace: 'pre-wrap' }}>
              <span>{log.level}</span>{' '}
              <span>{log.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
