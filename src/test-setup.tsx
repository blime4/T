import "@testing-library/jest-dom";

// Mock @tauri-apps/api/tauri
vi.mock("@tauri-apps/api/tauri", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

// Mock @tauri-apps/api/event
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

// Mock lottie-react (heavy animation library)
vi.mock("lottie-react", () => ({
  default: ({ ...props }: Record<string, unknown>) => (
    <div data-testid="lottie-animation" {...props} />
  ),
}));

// Mock Lottie JSON assets
vi.mock("./assets/cat-idle.json", () => ({ default: {} }));
vi.mock("./assets/cat-speaking.json", () => ({ default: {} }));
vi.mock("./assets/cat-listening.json", () => ({ default: {} }));
vi.mock("./assets/cat-sleeping.json", () => ({ default: {} }));
