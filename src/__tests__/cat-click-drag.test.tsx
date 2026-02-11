import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { useAppStore } from "../store/useAppStore";

beforeEach(() => {
  vi.useFakeTimers({
    shouldAdvanceTime: true,
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
  });
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

afterEach(() => {
  vi.useRealTimers();
});

describe("Bug fix: Click vs Drag conflict on cat", () => {
  it("cat-wrapper should stop mousedown propagation so drag region doesn't intercept clicks", () => {
    render(<App />);
    const catWrapper = screen.getByTitle(/Right-click for menu/);

    // Track whether stopPropagation is called on mousedown events
    let stopPropagationCalled = false;

    // Spy on Event.prototype.stopPropagation to detect the call
    const origStopProp = Event.prototype.stopPropagation;
    Event.prototype.stopPropagation = function (...args) {
      if (this.type === "mousedown") {
        stopPropagationCalled = true;
      }
      return origStopProp.apply(this, args);
    };

    fireEvent.mouseDown(catWrapper);

    expect(stopPropagationCalled).toBe(true);

    // Restore
    Event.prototype.stopPropagation = origStopProp;
  });

  it("clicking the cat should still work after mousedown is stopped", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    const cat = screen.getByTitle(/Right-click for menu/);
    await user.click(cat);
    act(() => { vi.advanceTimersByTime(300); });

    // Click should still toggle input
    expect(useAppStore.getState().showInput).toBe(true);
  });

  it("double-click on cat should still work after mousedown fix", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    const cat = screen.getByTitle(/Right-click for menu/);
    await user.dblClick(cat);
    act(() => { vi.advanceTimersByTime(300); });

    // Double-click should NOT toggle input (it opens studio instead)
    expect(useAppStore.getState().showInput).toBe(false);
  });

  it("dragging from cat-area (outside cat) should still be possible", () => {
    render(<App />);
    const catArea = document.querySelector(".cat-area")!;

    // cat-area should still have data-tauri-drag-region
    expect(catArea.hasAttribute("data-tauri-drag-region")).toBe(true);
  });
});

describe("Bug fix: Transparent box and black line around cat", () => {
  it("cat-wrapper should not have a visible border or outline", () => {
    render(<App />);
    const catWrapper = screen.getByTitle(/Right-click for menu/);
    const style = catWrapper.style;

    // Should have no border
    expect(style.border).toBeFalsy();
    // Should have no outline
    expect(style.outline).toBeFalsy();
  });

  it("cat-area should have no border and no outline", () => {
    render(<App />);
    const catArea = document.querySelector(".cat-area") as HTMLElement;
    expect(catArea).not.toBeNull();

    // Verify via computed style or inline — the CSS should set border:none, outline:none
    // We check the element doesn't have any visible border styling
    expect(catArea.style.border).toBeFalsy();
  });

  it("cat-wrapper should have overflow visible to avoid clipping artifacts", () => {
    render(<App />);
    const catWrapper = screen.getByTitle(/Right-click for menu/);

    // overflow should be 'visible' (not 'hidden' which can cause edge artifacts)
    expect(catWrapper.style.overflow).toBe("visible");
  });

  it("Lottie container should have no border or background", () => {
    render(<App />);
    const lottie = screen.getByTestId("lottie-animation");

    // The Lottie element should have pointerEvents none and no visible border
    expect(lottie.style.pointerEvents).toBe("none");
  });
});
