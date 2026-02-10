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
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(255, 255, 255, 0.95)",
        borderRadius: 16,
        padding: "10px 12px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        minWidth: 200,
        maxWidth: 280,
        animation: "bubbleIn 0.2s ease-out",
        zIndex: 10,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Speech bubble tail */}
      <div
        style={{
          position: "absolute",
          bottom: -8,
          left: "50%",
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderTop: "8px solid rgba(255, 255, 255, 0.95)",
        }}
      />
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type something to say..."
        rows={2}
        style={{
          width: "100%",
          border: "none",
          outline: "none",
          resize: "none",
          fontSize: 13,
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          background: "transparent",
          color: "#333",
          lineHeight: 1.4,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 6,
          marginTop: 6,
        }}
      >
        <button
          onClick={() => {
            useAppStore.getState().setShowInput(false);
            setText("");
          }}
          style={{
            padding: "4px 10px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "#f5f5f5",
            color: "#666",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          style={{
            padding: "4px 12px",
            borderRadius: 8,
            border: "none",
            background: text.trim() ? "#ff9800" : "#ccc",
            color: "#fff",
            fontSize: 12,
            cursor: text.trim() ? "pointer" : "default",
            fontWeight: 600,
          }}
        >
          🔊 Speak
        </button>
      </div>
    </div>
  );
}
