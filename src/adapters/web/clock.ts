// Clock adapter: today's day number for the review scheduler (days since 1970-01-01, local time).
export function today(): number {
  const d = new Date();
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86_400_000);
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
