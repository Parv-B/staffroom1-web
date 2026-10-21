import { useState, type SyntheticEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button, FieldError, Form, Input, Label, TextField } from "react-aria-components";
import { isApiError } from "~/api/client";
import { changePassword } from "~/auth/session";

export const Route = createFileRoute("/_app/account/password")({
  component: ChangePassword,
});

type Outcome = { kind: "idle" } | { kind: "saved" } | { kind: "error"; field: "current" | "new" | null; message: string };

function ChangePassword() {
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const current = data.get("current");
    const next = data.get("new");
    const repeat = data.get("repeat");
    if (typeof current !== "string" || typeof next !== "string" || typeof repeat !== "string") return;
    if (next !== repeat) {
      setOutcome({ kind: "error", field: "new", message: "The new passwords don't match. Type the same password in both boxes." });
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      form.reset();
      setOutcome({ kind: "saved" });
    } catch (err) {
      if (isApiError(err, "wrong_password")) {
        setOutcome({ kind: "error", field: "current", message: "Your current password isn't right. Check it and try again." });
      } else if (isApiError(err, "weak_password")) {
        setOutcome({ kind: "error", field: "new", message: err.message || "Choose a longer password." });
      } else {
        setOutcome({ kind: "error", field: null, message: "The password wasn't changed because Staffroom1 couldn't be reached. Try again." });
      }
    } finally {
      setBusy(false);
    }
  }

  const invalid = (f: "current" | "new") => outcome.kind === "error" && outcome.field === f;
  return (
    <main className="measure pt-6">
      <h1 className="t-heading">Change password</h1>
      <p className="t-reading mt-2 text-slate">Changing it signs you out everywhere else. You stay signed in here.</p>
      <Form className="mt-8 max-w-sm space-y-5" onSubmit={(e) => void onSubmit(e)} validationBehavior="aria">
        <TextField name="current" type="password" isRequired autoComplete="current-password" isInvalid={invalid("current")} className="flex flex-col gap-1.5">
          <Label className="t-small font-semibold">Current password</Label>
          <Input className="t-ui rounded-[3px] border border-slate bg-sheet px-3 py-2 data-[invalid]:border-2 data-[invalid]:border-ink" />
          <FieldError className="t-small">{outcome.kind === "error" ? outcome.message : null}</FieldError>
        </TextField>
        <TextField name="new" type="password" isRequired minLength={10} autoComplete="new-password" isInvalid={invalid("new")} className="flex flex-col gap-1.5">
          <Label className="t-small font-semibold">New password</Label>
          <Input className="t-ui rounded-[3px] border border-slate bg-sheet px-3 py-2 data-[invalid]:border-2 data-[invalid]:border-ink" aria-describedby="pw-hint" />
          <p id="pw-hint" className="t-small text-slate">
            At least 10 characters. A few unrelated words make a strong one.
          </p>
          <FieldError className="t-small">{outcome.kind === "error" ? outcome.message : null}</FieldError>
        </TextField>
        <TextField name="repeat" type="password" isRequired autoComplete="new-password" className="flex flex-col gap-1.5">
          <Label className="t-small font-semibold">New password again</Label>
          <Input className="t-ui rounded-[3px] border border-slate bg-sheet px-3 py-2" />
        </TextField>
        <div aria-live="polite">
          {outcome.kind === "saved" ? (
            <p className="t-small border-l-[3px] border-pen pl-3" role="status">
              Password changed. Other devices have been signed out.
            </p>
          ) : null}
          {outcome.kind === "error" && outcome.field === null ? (
            <p className="t-small border-l-[3px] border-ink pl-3" role="alert">
              {outcome.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" className="button" data-variant="primary" isDisabled={busy}>
          {busy ? "Changing password" : "Change password"}
        </Button>
      </Form>
    </main>
  );
}
