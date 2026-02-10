import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import CatCharacter from "./components/CatCharacter";
import InputBubble from "./components/InputBubble";
import SpeechBubble from "./components/SpeechBubble";
import { useAppStore } from "./store/useAppStore";
import "./App.css";

export default function App() {
  const fetchEngines = useAppStore((s) => s.fetchEngines);
  const showInput = useAppStore((s) => s.showInput);
  const showSpeech = useAppStore((s) => s.showSpeech);
  const toggleInput = useAppStore((s) => s.toggleInput);
  const speak = useAppStore((s) => s.speak);
  const setShowInput = useAppStore((s) => s.setShowInput);

  // Fetch available engines on mount
  useEffect(() => {
    fetchEngines();
  }, [fetchEngines]);

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
    <div className="app-root" data-tauri-drag-region>
      {/* Bubbles container — positioned above the cat */}
      <div className="bubble-area">
        {showInput && !showSpeech && <InputBubble />}
        {showSpeech && <SpeechBubble />}
      </div>

      {/* Cat character */}
      <div className="cat-area">
        <CatCharacter />
      </div>

      {/* Neko TTS label */}
      <div className="label">Neko TTS</div>
    </div>
  );
}
