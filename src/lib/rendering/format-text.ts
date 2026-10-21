/**
 * Placeholder substitution for text elements, e.g.
 *   "{host_name} invites you" or "{event_date|long} at {event_time|time}".
 *
 * Formatting is implemented by hand (not Intl) so that the server and every
 * browser produce exactly the same characters.
 */
import { PLACEHOLDER_RE } from "@/lib/templates/schema";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCMonth() !== Number(m[2]) - 1) return null;
  return d;
}

function ordinal(n: number): string {
  const s = n % 100;
  if (s >= 11 && s <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

function formatTime(value: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = m[2]!;
  if (hours > 23 || Number(minutes) > 59) return null;
  const suffix = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === "00" ? `${h12} ${suffix}` : `${h12}:${minutes} ${suffix}`;
}

export function applyFormatter(value: string, formatter: string | undefined): string {
  if (!formatter) {
    const date = parseDate(value);
    if (date) return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
    const time = formatTime(value);
    if (time) return time;
    return value;
  }
  if (formatter === "upper") return value.toUpperCase();
  if (formatter === "time") return formatTime(value) ?? value;
  const date = parseDate(value);
  if (!date) return value;
  const day = date.getUTCDate();
  const month = MONTHS[date.getUTCMonth()]!;
  const year = date.getUTCFullYear();
  const weekday = WEEKDAYS[date.getUTCDay()]!;
  switch (formatter) {
    case "long":
      return `${weekday}, ${day} ${month} ${year}`;
    case "short":
      return `${String(day).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.${year}`;
    case "dots":
      return `${String(day).padStart(2, "0")} · ${String(date.getUTCMonth() + 1).padStart(2, "0")} · ${String(year).slice(2)}`;
    case "day":
      return String(day);
    case "ordinal":
      return ordinal(day);
    case "month":
      return month;
    case "mon":
      return month.slice(0, 3);
    case "year":
      return String(year);
    case "weekday":
      return weekday;
    case "daymonth":
      return `${ordinal(day)} ${month}`;
    default:
      return value;
  }
}

export const FORMATTERS = ["upper", "time", "long", "short", "dots", "day", "ordinal", "month", "mon", "year", "weekday", "daymonth"] as const;

/**
 * Replaces placeholders. Returns null when the text references fields and all
 * of them are empty, so optional lines (e.g. "RSVP to …") disappear cleanly.
 */
export function resolveContent(content: string, fields: Record<string, string>): string | null {
  let placeholders = 0;
  let filled = 0;
  const out = content.replace(PLACEHOLDER_RE, (_match, key: string, formatter: string | undefined) => {
    placeholders++;
    const raw = (fields[key] ?? "").trim();
    if (raw) filled++;
    return raw ? applyFormatter(raw, formatter) : "";
  });
  if (placeholders > 0 && filled === 0) return null;
  return out.replace(/[ \t]{2,}/g, " ").trim();
}
