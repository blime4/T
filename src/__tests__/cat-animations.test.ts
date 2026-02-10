import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * These tests validate that all cat Lottie animations have proper
 * face-forward orientation — i.e., they include head, eyes, nose, ears, and tail
 * so the cat looks like it's facing the user, not showing its back.
 *
 * Face features can be named at either:
 *   - Layer level: layer.nm contains the feature name
 *   - Shape level: layer.shapes[].nm contains the feature name
 */

const ASSETS_DIR = path.resolve(__dirname, "../assets");

// Helper: check if a feature name exists anywhere in the Lottie structure
// (layer names OR shape group names)
function hasFeature(lottie: any, featureName: string): boolean {
  const shapeLayers = (lottie.layers || []).filter((l: any) => l.ty === 4);
  const lower = featureName.toLowerCase();

  for (const layer of shapeLayers) {
    // Check layer-level name
    if (layer.nm && layer.nm.toLowerCase().includes(lower)) {
      return true;
    }
    // Check shape-level names
    if (layer.shapes) {
      for (const shape of layer.shapes) {
        if (shape.nm && shape.nm.toLowerCase().includes(lower)) {
          return true;
        }
      }
    }
  }
  return false;
}

// All animation files that should show the cat facing forward
const FACE_FORWARD_ANIMATIONS = [
  "cat-idle.json",
  "cat-speaking.json",
  "cat-listening.json",
  "cat-sleeping.json",
  "cat-happy.json",
];

describe("Cat animation files exist", () => {
  for (const filename of FACE_FORWARD_ANIMATIONS) {
    it(`${filename} should exist in assets`, () => {
      const filePath = path.join(ASSETS_DIR, filename);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  }
});

describe("Cat animations have face-forward features", () => {
  for (const filename of FACE_FORWARD_ANIMATIONS) {
    describe(filename, () => {
      let lottie: any;

      try {
        const filePath = path.join(ASSETS_DIR, filename);
        if (fs.existsSync(filePath)) {
          lottie = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        }
      } catch {
        // will be undefined, tests will fail as expected
      }

      it("should be valid Lottie JSON with layers", () => {
        expect(lottie).toBeDefined();
        expect(lottie.layers).toBeDefined();
        expect(lottie.layers.length).toBeGreaterThan(0);
      });

      it("should have a head feature", () => {
        expect(lottie).toBeDefined();
        expect(hasFeature(lottie, "head")).toBe(true);
      });

      it("should have an eyes feature", () => {
        expect(lottie).toBeDefined();
        expect(hasFeature(lottie, "eyes")).toBe(true);
      });

      it("should have a nose feature", () => {
        expect(lottie).toBeDefined();
        expect(hasFeature(lottie, "nose")).toBe(true);
      });

      it("should have an ears feature", () => {
        expect(lottie).toBeDefined();
        expect(hasFeature(lottie, "ears")).toBe(true);
      });

      it("should have a tail feature", () => {
        expect(lottie).toBeDefined();
        expect(hasFeature(lottie, "tail")).toBe(true);
      });
    });
  }
});

describe("Cat animation canvas dimensions", () => {
  for (const filename of FACE_FORWARD_ANIMATIONS) {
    it(`${filename} should use 200x200 canvas`, () => {
      const filePath = path.join(ASSETS_DIR, filename);
      expect(fs.existsSync(filePath)).toBe(true);
      const lottie = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      expect(lottie.w).toBe(200);
      expect(lottie.h).toBe(200);
    });
  }
});
