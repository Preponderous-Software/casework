// The time-of-death evidence chart: one bar per piece of timing evidence, where they agree, the
// player's window, and (after signing) the real time. All times are hours before the body was found.
import { esc } from "./dom.ts";

export interface ChartBar {
  label: string;
  from: number;
  to: number;
  /** novice | practiced | mastered | given: sets the bar's colour. */
  mastery: string;
}

export interface ChartInput {
  bars: ChartBar[];
  /** Hours shown, from `span` before found (left) to found (right). */
  span: number;
  clock(hoursBefore: number): string;
  agree: { from: number; to: number } | null;
  window: { from: number; to: number } | null;
  truth?: number;
}

export function evidenceChart(c: ChartInput): string {
  const W = 360, left = 84, right = 24, top = 14, rowH = 26;
  const rows = Math.max(c.bars.length, 1);
  const H = top + rows * rowH + 50;
  const x = (h: number) => left + ((c.span - Math.min(c.span, Math.max(0, h))) / c.span) * (W - left - right);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Time-of-death evidence and your window">`;
  for (let h = c.span; h >= 0; h -= c.span / 4) {
    s += `<line x1="${x(h)}" y1="${top - 6}" x2="${x(h)}" y2="${H - 30}" class="grid"/><text x="${x(h)}" y="${H - 14}" text-anchor="middle" class="axis">${c.clock(h)}</text>`;
  }
  s += `<text x="${x(0)}" y="${top - 2}" text-anchor="end" class="axis">found</text>`;
  if (!c.bars.length) s += `<text x="${left}" y="${top + 16}" class="axis">Interpret findings to add timing evidence.</text>`;
  c.bars.forEach((b, i) => {
    const y = top + i * rowH;
    s += `<text x="${left - 6}" y="${y + 14}" text-anchor="end" class="lab">${esc(b.label)}</text><rect x="${x(b.to)}" y="${y + 3}" width="${Math.max(2, x(b.from) - x(b.to))}" height="15" rx="4" class="bar m-${esc(b.mastery)}"/>`;
  });
  const yb = top + rows * rowH;
  if (c.bars.length >= 2 && c.agree) {
    s += `<rect x="${x(c.agree.to)}" y="${top - 2}" width="${Math.max(2, x(c.agree.from) - x(c.agree.to))}" height="${yb - top}" class="overlap"/>`;
  }
  if (c.window) {
    s += `<rect x="${x(c.window.to)}" y="${yb + 2}" width="${Math.max(2, x(c.window.from) - x(c.window.to))}" height="7" rx="3.5" class="win"/><text x="${left - 6}" y="${yb + 10}" text-anchor="end" class="lab">Yours</text>`;
  }
  if (c.truth !== undefined) s += `<line x1="${x(c.truth)}" y1="${top - 8}" x2="${x(c.truth)}" y2="${yb + 12}" class="truth"/>`;
  return s + "</svg>";
}
