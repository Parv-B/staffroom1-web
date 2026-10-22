import type { AspectJudgement, Finding } from "~/analysis/types.gen";

export type Aspect = NonNullable<Finding["aspect"]>;
export type Level = NonNullable<AspectJudgement["level"]>;

/** Same labels as the backend's aspects file, in its order. */
export const ASPECTS: readonly { id: Aspect; label: string }[] = [
  { id: "subject_knowledge", label: "Subject knowledge and explanation" },
  { id: "lesson_planning", label: "Lesson structure and use of time" },
  { id: "questioning_dialogue", label: "Questioning and dialogue" },
  {
    id: "challenge_support",
    label: "Challenge and support for different learners",
  },
  { id: "critical_thinking", label: "Developing thinking and independence" },
  {
    id: "checking_understanding",
    label: "Checking understanding and feedback",
  },
  { id: "student_engagement", label: "Student involvement and responsibility" },
  { id: "student_interaction", label: "Student interaction and communication" },
  {
    id: "application_connections",
    label: "Connecting learning to the world and other topics",
  },
  { id: "progress_in_lesson", label: "Progress in the lesson" },
  { id: "relationships_conduct", label: "Relationships and conduct" },
];

const LABEL = new Map(ASPECTS.map((a) => [a.id, a.label]));

export function aspectLabel(a: Aspect | null | undefined): string | null {
  return a ? (LABEL.get(a) ?? a) : null;
}

/** Best first; `good` is the expected level for a lesson. */
export const LEVELS: readonly Level[] = [
  "outstanding",
  "very_good",
  "good",
  "acceptable",
  "weak",
  "very_weak",
];

export const LEVEL_LABEL: Readonly<Record<Level, string>> = {
  outstanding: "Outstanding",
  very_good: "Very good",
  good: "Good",
  acceptable: "Acceptable",
  weak: "Weak",
  very_weak: "Very weak",
};

/** 1 (very weak) to 6 (outstanding). */
export function levelRank(l: Level): number {
  return LEVELS.length - LEVELS.indexOf(l);
}

/** Above the expected level, at it, or below it. */
export function levelTone(l: Level): "above" | "expected" | "below" {
  const r = levelRank(l);
  const good = levelRank("good");
  return r > good ? "above" : r === good ? "expected" : "below";
}
