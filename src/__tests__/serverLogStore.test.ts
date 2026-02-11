import { describe, it, expect, beforeEach } from 'vitest';
import { useServerLogStore } from '@/stores/studio/serverLogStore';

// Reset store between tests
beforeEach(() => {
  useServerLogStore.setState({
    logs: [],
    nextId: 1,
    isAutoScroll: true,
    filter: '',
  });
});

describe('serverLogStore', () => {
  describe('addLog', () => {
    it('should add a log entry with auto-incremented id', () => {
      const { addLog } = useServerLogStore.getState();
      addLog({ timestamp: 1000, level: 'info', message: 'hello', source: 'stdout' });

      const { logs } = useServerLogStore.getState();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual({
        id: 1,
        timestamp: 1000,
        level: 'info',
        message: 'hello',
        source: 'stdout',
      });
    });

    it('should auto-increment ids across multiple adds', () => {
      const { addLog } = useServerLogStore.getState();
      addLog({ timestamp: 1000, level: 'info', message: 'first', source: 'stdout' });
      addLog({ timestamp: 2000, level: 'error', message: 'second', source: 'stderr' });

      const { logs } = useServerLogStore.getState();
      expect(logs).toHaveLength(2);
      expect(logs[0].id).toBe(1);
      expect(logs[1].id).toBe(2);
    });

    it('should cap logs at MAX_LOG_ENTRIES (5000) by dropping oldest', () => {
      const { addLog } = useServerLogStore.getState();
      // Add 5001 entries
      for (let i = 0; i < 5001; i++) {
        addLog({ timestamp: i, level: 'info', message: `msg-${i}`, source: 'stdout' });
      }

      const { logs } = useServerLogStore.getState();
      expect(logs).toHaveLength(5000);
      // Oldest entry should have been dropped — first entry should be msg-1
      expect(logs[0].message).toBe('msg-1');
      expect(logs[logs.length - 1].message).toBe('msg-5000');
    });
  });

  describe('clearLogs', () => {
    it('should remove all logs and reset nextId', () => {
      const store = useServerLogStore.getState();
      store.addLog({ timestamp: 1000, level: 'info', message: 'hello', source: 'stdout' });
      store.clearLogs();

      const { logs, nextId } = useServerLogStore.getState();
      expect(logs).toHaveLength(0);
      expect(nextId).toBe(1);
    });
  });

  describe('setAutoScroll', () => {
    it('should toggle auto-scroll', () => {
      const store = useServerLogStore.getState();
      expect(store.isAutoScroll).toBe(true);

      store.setAutoScroll(false);
      expect(useServerLogStore.getState().isAutoScroll).toBe(false);

      store.setAutoScroll(true);
      expect(useServerLogStore.getState().isAutoScroll).toBe(true);
    });
  });

  describe('setFilter', () => {
    it('should update the filter string', () => {
      const store = useServerLogStore.getState();
      store.setFilter('error');
      expect(useServerLogStore.getState().filter).toBe('error');
    });
  });

  describe('filteredLogs', () => {
    it('should return all logs when filter is empty', () => {
      const store = useServerLogStore.getState();
      store.addLog({ timestamp: 1000, level: 'info', message: 'hello', source: 'stdout' });
      store.addLog({ timestamp: 2000, level: 'error', message: 'oops', source: 'stderr' });

      const filtered = useServerLogStore.getState().filteredLogs();
      expect(filtered).toHaveLength(2);
    });

    it('should filter logs by message substring (case-insensitive)', () => {
      const store = useServerLogStore.getState();
      store.addLog({ timestamp: 1000, level: 'info', message: 'Loading model...', source: 'stdout' });
      store.addLog({ timestamp: 2000, level: 'error', message: 'Connection failed', source: 'stderr' });
      store.addLog({ timestamp: 3000, level: 'info', message: 'Model loaded', source: 'stdout' });

      store.setFilter('model');
      const filtered = useServerLogStore.getState().filteredLogs();
      expect(filtered).toHaveLength(2);
      expect(filtered[0].message).toBe('Loading model...');
      expect(filtered[1].message).toBe('Model loaded');
    });

    it('should also match against log level', () => {
      const store = useServerLogStore.getState();
      store.addLog({ timestamp: 1000, level: 'info', message: 'hello', source: 'stdout' });
      store.addLog({ timestamp: 2000, level: 'error', message: 'oops', source: 'stderr' });

      store.setFilter('error');
      const filtered = useServerLogStore.getState().filteredLogs();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].level).toBe('error');
    });
  });
});
