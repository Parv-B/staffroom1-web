import { useId, useState, type KeyboardEvent } from "react";
import { metricLabel } from "~/metrics/labels";
import { rangeText } from "~/progress/trend";
import { bucketName, bucketTick, describeBucket, trendSummary, type BucketPoint, type CentreTrend } from "./trend";

const W = 480;
const H = 220;
const PAD = { l: 44, r: 32, t: 24, b: 40 };

/** One measure across the centre's weeks or months, following the progress charts'
 *  conventions: one colour, no good/bad colouring, no targets, no fitted line or forecast.
 *  The line joins bucket medians; the shaded band is the middle half (p25 to p75). A bucket
 *  with no lectures is an empty gap (dotted guide), one with lectures but no value is a hatched
 *  N/A band; neither is ever drawn as zero. Buckets resting on one or two values carry "n=1"/
 *  "n=2" and a muted marker; any low-confidence value makes the marker hollow. Every bucket is
 *  focusable and states its values; the table below has them all. */
export function CentreTrendChart({ trend }: { trend: CentreTrend }) {
  const id = useId();
  const [active, setActive] = useState<BucketPoint | null>(null);
  const label = metricLabel(trend.metric);
  const { axis, points } = trend;
  const n = points.length;
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const x = (slot: number) => PAD.l + (n === 1 ? plotW / 2 : (slot / (n - 1)) * plotW);
  const y = (v: number) => PAD.t + (1 - v / (axis?.max ?? 1)) * plotH;
  const every = Math.max(1, Math.ceil(n / 6));
  const showTick = (slot: number) => slot % every === 0 || slot === n - 1;
  const half = n > 1 ? Math.min(9, plotW / (n - 1) / 2 - 1) : 9;

  return (
    <figure className="m-0 min-w-0 max-w-xl" data-centre-trend={trend.metric}>
      <h3 id={`${id}-h`} className="t-ui m-0 font-semibold">
        {label}
      </h3>
      {axis ? (
        <p className="t-small m-0 text-slate">Vertical axis: {rangeText(axis)}, from zero</p>
      ) : (
        <p className="t-small m-0 text-slate">Nothing to plot: no {trend.bucket} has a value for this measure.</p>
      )}
      {axis ? (
        <div className="relative">
          <svg viewBox={`0 0 ${W.toString()} ${H.toString()}`} className="block w-full" role="group" aria-labelledby={`${id}-h`} aria-describedby={`${id}-d`}>
            <defs>
              <pattern id={`${id}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                <rect width="7" height="7" fill="var(--sheet)" />
                <rect width="3" height="7" fill="var(--hatch)" />
              </pattern>
            </defs>
            {axis.ticks.map((t) => (
              <g key={t.value} aria-hidden="true">
                <line x1={PAD.l} x2={W - PAD.r} y1={y(t.value)} y2={y(t.value)} stroke="var(--slate)" strokeOpacity={t.value === 0 ? 0.6 : 0.15} strokeWidth="1" />
                <text x={PAD.l - 6} y={y(t.value) + 4} textAnchor="end" fontSize="12" fill="var(--slate)" fontFamily="var(--font-ui)" className="nums">
                  {t.label}
                </text>
              </g>
            ))}
            {points.map((p) =>
              showTick(p.slot) ? (
                <text key={p.start} aria-hidden="true" x={x(p.slot)} y={H - PAD.b + 18} textAnchor="middle" fontSize="12" fill="var(--slate)" fontFamily="var(--font-ui)" className="nums">
                  {bucketTick(p, trend.bucket)}
                </text>
              ) : null,
            )}
            {/* The middle half: a band along each run, or a bar for a run of one. */}
            {trend.runs.map((run) => {
              const first = run[0];
              if (!first) return null;
              if (run.length === 1) {
                if (first.p25 === null || first.p75 === null || first.p25 === first.p75) return null;
                return <rect key={`band-${first.start}`} aria-hidden="true" data-band={first.slot} x={x(first.slot) - 6} y={y(first.p75)} width="12" height={y(first.p25) - y(first.p75)} fill="var(--pen)" fillOpacity="0.14" />;
              }
              const upper = run.map((p) => `${x(p.slot).toFixed(1)},${y(p.p75 ?? p.median ?? 0).toFixed(1)}`);
              const lower = [...run].reverse().map((p) => `${x(p.slot).toFixed(1)},${y(p.p25 ?? p.median ?? 0).toFixed(1)}`);
              return <polygon key={`band-${first.start}`} aria-hidden="true" data-band={run.map((p) => p.slot).join(",")} points={[...upper, ...lower].join(" ")} fill="var(--pen)" fillOpacity="0.14" />;
            })}
            {trend.runs.map((run) =>
              run.length > 1 ? (
                <polyline
                  key={`line-${run[0]?.start ?? ""}`}
                  aria-hidden="true"
                  data-run={run.map((p) => p.slot).join(",")}
                  points={run.map((p) => `${x(p.slot).toFixed(1)},${y(p.median ?? 0).toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke="var(--pen)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null,
            )}
            {points.map((p) => {
              const cx = x(p.slot);
              const common = {
                role: "img",
                tabIndex: 0,
                "aria-label": describeBucket(p, trend.bucket),
                "data-bucket-state": p.state,
                ...(p.few ? { "data-few": p.n } : {}),
                ...(p.lowConfidence > 0 ? { "data-low-confidence": p.lowConfidence } : {}),
                className: "trend-point outline-none",
                onPointerEnter: () => {
                  setActive(p);
                },
                onPointerLeave: () => {
                  setActive((a) => (a?.start === p.start ? null : a));
                },
                onFocus: () => {
                  setActive(p);
                },
                onBlur: () => {
                  setActive((a) => (a?.start === p.start ? null : a));
                },
                onKeyDown: (e: KeyboardEvent) => {
                  if (e.key === "Escape") setActive(null);
                },
              } as const;
              const focusBox = <rect className="trend-focus" x={cx - half - 4} y={PAD.t - 4} width={2 * half + 8} height={plotH + 8} fill="none" stroke="var(--pen)" strokeWidth="2" rx="3" />;
              if (p.state === "no-lectures") {
                return (
                  <g key={p.start} {...common}>
                    <rect x={cx - half} y={PAD.t} width={2 * half} height={plotH} fill="transparent" />
                    <line x1={cx} x2={cx} y1={PAD.t} y2={PAD.t + plotH - 2} stroke="var(--slate)" strokeOpacity="0.35" strokeDasharray="2 4" />
                    {focusBox}
                  </g>
                );
              }
              if (p.median === null) {
                return (
                  <g key={p.start} {...common}>
                    <rect x={cx - half} y={PAD.t + 14} width={2 * half} height={plotH - 14} fill={`url(#${id}-hatch)`} />
                    <text x={cx} y={PAD.t + 8} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)" fontFamily="var(--font-ui)">
                      N/A
                    </text>
                    {focusBox}
                  </g>
                );
              }
              const cy = y(p.median);
              return (
                <g key={p.start} {...common}>
                  <circle cx={cx} cy={cy} r="12" fill="transparent" />
                  <circle className="trend-focus" cx={cx} cy={cy} r="9" fill="none" stroke="var(--pen)" strokeWidth="2" />
                  {p.lowConfidence > 0 ? (
                    <circle cx={cx} cy={cy} r="4.5" fill="var(--sheet)" stroke="var(--heather)" strokeWidth="2" />
                  ) : (
                    <circle cx={cx} cy={cy} r="4.5" fill={p.few ? "var(--slate)" : "var(--pen)"} stroke="var(--sheet)" strokeWidth="2" />
                  )}
                  {p.few ? (
                    <text x={cx} y={y(p.p75 ?? p.median) - 9} textAnchor="middle" fontSize="11" fill="var(--slate)" fontFamily="var(--font-ui)" className="nums" data-few-label>
                      n={p.n}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
          {active ? <Tip point={active} trend={trend} left={(x(active.slot) / W) * 100} top={((active.median === null ? PAD.t + plotH / 2 : y(active.median)) / H) * 100} /> : null}
        </div>
      ) : null}
      <figcaption id={`${id}-d`} className="t-small mt-1 text-slate">
        {trendSummary(trend)}
      </figcaption>
    </figure>
  );
}

function Tip({ point: p, trend, left, top }: { point: BucketPoint; trend: CentreTrend; left: number; top: number }) {
  const flip = left > 60;
  return (
    <div
      className="t-small pointer-events-none absolute z-10 w-60 border border-slate/40 bg-sheet px-3 py-2 shadow-[0_6px_20px_rgb(23_32_30/0.12)]"
      style={{ top: `calc(${top.toString()}% + 14px)`, ...(flip ? { right: `${(100 - left).toString()}%` } : { left: `${left.toString()}%` }) }}
      aria-hidden="true"
      data-trend-tooltip
    >
      <p className="m-0 font-semibold text-ink">{p.medianText ? `Median ${p.medianText}` : p.state === "no-lectures" ? "No lectures" : "N/A"}</p>
      <p className="m-0 text-slate">{bucketName(p, trend.bucket)}</p>
      {p.rangeText ? <p className="m-0 text-slate">Middle half: {p.rangeText}</p> : null}
      {p.state === "value" ? (
        <p className={`m-0 mt-1 ${p.few ? "font-semibold text-ink" : "text-slate"}`}>
          {p.few ? `Rests on only ${p.n.toString()} ${p.n === 1 ? "lecture" : "lectures"}` : `${p.n.toString()} lectures with a value`}
        </p>
      ) : null}
      {p.lowConfidence > 0 ? (
        <p className="m-0 mt-1 text-ink">
          Low confidence: {p.lowConfidence} of {p.n}
        </p>
      ) : null}
      {p.reason ? <p className="m-0 mt-1 text-ink">{p.reason}</p> : null}
    </div>
  );
}

export function CentreTrendLegend() {
  return (
    <ul className="t-small mt-3 flex list-none flex-wrap gap-x-6 gap-y-1 p-0 text-slate" aria-label="Chart key">
      <li className="inline-flex items-center gap-2">
        <svg width="22" height="14" aria-hidden="true">
          <rect x="0" y="2" width="22" height="10" fill="var(--pen)" fillOpacity="0.14" />
          <circle cx="11" cy="7" r="4.5" fill="var(--pen)" />
        </svg>
        Median, with the middle half shaded
      </li>
      <li className="inline-flex items-center gap-2">
        <svg width="14" height="14" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" fill="var(--slate)" />
        </svg>
        n=1, n=2: rests on one or two lectures
      </li>
      <li className="inline-flex items-center gap-2">
        <svg width="14" height="14" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" fill="var(--sheet)" stroke="var(--heather)" strokeWidth="2" />
        </svg>
        Includes low-confidence values (hollow)
      </li>
      <li className="inline-flex items-center gap-2">
        <span className="na-box nums">N/A</span>
        Lectures, but no value: the line breaks
      </li>
      <li className="inline-flex items-center gap-2">
        <svg width="10" height="14" aria-hidden="true">
          <line x1="5" x2="5" y1="0" y2="14" stroke="var(--slate)" strokeOpacity="0.6" strokeDasharray="2 3" />
        </svg>
        No lectures: a gap
      </li>
    </ul>
  );
}
