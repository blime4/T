import Lottie from "lottie-react";
import { useAppStore } from "../store/useAppStore";
import catIdle from "../assets/cat-idle.json";
import catSpeaking from "../assets/cat-speaking.json";

const animationMap = {
  idle: catIdle,
  speaking: catSpeaking,
  listening: catIdle,
  sleeping: catIdle,
};

export default function CatCharacter() {
  const catMood = useAppStore((s) => s.catMood);
  const toggleInput = useAppStore((s) => s.toggleInput);
  const stopSpeaking = useAppStore((s) => s.stopSpeaking);
  const playbackState = useAppStore((s) => s.playbackState);

  const handleClick = () => {
    if (playbackState === "playing" || playbackState === "synthesizing") {
      stopSpeaking();
    } else {
      toggleInput();
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        cursor: "pointer",
        width: 160,
        height: 160,
        position: "relative",
        filter:
          catMood === "speaking"
            ? "drop-shadow(0 0 8px rgba(255, 180, 50, 0.6))"
            : "none",
        transition: "filter 0.3s ease",
      }}
      title={
        playbackState === "playing"
          ? "Click to stop"
          : "Click to type something"
      }
    >
      <Lottie
        animationData={animationMap[catMood]}
        loop={true}
        autoplay={true}
        style={{ width: "100%", height: "100%" }}
      />
      {/* Status indicator dot */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          right: 8,
          width: 10,
          height: 10,
          borderRadius: "50%",
          background:
            playbackState === "playing"
              ? "#4caf50"
              : playbackState === "synthesizing"
              ? "#ff9800"
              : playbackState === "error"
              ? "#f44336"
              : "transparent",
          transition: "background 0.3s ease",
          boxShadow:
            playbackState !== "idle"
              ? "0 0 4px rgba(0,0,0,0.3)"
              : "none",
        }}
      />
    </div>
  );
}
