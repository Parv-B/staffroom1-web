# Review: screens for the owner

Screenshots are taken by `npm run screens` (playwright.screens.config.ts): pages are signed in
with an API token placed in sessionStorage, so no password is ever typed or shown. Viewport
1180×820 (tablet landscape) unless the name says portrait (820×1180). All data is the E2E
centre's; the fixture lecture's student names are redacted as `[student]`.

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

## Needs your decision
- None yet for the notes.
