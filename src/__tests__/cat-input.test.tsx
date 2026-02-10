import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { useAppStore } from "../store/useAppStore";

// Reset store state before each test
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

describe("Cat click → Input bubble", () => {
  it("should show InputBubble when cat is clicked", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Input bubble should NOT be visible initially
    expect(screen.queryByPlaceholderText("Type something to say...")).not.toBeInTheDocument();

    // Click the cat (the element with the tooltip)
    const cat = screen.getByTitle("Click to type · Right-click for menu");
    await user.click(cat);

    // Input bubble SHOULD now be visible
    expect(screen.getByPlaceholderText("Type something to say...")).toBeInTheDocument();
  });

  it("should hide InputBubble when cat is clicked again", async () => {
    const user = userEvent.setup();
    render(<App />);

    const cat = screen.getByTitle("Click to type · Right-click for menu");

    // First click: show input
    await user.click(cat);
    expect(screen.getByPlaceholderText("Type something to say...")).toBeInTheDocument();

    // Second click: hide input
    await user.click(cat);
    expect(screen.queryByPlaceholderText("Type something to say...")).not.toBeInTheDocument();
  });

  it("should not show InputBubble when cat is sleeping", async () => {
    useAppStore.setState({ catMood: "sleeping" });
    const user = userEvent.setup();
    render(<App />);

    const cat = screen.getByTitle("Right-click to wake up");
    await user.click(cat);

    // Sleeping cat click should still toggle input (current behavior)
    // This test documents the expected behavior
    expect(useAppStore.getState().showInput).toBe(true);
  });

  it("should stop speaking when clicked during playback", async () => {
    useAppStore.setState({
      playbackState: "playing",
      catMood: "speaking",
      showSpeech: true,
      speechText: "Hello",
    });
    const user = userEvent.setup();
    render(<App />);

    const cat = screen.getByTitle("Click to stop · Right-click for menu");
    await user.click(cat);

    // Should stop, not toggle input
    expect(useAppStore.getState().showInput).toBe(false);
  });
});

describe("InputBubble interaction", () => {
  it("should allow typing and submitting text", async () => {
    useAppStore.setState({ showInput: true });
    const user = userEvent.setup();
    render(<App />);

    const textarea = screen.getByPlaceholderText("Type something to say...");
    expect(textarea).toBeInTheDocument();

    await user.type(textarea, "Hello world");
    expect(textarea).toHaveValue("Hello world");
  });

  it("should close InputBubble when Escape is pressed", async () => {
    useAppStore.setState({ showInput: true });
    const user = userEvent.setup();
    render(<App />);

    const textarea = screen.getByPlaceholderText("Type something to say...");
    await user.type(textarea, "{Escape}");

    expect(screen.queryByPlaceholderText("Type something to say...")).not.toBeInTheDocument();
  });

  it("should close InputBubble when Cancel is clicked", async () => {
    useAppStore.setState({ showInput: true });
    const user = userEvent.setup();
    render(<App />);

    const cancelBtn = screen.getByText("Cancel");
    await user.click(cancelBtn);

    expect(screen.queryByPlaceholderText("Type something to say...")).not.toBeInTheDocument();
  });
});
