// All sign-in code lives in this module: token storage, the auth middleware, sign-in, sign-out,
// password change and the current-user query. Email-code sign-in (POST /auth/request-code →
// POST /auth/verify) is off on the API; adding it means a second `signInWith…` function here
// that ends in the same `storeSession`, and a second form on the sign-in screen.
import { useSyncExternalStore } from "react";
import { queryOptions } from "@tanstack/react-query";
import { api, unwrap, type Schemas } from "~/api/client";

const STORAGE_KEY = "staffroom1.session";

interface Session {
  token: string;
  expiresAt: number; // epoch ms
}

type Listener = () => void;
const listeners = new Set<Listener>();
let cached: Session | null | undefined;

function asSession(v: unknown): Session | null {
  if (typeof v === "object" && v !== null && "token" in v && "expiresAt" in v) {
    const { token, expiresAt } = v;
    if (typeof token === "string" && typeof expiresAt === "number" && expiresAt > Date.now()) return { token, expiresAt };
  }
  return null;
}

function readStorage(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? asSession(JSON.parse(raw)) : null;
  } catch {
    // Storage blocked or corrupt: treat as signed out.
    return null;
  }
}

function current(): Session | null {
  if (cached === undefined) cached = readStorage();
  if (cached && cached.expiresAt <= Date.now()) setSession(null);
  return cached ?? null;
}

function setSession(s: Session | null): void {
  cached = s;
  try {
    if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the session lives only in memory for this tab.
  }
  for (const l of listeners) l();
}

// sessionStorage is per tab, so a lecture opened in a new tab would otherwise ask to sign in
// again. Tabs share the session over a same-origin BroadcastChannel instead: a tab without one
// asks, and any signed-in tab answers. Nothing is written to shared storage, so the session
// still ends when the last tab closes; signing out in one tab signs out all of them.
type TabMessage = { type: "request" } | { type: "session"; session: Session } | { type: "signed-out" };
const channel: BroadcastChannel | null = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("staffroom1.session");
let pendingAsk: ((s: Session) => void) | null = null;

channel?.addEventListener("message", (e: MessageEvent<unknown>) => {
  const m = e.data as Partial<TabMessage> | null;
  if (m?.type === "request") {
    const s = current();
    if (s) channel.postMessage({ type: "session", session: s } satisfies TabMessage);
  } else if (m?.type === "session") {
    const s = asSession((m as { session?: unknown }).session);
    if (s && pendingAsk) pendingAsk(s);
  } else if (m?.type === "signed-out") {
    if (cached) setSession(null);
  }
});

/** Signed in here, or in another open tab of this browser (which then shares its session). */
export async function ensureSession(timeoutMs = 300): Promise<boolean> {
  if (isSignedIn()) return true;
  if (!channel) return false;
  const shared = await new Promise<Session | null>((resolve) => {
    const timer = setTimeout(() => {
      pendingAsk = null;
      resolve(null);
    }, timeoutMs);
    pendingAsk = (s) => {
      clearTimeout(timer);
      pendingAsk = null;
      resolve(s);
    };
    channel.postMessage({ type: "request" } satisfies TabMessage);
  });
  if (shared) setSession(shared);
  return shared !== null;
}

function endSessionEverywhere(): void {
  setSession(null);
  channel?.postMessage({ type: "signed-out" } satisfies TabMessage);
}

export function getToken(): string | null {
  return current()?.token ?? null;
}

export function isSignedIn(): boolean {
  return current() !== null;
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSignedIn(): boolean {
  return useSyncExternalStore(subscribe, isSignedIn, () => false);
}

// Attach the bearer token; drop the session when the API says it is no longer valid.
api.use({
  onRequest({ request }) {
    const token = getToken();
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  },
  async onResponse({ response }) {
    if (response.status === 401 && getToken()) {
      const body = (await response.clone().json().catch(() => null)) as { error?: { code?: string } } | null;
      if (body?.error?.code === "unauthenticated") endSessionEverywhere();
    }
    return response;
  },
});

function storeSession(t: Schemas["TokenOut"]): void {
  setSession({ token: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 });
}

/** Throws ApiError; every failed sign-in is the same `401 invalid_credentials`. */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  const t = await unwrap(api.POST("/auth/login", { body: { email, password } }));
  storeSession(t);
}

export async function signOut(): Promise<void> {
  try {
    if (getToken()) await api.POST("/auth/logout");
  } finally {
    endSessionEverywhere();
  }
}

/** The API ends the user's other sessions; this one stays valid. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await unwrap(api.POST("/me/password", { body: { current_password: currentPassword, new_password: newPassword } }));
}

export type Me = Schemas["MeOut"];
export type Role = Schemas["Role"];

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: () => unwrap(api.GET("/me")),
  staleTime: 5 * 60_000,
});
