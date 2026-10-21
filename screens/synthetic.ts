// Synthetic /org/summary for reviewing the centre layout with several teachers. Invented names
// and numbers; never shown in the app itself.
type Agg = { unit: string; n_lectures_with_value: number; median: number | null; p25: number | null; p75: number | null; n_low_confidence: number; n_null: number; most_common_null_reason: string | null; n_not_computed: number };
const METRICS = ["teacher_talk_time_s", "student_talk_share", "longest_teacher_monologue_s", "teacher_wpm", "teacher_question_count", "open_question_share", "wait_time_median_s", "student_turn_count"];
const UNITS: Record<string, string> = { teacher_talk_time_s: "s", student_talk_share: "fraction", longest_teacher_monologue_s: "s", teacher_wpm: "words/min", teacher_question_count: "count", open_question_share: "fraction", wait_time_median_s: "s", student_turn_count: "count" };
const BASE: Record<string, [number, number, number]> = {
  teacher_talk_time_s: [2400, 2100, 2700], student_talk_share: [0.12, 0.08, 0.17], longest_teacher_monologue_s: [310, 220, 400], teacher_wpm: [148, 136, 160],
  teacher_question_count: [42, 31, 55], open_question_share: [0.21, 0.14, 0.3], wait_time_median_s: [1.4, 1.1, 1.9], student_turn_count: [64, 40, 90],
};

function group(n: number, opts: { nullWait?: number; lowWait?: number; scale?: number; strength?: number; pedagogy?: number } = {}) {
  const s = opts.scale ?? 1;
  const metrics: Record<string, Agg> = {};
  for (const m of METRICS) {
    const [med, lo, hi] = BASE[m] ?? [0, 0, 0];
    const isWait = m === "wait_time_median_s";
    const nNull = isWait ? (opts.nullWait ?? 0) : 0;
    const nVal = n - nNull;
    metrics[m] = {
      unit: UNITS[m] ?? "count",
      n_lectures_with_value: nVal,
      median: nVal > 0 ? med * s : null,
      p25: nVal > 1 ? lo * s : nVal === 1 ? med * s : null,
      p75: nVal > 1 ? hi * s : nVal === 1 ? med * s : null,
      n_low_confidence: isWait ? Math.min(opts.lowWait ?? 0, nVal) : 0,
      n_null: nNull,
      most_common_null_reason: nNull > 0 ? "The teacher asked no open or closed questions." : null,
      n_not_computed: 0,
    };
  }
  const zero = { info: 0, minor: 0, moderate: 0, important: 0 };
  return {
    n_lectures: n,
    lectures_by_status: { awaiting_upload: 0, queued: 0, running: n > 3 ? 1 : 0, done: n > 3 ? n - 1 : n, failed: 0 },
    n_done_without_metrics: 0,
    findings: { content_error: zero, explanation_gap: zero, conduct: zero, pedagogy: { ...zero, minor: opts.pedagogy ?? 1, moderate: 1 }, strength: { ...zero, minor: opts.strength ?? 4 } },
    findings_n_lectures: { content_error: 0, explanation_gap: 0, conduct: 0, pedagogy: n, strength: n },
    n_done_categories_unknown: 0,
    metrics,
  };
}

export function syntheticSummary() {
  const teachers = [
    { teacher_user_id: "t1", display_name: "Aisha Kapoor", active: true, ...group(6, { lowWait: 2, scale: 1.05 }) },
    { teacher_user_id: "t2", display_name: "Daniel Mathew", active: true, ...group(4, { nullWait: 1, scale: 0.9, strength: 7 }) },
    { teacher_user_id: "t3", display_name: "Farah Siddiqui", active: true, ...group(1, { scale: 1.1 }) },
    { teacher_user_id: "t4", display_name: "Rohan Iyer", active: false, ...group(2, { nullWait: 2 }) },
    { teacher_user_id: "t5", display_name: "Sana Qureshi", active: true, ...group(0) },
  ];
  return {
    org_id: "synthetic",
    from_date: null,
    to_date: null,
    teacher_user_id: null,
    released_categories: ["content_error", "explanation_gap", "conduct", "pedagogy", "strength"],
    metric_names: METRICS,
    org: group(13, { nullWait: 3, lowWait: 2 }),
    teachers,
  };
}
