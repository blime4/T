/** Log level emitted by the backend server process */
export type LogLevel = 'info' | 'warning' | 'error' | 'debug';

/** A single log entry from the server process */
export interface ServerLogEntry {
  id: number;
  timestamp: number; // epoch ms
  level: LogLevel;
  message: string;
  source: 'stdout' | 'stderr';
}

/** Payload shape for the Tauri "server-log" event */
export interface ServerLogPayload {
  level: LogLevel;
  message: string;
  source: 'stdout' | 'stderr';
}
