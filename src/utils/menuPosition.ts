/**
 * Calculates the adjusted position for a context menu to prevent
 * it from overflowing the window boundaries.
 */
export interface MenuPosition {
  x: number;
  y: number;
}

export interface WindowBounds {
  width: number;
  height: number;
}

export interface MenuSize {
  width: number;
  height: number;
}

/**
 * Given a click position, menu size, and window bounds,
 * returns an adjusted position that keeps the menu fully visible.
 *
 * Strategy:
 *  1. If menu fits to the right/below the click point → use click position as-is.
 *  2. If it overflows right → flip: place menu to the LEFT of the click point.
 *  3. If it overflows bottom → flip: place menu ABOVE the click point.
 *  4. Clamp to [0, windowBound - menuSize] so it never goes off-screen.
 */
export function adjustMenuPosition(
  click: MenuPosition,
  menuSize: MenuSize,
  windowBounds: WindowBounds
): MenuPosition {
  let x = click.x;
  let y = click.y;

  // Flip horizontally if overflows right edge
  if (x + menuSize.width > windowBounds.width) {
    x = click.x - menuSize.width;
  }

  // Flip vertically if overflows bottom edge
  if (y + menuSize.height > windowBounds.height) {
    y = click.y - menuSize.height;
  }

  // Clamp so menu never goes off the left/top edge
  x = Math.max(0, x);
  y = Math.max(0, y);

  return { x, y };
}
