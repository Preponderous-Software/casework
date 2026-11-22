// Pointer coordinates to the screen space the camera understands. Pure: no DOM, no engine.
//
// The trap (met first in Tangle): the canvas's drawing buffer is its CSS size times the device
// pixel ratio, CAPPED (the kit's dprCap, 2 here). A DPR-3 phone therefore draws at 2x, and a
// pointer position must be scaled by drawable size / CSS size (2), never by devicePixelRatio (3).
// The safest path, which the exam view uses, keeps pointers in CSS pixels all the way to
// normalised device coordinates, so the pixel ratio never enters picking. The drawable path is here
// too, for code that reads pixels, and the tests check both agree at DPR 1, 2 and 3.

export function effectiveDpr(deviceDpr: number, cap: number): number {
  return Math.min(deviceDpr || 1, cap);
}

// The drawing buffer's size for a canvas of cssW x cssH CSS pixels (as the kit sizes it).
export function drawableSize(cssW: number, cssH: number, deviceDpr: number, cap: number): [number, number] {
  const d = effectiveDpr(deviceDpr, cap);
  return [Math.max(1, Math.round(cssW * d)), Math.max(1, Math.round(cssH * d))];
}

// Drawable pixels per CSS pixel along each axis: the only correct pointer scale.
export function pointerScale(drawW: number, drawH: number, cssW: number, cssH: number): [number, number] {
  return [drawW / Math.max(cssW, 1), drawH / Math.max(cssH, 1)];
}

// CSS pixels relative to the canvas's top-left -> normalised device coordinates (y up).
export function cssToNdc(x: number, y: number, cssW: number, cssH: number): [number, number] {
  return [(x / Math.max(cssW, 1)) * 2 - 1, 1 - (y / Math.max(cssH, 1)) * 2];
}

// CSS pixels -> drawing-buffer pixels.
export function cssToDrawable(x: number, y: number, drawW: number, drawH: number, cssW: number, cssH: number): [number, number] {
  const [sx, sy] = pointerScale(drawW, drawH, cssW, cssH);
  return [x * sx, y * sy];
}

// Drawing-buffer pixels -> normalised device coordinates.
export function drawableToNdc(px: number, py: number, drawW: number, drawH: number): [number, number] {
  return [(px / Math.max(drawW, 1)) * 2 - 1, 1 - (py / Math.max(drawH, 1)) * 2];
}

// Normalised device coordinates -> CSS pixels relative to the canvas.
export function ndcToCss(nx: number, ny: number, cssW: number, cssH: number): [number, number] {
  return [((nx + 1) / 2) * cssW, ((1 - ny) / 2) * cssH];
}
