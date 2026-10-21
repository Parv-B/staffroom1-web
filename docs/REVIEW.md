# Review: screens for the owner

Screenshots are taken by `npm run screens` (playwright.screens.config.ts): pages are signed in
with an API token placed in sessionStorage, so no password is ever typed or shown. Viewport
1180×820 (tablet landscape) unless the name says portrait (820×1180). All data is the E2E
centre's; the fixture lecture's student names are redacted as `[student]`.

## Every screen, per role

| Screen | Teacher | Owner | Admin |
|---|---|---|---|
| Sign in (signed out) | ![](../screenshots/sign-in.png) | | |
| Lecture list | ![](../screenshots/lectures-teacher.png) ([portrait](../screenshots/lectures-teacher-portrait.png)) | ![](../screenshots/lectures-owner.png) | ![](../screenshots/lectures-admin.png) |
| Upload | ![](../screenshots/upload-teacher.png) | (no upload: explains why) | ![](../screenshots/upload-admin.png) |
| Processing status | ![](../screenshots/status-teacher.png) | ![](../screenshots/status-owner.png) | ![](../screenshots/status-admin.png) |
| Analysis: overview | ![](../screenshots/analysis-overview-teacher.png) | ![](../screenshots/analysis-overview-owner.png) | ![](../screenshots/analysis-overview-admin.png) |
| Analysis: findings | ![](../screenshots/analysis-findings-teacher.png) | ![](../screenshots/analysis-findings-owner.png) | ![](../screenshots/analysis-findings-admin.png) |
| Analysis: structure, coverage, measures | ![](../screenshots/analysis-structure-teacher.png) ![](../screenshots/analysis-coverage-teacher.png) ![](../screenshots/analysis-metrics-teacher.png) | | |
| Not shared by the teacher | | ![](../screenshots/analysis-not-shared-owner.png) | |
| Transcript | ![](../screenshots/transcript-teacher.png) ([portrait](../screenshots/transcript-teacher-portrait.png)) | ![](../screenshots/transcript-owner.png) | ![](../screenshots/transcript-admin.png) |
| Lecture notes | see below | ![](../screenshots/notes-owner.png) | ![](../screenshots/notes-admin.png) |
| Measures over time | ![](../screenshots/progress-teacher.png) | ![](../screenshots/progress-owner.png) | ![](../screenshots/progress-admin-empty.png) |
| Centre summary | (not available) | ![](../screenshots/centre-owner.png) | ![](../screenshots/centre-admin.png) |
| Users | (not available) | (not available) | ![](../screenshots/users-admin.png) |
| Change password | ![](../screenshots/password-teacher.png) | same | same |
| Empty list, failed load, unknown lecture | ![](../screenshots/state-lectures-empty-teacher.png) ![](../screenshots/state-analysis-error-teacher.png) ![](../screenshots/state-lecture-not-found-teacher.png) | | |

## Polish done in this pass
- Accessibility: `e2e/a11y.spec.ts` runs axe (WCAG 2.1 A and AA) on every screen for every role,
  plus the notes editor with its transcript panel, the add-user form and the change-user dialog,
  and a keyboard-only path (skip link; editing notes and ticking transcript lines with Enter and
  Space). Fixed: accessible names that didn't contain the visible text (account menu, "Move
  up", "Remove", "Change"); they now add hidden context after the visible words.
- An unexpected rendering failure shows a plain "This page couldn't be shown" page.
- Tablet portrait: wide tables (centre, measures over time, users) scroll sideways inside their
  own labelled, focusable region; the notes transcript panel becomes a side sheet.
- Print: lecture notes print as a handout (see `notes-print.png`).

## Lecture notes (milestone e)

| Screen | Role | Screenshot |
|---|---|---|
| Approved teacher version | teacher | ![](../screenshots/notes-teacher-approved.png) |
| Pipeline draft, never edited | teacher | ![](../screenshots/notes-teacher-draft.png) |
| Editing, transcript panel open | teacher | ![](../screenshots/notes-teacher-editing.png) |
| Editing, tablet portrait (panel as a sheet) | teacher | ![](../screenshots/notes-teacher-editing-portrait.png) |
| Read only | admin | ![](../screenshots/notes-admin.png) |
| Read only (lecture shared) | owner | ![](../screenshots/notes-owner.png) |
| Print | teacher | ![](../screenshots/notes-print.png) |

Decisions made on your behalf:
- The notes open in a reading view; the teacher presses "Edit notes" to get fields. Saving
  always returns the notes to draft (the API does this) and the editor says so before saving.
- Problems the API would reject (empty heading or bullet, `[student]`, no cited line, more than
  6, a line no longer in the transcript) are checked before saving and shown beside the item,
  in the same place and words as the API's `422` answers. Only the student-name check needs the
  API; its answer never contains the name, and neither does the screen.
- Approving is a separate step from saving and says it doesn't send the notes anywhere.
- Printing gives a handout: the draft label stays on, transcript excerpts and controls go.

## Centre summary and users (milestone f)

