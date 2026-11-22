// Small DOM helpers shared by the pages.
import type { Mastery } from "../../kernel/skills.ts";

export function el(tag: string, attrs: Record<string, string | null> = {}, text?: string): HTMLElement {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

export function button(text: string, onClick: () => void, cls = "btn go", id?: string): HTMLButtonElement {
  const b = el("button", { type: "button", class: cls, id: id ?? null }, text) as HTMLButtonElement;
  b.addEventListener("click", onClick);
  return b;
}

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

export function masteryLabel(m: Mastery): string {
  return { unknown: "not learned", novice: "novice", practiced: "practiced", mastered: "mastered" }[m];
}

let toastTimer = 0;
/** A short message at the bottom of the screen. */
export function toast(text: string): void {
  document.querySelector(".toast")?.remove();
  const t = el("div", { class: "toast", role: "status" }, text);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.remove(), 3200);
}

/** A ring showing points out of max. */
export function scoreRing(points: number, max: number): string {
  const r = 18, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, points / max));
  return `<svg class="score-ring" viewBox="0 0 46 46" aria-label="${points} of ${max}"><circle cx="23" cy="23" r="${r}" fill="none" stroke-width="5" class="track"/><circle cx="23" cy="23" r="${r}" fill="none" stroke-width="5" class="val" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 23 23)" stroke-linecap="round"/><text x="23" y="27" text-anchor="middle">${points}</text></svg>`;
}
