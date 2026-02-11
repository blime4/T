/**
 * Tauri v1 platform implementation for neko-tts studio window.
 * Provides concrete implementations of the Platform interfaces using Tauri APIs.
 */
import { invoke } from '@tauri-apps/api/tauri';
import { save } from '@tauri-apps/api/dialog';
import { writeBinaryFile } from '@tauri-apps/api/fs';
import { getVersion } from '@tauri-apps/api/app';
import type {
  Platform,
  PlatformFilesystem,
  PlatformUpdater,
  PlatformAudio,
  PlatformLifecycle,
  PlatformMetadata,
  UpdateStatus,
  AudioDevice,
  FileFilter,
} from './types';

// ---------------------------------------------------------------------------
// Filesystem
// ---------------------------------------------------------------------------
const filesystem: PlatformFilesystem = {
  async saveFile(filename: string, blob: Blob, filters?: FileFilter[]) {
    const filePath = await save({
      defaultPath: filename,
      filters: filters?.map((f) => ({ name: f.name, extensions: f.extensions })),
    });
    if (!filePath) return; // user cancelled
    const arrayBuffer = await blob.arrayBuffer();
    await writeBinaryFile(filePath, new Uint8Array(arrayBuffer));
  },
};

// ---------------------------------------------------------------------------
// Updater  (stub – neko-tts doesn't ship auto-update yet)
// ---------------------------------------------------------------------------
const defaultUpdateStatus: UpdateStatus = {
  checking: false,
  available: false,
  downloading: false,
  installing: false,
  readyToInstall: false,
};

const updater: PlatformUpdater = {
  async checkForUpdates() {
    /* no-op */
  },
  async downloadAndInstall() {
    /* no-op */
  },
  async restartAndInstall() {
    /* no-op */
  },
  getStatus() {
    return { ...defaultUpdateStatus };
  },
  subscribe(_callback: (status: UpdateStatus) => void) {
    // nothing to subscribe to
    return () => {};
  },
};

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------
const audio: PlatformAudio = {
  isSystemAudioSupported() {
    return true;
  },
  async startSystemAudioCapture(maxDurationSecs: number) {
    await invoke('start_system_audio_capture', { maxDurationSecs });
  },
  async stopSystemAudioCapture(): Promise<Blob> {
    const bytes: number[] = await invoke('stop_system_audio_capture');
    return new Blob([new Uint8Array(bytes)], { type: 'audio/wav' });
  },
  async listOutputDevices(): Promise<AudioDevice[]> {
    try {
      return await invoke<AudioDevice[]>('list_output_devices');
    } catch {
      return [];
    }
  },
  async playToDevices(audioData: Uint8Array, deviceIds: string[]) {
    await invoke('play_to_devices', { audioData: Array.from(audioData), deviceIds });
  },
  stopPlayback() {
    invoke('stop_playback').catch(console.error);
  },
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
const lifecycle: PlatformLifecycle = {
  async startServer(remote?: boolean) {
    return invoke<string>('start_server', { remote: remote ?? false });
  },
  async stopServer() {
    await invoke('stop_server');
  },
  async setKeepServerRunning(keep: boolean) {
    await invoke('set_keep_server_running', { keep });
  },
  async setupWindowCloseHandler() {
    // handled by Tauri window config / Rust side
  },
};

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------
const metadata: PlatformMetadata = {
  async getVersion() {
    try {
      return await getVersion();
    } catch {
      return '0.0.0';
    }
  },
  isTauri: true,
};

// ---------------------------------------------------------------------------
// Assembled platform
// ---------------------------------------------------------------------------
export const tauriPlatform: Platform = {
  filesystem,
  updater,
  audio,
  lifecycle,
  metadata,
};
