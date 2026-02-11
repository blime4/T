import { create } from 'zustand';
import type { ServerLogEntry } from '@/lib/types/serverLog';

const MAX_LOG_ENTRIES = 5000;

interface ServerLogStore {
  logs: ServerLogEntry[];
  nextId: number;
  isAutoScroll: boolean;
  filter: string;

  addLog: (entry: Omit<ServerLogEntry, 'id'>) => void;
  clearLogs: () => void;
  setAutoScroll: (enabled: boolean) => void;
  setFilter: (filter: string) => void;
  filteredLogs: () => ServerLogEntry[];
}

export const useServerLogStore = create<ServerLogStore>()((set, get) => ({
  logs: [],
  nextId: 1,
  isAutoScroll: true,
  filter: '',

  addLog: (entry) =>
    set((state) => {
      const newEntry: ServerLogEntry = { ...entry, id: state.nextId };
      const logs = [...state.logs, newEntry];
      return {
        logs: logs.length > MAX_LOG_ENTRIES ? logs.slice(logs.length - MAX_LOG_ENTRIES) : logs,
        nextId: state.nextId + 1,
      };
    }),

  clearLogs: () => set({ logs: [], nextId: 1 }),

  setAutoScroll: (enabled) => set({ isAutoScroll: enabled }),

  setFilter: (filter) => set({ filter }),

  filteredLogs: () => {
    const { logs, filter } = get();
    if (!filter) return logs;
    const lower = filter.toLowerCase();
    return logs.filter(
      (log) =>
        log.message.toLowerCase().includes(lower) ||
        log.level.toLowerCase().includes(lower),
    );
  },
}));
