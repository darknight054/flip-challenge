const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact relative time for meta lines: "now", "40m", "3h", "2d", then "12 Oct". */
export function relativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  if (diff < MINUTE) return "now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d`;
  const sameYear = new Date(then).getFullYear() === new Date(now).getFullYear();
  return sameYear ? dayMonth(iso) : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Full date for `title` attributes. */
export function fullDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" });
}

/** "{d MMM}", e.g. "12 Oct". */
export function dayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** "{Mon YYYY}", e.g. "Oct 2026". */
export function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many.replace("{n}", String(n));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length === 1 ? parts[0].slice(0, 1) : parts[0][0] + parts[parts.length - 1][0];
  return letters.toUpperCase();
}
