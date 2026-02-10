import { useState, useRef, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";

export default function InputBubble() {
  const showInput = useAppStore((s) => s.showInput);
  const speak = useAppStore((s) => s.speak);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInput]);

  if (!showInput) return null;

  const handleSubmit = () => {
    if (text.trim()) {
      speak(text.trim());
      setText("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      useAppStore.getState().setShowInput(false);
      setText("");
    }
  };

  return (
    <div className="input-bubble" onClick={(e) => e.stopPropagation()}>
      <div className="speech-bubble-tail" />
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type something to say... ✨"
        rows={2}
        className="input-bubble-textarea"
      />
      <div className="input-bubble-actions">
        <button
          className="btn-cancel"
          onClick={() => {
            useAppStore.getState().setShowInput(false);
            setText("");
          }}
        >
          Cancel
        </button>
        <button
          className="btn-speak"
          onClick={handleSubmit}
          disabled={!text.trim()}
        >
          🔊 Speak
        </button>
      </div>
    </div>
  );
}
