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

## Needs your decision
- None yet for the notes.