| Screen | Role | Screenshot |
|---|---|---|
| Centre summary, real E2E data | owner | ![](../screenshots/centre-owner.png) |
| Centre summary, wait time (low confidence) | admin | ![](../screenshots/centre-admin.png) |
| Centre summary, **synthetic** 5-teacher centre (mocked `/org/summary`, invented names) | owner | ![](../screenshots/centre-owner-synthetic.png) |
| Same, tablet portrait | owner | ![](../screenshots/centre-owner-synthetic-portrait.png) |
| Users | admin | ![](../screenshots/users-admin.png) |
| Add a user | admin | ![](../screenshots/users-admin-add.png) |
| Change a user | admin | ![](../screenshots/users-admin-change.png) |

Decisions made on your behalf:
- Centre: three plain tables (lectures, findings, measures), teachers in the API's alphabetical
  order with the whole centre as the first row. Measures show one metric at a time (a pill
  picker, kept in the URL) so each teacher stays one row: lectures with a value, median, middle
  half (p25 to p75), low-confidence count, missing count with the most common reason. No
  charts, no range bars, no colour that depends on a value. A group with no values reads
  "N/A" and why. Categories never checked read "Not checked in any lecture yet", never 0.
- An optional upload-date period (from/to) is offered; a reversed period shows the API's
  `bad_range` as a plain sentence.
- Users: a first password is **required** when adding someone, because code sign-in is off and
  an account without a password can't sign in. "Make one up for me" generates a 16-character
  password (no look-alike characters) and shows it so it can be read out. Deactivation is
  confirmed; deactivated people are listed separately and can be reactivated. Demoting
  yourself asks first; `409 last_admin` is explained in the dialog.
- Admins can't reset their own password from Users (the API would allow it); they use Change
  password, which needs the current one.
- E2E creates one `e2e-managed-…@staffroom1-e2e.com` user per run and deactivates it after
  (accounts can't be deleted), so the E2E centre's Deactivated list grows by one per run.

## Measures over time (teacher progress view)

| Screen | Role | Screenshot |
|---|---|---|
| Your measures | teacher | ![](../screenshots/progress-teacher.png) |
| Same, tablet portrait (table scrolls sideways in its own region) | teacher | ![](../screenshots/progress-teacher-portrait.png) |
| One teacher's measures | owner | ![](../screenshots/progress-owner.png) |
| No teacher chosen yet | admin | ![](../screenshots/progress-admin-empty.png) |

Decisions made on your behalf:
- `/progress`: one row per analysed lecture, oldest first, with the same eight measures as the
  centre summary, each exactly as the lecture's report gave it. No chart, no averages, no
  arrows or colours for up/down, and copy that says higher or lower isn't better in itself.
- Reasons for N/A and low-confidence values are numbered notes under the table (identical
  reasons share a note) so the table stays readable; every N/A and low-confidence cell links to
  its note. The low-confidence mark is also written in the cell.
- Owners and admins pick a teacher (also linked from each teacher in the centre summary). They
  see the values they can already see in the lecture list, whatever the sharing.

## Upload: participant list and chat log (backend changelog item 2)

| Screen | Role | Screenshot |
|---|---|---|
| Teacher's row not recognised: asks them to pick it | teacher | ![](../screenshots/upload-participants-teacher-unknown.png) |
| Whole form with a list and the teacher chosen | teacher | ![](../screenshots/upload-teacher.png) |
| Same, tablet portrait | teacher | ![](../screenshots/upload-teacher-portrait.png) |
| Admin (teacher picker) | admin | ![](../screenshots/upload-admin.png) |

All names in these screenshots are invented.

Decisions made on your behalf:
- Both inputs sit in an optional "Participant list and chat (optional)" part of the form,
  below the lesson details, with the brief's explanation that names are used only for removing
  them from the transcript.
- The pasted text is read by `POST /participants/parse` and shown as an editable list (rename,
  remove, add, pick the teacher with a radio). When the teacher's row isn't recognised, the
  lecture can't be created until the teacher picks their row or confirms they aren't on the
  list. The API's warnings are shown as given.
- The list lives only in the page's memory: unlike the other details, it isn't saved with the
  upload draft in the browser, so a refresh loses it (names of minors stay out of browser
  storage). The chat file is uploaded as soon as it's chosen.
- The lecture page says "Uploaded with a participant list with N students and the meeting's
  chat" when they were given; names never come back.

## Needs your decision
1. **Wording for categories a lecture was never checked for.** Rule 6's phrase "Not yet reported
   (still being validated)" is used everywhere. For lectures processed before a category was
   released (the fixture lecture: only teaching practice and strengths), "Not checked for this
   lesson" would be more exact now that all five are released. Keep the brief's phrase, or
   switch for those lectures?
2. **First password required when adding a user.** Chosen because code sign-in is off. When
   email codes are switched on, it could become optional.
3. **The participant list isn't kept across a page refresh** (it holds minors' names, so it
   stays out of browser storage); the teacher pastes it again. Acceptable?
4. **Measures over time has no chart.** Per-lecture values are a table with numbered notes.
   A plain dot-per-lecture chart per measure is possible, but it invites reading trends as
   better or worse; I left it out.
5. **E2E user accounts accumulate** (one deactivated `e2e-managed-…` user per run), because
   accounts can't be deleted. A backend delete for test users, or a fixed reusable test user,
   would avoid it.
