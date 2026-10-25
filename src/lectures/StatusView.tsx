import type { Schemas } from "~/api/client";
import type { Role } from "~/auth/session";
import { duration } from "~/lib/format";
import type { LectureDetail, StageOut } from "./detail";
import { STAGES, STAGE_STATUS_LABEL } from "./stages";

type Estimate = Schemas["ProcessingEstimate"];

export interface StageRow {
  stage: string;
  label: string;
  status: string;
  seconds: number | null;
  startedAt: string | null;
  error: string | null;
}

/** All 13 stages in pipeline order. Stages the API hasn't reported yet are waiting. */
export function stageRows(stages: readonly StageOut[]): StageRow[] {
  const byName = new Map(stages.map((s) => [s.stage, s]));
  const known: StageRow[] = STAGES.map(([stage, label]) => {
    const s = byName.get(stage);
    return { stage, label, status: s?.status ?? "pending", seconds: s?.seconds ?? null, startedAt: s?.started_at ?? null, error: s?.error ?? null };
  });
  // A stage the frontend doesn't know yet is still shown, after the known ones.
  const extra = stages.filter((s) => !STAGES.some(([n]) => n === s.stage)).map((s) => ({ stage: s.stage, label: s.stage, status: s.status, seconds: s.seconds ?? null, startedAt: s.started_at ?? null, error: s.error ?? null }));
  return [...known, ...extra];
}

const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

function sentence(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? "" : ".") : s;
}

export type EstimateState =
  | { kind: "no-duration" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; estimate: Estimate };

/** What to say about time. Uses only the API's per-stage estimates: remaining stages are
 *  summed, and time already spent in the running stage is subtracted from that stage's. */
export function estimateText(rows: readonly StageRow[], e: EstimateState, now: number): { main: string; detail: string | null } {
  if (e.kind === "no-duration") return { main: "There's no time estimate yet, because the recording's length isn't known until processing has read it.", detail: null };
  if (e.kind === "loading") return { main: "Working out a time estimate.", detail: null };
  if (e.kind === "error") return { main: "The time estimate couldn't be loaded.", detail: null };
  const est = e.estimate;
  if (est.total_estimate_seconds == null) return { main: sentence(est.reason_if_unavailable ?? "There isn't enough history in this centre to estimate the time yet."), detail: null };
  const per = new Map(est.stages.map((s) => [s.stage, s.estimate_seconds]));
  let left = 0;
  let overrun = false;
  for (const r of rows) {
    const s = per.get(r.stage);
    if (s == null || r.status === "done" || r.status === "cached" || r.status === "failed") continue;
    if (r.status === "running" && r.startedAt) {
      const spent = (now - Date.parse(r.startedAt)) / 1000;
      if (spent > s) overrun = true;
      left += Math.max(0, s - spent);
    } else left += s;
  }
  const runs = est.n_runs === 1 ? "the last lecture" : `the last ${est.n_runs.toString()} lectures`;
  const main = left < 60 ? "Less than a minute left, if this lecture runs like the others." : `About ${duration(Math.round(left / 60) * 60)} left.`;
  return { main, detail: `Estimated from ${runs} processed in your centre, scaled to this recording's length. ${overrun ? "The current step is taking longer than usual." : "Some lectures take longer."}` };
}

interface Props {
  detail: LectureDetail;
  role: Role;
  estimate: EstimateState;
  now: number;
}

export function StatusView({ detail, role, estimate, now }: Props) {
  const rows = stageRows(detail.stages);
  const showErrors = role !== "owner"; // the API hides stage errors from owners too
  const failed = rows.find((r) => r.status === "failed");
  const inProgress = detail.status === "queued" || detail.status === "running";
  const est = inProgress ? estimateText(rows, estimate, now) : null;
  return (
    <div className="space-y-6">
      <div className="measure" aria-live="polite">
        {detail.status === "done" ? (
          <p className="t-reading m-0">
            Processing finished{detail.total_seconds != null ? ` in ${duration(detail.total_seconds)}` : ""}.
          </p>
        ) : null}
        {detail.status === "awaiting_upload" ? <p className="t-reading m-0">Waiting for the recording to finish uploading.</p> : null}
        {detail.status === "queued" ? (
          <p className="t-reading m-0">
            {detail.error
              ? "The last attempt stopped before the analysis was complete, so nothing was published. It will be tried again automatically."
              : "Queued. Processing starts when the worker is free."}
          </p>
        ) : null}
        {detail.status === "running" ? <p className="t-reading m-0">Processing. This page updates by itself.</p> : null}
        {detail.status === "failed" ? (
          <p className="t-reading m-0">
            Processing stopped{failed ? ` at “${failed.label.toLowerCase()}”` : ""}.{" "}
            {role === "owner" ? "The teacher or an admin can run it again." : "You can run it again below."}
          </p>
        ) : null}
        {est ? (
          <p className="t-small mt-2 text-slate">
            <span className="font-semibold text-ink">{est.main}</span> {est.detail}
          </p>
        ) : null}
        {showErrors && (detail.status === "failed" || detail.status === "queued") && detail.error ? (
          <p className="t-small mt-2 border-l-[3px] border-ink pl-3">What went wrong: {detail.error}</p>
        ) : null}
      </div>

      <ol className="m-0 list-none p-0" aria-label="Processing steps">
        {rows.map((r, i) => (
          <li key={r.stage} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-baseline gap-x-3 border-t border-slate/25 py-2.5 sm:grid-cols-[2rem_minmax(0,1fr)_12rem_8rem]" data-stage={r.stage} data-status={r.status}>
            <span className="t-small nums text-slate">{i + 1}</span>
            <span className={`t-ui ${r.status === "running" ? "font-semibold" : ""}`}>
              {r.label}
              {showErrors && r.error ? <span className="t-small mt-0.5 block text-ink">{r.error}</span> : null}
            </span>
            <span className={`t-small ${r.status === "failed" ? "font-semibold text-ink" : r.status === "running" ? "font-semibold text-pen" : "text-slate"}`}>
              <StatusGlyph status={r.status} /> {STAGE_STATUS_LABEL[r.status] ?? r.status}
            </span>
            <span className="t-small nums col-start-3 text-slate sm:col-start-auto sm:text-right">
              {r.status === "running" && r.startedAt
                ? `since ${timeFmt.format(new Date(r.startedAt))}`
                : r.seconds != null && r.status !== "pending"
                  ? duration(r.seconds)
                  : ""}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StatusGlyph({ status }: { status: string }) {
  const common = { width: "0.9em", height: "0.9em", viewBox: "0 0 16 16", "aria-hidden": true, className: "inline align-[-0.1em]" } as const;
  switch (status) {
    case "done":
    case "cached":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 8.5l3 3 7-7" />
        </svg>
      );
    case "running":
      return (
        <svg {...common} fill="currentColor">
          <circle cx="8" cy="8" r="4" />
        </svg>
      );
    case "failed":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 3v6M8 12v1" />
        </svg>
      );
    default:
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="4" />
        </svg>
      );
  }
}
