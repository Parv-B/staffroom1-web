import { useId, useState, type KeyboardEvent } from "react";
import { metricLabel } from "~/metrics/labels";
import { rangeText, type Trend, type TrendPoint } from "./trend";

const W = 480;
const H = 210;
const PAD = { l: 44, r: 32, t: 14, b: 40 };
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const fullDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** One measure across lectures. A plain line in one colour: no good/bad colouring, no target or
 *  reference lines, no fitted line or forecast. N/A is a break in the line with "N/A" written
 *  in its place; low-confidence values are hollow markers. Every point (and every N/A) can be
 *  focused and shows the lecture, the value and any reason; the table below has every value. */
export function TrendChart({ trend }: { trend: Trend }) {
  const id = useId();
  const [active, setActive] = useState<TrendPoint | null>(null);
  const label = metricLabel(trend.metric);
  const { axis, points } = trend;
  const n = points.length;

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  // Lectures are evenly spaced in upload order (not to time scale); one lecture sits mid-plot.
  const x = (slot: number) => PAD.l + (n === 1 ? plotW / 2 : (slot / (n - 1)) * plotW);
  const y = (v: number) => PAD.t + (1 - v / (axis?.max ?? 1)) * plotH;
  // Date labels: all when they fit, otherwise every k-th plus the last.
  const every = Math.max(1, Math.ceil(n / 6));
  const showDate = (slot: number) => slot % every === 0 || slot === n - 1;

  const describe = (p: TrendPoint) => {
    const when = `${fullDate.format(new Date(p.createdAt))}, ${p.title}`;
    if (p.state === "na" || p.state === "not-computed") return `${when}: N/A. ${p.reason ?? ""}`;
    if (p.state === "low-confidence") return `${when}: ${p.text ?? ""}, low confidence. ${p.reason ?? ""}`;
    return `${when}: ${p.text ?? ""}`;
  };

  return (
    <figure className="m-0 min-w-0 max-w-xl" data-trend={trend.metric}>
      <h3 id={`${id}-h`} className="t-ui m-0 font-semibold">
        {label}
      </h3>
      {axis ? (
        <p className="t-small m-0 text-slate">Vertical axis: {rangeText(axis)}, from zero</p>
      ) : (
        <p className="t-small m-0 text-slate">Nothing to plot: no lecture has a value for this measure.</p>
      )}
      {axis ? (
        <div className="relative">
          <svg viewBox={`0 0 ${W.toString()} ${H.toString()}`} className="block w-full" role="group" aria-labelledby={`${id}-h`} aria-describedby={`${id}-d`}>
            {axis.ticks.map((t) => (
              <g key={t.value} aria-hidden="true">
                <line x1={PAD.l} x2={W - PAD.r} y1={y(t.value)} y2={y(t.value)} stroke="var(--slate)" strokeOpacity={t.value === 0 ? 0.6 : 0.15} strokeWidth="1" />
                <text x={PAD.l - 6} y={y(t.value) + 4} textAnchor="end" fontSize="12" fill="var(--slate)" fontFamily="var(--font-ui)" className="nums">
                  {t.label}
                </text>
              </g>
            ))}
            {points.map((p) =>
              showDate(p.slot) ? (
                <text key={p.lectureId} aria-hidden="true" x={x(p.slot)} y={H - PAD.b + 18} textAnchor="middle" fontSize="12" fill="var(--slate)" fontFamily="var(--font-ui)" className="nums">
                  {dayMonth.format(new Date(p.createdAt))}
                </text>
              ) : null,
            )}
            {trend.runs.map((run) =>
              run.length > 1 ? (
                <polyline
                  key={run[0]?.lectureId}
                  aria-hidden="true"
                  data-run={run.map((p) => p.slot).join(",")}
                  points={run.map((p) => `${x(p.slot).toFixed(1)},${y(p.value ?? 0).toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke="var(--pen)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null,
            )}
            <defs>
              <pattern id={`${id}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                <rect width="7" height="7" fill="var(--sheet)" />
                <rect width="3" height="7" fill="var(--hatch)" />
              </pattern>
            </defs>
            {points.map((p) => {
              const cx = x(p.slot);
              const show = () => {
                setActive(p);
              };
              const hide = () => {
                setActive((a) => (a?.lectureId === p.lectureId ? null : a));
              };
              const common = {
                role: "img",
                tabIndex: 0,
                "aria-label": describe(p),
                "data-point-state": p.state,
                className: "trend-point outline-none",
                onPointerEnter: show,
                onPointerLeave: hide,
                onFocus: show,
                onBlur: hide,
                onKeyDown: (e: KeyboardEvent) => {
                  if (e.key === "Escape") setActive(null);
                },
              } as const;
              if (p.value === null) {
                // N/A: a hatched band over the whole height, so it can't be read as any value.
                return (
                  <g key={p.lectureId} {...common}>
                    <rect x={cx - 9} y={PAD.t + 16} width="18" height={plotH - 16} fill={`url(#${id}-hatch)`} />
                    <text x={cx} y={PAD.t + 10} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)" fontFamily="var(--font-ui)">
                      N/A
                    </text>
                    <rect className="trend-focus" x={cx - 15} y={PAD.t - 2} width="30" height={plotH + 4} fill="none" stroke="var(--pen)" strokeWidth="2" rx="3" />
                  </g>
                );
              }
              const cy = y(p.value);
              return (
                <g key={p.lectureId} {...common}>
                  {/* Hit area larger than the mark. */}
                  <circle cx={cx} cy={cy} r="12" fill="transparent" />
                  <circle className="trend-focus" cx={cx} cy={cy} r="9" fill="none" stroke="var(--pen)" strokeWidth="2" />
                  {p.state === "low-confidence" ? (
                    <circle cx={cx} cy={cy} r="4.5" fill="var(--sheet)" stroke="var(--heather)" strokeWidth="2" />
                  ) : (
                    <circle cx={cx} cy={cy} r="4.5" fill="var(--pen)" stroke="var(--sheet)" strokeWidth="2" />
                  )}
                </g>
              );
            })}
          </svg>
          {active ? <Tooltip point={active} left={(x(active.slot) / W) * 100} top={((active.value === null ? PAD.t + plotH / 2 : y(active.value)) / H) * 100} /> : null}
        </div>
      ) : null}
      <figcaption id={`${id}-d`} className="t-small mt-1 text-slate">
        {summary(trend)}
      </figcaption>
    </figure>
  );
}

function Tooltip({ point: p, left, top }: { point: TrendPoint; left: number; top: number }) {
  const flip = left > 60;
  return (
    <div
      className="t-small pointer-events-none absolute z-10 w-56 border border-slate/40 bg-sheet px-3 py-2 shadow-[0_6px_20px_rgb(23_32_30/0.12)]"
      style={{ top: `calc(${top.toString()}% + 14px)`, ...(flip ? { right: `${(100 - left).toString()}%` } : { left: `${left.toString()}%` }) }}
      aria-hidden="true"
      data-trend-tooltip
    >
      <p className="m-0 font-semibold text-ink">{p.value === null ? "N/A" : p.text}</p>
      <p className="m-0 text-slate">
        {p.title}, {fullDate.format(new Date(p.createdAt))}
      </p>
      {p.state === "low-confidence" ? <p className="m-0 mt-1 text-ink">Low confidence: {p.reason}</p> : null}
      {p.value === null ? <p className="m-0 mt-1 text-ink">{p.reason}</p> : null}
    </div>
  );
}

function plural(n: number, one: string, many: string): string {
  return `${n.toString()} ${n === 1 ? one : many}`;
}

/** The chart in words (also its accessible description). States counts only: no direction. */
export function summary(t: Trend): string {
  const parts = [`${plural(t.points.length, "analysed lecture", "analysed lectures")} by upload date, evenly spaced: ${plural(t.counts.plotted, "has a value", "have a value")}`];
  if (t.counts.lowConfidence > 0) parts.push(`${t.counts.lowConfidence.toString()} of them low confidence (hollow markers)`);
  const gaps = t.counts.na + t.counts.notComputed;
  if (gaps > 0) parts.push(plural(gaps, "is N/A, shown as a break in the line", "are N/A, shown as breaks in the line"));
  return `${parts.join("; ")}. Exact values are in the table below.`;
}
