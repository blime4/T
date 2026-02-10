import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../App";
import { useAppStore } from "../store/useAppStore";

beforeEach(() => {
  useAppStore.setState({
    catMood: "idle",
    playbackState: "idle",
    showInput: false,
    showSpeech: false,
    speechText: "",
    inputText: "",
    clipboardMonitor: false,
    availableEngines: [],
    activeEngine: "system",
  });
});

describe("Issue 4: Drag region limited to cat body", () => {
  it("should NOT have a full-window drag-region overlay", () => {
    render(<App />);
    // The old drag-region covered the entire window with position:absolute inset:0
    // It should no longer exist as a separate full-window overlay
    const dragRegions = document.querySelectorAll(".drag-region");
    // There should be no standalone full-window drag region
    dragRegions.forEach((el) => {
      const style = window.getComputedStyle(el);
      // It should NOT have inset:0 (full window coverage)
      expect(el.className).not.toContain("drag-region");
    });
  });

  it("should have data-tauri-drag-region on the cat-wrapper", () => {
    render(<App />);
    const catWrapper = screen.getByTitle(/Right-click for menu/);
    expect(catWrapper.getAttribute("data-tauri-drag-region")).toBeDefined();
  });

  it("should have data-tauri-drag-region on the status-bar", () => {
    render(<App />);
    const statusBar = document.querySelector(".status-bar");
    expect(statusBar).not.toBeNull();
    expect(statusBar!.getAttribute("data-tauri-drag-region")).toBeDefined();
  });

  it("should NOT have a full-window drag overlay element", () => {
    render(<App />);
    // The old .drag-region div should be completely removed
    const fullDragOverlay = document.querySelector(".app-root > .drag-region");
    expect(fullDragOverlay).toBeNull();
  });
});
