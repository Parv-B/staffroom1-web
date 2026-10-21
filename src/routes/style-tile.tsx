import { useState, type ReactNode, type SyntheticEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Form, Input, Label, TextField } from "react-aria-components";
import type { LectureAnalysis, MetricResult, SeriesResult } from "~/analysis/types.gen";
import { InvalidDocumentError } from "~/analysis/parse";
import { analysisQuery, notesQuery } from "~/analysis/queries";
import { isApiError, type Schemas } from "~/api/client";
import { signInWithPassword, useSignedIn } from "~/auth/session";
import { FindingEntry, type TranscriptLinkProps } from "~/components/FindingEntry";
import { MetricValue } from "~/components/MetricValue";
import { NotesBullet } from "~/components/NotesBullet";
import { StatusMark } from "~/components/StatusMark";
import { TranscriptLines } from "~/components/TranscriptLines";
import { longDate, mmss } from "~/lib/format";
import { PlayerBar, PlayerProvider } from "~/media/player";
import { METRIC_DEFINITIONS } from "~/metrics/definitions.gen";
import { metricLabel } from "~/metrics/labels";
import { fromResult, type MetricReading } from "~/metrics/reading";

const DEFAULT_LECTURE = "lec_b6899035ede4aefd";
const FINDING = "f_6d29a3d6fb6f5dde";

export const Route = createFileRoute("/style-tile")({
  validateSearch: (s: Record<string, unknown>): { lecture?: string } =>
    typeof s.lecture === "string" && /^lec_[0-9a-f]+$/.test(s.lecture) ? { lecture: s.lecture } : {},
  component: StyleTile,
});

function StyleTile() {
  const signedIn = useSignedIn();
  const { lecture = DEFAULT_LECTURE } = Route.useSearch();
  return (
    <main className="mx-auto max-w-[78rem] px-4 py-10 sm:px-8">
      <header className="measure mb-8">
        <h1 className="t-heading">Style tile</h1>
        <p className="t-reading mt-2 text-slate">
          The type, colour and core reading patterns for Staffroom1, rendered from a real lecture through the API. Nothing on
          this page is mocked.
        </p>
      </header>
      {signedIn ? <TileBody lectureId={lecture} /> : <TileSignIn />}
    </main>
  );
}

