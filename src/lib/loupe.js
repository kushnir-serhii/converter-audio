/**
 * Where to put the magnifier relative to the point it is magnifying.
 *
 * The one hard requirement is that it must never sit on top of that point —
 * covering the corner you are adjusting defeats the purpose. So it is offset
 * to one side, and flips to the opposite side when there isn't room, rather
 * than being clamped into place on top of the anchor.
 *
 * Coordinates are viewport pixels, matching a `position: fixed` element.
 */
export function loupePlacement(anchorX, anchorY, size, gap, viewportW, viewportH) {
  // Preferred corner: above and to the left of the anchor.
  let left = anchorX - size - gap;
  let top = anchorY - size - gap;

  // Flip to the far side when the preferred one would run off the viewport.
  if (left < gap) left = anchorX + gap;
  if (top < gap) top = anchorY + gap;

  // If the flipped side doesn't fit either, clamp — but clamp to the side of
  // the anchor with more room, so the anchor still stays uncovered.
  const maxLeft = Math.max(gap, viewportW - size - gap);
  const maxTop = Math.max(gap, viewportH - size - gap);
  if (left > maxLeft) left = Math.max(gap, anchorX - size - gap);
  if (top > maxTop) top = Math.max(gap, anchorY - size - gap);

  return {
    left: Math.min(Math.max(left, gap), maxLeft),
    top: Math.min(Math.max(top, gap), maxTop),
  };
}

/** Viewport position of a point given in an image's natural pixels. */
export function naturalToClient(rect, naturalX, naturalY, naturalW, naturalH) {
  if (!(naturalW > 0) || !(naturalH > 0)) return { x: rect.left, y: rect.top };
  return {
    x: rect.left + (naturalX / naturalW) * rect.width,
    y: rect.top + (naturalY / naturalH) * rect.height,
  };
}
