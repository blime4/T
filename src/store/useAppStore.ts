import { create } from "zustand";
import { invoke } from "@tauri-apps/api/tauri";

export type PlaybackState =
  | "idle"
  | "synthesizing"
  | "playing"
  | "paused"
  | "error";

export type CatMood = "idle" | "speaking" | "listening" | "sleeping" | "happy";

interface AppState {
  // ─── Cat state ──────────────────────────────
  catMood: CatMood;
  setCatMood: (mood: CatMood) => void;
  triggerHappy: () => void;
  isHovering: boolean;
  setIsHovering: (hovering: boolean) => void;

  // ─── Input ──────────────────────────────────
  inputText: string;
  setInputText: (text: string) => void;
  showInput: boolean;
  setShowInput: (show: boolean) => void;

  // ─── Speech bubble ──────────────────────────
  speechText: string;
  setSpeechText: (text: string) => void;
  showSpeech: boolean;
  setShowSpeech: (show: boolean) => void;

  // ─── Playback ───────────────────────────────
  playbackState: PlaybackState;
  setPlaybackState: (state: PlaybackState) => void;

  // ─── Engine ─────────────────────────────────
  activeEngine: string;
  setActiveEngine: (engine: string) => void;
  availableEngines: string[];
  setAvailableEngines: (engines: string[]) => void;

  // ─── Clipboard monitor ────────────────────
  clipboardMonitor: boolean;
  setClipboardMonitor: (enabled: boolean) => void;
  toggleClipboardMonitor: () => Promise<void>;

  // ─── Actions ────────────────────────────────
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => Promise<void>;
  toggleInput: () => void;
  fetchEngines: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // ─── Cat state ──────────────────────────────
  catMood: "idle",
  setCatMood: (mood) => set({ catMood: mood }),
  triggerHappy: () => {
    const currentMood = get().catMood;
    set({ catMood: "happy" });
    setTimeout(() => {
      const state = get();
      if (state.catMood === "happy") {
        set({ catMood: currentMood === "happy" ? "idle" : currentMood });
      }
    }, 2000);
  },
  isHovering: false,
  setIsHovering: (hovering) => set({ isHovering: hovering }),

  // ─── Input ──────────────────────────────────
  inputText: "",
  setInputText: (text) => set({ inputText: text }),
  showInput: false,
  setShowInput: (show) => set({ showInput: show }),

  // ─── Speech bubble ──────────────────────────
  speechText: "",
  setSpeechText: (text) => set({ speechText: text }),
  showSpeech: false,
  setShowSpeech: (show) => set({ showSpeech: show }),

  // ─── Playback ───────────────────────────────
  playbackState: "idle",
  setPlaybackState: (state) => set({ playbackState: state }),

  // ─── Engine ─────────────────────────────────
  activeEngine: "system",
  setActiveEngine: (engine) => set({ activeEngine: engine }),
  availableEngines: [],
  setAvailableEngines: (engines) => set({ availableEngines: engines }),

  // ─── Clipboard monitor ────────────────────
  clipboardMonitor: false,
  setClipboardMonitor: (enabled) => set({ clipboardMonitor: enabled }),
  toggleClipboardMonitor: async () => {
    try {
      const result = await invoke<boolean>("toggle_clipboard_monitor");
      set({ clipboardMonitor: result });
    } catch (e) {
      console.error("Failed to toggle clipboard monitor:", e);
    }
  },

  // ─── Actions ────────────────────────────────
  speak: async (text: string) => {
    if (!text.trim()) return;

    const { activeEngine } = get();
    set({
      speechText: text,
      showSpeech: true,
      catMood: "speaking",
      playbackState: "synthesizing",
      showInput: false,
    });

    try {
      await invoke("speak", { text, engine: activeEngine });
      set({ playbackState: "playing" });

      // Auto-hide speech bubble after estimated duration
      const duration = Math.max(2000, text.length * 100);
      setTimeout(() => {
        const state = get();
        if (state.catMood === "speaking") {
          // Show happy mood briefly after successful speak
          set({ catMood: "happy" });
          setTimeout(() => {
            const currentState = get();
            if (currentState.catMood === "happy") {
              set({
                catMood: "idle",
                playbackState: "idle",
                showSpeech: false,
              });
            }
          }, 1500);
        }
      }, duration);
    } catch (e) {
      console.error("TTS error:", e);
      set({
        catMood: "idle",
        playbackState: "error",
      });
      // Hide error state after 2s
      setTimeout(() => {
        set({ showSpeech: false, playbackState: "idle" });
      }, 2000);
    }
  },

  stopSpeaking: async () => {
    try {
      await invoke("stop_speaking");
    } catch (e) {
      console.error("Stop error:", e);
    }
    set({
      catMood: "idle",
      playbackState: "idle",
      showSpeech: false,
    });
  },

  toggleInput: () => {
    const { showInput } = get();
    set({ showInput: !showInput });
  },

  fetchEngines: async () => {
    try {
      const engines = await invoke<string[]>("get_available_engines");
      set({
        availableEngines: engines.map((e) => e.toLowerCase()),
      });
    } catch (e) {
      console.error("Failed to fetch engines:", e);
    }
  },
}));
