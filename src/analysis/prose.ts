import { mmss } from "~/lib/format";
import type { AspectJudgement, LectureAnalysis } from "./types.gen";

// A segment id, or a range of two ("s0662-s0675"), as models wrote them in older analyses.
const SEG_REF = /\b(s\d{4})(?:\s*[-–]\s*(s\d{4}))?\b/g;

/** Replace transcript line ids in prose with the times teachers see ("at s0277" -> "at 21:40").
 *  Analyses published since 2026-10-23 already carry times; this covers older ones. Unknown ids
 *  are left as they are. */
export function idsToTimes(
  text: string,
  starts: ReadonlyMap<string, number>,
): string {
  return text.replace(SEG_REF, (whole, a: string, b: string | undefined) => {
    const s = starts.get(a);
    if (s === undefined) return whole;
    if (b === undefined) return mmss(s);
    const e = starts.get(b);
    if (e === undefined) return whole;
    return mmss(s) === mmss(e) ? mmss(s) : `${mmss(s)}–${mmss(e)}`;
  });
}

/** The analysis with finding and lesson-profile prose rewritten by `idsToTimes`. Quotes and the
 *  teacher summary text are left exactly as published. */
export function withTimesInProse(a: LectureAnalysis): LectureAnalysis {
  const starts = new Map(
    a.transcript.segments.map((s) => [s.segment_id, s.start_ms]),
  );
  const t = (x: string | null | undefined) =>
    x == null ? x : idsToTimes(x, starts);
  return {
    ...a,
    findings: a.findings?.map((f) => ({
      ...f,
      issue: idsToTimes(f.issue, starts),
      why_it_matters: t(f.why_it_matters),
      suggestion: t(f.suggestion),
      suggested_rephrasing: t(f.suggested_rephrasing),
      likely_intent: t(f.likely_intent),
      what_the_phrasing_implies: t(f.what_the_phrasing_implies),
    })),
    lesson_judgement: a.lesson_judgement
      ? {
          ...a.lesson_judgement,
          aspects: a.lesson_judgement.aspects.map((x): AspectJudgement => ({
            ...x,
            done_well: t(x.done_well),
            next_step: t(x.next_step),
            reason_if_no_level: t(x.reason_if_no_level),
          })) as [AspectJudgement, ...AspectJudgement[]],
        }
      : a.lesson_judgement,
  };
}
