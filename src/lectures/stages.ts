// The pipeline's stages in order (docs/api.md), with what each does in plain words.
export const STAGES = [
  ["ingest", "Reading the recording"],
  ["asr", "Transcribing the speech"],
  ["diarize", "Telling speakers apart"],
  ["transcript", "Putting the transcript together"],
  ["questions", "Finding the questions asked"],
  ["structure", "Mapping the lesson's sections and problems"],
  ["coverage", "Checking the objectives covered"],
  ["metrics", "Measuring talk, questions and pace"],
  ["findings", "Finding what worked and what to review"],
  ["notes", "Drafting lecture notes"],
  ["report", "Publishing the analysis"],
] as const;

export type StageName = (typeof STAGES)[number][0];

export const STAGE_LABEL: Readonly<Record<string, string>> = Object.fromEntries(STAGES);

export const STAGE_STATUS_LABEL: Readonly<Record<string, string>> = {
  pending: "Waiting",
  running: "In progress",
  done: "Done",
  cached: "Reused from the previous run",
  failed: "Stopped",
};
