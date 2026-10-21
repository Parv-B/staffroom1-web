# Staffroom1 web: design plan

Staffroom1 is something teachers read, so the design starts from the reading. The model is a
teacher's marked-up script, or a critical edition of a text: the lesson as spoken is the main
text, timestamps sit in the margin like line numbers, and every remark is pinned to the passage
it comes from. Nothing is decoration. A rule, a tint or a label is there because it tells the
reader something about the content next to it.

## Typefaces (two families, self-hosted from npm `@fontsource*` packages)

| Role | Face | Why |
|---|---|---|
| Reading and display: transcripts, evidence quotes, findings, notes, lecture titles, section headings | **Literata** (variable: `opsz` 7–72, `wght` 200–900) | Google made it for long reading on tablets (Play Books). Its Latin is excellent, it has `tnum`, and the optical-size axis lets one family do both jobs: at text sizes it is sturdy and open, and at `opsz` 72 the display cut is sharp and high-contrast. Lecture titles and section headings are the one place the design is bold. |
| Interface and data: navigation, labels, buttons, metric values, tables, timestamps, badges | **Atkinson Hyperlegible Next** (400, 600, 400 italic) | The Braille Institute designed it so that easily confused characters look different: `l / I / 1`, `0 / O`, `rn / m`. That matters for numbers and for maths like "h + 2r" in labels. Its `tnum` figures keep columns lined up. As a sans beside Literata's serif, the two are clearly different. |

Fallbacks (subset by `unicode-range`, so they are only downloaded when a page needs them):
Literata → Noto Serif Devanagari → Noto Naskh Arabic → serif. Atkinson → Noto Sans
Devanagari → Noto Sans Arabic → sans-serif.
`font-variant-numeric: tabular-nums` is set on every metric, count, table cell and `mm:ss`
timestamp. Running prose keeps proportional figures.

### Type scale (rem at 16 px; ratio about 1.25; six sizes)

| Token | Size / line height | Face, weight | Use |
|---|---|---|---|
| `display` | 2.5 / 1.1 | Literata 600, opsz 72 | lecture title (once per page) |
| `heading` | 1.75 / 1.2 | Literata 600, opsz 48 | page sections |
| `subheading` | 1.25 / 1.35 | Literata 600, opsz 24 | a finding's claim, a notes heading |
| `reading` | 1.125 / 1.65 (transcript 1.8) | Literata 400, opsz auto | body text, quotes, transcript, notes |
| `ui` | 1 / 1.5 | Atkinson 400 / 600 | controls, table cells, metric values |
| `small` | 0.875 / 1.45 | Atkinson 400 / 600 | metadata, reasons, badges, timestamps |

Reading columns are at most `66ch` wide. Weight carries emphasis: no all-caps tracking, no
coloured headline words.

## Colour (light theme; text pairings measured against WCAG)

| Name | Hex | Role | Contrast |
|---|---|---|---|
| **Desk** | `#EEF0EC` | page background (a cool grey-green, not cream) | |
| **Sheet** | `#FFFFFF` | the reading surface: one sheet per lecture document | |
| **Ink** | `#17201E` | text | 16.6 on Sheet, 14.5 on Desk |
| **Slate** | `#4C5856` | secondary text, meaningful rules, pencil-draft marks | 7.4 / 6.5 |
| **Fountain pen** | `#1F4C8A` | everything you can act on: links, timestamps, playhead, focus ring | 8.5 / 7.5 |
| **Moss** | `#2C6537` | category: *What worked well* (strengths) | 7.0 / 6.1 |
| **Ochre** | `#875000` | category: *Points to review* (teaching practice; later content accuracy, explanation gaps, classroom conduct) | 6.6 / 5.8 |

Statuses are not severities, so they use separate hues and always come with a shape and a word:

| Status | Encoding |
|---|---|
| Low confidence | **Heather** `#674A86` (7.2 on Sheet), dotted underline under the value, "Low confidence" mark with the reason |
| Stale notes | **Lagoon** `#0E626B` (7.1), solid left bar, "Out of date" with the reason |
| Draft notes | Slate dashed "pencil" border with "Draft, not approved". An approved version changes to a solid Fountain-pen rule ("Approved by you on …"): pencil, then pen |
| Not shared | Ink on a Desk-coloured block with a closed-lock glyph and "Not shared by the teacher" |
| N/A | Not a colour. A hatched box with "N/A" in Atkinson 600, followed by the reason in full. It cannot be mistaken for a number: there is no digit and it is never right-aligned like one |

Severity is a word ("minor", "moderate", "important") next to the category, never a colour or
a run of pips (pips read as ratings). Category tints behind highlighted transcript passages are
8–10 % mixes, so Ink on them still clears 14:1. Content errors and conduct use the same
developmental Ochre as everything else to review. Nothing is red.

## Layout

