import { useState, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";

export default function SpeechBubble() {
  const showSpeech = useAppStore((s) => s.showSpeech);
  const speechText = useAppStore((s) => s.speechText);
  const playbackState = useAppStore((s) => s.playbackState);
  const [displayText, setDisplayText] = useState("");

  // Typewriter effect
  useEffect(() => {
    if (!speechText) {
      setDisplayText("");
      return;
    }
    setDisplayText("");
    let i = 0;
    const timer = setInterval(() => {
      if (i < speechText.length) {
        setDisplayText(speechText.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 30);
    return () => clearInterval(timer);
  }, [speechText]);

  if (!showSpeech || !speechText) return null;

  const isError = playbackState === "error";

  return (
    <div className={`speech-bubble ${isError ? "error" : ""}`}>
      <div className="speech-bubble-tail" />
      <p className="speech-bubble-text">
        {playbackState === "synthesizing" && <span className="status-icon">⏳ </span>}
        {playbackState === "playing" && <span className="status-icon">🔊 </span>}
        {playbackState === "error" && <span className="status-icon">❌ </span>}
        {displayText}
        {displayText.length < speechText.length && (
          <span className="typing-cursor" style={{ opacity: 0.6, animation: "pulse 0.5s infinite" }}>|</span>
        )}
      </p>
    </div>
  );
}
