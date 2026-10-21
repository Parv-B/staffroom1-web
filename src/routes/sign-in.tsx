import { useState, type SyntheticEvent } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Button, Form, Input, Label, TextField } from "react-aria-components";
import { isApiError } from "~/api/client";
import { safeRedirect } from "~/auth/roles";
import { ensureSession, signInWithPassword } from "~/auth/session";

export const Route = createFileRoute("/sign-in")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } =>
    typeof s.redirect === "string" ? { redirect: s.redirect } : {},
  beforeLoad: async ({ search }) => {
    if (await ensureSession()) throw redirect({ href: safeRedirect(search.redirect) });
  },
  component: SignIn,
});

// One message for every failed sign-in: the API answers the same 401 for an unknown email, a
// wrong password, an inactive account and a temporary lock, and so does this screen.
const FAILED = "That email and password don't match an active account. Check both and try again.";
const UNREACHABLE = "Staffroom1 couldn't be reached. Check your connection and try again.";

function SignIn() {
  const { redirect: target } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = data.get("email");
    const password = data.get("password");
    setBusy(true);
    setError(null);
    try {
      await signInWithPassword(typeof email === "string" ? email.trim() : "", typeof password === "string" ? password : "");
      await navigate({ href: safeRedirect(target) });
    } catch (err) {
      setError(isApiError(err) && err.status === 401 ? FAILED : UNREACHABLE);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <p className="t-heading">Staffroom1</p>
      <div className="mt-8 bg-sheet px-6 py-8 sm:px-8">
        <h1 className="t-subheading">Sign in</h1>
        <p className="t-small mt-1 text-slate">Your centre's admin creates accounts and sets first passwords.</p>
        <Form className="mt-6 space-y-5" onSubmit={(e) => void onSubmit(e)}>
          <TextField name="email" type="email" isRequired autoComplete="username" autoFocus className="flex flex-col gap-1.5">
            <Label className="t-small font-semibold">Email</Label>
            <Input className="t-ui rounded-[3px] border border-slate bg-sheet px-3 py-2" />
          </TextField>
          <TextField name="password" type="password" isRequired autoComplete="current-password" className="flex flex-col gap-1.5">
            <Label className="t-small font-semibold">Password</Label>
            <Input className="t-ui rounded-[3px] border border-slate bg-sheet px-3 py-2" />
          </TextField>
          <div aria-live="polite">
            {error ? (
              <p className="t-small border-l-[3px] border-ink pl-3 text-ink" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <Button type="submit" className="button w-full" data-variant="primary" isDisabled={busy}>
            {busy ? "Signing in" : "Sign in"}
          </Button>
        </Form>
        <p className="t-small mt-6 text-slate">Forgotten your password? Ask your centre's admin to set a new one.</p>
      </div>
    </main>
  );
}