function TileSignIn() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const email = data.get("email");
      const password = data.get("password");
      await signInWithPassword(typeof email === "string" ? email : "", typeof password === "string" ? password : "");
    } catch (err) {
      setError(
        isApiError(err, "invalid_credentials")
          ? "That email and password don't match an active account. Check both and try again."
          : "Couldn't reach Staffroom1. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="max-w-sm bg-sheet p-6" aria-labelledby="tile-signin">
      <h2 id="tile-signin" className="t-subheading">
        Sign in to load the lecture
      </h2>
      <Form className="mt-4 space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <TextField name="email" type="email" isRequired autoComplete="username" className="flex flex-col gap-1">
          <Label className="t-small font-semibold">Email</Label>
          <Input className="t-ui rounded-[3px] border border-slate px-3 py-2" />
        </TextField>
        <TextField name="password" type="password" isRequired autoComplete="current-password" className="flex flex-col gap-1">
          <Label className="t-small font-semibold">Password</Label>
          <Input className="t-ui rounded-[3px] border border-slate px-3 py-2" />
        </TextField>
        {error ? (
          <p className="t-small text-ink" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="button" data-variant="primary" isDisabled={busy}>
          {busy ? "Signing in" : "Sign in"}
        </Button>
      </Form>
    </section>
  );
}

function TileBody({ lectureId }: { lectureId: string }) {
  const analysis = useQuery(analysisQuery(lectureId));
  const notes = useQuery(notesQuery(lectureId));
  if (analysis.isPending) return <p className="t-reading">Loading the lecture</p>;
  if (analysis.isError) {
    const e = analysis.error;
    return (
      <p className="t-reading measure" role="alert">
        {e instanceof InvalidDocumentError
          ? "The analysis didn't match the published schema, so nothing from it is shown. Ask an admin to rerun the lecture."
          : isApiError(e, "not_shared")
            ? "The teacher hasn't shared this lecture."
            : "The analysis couldn't be loaded. Reload the page to try again."}
      </p>
    );
  }
  const a = analysis.data;
  return (
    <PlayerProvider lectureId={lectureId} durationMs={a.metadata.duration_ms}>
      <div className="bg-sheet px-5 pb-12 sm:px-10">
        <PlayerBar />
        <div className="space-y-16 pt-6">
          <TypeSection a={a} />
          <PaletteSection />
          <MastheadSection a={a} />
          <FindingSection a={a} />
          <MetricSection a={a} />
          <TranscriptSection a={a} />
          <NotesSection a={a} notes={notes.data} notesError={notes.isError} />
        </div>
      </div>
    </PlayerProvider>
  );
}

function Section({ id, title, note, children }: { id: string; title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="t-heading">
        {title}
      </h2>
      {note ? <p className="t-small measure mt-2 text-slate">{note}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function TypeSection({ a }: { a: LectureAnalysis }) {
  const f = a.findings?.find((x) => x.finding_id === FINDING);
  const rows: { token: string; spec: string; sample: ReactNode }[] = [
    { token: "display", spec: "Literata 600, opsz 72, 40/44", sample: <span className="t-display">{a.metadata.chapter}</span> },
    { token: "heading", spec: "Literata 600, opsz 48, 28/34", sample: <span className="t-heading">What worked well</span> },
    { token: "subheading", spec: "Literata 600, opsz 24, 20/27", sample: <span className="t-subheading">{f?.issue}</span> },
    { token: "reading", spec: "Literata 400, 18/30 (transcript 18/32)", sample: <span className="t-reading">{f?.evidence[0]?.quote}</span> },
    {
      token: "ui",
      spec: "Atkinson Hyperlegible Next 400 / 600, 16/24",
      sample: (
        <span className="t-ui">
          Teacher speaking rate <span className="nums font-semibold">168 words/min</span>. Distinct: Il1 0O rn m h + 2r
        </span>
      ),
    },
    {
      token: "small",
      spec: "Atkinson 400 / 600, 14/20, tabular figures",
      sample: (
        <span className="t-small nums">
          09:14–09:25 <span className="text-slate">and</span> 42:43–42:53 <span className="text-slate">and</span> 101:07
        </span>
      ),
    },
    {
      token: "fallbacks",
      spec: "Noto Serif / Sans Devanagari, Noto Naskh / Sans Arabic",
      sample: (
        <span className="t-reading">
          Font check, not from this lecture: <span lang="hi">समझ गए? ठीक है।</span> <span lang="ar" dir="rtl">هل فهمتم؟</span>
        </span>
      ),
    },
  ];
  return (
    <Section id="type" title="Type">
      <dl className="m-0 grid gap-x-8 gap-y-6 md:grid-cols-[12rem_1fr]">
        {rows.map((r) => (
          <div key={r.token} className="contents">
            <dt className="t-small">
              <span className="font-semibold">{r.token}</span>
              <br />
              <span className="text-slate">{r.spec}</span>
            </dt>
            <dd className="measure m-0">{r.sample}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

const PALETTE = [
  { name: "Desk", hex: "#EEF0EC", role: "Page background", contrast: "" },
  { name: "Sheet", hex: "#FFFFFF", role: "The reading surface", contrast: "" },
  { name: "Ink", hex: "#17201E", role: "Text", contrast: "16.6:1 on Sheet" },
  { name: "Slate", hex: "#4C5856", role: "Secondary text, pencil drafts", contrast: "7.4:1" },
  { name: "Fountain pen", hex: "#1F4C8A", role: "Anything you can act on, and focus", contrast: "8.5:1" },
  { name: "Moss", hex: "#2C6537", role: "What worked well", contrast: "7.0:1" },
  { name: "Ochre", hex: "#875000", role: "Points to review, every category", contrast: "6.6:1" },
  { name: "Heather", hex: "#674A86", role: "Status: low confidence", contrast: "7.2:1" },
  { name: "Lagoon", hex: "#0E626B", role: "Status: notes out of date", contrast: "7.1:1" },
];

function PaletteSection() {
  return (
    <Section id="colour" title="Colour" note="The first seven are the palette; Heather and Lagoon are kept for statuses so they never read as severity.">
      <ul className="m-0 grid list-none gap-x-8 gap-y-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {PALETTE.map((c) => (
          <li key={c.name} className="flex items-start gap-3">
            <span aria-hidden="true" className="size-12 shrink-0 border border-slate/30" style={{ background: c.hex }} />
            <span className="t-small">
              <span className="font-semibold">{c.name}</span> <span className="nums text-slate">{c.hex}</span>
              <br />
              {c.role}
              {c.contrast ? <span className="text-slate">, {c.contrast}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const CLASS_TYPE = { online: "an online class", in_person: "an in-person class" } as const;

function MastheadSection({ a }: { a: LectureAnalysis }) {
  const m = a.metadata;
  const minutes = Math.round(m.duration_ms / 60_000);
  return (
    <Section id="masthead" title="Lecture masthead">
      <div className="measure">
        <p className="t-display m-0">{m.chapter}</p>
        <p className="t-reading mt-3 text-slate">
          {m.board} grade {m.grade} {m.subject}, {CLASS_TYPE[m.class_type]} of {minutes} minutes, analysed on {longDate(a.created_at)}.
        </p>
      </div>
    </Section>
  );
}

function TileTranscriptLink({ startMs, children }: TranscriptLinkProps) {
  return (
    <a
      className="action"
      href={`#t-${startMs.toString()}`}
      onClick={(e) => {
        e.preventDefault();
        const target = document.querySelector<HTMLElement>(`[data-start-ms="${startMs.toString()}"]`);
        if (target) {
          target.scrollIntoView({ block: "start" });
          target.classList.remove("just-landed");
          requestAnimationFrame(() => {
            target.classList.add("just-landed");
          });
        }
      }}
    >
      {children}
    </a>
  );
}

function FindingSection({ a }: { a: LectureAnalysis }) {
  const f = a.findings?.find((x) => x.finding_id === FINDING);
  return (
    <Section id="finding" title="A finding with its evidence">
      <div id={`finding-${FINDING}`} data-scroll-target>
        {f ? <FindingEntry finding={f} TranscriptLink={TileTranscriptLink} /> : <p className="t-reading">Finding {FINDING} is not in this analysis.</p>}
      </div>
    </Section>
  );
}

function isScalar(m: MetricResult | SeriesResult | undefined): m is MetricResult {
  return m !== undefined && (m.kind ?? "scalar") === "scalar";
}

function MetricRow({ reading, definition, label }: { reading: MetricReading; definition: string; label?: string }) {
  return (
    <div className="grid gap-x-8 gap-y-1 border-t border-slate/25 py-4 md:grid-cols-[18rem_1fr]">
      <dt className="t-ui">
        {label ?? metricLabel(reading.name)}
        <details className="t-small mt-1 text-slate">
          <summary className="action w-fit">How it's measured</summary>
          <p className="measure mt-1">{definition}</p>
        </details>
      </dt>
      <dd className="m-0">
        <MetricValue reading={reading} />
      </dd>
    </div>
  );
}

function MetricSection({ a }: { a: LectureAnalysis }) {
  const wpm = a.metrics?.teacher_wpm;
  const wait = a.metrics?.wait_time_median_s;
  const series = a.metrics?.teacher_wpm_series;
  const nullBin = series && series.kind === "series" ? series.values.findIndex((v) => v === null) : -1;
  const seriesDef = METRIC_DEFINITIONS.teacher_wpm_series?.definition ?? "";
  return (
    <Section
      id="metrics"
      title="One metric, three ways"
      note="No single-value metric is missing in this lecture, so the N/A row is a real empty minute from the speaking-rate series: the API returns null for it, and its reason comes from the series definition."
    >
      <dl className="m-0 border-b border-slate/25">
        {isScalar(wpm) ? <MetricRow reading={fromResult("teacher_wpm", wpm)} definition={wpm.definition} /> : null}
        {series && series.kind === "series" && nullBin >= 0 ? (
          <MetricRow
            label={`Teacher speaking rate, ${mmss(nullBin * series.bin_ms)}–${mmss((nullBin + 1) * series.bin_ms)}`}
            reading={{
              name: "teacher_wpm_series",
              value: null,
              unit: series.unit,
              lowConfidence: false,
              nullReason: "Less than 5 s of teacher speech in this minute, too little to give a rate.",
              lowConfidenceReason: null,
            }}
            definition={seriesDef}
          />
        ) : null}
        {isScalar(wait) ? <MetricRow reading={fromResult("wait_time_median_s", wait)} definition={wait.definition} /> : null}
      </dl>
    </Section>
  );
}

function TranscriptSection({ a }: { a: LectureAnalysis }) {
  const segs = a.transcript.segments;
  const f = a.findings?.find((x) => x.finding_id === FINDING);
  const first = f?.evidence[0]?.segment_ids[0];
  const at = segs.findIndex((s) => s.segment_id === first);
  const excerpt = at >= 0 ? segs.slice(Math.max(0, at - 3), at + 9) : segs.slice(0, 10);
  return (
    <Section id="transcript" title="Transcript excerpt" note="Times in the gutter play the recording from that moment. The tinted passage is the evidence for the finding above.">
      <div>
        <TranscriptLines
          segments={excerpt}
          findings={f ? [f] : []}
          FindingLink={({ findingId, children }) => (
            <a className="action" href={`#finding-${findingId}`}>
              {children}
            </a>
          )}
        />
      </div>
    </Section>
  );
}

function NotesSection({ a, notes, notesError }: { a: LectureAnalysis; notes: Schemas["NotesOut"] | undefined; notesError: boolean }) {
  const byId = new Map(a.transcript.segments.map((s) => [s.segment_id, s]));
  const f = a.findings?.find((x) => x.finding_id === FINDING);
  const wanted = new Set(f?.segment_ids ?? []);
  const section = notes?.sections.find((s) => s.bullets.some((b) => b.segment_ids.some((id) => wanted.has(id)))) ?? notes?.sections[0];
  const bullet = section?.bullets.find((b) => b.segment_ids.some((id) => wanted.has(id))) ?? section?.bullets[0];
  return (
    <Section id="notes" title="A notes bullet with its cited moments">
      {notesError ? <p className="t-reading">The lecture notes couldn't be loaded.</p> : null}
      {notes && section && bullet ? (
        <div className="space-y-4">
          <p className="flex flex-wrap items-center gap-3">
            {notes.status === "approved" ? (
              <StatusMark kind="approved">Approved{notes.approved_at ? ` on ${longDate(notes.approved_at)}` : ""}</StatusMark>
            ) : (
              <StatusMark kind="draft" />
            )}
            {notes.stale ? <StatusMark kind="stale">Out of date: {notes.stale_reason ?? "no reason was recorded"}</StatusMark> : null}
            <span className="t-small text-slate">{notes.source === "teacher" ? "The teacher's version" : "Generated draft"}</span>
          </p>
          <h3 className="t-subheading measure">{section.heading}</h3>
          <ul className="m-0 list-none space-y-5 p-0">
            <NotesBullet bullet={bullet} segmentsById={byId} />
          </ul>
        </div>
      ) : null}
      <div className="mt-10">
        <h3 className="t-subheading">Status marks</h3>
        <p className="t-small measure mt-1 text-slate">Each has its own hue, shape and words. None uses a severity colour.</p>
        <p className="mt-4 flex flex-wrap gap-3">
          <StatusMark kind="low-confidence" />
          <StatusMark kind="draft" />
          <StatusMark kind="approved" />
          <StatusMark kind="stale" />
          <StatusMark kind="not-shared" />
        </p>
      </div>
    </Section>
  );
}
