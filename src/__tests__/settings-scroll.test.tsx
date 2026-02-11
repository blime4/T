import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Issue: Settings window content gets clipped because .settings-root
 * has `overflow: hidden`. We need `overflow-y: auto` so the page scrolls
 * when content exceeds the window height.
 *
 * jsdom doesn't apply CSS stylesheets to getComputedStyle, so we verify
 * the CSS source directly — this is the most reliable approach.
 */

function getSettingsCSS(): string {
  return readFileSync(resolve(__dirname, "../Settings.css"), "utf-8");
}

/** Extract the CSS block for a given selector (top-level only, no nested) */
function extractRuleBlock(css: string, selector: string): string | null {
  // Escape special regex chars in selector
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match the selector followed by { ... } (non-greedy, first closing brace)
  const regex = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g");
  let match: RegExpExecArray | null;
  // Return the first match that is NOT inside a media query or pseudo-element
  while ((match = regex.exec(css)) !== null) {
    // Check that this isn't .settings-root::before or similar
    const before = css.substring(Math.max(0, match.index - 1), match.index);
    const fullMatch = match[0];
    if (!fullMatch.includes("::") && !fullMatch.includes(":hover")) {
      return match[1];
    }
  }
  return null;
}

describe("Settings page scrollability (CSS)", () => {
  it(".settings-root should NOT have overflow: hidden", () => {
    const css = getSettingsCSS();
    const block = extractRuleBlock(css, ".settings-root");
    expect(block).not.toBeNull();

    // Should not contain overflow: hidden (which clips content)
    const hasOverflowHidden = /overflow\s*:\s*hidden/.test(block!);
    expect(hasOverflowHidden).toBe(false);
  });

  it(".settings-root should have overflow-y: auto for vertical scrolling", () => {
    const css = getSettingsCSS();
    const block = extractRuleBlock(css, ".settings-root");
    expect(block).not.toBeNull();

    // Should contain overflow-y: auto (or scroll)
    const hasOverflowYAuto = /overflow-y\s*:\s*(auto|scroll)/.test(block!);
    expect(hasOverflowYAuto).toBe(true);
  });
});
