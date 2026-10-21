import type { LectureAnalysis, Transcript } from "./types.gen";
import { validateLectureAnalysis, validateTranscript, type StandaloneValidator } from "./validate.gen.js";

export type Parsed<T> = { ok: true; value: T } | { ok: false; problems: string[] };

// Only schema paths and Ajv's keyword messages are kept: never the offending values, which can
// be transcript text.
function check<T>(validate: StandaloneValidator, data: unknown): Parsed<T> {
  if (validate(data)) return { ok: true, value: data as T };
  const problems = (validate.errors ?? []).map((e) => `${e.instancePath || "(document)"} ${e.message ?? "is invalid"}`);
  return { ok: false, problems: problems.length ? problems : ["(document) is invalid"] };
}

export function parseAnalysis(data: unknown): Parsed<LectureAnalysis> {
  return check<LectureAnalysis>(validateLectureAnalysis, data);
}

export function parseTranscript(data: unknown): Parsed<Transcript> {
  return check<Transcript>(validateTranscript, data);
}

/** Thrown from query functions so an invalid document becomes an error state. */
export class InvalidDocumentError extends Error {
  readonly problems: string[];
  constructor(what: string, problems: string[]) {
    super(`The ${what} did not match the published schema.`);
    this.name = "InvalidDocumentError";
    this.problems = problems;
  }
}

export function requireValid<T>(what: string, parsed: Parsed<T>): T {
  if (parsed.ok) return parsed.value;
  throw new InvalidDocumentError(what, parsed.problems);
}

