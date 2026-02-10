import { useState, useCallback, useRef } from "react";
import Lottie from "lottie-react";
import { invoke } from "@tauri-apps/api";
import { useAppStore } from "../store/useAppStore";
import { adjustMenuPosition } from "../utils/menuPosition";
import catIdle from "../assets/cat-idle.json";
import catSpeaking from "../assets/cat-speaking.json";
import catListening from "../assets/cat-listening.json";
import catSleeping from "../assets/cat-sleeping.json";
import catHappy from "../assets/cat-happy.json";

const animationMap = {
  idle: catIdle,
  speaking: catSpeaking,
  listening: catListening,
  sleeping: catSleeping,
  happy: catHappy,
};

interface ContextMenuPos {
  x: number;
  y: number;
}

export default function CatCharacter() {
  const catMood = useAppStore((s) => s.catMood);
  const toggleInput = useAppStore((s) => s.toggleInput);
  const stopSpeaking = useAppStore((s) => s.stopSpeaking);
  const playbackState = useAppStore((s) => s.playbackState);
  const setCatMood = useAppStore((s) => s.setCatMood);
  const speak = useAppStore((s) => s.speak);
  const toggleClipboardMonitor = useAppStore((s) => s.toggleClipboardMonitor);
  const clipboardMonitor = useAppStore((s) => s.clipboardMonitor);
  const triggerHappy = useAppStore((s) => s.triggerHappy);
  const setIsHovering = useAppStore((s) => s.setIsHovering);
  const isHovering = useAppStore((s) => s.isHovering);

  const [contextMenu, setContextMenu] = useState<ContextMenuPos | null>(null);
  const [bounce, setBounce] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Cancel pending single-click action
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    // Open studio window
    invoke("open_studio").catch(console.error);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (contextMenu) {
      setContextMenu(null);
      return;
    }

    // Delay single-click action to distinguish from double-click
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      if (playbackState === "playing" || playbackState === "synthesizing") {
        stopSpeaking();
      } else {
        // If idle or sleeping, trigger happy before toggling input
        if (catMood === "idle" || catMood === "sleeping") {
          triggerHappy();
        }
        toggleInput();
      }
      // Trigger bounce animation
      setBounce(true);
      setTimeout(() => setBounce(false), 300);
    }, 250);
  };

  // Approximate context menu size (matches CSS min-width:180px, ~5 items)
  const MENU_SIZE = { width: 200, height: 180 };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const adjusted = adjustMenuPosition(
      { x: e.clientX, y: e.clientY },
      MENU_SIZE,
      { width: window.innerWidth, height: window.innerHeight }
    );
    setContextMenu(adjusted);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleMenuAction = useCallback(
    (action: string) => {
      closeContextMenu();
      switch (action) {
        case "input":
          toggleInput();
          break;
        case "clipboard":
          // Read clipboard and speak
          navigator.clipboard.readText().then((text) => {
            if (text?.trim()) speak(text.trim());
          }).catch(() => {});
          break;
        case "monitor":
          toggleClipboardMonitor();
          break;
        case "sleep":
          setCatMood(catMood === "sleeping" ? "idle" : "sleeping");
          break;
        case "wake":
          setCatMood("idle");
          break;
      }
    },
    [closeContextMenu, toggleInput, speak, toggleClipboardMonitor, setCatMood, catMood]
  );

  // Status dot color
  const dotColor =
    playbackState === "playing"
      ? "#4caf50"
      : playbackState === "synthesizing"
      ? "#ff9800"
      : playbackState === "paused"
      ? "#2196f3"
      : playbackState === "error"
      ? "#f44336"
      : "transparent";

  // Tooltip
  const tooltip =
    playbackState === "playing"
      ? "Click to stop · Right-click for menu"
      : catMood === "sleeping"
      ? "Right-click to wake up"
      : catMood === "happy"
      ? "Happy cat! · Right-click for menu"
      : "Click to type · Double-click for Studio · Right-click for menu";

  // Build CSS class list
  const wrapperClasses = [
    "cat-wrapper",
    `cat-${catMood}-glow`,
    bounce ? "cat-bounce" : "",
    isHovering ? "cat-hover" : "",
  ].filter(Boolean).join(" ");

  return (
    <>
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className={wrapperClasses}
        style={{
          cursor: "pointer",
          width: 160,
          height: 160,
          position: "relative",
          transition: "filter 0.3s ease",
        }}
        title={tooltip}
      >
        <Lottie
          animationData={animationMap[catMood]}
          loop={true}
          autoplay={true}
          style={{ width: "100%", height: "100%", pointerEvents: "none" }}
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
            background: dotColor,
            transition: "background 0.3s ease",
            boxShadow:
              playbackState !== "idle"
                ? "0 0 4px rgba(0,0,0,0.3)"
                : "none",
          }}
        />

        {/* Mood label */}
        {catMood !== "idle" && (
          <div className="mood-label">
            {catMood === "speaking" && "🔊"}
            {catMood === "listening" && "👂"}
            {catMood === "sleeping" && "💤"}
            {catMood === "happy" && "😊"}
          </div>
        )}

        {/* Floating hearts for happy mood */}
        {catMood === "happy" && (
          <div className="particles-container">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                className="particle heart"
                style={{
                  animationDelay: `${i * 0.3}s`,
                  left: `${20 + i * 15}%`,
                  top: "30%",
                }}
                key={i}
              />
            ))}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="context-overlay" onClick={closeContextMenu} />
          <div
            className="context-menu"
            style={{
              position: "fixed",
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >
            <button className="context-item" onClick={() => handleMenuAction("input")}>
              ✏️ Quick Input
            </button>
            <button className="context-item" onClick={() => handleMenuAction("clipboard")}>
              📋 Read Clipboard
            </button>
            <button className="context-item" onClick={() => handleMenuAction("monitor")}>
              {clipboardMonitor ? "🔕" : "🔔"} Clipboard Monitor: {clipboardMonitor ? "ON" : "OFF"}
            </button>
            <div className="context-separator" />
            {catMood === "sleeping" ? (
              <button className="context-item" onClick={() => handleMenuAction("wake")}>
                ☀️ Wake Up
              </button>
            ) : (
              <button className="context-item" onClick={() => handleMenuAction("sleep")}>
                😴 Sleep
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
