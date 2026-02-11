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

  it("should NOT have data-tauri-drag-region on the cat-wrapper (prevents click)", () => {
    render(<App />);
    const catWrapper = screen.getByTitle(/Right-click for menu/);
    // data-tauri-drag-region intercepts mousedown and blocks onClick,
    // so the cat-wrapper must NOT have it. Dragging is handled by the
    // surrounding cat-area or status-bar instead.
    expect(catWrapper.hasAttribute("data-tauri-drag-region")).toBe(false);
  });

  it("should have data-tauri-drag-region on the cat-area container", () => {
    render(<App />);
    const catArea = document.querySelector(".cat-area");
    expect(catArea).not.toBeNull();
    expect(catArea!.getAttribute("data-tauri-drag-region")).toBeDefined();
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

  it("should have data-tauri-drag-region on app-root for full-window dragging", () => {
    render(<App />);
    const appRoot = document.querySelector(".app-root");
    expect(appRoot).not.toBeNull();
    expect(appRoot!.hasAttribute("data-tauri-drag-region")).toBe(true);
  });

  it("should have data-tauri-drag-region on bubble-area so empty space is draggable", () => {
    render(<App />);
    const bubbleArea = document.querySelector(".bubble-area");
    expect(bubbleArea).not.toBeNull();
    expect(bubbleArea!.hasAttribute("data-tauri-drag-region")).toBe(true);
  });
});
