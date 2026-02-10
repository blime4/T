import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Tests that all cat Lottie animations use a YELLOW/ORANGE tabby cat color scheme.
 *
 * Yellow/Orange tabby cat colors:
 *   - Body/Head/Ears outer: warm orange ~[1, 0.65, 0.15]
 *   - Ear inner: warm peach ~[1, 0.75, 0.6]
 *   - Nose: pink ~[1, 0.6, 0.65]
 *   - Eyes stroke: dark ~[0.2, 0.2, 0.2] for contrast
 *   - Tail: darker orange ~[0.85, 0.55, 0.1]
 *   - Paws: lighter orange ~[1, 0.75, 0.3]
 *   - Blush: subtle pink ~[1, 0.6, 0.7] with low opacity
 *
 * NO dark black/charcoal colors [0.15, 0.15, 0.17] should remain on body parts.
 */

const ASSETS_DIR = path.resolve(__dirname, "../assets");

const ALL_ANIMATIONS = [
  "cat-idle.json",
  "cat-speaking.json",
  "cat-listening.json",
  "cat-sleeping.json",
  "cat-happy.json",
];

// Recursively find all fill ("fl") and stroke ("st") color values with their names
function findAllColorEntries(obj: any, parentName?: string): { nm: string; color: number[] }[] {
  const entries: { nm: string; color: number[] }[] = [];
  if (!obj || typeof obj !== "object") return entries;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      entries.push(...findAllColorEntries(item, parentName));
    }
    return entries;
  }

  const currentName = obj.nm || parentName || "unknown";

  // If this is a fill or stroke shape, extract its color
  if ((obj.ty === "fl" || obj.ty === "st") && obj.c && obj.c.k) {
    const k = obj.c.a === 0 ? obj.c.k : null;
    if (k && Array.isArray(k) && k.length >= 3) {
      entries.push({ nm: currentName, color: k.slice(0, 3) });
    }
  }

  // Recurse into all object values
  for (const key of Object.keys(obj)) {
    entries.push(...findAllColorEntries(obj[key], currentName));
  }

  return entries;
}

// Check if a color is the old black cat body color
function isBlackCatBody(rgb: number[]): boolean {
  const [r, g, b] = rgb;
  // Black cat body: very dark, all channels < 0.25, roughly equal
  return r < 0.25 && g < 0.25 && b < 0.25 && Math.abs(r - g) < 0.05;
}

// Check if a color is warm/orange (expected for yellow cat body)
function isWarmOrange(rgb: number[]): boolean {
  const [r, g, b] = rgb;
  // Orange: high red (>0.7), medium green (0.4-0.8), low-medium blue (<0.5)
  return r > 0.7 && g > 0.4 && b < 0.5;
}

describe("Yellow/Orange tabby cat color scheme", () => {
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

      it("should NOT contain black cat body colors on body parts", () => {
        expect(lottie).toBeDefined();
        const entries = findAllColorEntries(lottie);
        // Body-related fill names that should NOT be dark/black
        const bodyPartNames = [
          "BodyFill", "HeadFill", "LeftEarOuterFill", "RightEarOuterFill",
        ];
        // Exclude eye-related elements (pupils are intentionally dark)
        const eyeRelatedNames = [
          "Eye", "Pupil", "Highlight", "Whisker", "Blink",
        ];
        const bodyEntries = entries.filter(e => {
          const isBodyPart = bodyPartNames.some(n => e.nm.includes(n)) ||
            e.nm === "Body" || e.nm === "Head";
          const isEyeRelated = eyeRelatedNames.some(n => e.nm.includes(n));
          return isBodyPart && !isEyeRelated;
        });
        const blackBodyColors = bodyEntries.filter(e => isBlackCatBody(e.color));
        expect(blackBodyColors).toEqual([]);
      });

      it("should have warm orange body color (yellow cat)", () => {
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
        expect(isWarmOrange(bodyColor!)).toBe(true);
      });

      it("should have warm orange head color (yellow cat)", () => {
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
        expect(isWarmOrange(headColor!)).toBe(true);
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
