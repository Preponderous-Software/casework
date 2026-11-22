// Converting between clock times and "hours before the body was found".

/** Clock time (HH:MM) `hoursBefore` hours before `foundAt`. */
export function toClock(foundAt: number, hoursBefore: number): string {
  const t = (((foundAt - hoursBefore) % 24) + 24) % 24;
  let hh = Math.floor(t);
  let mm = Math.round((t - hh) * 60);
  if (mm === 60) {
    hh = (hh + 1) % 24;
    mm = 0;
  }
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Hours before `foundAt` for a clock time "HH:MM", taking it as the most recent such time at or
 * before the finding (so 23:00 the evening before a 07:40 finding is 8.67 h). Null if malformed. */
export function fromClock(foundAt: number, hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const t = Number(m[1]) + Number(m[2]) / 60;
  if (t >= 24) return null;
  let h = foundAt - t;
  if (h < 0) h += 24;
  return Math.round(h * 100) / 100;
}
