import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import CatCharacter from "./components/CatCharacter";
import InputBubble from "./components/InputBubble";
import SpeechBubble from "./components/SpeechBubble";
import { useAppStore } from "./store/useAppStore";
import "./App.css";

// Auto-sleep after 3 minutes of idle
const IDLE_SLEEP_MS = 3 * 60 * 1000;

export default function App() {
  const fetchEngines = useAppStore((s) => s.fetchEngines);
  const showInput = useAppStore((s) => s.showInput);
  const showSpeech = useAppStore((s) => s.showSpeech);
  const toggleInput = useAppStore((s) => s.toggleInput);
  const speak = useAppStore((s) => s.speak);
  const setShowInput = useAppStore((s) => s.setShowInput);
  const catMood = useAppStore((s) => s.catMood);
  const setCatMood = useAppStore((s) => s.setCatMood);
  const playbackState = useAppStore((s) => s.playbackState);
  const clipboardMonitor = useAppStore((s) => s.clipboardMonitor);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch available engines on mount
  useEffect(() => {
    fetchEngines();
  }, [fetchEngines]);

  // Auto-sleep timer: if idle for IDLE_SLEEP_MS, switch to sleeping
  useEffect(() => {
    // Reset timer whenever mood or playback changes
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    // Only start sleep timer when truly idle
    if (catMood === "idle" && playbackState === "idle") {
      idleTimerRef.current = setTimeout(() => {
        const state = useAppStore.getState();
        if (state.catMood === "idle" && state.playbackState === "idle") {
          setCatMood("sleeping");
        }
      }, IDLE_SLEEP_MS);
    }

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [catMood, playbackState, setCatMood]);

  // Listen for backend events
  useEffect(() => {
    const unlisten: Array<() => void> = [];

    // Global hotkey: toggle input bubble
    listen("toggle-input", () => {
      toggleInput();
    }).then((fn) => unlisten.push(fn));

    // Global hotkey: read clipboard content aloud
    listen<string>("read-clipboard", (event) => {
      const text = event.payload;
      if (text && text.trim()) {
        speak(text);
      }
    }).then((fn) => unlisten.push(fn));

    // Clipboard monitor: new text detected
    listen<string>("clipboard-text", (event) => {
      const text = event.payload;
      if (text && text.trim()) {
        speak(text);
      }
    }).then((fn) => unlisten.push(fn));

    // Tray menu: open quick input
    listen("open-input", () => {
      setShowInput(true);
    }).then((fn) => unlisten.push(fn));

    return () => {
      unlisten.forEach((fn) => fn());
    };
  }, [toggleInput, speak, setShowInput]);

  return (
    <div className="app-root">
      {/* Drag region — covers empty space, but not interactive elements */}
      <div className="drag-region" data-tauri-drag-region />

      {/* Bubbles container — positioned above the cat */}
      <div className="bubble-area">
        {showInput && !showSpeech && <InputBubble />}
        {showSpeech && <SpeechBubble />}
      </div>

      {/* Cat character */}
      <div className="cat-area">
        <CatCharacter />
      </div>

      {/* Status bar */}
      <div className="status-bar glass" data-tauri-drag-region>
        <span className="label">
          {catMood === "speaking" && "🔊 "}
          {catMood === "listening" && "👂 "}
          {catMood === "sleeping" && "💤 "}
          {catMood === "happy" && "😊 "}
          {catMood === "idle" && "🐱 "}
          Neko TTS
        </span>
        {clipboardMonitor && <span className="status-badge">📋 Monitor</span>}
        {playbackState === "playing" && <span className="status-badge playing">▶ Playing</span>}
        {playbackState === "synthesizing" && <span className="status-badge synth">⏳ Synth</span>}
        {playbackState === "paused" && <span className="status-badge paused">⏸ Paused</span>}
      </div>
    </div>
  );
}
