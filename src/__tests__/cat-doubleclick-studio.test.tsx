import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { useAppStore } from "../store/useAppStore";
import { invoke } from "@tauri-apps/api";

// Mock Tauri invoke
vi.mock("@tauri-apps/api", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

const mockedInvoke = vi.mocked(invoke);

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
  mockedInvoke.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Double-click cat → open Studio", () => {
  it("should call invoke('open_studio') on double-click", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    const cat = screen.getByTitle(/Right-click for menu/);
    await user.dblClick(cat);
    act(() => { vi.advanceTimersByTime(300); });

    expect(mockedInvoke).toHaveBeenCalledWith("open_studio");
  });

  it("should NOT toggle input on double-click (single-click timer must be cancelled)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    const cat = screen.getByTitle(/Right-click for menu/);
    await user.dblClick(cat);
    act(() => { vi.advanceTimersByTime(300); });

    expect(useAppStore.getState().showInput).toBe(false);
  });

  it("should NOT call stopSpeaking on double-click while playing", async () => {
    useAppStore.setState({
      playbackState: "playing",
      catMood: "speaking",
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    const cat = screen.getByTitle("Click to stop · Right-click for menu");
    await user.dblClick(cat);
    act(() => { vi.advanceTimersByTime(300); });

    // Double-click should open studio, NOT stop speaking
    expect(mockedInvoke).toHaveBeenCalledWith("open_studio");
    expect(mockedInvoke).not.toHaveBeenCalledWith("stop_speaking");
    // Playback should still be playing
    expect(useAppStore.getState().playbackState).toBe("playing");
  });

  it("should open studio even when cat is sleeping", async () => {
    useAppStore.setState({ catMood: "sleeping" });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    const cat = screen.getByTitle("Right-click to wake up");
    await user.dblClick(cat);
    act(() => { vi.advanceTimersByTime(300); });

    expect(mockedInvoke).toHaveBeenCalledWith("open_studio");
    // Should NOT toggle input when sleeping + double-click
    expect(useAppStore.getState().showInput).toBe(false);
  });

  it("should open studio during synthesizing state without interrupting", async () => {
    useAppStore.setState({
      playbackState: "synthesizing",
      catMood: "speaking",
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    // During synthesizing (not playing), the title is the default one
    const cat = screen.getByTitle(/Double-click for Studio/);
    await user.dblClick(cat);
    act(() => { vi.advanceTimersByTime(300); });

    expect(mockedInvoke).toHaveBeenCalledWith("open_studio");
    // Should NOT stop the synthesis
    expect(useAppStore.getState().playbackState).toBe("synthesizing");
  });

  it("should not trigger triggerHappy on double-click (only single-click does)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    const cat = screen.getByTitle(/Right-click for menu/);
    await user.dblClick(cat);
    act(() => { vi.advanceTimersByTime(300); });

    // Cat mood should remain idle — triggerHappy should NOT fire
    expect(useAppStore.getState().catMood).toBe("idle");
  });
});

describe("Double-click error handling", () => {
  it("should not crash if open_studio invoke fails", async () => {
    mockedInvoke.mockRejectedValueOnce(new Error("Window creation failed"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    const cat = screen.getByTitle(/Right-click for menu/);

    // Should not throw
    await user.dblClick(cat);
    act(() => { vi.advanceTimersByTime(300); });

    expect(mockedInvoke).toHaveBeenCalledWith("open_studio");
    // App should still be functional — cat mood unchanged
    expect(useAppStore.getState().catMood).toBe("idle");
  });
});

describe("Single-click vs double-click race condition", () => {
  it("rapid single-click followed by double-click should only open studio", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    const cat = screen.getByTitle(/Right-click for menu/);

    // Simulate: click, then quickly double-click
    await user.click(cat);
    // Don't advance timer yet — immediately double-click
    await user.dblClick(cat);
    act(() => { vi.advanceTimersByTime(300); });

    // Studio should have been invoked
    expect(mockedInvoke).toHaveBeenCalledWith("open_studio");
    // Input should NOT be toggled (single-click timer should be cancelled)
    expect(useAppStore.getState().showInput).toBe(false);
  });
});
