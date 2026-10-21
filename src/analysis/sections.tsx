import type { ReactNode } from "react";
import type { LectureAnalysis, Segment } from "./types.gen";

export type SectionKey = "teacher_summary" | "findings" | "structure" | "problems" | "coverage" | "metrics" | "lecture_notes";

const SECTION_NAME: Readonly<Record<SectionKey, string>> = {
  teacher_summary: "The summary",
  findings: "Findings",
  structure: "The lesson's structure",
  problems: "The problems worked on",
  coverage: "Objective coverage",
  metrics: "The measures",
  lecture_notes: "Lecture notes",
};

/** Rule 9: a missing section shows its `unavailable` reason in its place. */
export function SectionOrReason({ a, section, children }: { a: LectureAnalysis; section: SectionKey; children: ReactNode }) {
  const reason = a.unavailable?.[section];
  const missing = a[section] == null;
  if (!reason && !missing) return children;
  return (
    <div className="measure border-l-[3px] border-slate/50 py-1 pl-4" data-unavailable={section}>
      <p className="t-reading m-0">
        {SECTION_NAME[section]} {missing ? "isn't available for this lecture." : "is incomplete for this lecture."}
      </p>
      <p className="t-small mt-1 text-slate">{reason ? `Reason: ${reason}` : "No reason was recorded."}</p>
    </div>
  );
}

/** Rule 13: the pipeline's quality warnings, where they affect what's shown. */
export function QualityWarnings({ a, intro }: { a: LectureAnalysis; intro: string }) {
  const w = a.quality.warnings ?? [];
  if (w.length === 0) return null;
  return (
    <details className="measure t-small border-l-[3px] border-heather pl-4" data-quality-warnings>
      <summary className="cursor-pointer">
        <span className="font-semibold">{w.length === 1 ? "1 note" : `${w.length.toString()} notes`} from processing</span>{" "}
        <span className="text-slate">{intro}</span>
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {w.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </details>
  );
}

export function segmentIndex(a: LectureAnalysis): ReadonlyMap<string, Segment> {
  return new Map(a.transcript.segments.map((s) => [s.segment_id, s]));
}
