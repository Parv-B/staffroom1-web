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

export function syntheticSummary(groupBy: "teacher" | "subject" | "grade" = "teacher") {
  const groups =
    groupBy === "subject"
      ? [
          { key: "biology", label: "Biology", ...group(3, { scale: 0.95 }) },
          { key: "chemistry", label: "Chemistry", ...group(2, { lowWait: 1 }) },
          { key: "mathematics", label: "Mathematics", ...group(6, { nullWait: 2, scale: 1.05 }) },
          { key: "physics", label: "Physics", ...group(1, { scale: 1.1 }) },
          { key: null, label: "Not recorded", ...group(1) },
        ]
      : groupBy === "grade"
        ? [
            { key: "7", label: "7", ...group(1) },
            { key: "9", label: "9", ...group(3, { lowWait: 1 }) },
            { key: "10", label: "10", ...group(7, { nullWait: 3, scale: 1.05 }) },
            { key: "11", label: "11", ...group(2, { scale: 0.9 }) },
          ]
        : [];
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
    group_by: groupBy,
    metadata_filters: [],
    groups,
  };
}

// Synthetic GET /lectures for reviewing the measures-over-time charts with more lectures than the
// E2E centre has: invented chapters and values, with N/A and low-confidence values on purpose.
export function syntheticLectures(teacherUserId: string) {
  const chapters = ["Real Numbers", "Polynomials", "Pair of Linear Equations", "Quadratic Equations", "Arithmetic Progressions", "Triangles", "Coordinate Geometry", "Trigonometry", "Circles"];
  const items = chapters.map((chapter, i) => {
    const created = new Date(Date.UTC(2026, 7, 3 + i * 7, 9)).toISOString();
    const b = (value: number | null, unit: string, low = false, reason: string | null = null) => ({ value, unit, confidence: low ? "low" : "high", reason });
    const wait = i === 3 ? b(null, "s", false, "The teacher asked no questions that were followed by a pause.") : b([1.2, 1.6, 0.9, 0, 2.1, 1.4, 1.8, 1.1, 2.4][i] ?? 1, "s", i === 5 || i === 6, i === 5 || i === 6 ? "Audio only: a pause can't be told apart from students muted." : null);
    return {
      lecture_id: `lec_synthetic${i.toString().padStart(4, "0")}`,
      org_id: "o",
      teacher_user_id: teacherUserId,
      status: "done",
      metadata: { board: "CBSE", grade: "10", subject: "Mathematics", chapter, class_type: "online" },
      shared_with_owner: true,
      analysis_available: true,
      has_chat: false,
      has_unseen_results: false,
      total_cost_usd: 0.8,
      total_seconds: 300,
      findings_summary: {},
      released_categories: ["content_error", "explanation_gap", "conduct", "pedagogy", "strength"],
      duration_ms: 3_400_000,
      asr_provider: "assemblyai",
      created_at: created,
      updated_at: created,
      metrics_summary: {
        student_talk_share: b([0.08, 0.12, 0.1, 0.15, 0.09, 0.18, 0.14, 0.11, 0.16][i] ?? 0.1, "fraction"),
        teacher_talk_time_s: b([2650, 2480, 2700, 2300, 2590, 2200, 2400, 2550, 2350][i] ?? 2400, "s"),
        longest_teacher_monologue_s: b([420, 310, 505, 260, 380, 240, 300, 350, 280][i] ?? 300, "s"),
        teacher_wpm: i === 7 ? b(null, "words/min", false, "Too little teacher speech was transcribed.") : b([150, 142, 155, 139, 148, 136, 141, 0, 144][i] ?? 140, "words/min"),
        teacher_question_count: b([38, 45, 31, 52, 40, 57, 49, 44, 51][i] ?? 40, "count"),
        open_question_share: b([0.18, 0.22, 0.12, 0.25, 0.2, 0.3, 0.26, 0.21, 0.28][i] ?? 0.2, "fraction", i === 2, i === 2 ? "Many questions were cut off in the recording." : null),
        wait_time_median_s: wait,
        student_turn_count: b([55, 61, 42, 70, 58, 82, 75, 63, 77][i] ?? 60, "count"),
      },
    };
  });
  return { items, total: items.length, limit: 100, offset: 0 };
}

// Synthetic GET /org/trend: twelve weeks with an empty week, a week of lectures with no value
// for wait time, weeks resting on one or two lectures and low-confidence values. Invented.
export function syntheticTrend(bucket: "week" | "month" = "week") {
  const counts = bucket === "week" ? [3, 4, 0, 2, 5, 1, 3, 0, 4, 6, 2, 3] : [7, 14, 11, 9];
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const buckets = counts.map((n, i) => {
    const start = bucket === "week" ? new Date(Date.UTC(2026, 6, 27 + 7 * i)) : new Date(Date.UTC(2026, 6 + i, 1));
    const end = bucket === "week" ? new Date(start.getTime() + 6 * 86_400_000) : new Date(Date.UTC(2026, 7 + i, 0));
    const wobble = 0.9 + ((i * 37) % 23) / 100;
    const g = group(n, { scale: wobble, nullWait: i === 5 ? 1 : 0, lowWait: i % 4 === 1 ? 1 : 0 });
    return { start: day(start), end: day(end), partial: i === counts.length - 1, n_lectures: n, n_done: n, n_done_without_metrics: 0, metrics: g.metrics };
  });
  return {
    org_id: "synthetic",
    bucket,
    date_basis: "created_at",
    from_date: buckets[0]?.start ?? null,
    to_date: buckets[buckets.length - 1]?.end ?? null,
    teacher_user_id: null,
    metadata_filters: [],
    metric_names: METRICS,
    buckets,
  };
}
