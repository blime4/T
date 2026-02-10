import { useAppStore } from "../store/useAppStore";

export default function SpeechBubble() {
  const showSpeech = useAppStore((s) => s.showSpeech);
  const speechText = useAppStore((s) => s.speechText);
  const playbackState = useAppStore((s) => s.playbackState);

  if (!showSpeech || !speechText) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        left: "50%",
        transform: "translateX(-50%)",
        background:
          playbackState === "error"
            ? "rgba(244, 67, 54, 0.9)"
            : "rgba(255, 255, 255, 0.95)",
        borderRadius: 16,
        padding: "8px 14px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
        maxWidth: 250,
        animation: "bubbleIn 0.2s ease-out",
        zIndex: 10,
      }}
    >
      {/* Tail */}
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
          borderTop:
            playbackState === "error"
              ? "8px solid rgba(244, 67, 54, 0.9)"
              : "8px solid rgba(255, 255, 255, 0.95)",
        }}
      />
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: playbackState === "error" ? "#fff" : "#333",
          lineHeight: 1.4,
          wordBreak: "break-word",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}
      >
        {playbackState === "synthesizing" && (
          <span style={{ marginRight: 4 }}>⏳</span>
        )}
        {playbackState === "playing" && (
          <span style={{ marginRight: 4 }}>🔊</span>
        )}
        {playbackState === "error" && (
          <span style={{ marginRight: 4 }}>❌</span>
        )}
        {speechText}
      </p>
    </div>
  );
}
