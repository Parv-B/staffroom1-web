import type { SeriesResult } from "~/analysis/types.gen";
import { mmss } from "~/lib/format";
import { StatusMark } from "./StatusMark";

/** Speaking rate over the lesson. The axis starts at zero; a minute with too little teacher
 *  speech (null) is a gap in the line, never a drop to zero. A table gives the same numbers. */
export function WpmChart({ series: s }: { series: SeriesResult }) {
  const W = 720;
  const H = 220;
  const pad = { l: 44, r: 12, t: 12, b: 32 };
  const values = s.values;
  const max = Math.max(50, ...values.filter((v): v is number => v !== null));
  const yMax = Math.ceil(max / 50) * 50;
  const x = (ms: number) => pad.l + (ms / s.duration_ms) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / yMax) * (H - pad.t - pad.b);
  const mid = (i: number) => Math.min(s.duration_ms, i * s.bin_ms + s.bin_ms / 2);
  // Runs of consecutive non-null bins become separate lines; single bins become dots.
  const runs: { i: number; v: number }[][] = [];
  values.forEach((v, i) => {
    if (v === null) return;
    const last = runs[runs.length - 1];
    const prev = last?.[last.length - 1];
    if (last && prev?.i === i - 1) last.push({ i, v });
    else runs.push([{ i, v }]);
  });
  const minutes = s.duration_ms / 60_000;
  const step = minutes > 90 ? 20 : 10;
  const xTicks = Array.from({ length: Math.floor(minutes / step) + 1 }, (_, k) => k * step * 60_000);
  const yTicks = Array.from({ length: yMax / 50 + 1 }, (_, k) => k * 50);
  const nNull = values.filter((v) => v === null).length;
  return (
    <figure className="m-0">
      {s.confidence === "low" ? (
        <p className="mb-2">
          <StatusMark kind="low-confidence" /> <span className="t-small text-slate">{s.reason_low_confidence ?? "No reason was recorded."}</span>
        </p>
      ) : null}
      <svg viewBox={`0 0 ${W.toString()} ${H.toString()}`} className="w-full max-w-3xl" role="img" aria-label={`Teacher speaking rate per minute over the lesson, 0 to ${yMax.toString()} words a minute. ${nNull.toString()} minutes had too little teacher speech and are left as gaps. The same figures are in the table below.`}>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--slate)" strokeOpacity={t === 0 ? 0.6 : 0.15} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--slate)" className="nums" fontFamily="var(--font-ui)">
              {t}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={H - 10} textAnchor="middle" fontSize="12" fill="var(--slate)" fontFamily="var(--font-ui)">
            {mmss(t)}
          </text>
        ))}
        {runs.map((r) =>
          r.length === 1 && r[0] ? (
            <circle key={r[0].i} cx={x(mid(r[0].i))} cy={y(r[0].v)} r="2.5" fill="var(--pen)" />
          ) : (
            <polyline key={r[0]?.i} points={r.map((p) => `${x(mid(p.i)).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")} fill="none" stroke="var(--pen)" strokeWidth="2" strokeLinejoin="round" />
          ),
        )}
      </svg>
      <figcaption className="t-small measure mt-2 text-slate">
        Words a minute, per {Math.round(s.bin_ms / 1000).toString()}-second stretch. Gaps are stretches with under 5 seconds of teacher speech ({nNull} of {values.length}), too little to give a rate.
      </figcaption>
      <details className="t-small mt-2">
        <summary className="action w-fit">Show the figures as a table</summary>
        <table className="nums mt-2 border-collapse">
          <thead>
            <tr>
              <th className="pr-6 text-left font-semibold">From</th>
              <th className="text-right font-semibold">Words a minute</th>
            </tr>
          </thead>
          <tbody>
            {values.map((v, i) => (
              <tr key={i}>
                <td className="pr-6">{mmss(i * s.bin_ms)}</td>
                <td className="text-right">{v === null ? <span className="text-slate">N/A, too little speech</span> : Math.round(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
