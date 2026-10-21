/** mm:ss from milliseconds, minutes uncapped (95:12), the same as the backend's summaries. */
export function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function timeRange(startMs: number, endMs: number): string {
  return `${mmss(startMs)}–${mmss(endMs)}`;
}

/** A spoken duration: "1.3 s", "13 min 5 s", "1 h 2 min". */
export function duration(seconds: number): string {
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds).toString()} s`;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} h ${m} min`;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}

/** Formats a metric value that exists. Missing values never come here: they are N/A. */
export function metricValue(value: number, unit: string): string {
  switch (unit) {
    case "count":
      return Math.round(value).toString();
    case "fraction": {
      const pct = value * 100;
      if (pct > 0 && pct < 1) return `${pct.toFixed(1)}%`;
      return `${Math.round(pct).toString()}%`;
    }
    case "s":
      return duration(value);
    case "words/min":
      return `${value.toFixed(0)} words/min`;
    default:
      return `${value.toString()} ${unit}`;
  }
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });
export function longDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}