- **Masthead.** The lecture title is the chapter, in Literata display. Under it, one plain
  sentence of facts ("CBSE grade 10 mathematics, an online class of 57 minutes, uploaded
  21 October 2026"), not a meta string with dots between the parts.
- **Sheet on a desk.** Each lecture view is one white sheet on the Desk background, with no
  shadow and no outline: the change of ground is the edge. Inside it there are no nested cards
  and no divider lines between sections. Hierarchy comes from space and the type scale. The
  only rules are evidence ties (a 3 px bar in the category hue joining a claim to its quote) and
  status edges, so a line always means "this belongs to that".
- **Alignment.** Everything is left-aligned and ragged right. Nothing is justified: Hinglish
  mixes long and short words, and browsers can't hyphenate romanized Hindi, so justified text
  would open rivers. Numbers in tables are right-aligned on tabular figures. N/A is
  left-aligned so that it never sits in a number's place.
- **Margin.** Tablet landscape and wider: a 66ch reading column plus a margin column about
  16rem wide for timestamps, evidence links and statuses. Tablet portrait: the margin folds in
  under each item. Phones get a single column that doesn't break.
- **Findings.** The claim is set as a `subheading`. The verbatim quote hangs directly beneath it,
  indented, behind a 3 px rule in the category hue, with its `mm:ss` range and the two actions
  ("Play from 09:14", "Read in transcript"). Claim and evidence never separate.
- **Transcript.** A three-column grid: a time gutter (tabular, Fountain pen, click to seek), the
  speaker as a small Atkinson label (Teacher / Student / Unknown speaker), then the text at
  `reading` size and 1.8 line height. A passage cited by a finding gets the category tint, a
  left rule and a margin note with the finding's claim, linked back to it.
- **Audio.** A slim player docked at the top of the reading column (sticky, in the normal flow).
  It never sits over text; jump targets use `scroll-margin-top`, so a passage you jump to lands
  below it.
- **Owner views.** Plain tables in alphabetical order. Medians and middle ranges are numbers,
  with at most a plain grey range line. No colour depends on the value.

### Wireframes

(Illustrative text only; the real content comes from the API.)

Finding with evidence, tablet landscape (the margin holds where it happened and how to get there):

```
 ┌ Sheet ──────────────────────────────────────────────────────────────────┐
 │  What worked well                                                       │
 │  Connects the formula to the labelled diagram       12:40–12:52         │
 │  before asking students to apply it.                Play from 12:40     │
 │  ┃ "Look at the figure. This side is a, this one     Read in transcript  │
 │  ┃  is b, so the area is a times b. Batao, what                          │
 │  ┃  is a here?"                                                          │
 │  Why it matters  Students see where each term comes from ...            │
 │  Suggestion      Keep pointing to the figure as you ...                 │
 │  Your view       ( Agree ) ( Disagree ) ( Needs context )               │
 └─────────────────────────────────────────────────────────────────────────┘
```

Transcript (the gutter is the time index; a cited passage is tinted and its claim sits in the margin):

```
 Play  Back 5 s   12:40 / 58:00  ───────●──────────────────────   (sticky)
 12:36  Teacher   Batao, what is a here?
 12:40  Teacher ┃ Look at the figure. This side is a,       ▏What worked well
               ┃ this one is b ...                         ▏Connects the formula
               ┃                                           ▏to the diagram ...
 12:55  Student   Five.
```

Metric row (the reason is always visible, never hidden in a tooltip):

```
 Teacher speaking rate       168 words/min
 Wait time after questions   1.3 s   ┄┄ Low confidence: audio only; chat replies not counted
 Wait time after questions   [N/A]  The teacher asked no open or closed questions.
```

## Motion

Only in response to something the user did, each under 200 ms: a finding expanding, the
highlight pulsing once when you land on a transcript moment, the save state changing in the
notes editor. All of it is off under `prefers-reduced-motion`.

## Review against generic AI defaults

| Default it avoids | What this plan does instead |
|---|---|
| Inter, system-ui or Space Grotesk; one geometric sans everywhere | Literata for reading and display, Atkinson Hyperlegible Next for data, both chosen for a reason this product has |
| Purple-to-blue gradients; near-black with one neon accent | Flat colour. The only "accent" is Fountain pen, and it means "you can act on this" |
| Cream, serif and terracotta | A cool grey-green Desk and a white Sheet. The warm hue (Ochre) is limited to "points to review" |
| A SaaS card grid: one radius, soft shadows, KPI tiles | One sheet and a margin column. Radius follows hierarchy (see the second pass below). No shadows except on popovers |
| Gauges, donuts, progress rings, a hero number | Metrics are rows: name, value or N/A with its reason, confidence, and a definition you can expand. The only chart is WPM over the lesson, with null bins as gaps |
| Tracked all-caps eyebrows, 01/02/03, "→" on buttons, "A · B · C" | Sentence-case labels, numbering only for a real sequence (the 12 pipeline stages), verbs on buttons, facts written as sentences |
| Red for errors and severity | Ochre for anything to review, words for severity, Heather and Lagoon for data and notes statuses |

### Second pass, against the frontend-design skill's list of current defaults

- *Broadsheet: hairline rules, zero radius, dense columns.* My first draft leaned this way
  ("hairline edge", "radius 0 on reading surfaces", "editorial"). **Changed:** no outlines or
  section dividers at all. Lines exist only as evidence ties and status edges. Radius follows
  hierarchy: 0 on the Sheet (which is a ground, not a box), 3 px on buttons and fields, and
  full pills only for toggle choices (the feedback verdicts, the raw/redacted switch). The
  layout is a single 66ch column with a margin, not newspaper columns.
- *Monospace for small data labels.* Not used: data is set in Atkinson with tabular figures.
- *Cream, serif and terracotta; near-black with neon; the card kit; eyebrows and dot strings; →
  buttons.* None of these is in the plan (see the table above).
- *The one bold thing.* The Literata display cut for lecture titles and headings, together with
  the time gutter that runs down the transcript and the findings. Everything else stays quiet.

What I'll check before calling the tile done: AA contrast on every pairing above, a visible
2 px Fountain-pen focus ring offset from every control, a 66ch measure at 820 px (tablet
portrait) and 1180 px (landscape), and Devanagari or Arabic text rendering without boxes.
