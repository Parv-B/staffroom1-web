// Plain names for metrics. Definitions come from docs/metrics.md (definitions.gen.ts).
export const METRIC_LABELS: Readonly<Record<string, string>> = {
  teacher_talk_time_s: "Teacher talk time",
  student_talk_time_s: "Student talk time",
  student_talk_share: "Student share of talk",
  silence_time_s: "Time without speech",
  longest_teacher_monologue_s: "Longest teacher monologue",
  teacher_monologue_median_s: "Typical teacher monologue (median)",
  student_turn_count: "Student turns",
  student_turn_median_s: "Typical student turn (median)",
  teacher_wpm: "Teacher speaking rate",
  teacher_wpm_series: "Teacher speaking rate over the lesson",
  teacher_question_count: "Teacher questions",
  open_question_count: "Open questions",
  closed_question_count: "Closed questions",
  check_in_count: "Check-ins",
  rhetorical_question_count: "Rhetorical questions",
  open_question_share: "Open share of open and closed questions",
  wait_time_median_s: "Wait time after a question (median)",
  wait_time_p25_s: "Wait time after a question (a quarter were shorter)",
  wait_time_p75_s: "Wait time after a question (three quarters were shorter)",
  teacher_resumed_before_response_rate: "Teacher spoke again before any reply",
  language_share_en: "English words",
  language_share_hi: "Hindi words",
  language_share_ar: "Arabic words",
  language_share_neutral: "Words with no language",
  language_share_hi_teacher: "Hindi in the teacher's words",
  time_on_task_explanation_s: "Time explaining",
  time_on_task_worked_example_s: "Time on worked examples",
  time_on_task_student_practice_s: "Time on student practice",
  time_on_task_qa_s: "Time on questions and answers",
  time_on_task_admin_s: "Time on admin",
  time_on_task_unclassified_s: "Time not classified",
};

export function metricLabel(name: string): string {
  return METRIC_LABELS[name] ?? name.replaceAll("_", " ");
}
