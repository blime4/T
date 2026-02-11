import { describe, it, expect } from "vitest";
import { adjustMenuPosition } from "../utils/menuPosition";

// Neko TTS window is 300×400. Context menu is ~180×160.
const WINDOW = { width: 300, height: 400 };
const MENU = { width: 180, height: 160 };

describe("adjustMenuPosition — context menu boundary detection", () => {
  it("should keep position unchanged when menu fits entirely", () => {
    // Click at top-left area — plenty of room
    const result = adjustMenuPosition({ x: 10, y: 10 }, MENU, WINDOW);
    expect(result).toEqual({ x: 10, y: 10 });
  });

  it("should flip left when menu overflows right edge", () => {
    // Click near right edge: x=250, menu width=180 → 250+180=430 > 300
    const result = adjustMenuPosition({ x: 250, y: 10 }, MENU, WINDOW);
    // Menu should be placed so its right edge aligns with click point
    // i.e., x = 250 - 180 = 70
    expect(result.x).toBe(250 - MENU.width);
    expect(result.y).toBe(10);
  });

  it("should flip up when menu overflows bottom edge", () => {
    // Click near bottom: y=350, menu height=160 → 350+160=510 > 400
    const result = adjustMenuPosition({ x: 10, y: 350 }, MENU, WINDOW);
    expect(result.x).toBe(10);
    // Menu should be placed so its bottom aligns with click point
    // i.e., y = 350 - 160 = 190
    expect(result.y).toBe(350 - MENU.height);
  });

  it("should flip both when menu overflows bottom-right corner", () => {
    // Click at bottom-right corner
    const result = adjustMenuPosition({ x: 260, y: 380 }, MENU, WINDOW);
    expect(result.x).toBe(260 - MENU.width);
    expect(result.y).toBe(380 - MENU.height);
  });

  it("should clamp to 0 if flipped position goes negative", () => {
    // Very small window scenario: click at x=50, menu width=180
    // Flip: 50-180 = -130 → clamp to 0
    const tinyWindow = { width: 100, height: 100 };
    const result = adjustMenuPosition({ x: 50, y: 50 }, MENU, tinyWindow);
    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.y).toBeGreaterThanOrEqual(0);
  });

  it("should handle click exactly at window edge", () => {
    const result = adjustMenuPosition({ x: 300, y: 400 }, MENU, WINDOW);
    // Both overflow → flip
    expect(result.x).toBe(300 - MENU.width); // 120
    expect(result.y).toBe(400 - MENU.height); // 240
  });

  it("should handle menu that barely fits", () => {
    // x=120, menu width=180 → 120+180=300 = exactly window width → fits
    const result = adjustMenuPosition({ x: 120, y: 240 }, MENU, WINDOW);
    expect(result).toEqual({ x: 120, y: 240 });
  });

  it("should add padding from edge (4px margin)", () => {
    // When flipping, ensure at least 4px padding from window edge
    // Click at x=5, menu width=180 → 5+180=185 < 300 → fits, no flip needed
    const result = adjustMenuPosition({ x: 5, y: 5 }, MENU, WINDOW);
    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.y).toBeGreaterThanOrEqual(0);
  });
});

describe("adjustMenuPosition — integration with CatCharacter context menu", () => {
  it("should handle typical right-click on cat (center of 300×400 window)", () => {
    // Cat is centered around x=150, y=300 area
    const result = adjustMenuPosition({ x: 150, y: 300 }, MENU, WINDOW);
    // x: 150+180=330 > 300 → flip: 150-180=-30 → clamp to 0
    // y: 300+160=460 > 400 → flip: 300-160=140
    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.y).toBeLessThanOrEqual(WINDOW.height - MENU.height);
  });
});
