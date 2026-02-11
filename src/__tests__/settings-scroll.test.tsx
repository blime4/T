import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Issue: Settings window content gets clipped — can't scroll to bottom.
 * Root causes:
 * 1. .settings-root needs flex column layout so .tab-content fills remaining space
 * 2. .settings-root should use height:100vh (not min-height) to bound the scroll area
 * 3. .tab-content needs overflow-y:auto to scroll independently
 * 4. Rust window size is too small (520x560) — needs to be larger
 *
 * jsdom doesn't apply CSS stylesheets, so we verify CSS source directly.
 */

function getSettingsCSS(): string {
  return readFileSync(resolve(__dirname, "../Settings.css"), "utf-8");
}

function getRustMain(): string {
  return readFileSync(
    resolve(__dirname, "../../src-tauri/src/main.rs"),
    "utf-8"
  );
}

/** Extract the CSS block for a given selector (top-level only, no pseudo/hover) */
function extractRuleBlock(css: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(css)) !== null) {
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
    const hasOverflowHidden = /overflow\s*:\s*hidden/.test(block!);
    expect(hasOverflowHidden).toBe(false);
  });

  it(".settings-root should have overflow-y: auto for vertical scrolling", () => {
    const css = getSettingsCSS();
    const block = extractRuleBlock(css, ".settings-root");
    expect(block).not.toBeNull();
    const hasOverflowYAuto = /overflow-y\s*:\s*(auto|scroll)/.test(block!);
    expect(hasOverflowYAuto).toBe(true);
  });

  it(".settings-root should use flex column layout", () => {
    const css = getSettingsCSS();
    const block = extractRuleBlock(css, ".settings-root");
    expect(block).not.toBeNull();
    expect(/display\s*:\s*flex/.test(block!)).toBe(true);
    expect(/flex-direction\s*:\s*column/.test(block!)).toBe(true);
  });

  it(".settings-root should use height:100vh (not min-height) to bound scroll area", () => {
    const css = getSettingsCSS();
    const block = extractRuleBlock(css, ".settings-root");
    expect(block).not.toBeNull();
    // Need height: 100vh so the container is bounded, not min-height which grows unbounded
    expect(/(?<![min-])height\s*:\s*100vh/.test(block!)).toBe(true);
  });

  it(".tab-content should have overflow-y: auto and flex:1", () => {
    const css = getSettingsCSS();
    const block = extractRuleBlock(css, ".tab-content");
    expect(block).not.toBeNull();
    expect(/overflow-y\s*:\s*(auto|scroll)/.test(block!)).toBe(true);
    expect(/flex\s*:\s*1/.test(block!)).toBe(true);
  });
});

describe("Settings window size (Rust)", () => {
  /**
   * Extract the settings window builder block from main.rs.
   * We look for the "settings" label in WindowBuilder::new and grab
   * the chained builder calls that follow.
   */
  function getSettingsWindowBlock(): string {
    const rust = getRustMain();
    // Match from "settings" window label to .build()
    const match = rust.match(
      /"settings",\s*WindowUrl::App[^)]*\)\s*\)([\s\S]*?)\.build\(\)/
    );
    expect(match).not.toBeNull();
    return match![1];
  }

  it("settings window should be at least 640x720", () => {
    const block = getSettingsWindowBlock();
    const sizeMatch = block.match(/\.inner_size\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
    expect(sizeMatch).not.toBeNull();
    const width = parseFloat(sizeMatch![1]);
    const height = parseFloat(sizeMatch![2]);
    expect(width).toBeGreaterThanOrEqual(640);
    expect(height).toBeGreaterThanOrEqual(720);
  });

  it("settings window min size should be at least 520x600", () => {
    const block = getSettingsWindowBlock();
    const minMatch = block.match(/\.min_inner_size\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
    expect(minMatch).not.toBeNull();
    const width = parseFloat(minMatch![1]);
    const height = parseFloat(minMatch![2]);
    expect(width).toBeGreaterThanOrEqual(520);
    expect(height).toBeGreaterThanOrEqual(600);
  });
});
