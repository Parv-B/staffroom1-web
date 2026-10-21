import { api, isApiError, unwrap, type Schemas } from "~/api/client";
import { queryOptions } from "@tanstack/react-query";

export type User = Schemas["UserOut"];
export type UserCreate = Schemas["UserCreateIn"];
export type UserPatch = Schemas["UserPatchIn"];
export type Role = Schemas["Role"];

/** The API's minimum (auth.password_min_length); the API checks it again. */
export const PASSWORD_MIN = 10;

export const usersQuery = queryOptions({
  queryKey: ["users"],
  queryFn: () => unwrap(api.GET("/users")),
});

export function createUser(body: UserCreate) {
  return unwrap(api.POST("/users", { body }));
}

export function updateUser(id: string, body: UserPatch) {
  return unwrap(api.PATCH("/users/{user_id}", { params: { path: { user_id: id } }, body }));
}

export const ROLE_HELP: Readonly<Record<Role, string>> = {
  teacher: "Uploads their own lectures and reads their own analyses. Their feedback stays private unless they share a lecture.",
  owner: "Sees every lecture's status, counts and measures, and the centre summary. Reads a full analysis only when its teacher shares it.",
  admin: "Manages users, uploads for teachers, processes lectures again and reads everything in the centre.",
};

/** Active people first, then deactivated; each group by name (or email), never by anything else. */
export function orderUsers(users: readonly User[]): { active: User[]; inactive: User[] } {
  const byName = (a: User, b: User) => displayName(a).localeCompare(displayName(b), "en", { sensitivity: "base" });
  return { active: users.filter((u) => u.active).sort(byName), inactive: users.filter((u) => !u.active).sort(byName) };
}

export function displayName(u: User): string {
  return u.display_name?.trim() || u.email;
}

/** A password an admin can read out or copy: 16 random characters in four groups, without
 *  look-alikes (0/O, 1/l/I). Uses the browser's CSPRNG. */
export function generatePassword(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const out: string[] = [];
  // Rejection sampling keeps every character equally likely.
  const limit = 256 - (256 % alphabet.length);
  while (out.length < 16) {
    for (const b of random(32)) {
      if (b < limit && out.length < 16) out.push(alphabet[b % alphabet.length] ?? "");
    }
  }
  return [0, 4, 8, 12].map((i) => out.slice(i, i + 4).join("")).join("-");
}

export type UserField = "email" | "display_name" | "password" | "role" | null;

/** What went wrong, in words, and which field it belongs to. The API never echoes values. */
export function userError(e: unknown): { field: UserField; message: string } {
  if (isApiError(e, "email_taken")) return { field: "email", message: "This email already has a Staffroom1 account." };
  if (isApiError(e, "weak_password")) return { field: "password", message: `Use at least ${PASSWORD_MIN.toString()} characters.` };
  if (isApiError(e, "last_admin"))
    return { field: null, message: "The centre must keep at least one active admin. Make someone else an admin first, then change this account." };
  if (isApiError(e, "validation_error")) {
    const loc = e.fields[0]?.loc ?? [];
    const f = loc[loc.length - 1];
    if (f === "email") return { field: "email", message: "Enter a full email address, like name@school.ae." };
    if (f === "display_name") return { field: "display_name", message: "Use a shorter name (at most 200 characters)." };
    if (f === "password") return { field: "password", message: "Use a shorter password (at most 200 characters)." };
    return { field: null, message: "Check the details and try again." };
  }
  if (isApiError(e, "network_error")) return { field: null, message: "Nothing was changed, because Staffroom1 couldn't be reached. Try again." };
  if (isApiError(e) && e.status === 404) return { field: null, message: "This account no longer exists in this centre. Reload the page." };
  if (isApiError(e) && e.status === 403) return { field: null, message: "Only admins can manage users." };
  return { field: null, message: "Nothing was changed. Try again." };
}
