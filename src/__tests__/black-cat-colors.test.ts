import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Tests that all cat Lottie animations use a BLACK British Shorthair color scheme.
 *
 * Black British Shorthair colors:
 *   - Body/Head/Ears outer: dark charcoal ~[0.15, 0.15, 0.17] to [0.2, 0.2, 0.22]
 *   - Ear inner: dark pink-gray ~[0.35, 0.25, 0.28]
 *   - Nose: dark pink ~[0.45, 0.3, 0.32]
 *   - Eyes stroke: very dark ~[0.1, 0.1, 0.1]
 *   - Tail: dark charcoal (same as body)
 *   - Paws: slightly lighter gray ~[0.25, 0.25, 0.27]
 *   - Blush: subtle pink ~[1, 0.7, 0.75] with low opacity
 *
 * NO orange/golden colors [0.95, 0.75, 0.3] should remain.
 */

const ASSETS_DIR = path.resolve(__dirname, "../assets");

const ALL_ANIMATIONS = [
  "cat-idle.json",
  "cat-speaking.json",
  "cat-listening.json",
  "cat-sleeping.json",
  "cat-happy.json",
];

// Recursively find all fill ("fl") color values in a Lottie JSON
function findAllFillColors(obj: any): number[][] {
  const colors: number[][] = [];
  if (!obj || typeof obj !== "object") return colors;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      colors.push(...findAllFillColors(item));
    }
    return colors;
  }

  // If this is a fill shape, extract its color
  if (obj.ty === "fl" && obj.c && obj.c.k) {
    const k = obj.c.a === 0 ? obj.c.k : null;
    if (k && Array.isArray(k) && k.length >= 3) {
      colors.push(k.slice(0, 3));
    }
  }

  // If this is a stroke shape, extract its color
  if (obj.ty === "st" && obj.c && obj.c.k) {
    const k = obj.c.a === 0 ? obj.c.k : null;
    if (k && Array.isArray(k) && k.length >= 3) {
      colors.push(k.slice(0, 3));
    }
  }

  // Recurse into all object values
  for (const key of Object.keys(obj)) {
    colors.push(...findAllFillColors(obj[key]));
  }

  return colors;
}

// Check if a color is orange/golden (the OLD color scheme)
function isOrangeGolden(rgb: number[]): boolean {
  const [r, g, b] = rgb;
  // Orange/golden: high red (>0.8), medium green (0.5-0.85), low blue (<0.4)
  return r > 0.8 && g > 0.5 && g < 0.85 && b < 0.4;
}

// Check if a color is dark enough for a black cat (R,G,B all < 0.4 for body parts)
function isDarkColor(rgb: number[]): boolean {
  const [r, g, b] = rgb;
  return r < 0.5 && g < 0.5 && b < 0.5;
}

describe("Black British Shorthair color scheme", () => {
  for (const filename of ALL_ANIMATIONS) {
    describe(filename, () => {
      let lottie: any;

      try {
        const filePath = path.join(ASSETS_DIR, filename);
        if (fs.existsSync(filePath)) {
          lottie = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        }
      } catch {
        // will be undefined
      }

      it("should NOT contain any orange/golden fill colors", () => {
        expect(lottie).toBeDefined();
        const colors = findAllFillColors(lottie);
        const orangeColors = colors.filter(isOrangeGolden);
        expect(orangeColors).toEqual([]);
      });

      it("should have dark body color (black cat)", () => {
        expect(lottie).toBeDefined();
        // Find the Body layer's fill color
        const bodyLayer = lottie.layers?.find(
          (l: any) => l.nm === "Body" || l.shapes?.some((s: any) => s.nm === "Body")
        );
        expect(bodyLayer).toBeDefined();

        // Extract fill color from body
        let bodyColor: number[] | null = null;
        const findFill = (obj: any): void => {
          if (!obj || typeof obj !== "object") return;
          if (obj.ty === "fl" && obj.c?.k && obj.c.a === 0) {
            bodyColor = obj.c.k.slice(0, 3);
            return;
          }
          if (Array.isArray(obj)) {
            obj.forEach(findFill);
          } else {
            Object.values(obj).forEach(findFill);
          }
        };
        findFill(bodyLayer.shapes);

        expect(bodyColor).not.toBeNull();
        expect(isDarkColor(bodyColor!)).toBe(true);
      });

      it("should have dark head color (black cat)", () => {
        expect(lottie).toBeDefined();
        const headLayer = lottie.layers?.find(
          (l: any) => l.nm === "Head" || l.shapes?.some((s: any) => s.nm === "Head")
        );
        expect(headLayer).toBeDefined();

        let headColor: number[] | null = null;
        const findFill = (obj: any): void => {
          if (!obj || typeof obj !== "object") return;
          if (obj.ty === "fl" && obj.c?.k && obj.c.a === 0) {
            headColor = obj.c.k.slice(0, 3);
            return;
          }
          if (Array.isArray(obj)) {
            obj.forEach(findFill);
          } else {
            Object.values(obj).forEach(findFill);
          }
        };
        findFill(headLayer.shapes);

        expect(headColor).not.toBeNull();
        expect(isDarkColor(headColor!)).toBe(true);
      });
    });
  }
});

describe("Cat animation: no weird head bounce", () => {
  for (const filename of ALL_ANIMATIONS) {
    it(`${filename}: Head layer should NOT have large Y-axis position animation`, () => {
      const filePath = path.join(ASSETS_DIR, filename);
      if (!fs.existsSync(filePath)) return;
      const lottie = JSON.parse(fs.readFileSync(filePath, "utf-8"));

      const headLayer = lottie.layers?.find(
        (l: any) => l.nm === "Head"
      );
      if (!headLayer) return;

      // Check if head has position animation
      const posAnim = headLayer.ks?.p;
      if (posAnim?.a === 1 && Array.isArray(posAnim.k)) {
        // Get all Y values from keyframes
        const yValues = posAnim.k
          .filter((kf: any) => kf.s)
          .map((kf: any) => kf.s[1]);

        if (yValues.length > 1) {
          const minY = Math.min(...yValues);
          const maxY = Math.max(...yValues);
          // Head should NOT bounce more than 2px (subtle breathing only)
          expect(maxY - minY).toBeLessThanOrEqual(2);
        }
      }
    });
  }
});
