import "@testing-library/jest-dom";

// Mock @tauri-apps/api/tauri
vi.mock("@tauri-apps/api/tauri", () => ({
  invoke: vi.fn().mockImplementation((cmd: string) => {
    // Return sensible defaults for known commands
    if (cmd === "get_available_engines") return Promise.resolve([]);
    if (cmd === "get_tts_config") return Promise.resolve(null);
    return Promise.resolve(undefined);
  }),
}));

// Mock @tauri-apps/api/event
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

// Mock lottie-react (heavy animation library)
// Only pass safe props to the DOM element to avoid React warnings
vi.mock("lottie-react", () => ({
  default: ({ animationData: _a, autoplay: _b, loop: _c, ...rest }: Record<string, unknown>) => (
    <div data-testid="lottie-animation" {...rest} />
  ),
}));

// Mock Lottie JSON assets
vi.mock("./assets/cat-idle.json", () => ({ default: {} }));
vi.mock("./assets/cat-speaking.json", () => ({ default: {} }));
vi.mock("./assets/cat-listening.json", () => ({ default: {} }));
vi.mock("./assets/cat-sleeping.json", () => ({ default: {} }));
vi.mock("./assets/cat-happy.json", () => ({ default: {} }));
