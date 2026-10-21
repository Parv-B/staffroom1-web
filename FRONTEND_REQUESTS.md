# Requests to the backend

## 1. Processing-time estimate: expose what the client needs to base it on comparable runs

**Resolved 2026-10-21.** Both options were delivered: `GET /lectures/processing-estimate?duration_ms=`
(the status screen uses it as is and shows `reason_if_unavailable` when
`total_estimate_seconds` is null), and `asr_provider` and `duration_ms` on every list and detail
item (docs/api.md, "Processing-time estimate"). No estimate is computed on the client.

**Context.** The brief now says to estimate processing time from the per-stage `seconds` of
finished lectures. The client can only see those through `GET /lectures` and
`GET /lectures/{id}`, which has two problems:

- **Old runs skew it.** Lectures processed before the move to AssemblyAI have ASR times about
  20× longer (lec_b6899035ede4aefd: asr 2,314 s, diarize 3,211 s, 5,711 s in total for 57 min).
  Nothing in the lecture list or detail says which ASR provider ran, so the client can't
  leave those runs out. The only signal is `quality.asr_provider` in the analysis, which owners
  often can't read (`403 not_shared`), and fetching every analysis to read it would be heavy.
- **Teachers see too few runs.** A teacher sees only their own lectures, so a new teacher has
  nothing to base an estimate on.

**Request (either is enough):**
- (preferred) `GET /lectures/processing-estimate?duration_ms=` (any signed-in role) returning,
  per stage, the median seconds per recording minute over the org's last N finished runs with
  the current pipeline/ASR configuration, plus `n_runs`. Or
- add `asr_provider` (and `pipeline_version`) to each item of `StageOut` / `LectureDetail`, so
  the client can filter comparable runs itself.

## 2. Released categories per lecture in the lecture list (and in /org/summary)

**Resolved 2026-10-21 (backend changelog, item 1).** `released_categories` is on every list and
detail item, and `/org/summary` adds `findings_n_lectures` and `n_done_categories_unknown`. The
list and the not-shared view now classify each category per lecture ("none" only for a category
the lecture was checked for); the "Other categories: open the analysis" fallback is gone except
for lectures without a report. The centre view uses `findings_n_lectures`.

**Context.** Each `GET /lectures` item has `findings_summary` counts for the categories released
*when that lecture was published*. A category missing from the counts is either released with
no findings ("none in this lesson") or wasn't released then ("not yet reported"), and
credibility rule 6 needs the UI to say which. The list doesn't carry that. The centre-wide
`released_categories` from `/org/summary` is no substitute: on 2026-10-21 the release setting
changed to all five categories, and lec_b6899035ede4aefd, published when only strength and
pedagogy were released, would then read "content accuracy: none" although it was never checked
for content accuracy. (Its analysis' own `findings_summary.released_categories` is still
`[pedagogy, strength]`, which is correct.)

The same applies to `/org/summary.findings`: if older lectures are counted under categories
they weren't checked for, those counts include zeros that mean "not checked".

**Request.** Add `released_categories: Category[]` to each `LectureSummary` / `LectureDetail`
item, taken from that lecture's published report (null when there is no report). In
`/org/summary`, count a lecture under a category only if that category was released for it,
and say how many lectures each category's counts cover.

**Until then** every role's list shows only the categories that have findings, plus "Other
categories: open the analysis". It never shows "none" or a zero for a category it can't
classify. The analysis pages use the analysis' own released categories and are unaffected.

## 3. Recording length while a lecture is processing

**Resolved 2026-10-21.** `duration_ms` is set when ingest finishes. No frontend change was
needed; the "no time estimate yet" message now shows only before ingest has run.

**Context.** `GET /lectures/processing-estimate` needs `duration_ms`, but list and detail items
carry `duration_ms` only once the lecture has a report, which is after processing ends. So the
status page can never ask for an estimate while one would be useful.

**Request.** Set `duration_ms` on the lecture as soon as the ingest stage has measured the
recording (it already knows the length), instead of only when the report is published. The
status page already reads `duration_ms` from `GET /lectures/{id}`, so no frontend change is
needed when this lands.

**Until then** the status page says "There's no time estimate yet, because the recording's
length isn't known until processing has read it." It never guesses a length.

## 4. Raw transcript response shape

**Resolved 2026-10-21.** `raw=true` returns a `Transcript`, typed in OpenAPI. The frontend's
"accept both" fallback was removed; the raw transcript is still validated before it's shown.

**Context.** `GET /lectures/{id}/transcript?raw=false` returns `TranscriptOut.transcript` as a
`Transcript` (as in the analysis schema). `?raw=true` returns the transcript stage's artifact,
`{transcript: Transcript, diarization_method, teacher_id_method, diarization_confidence,
warnings}`, which isn't in any schema, so the same field has two shapes depending on a query
parameter.

**Request (either).** Return `artifact["transcript"]` for `raw=true`, so both are a
`Transcript`; or add the artifact's shape to the schema and to OpenAPI as a separate type.

**Meanwhile** the frontend accepts both: a payload that validates as a `Transcript`, or one
whose `.transcript` does. Anything else is not shown.
