import type { Role } from "./session";

// What each role may do, mirroring the API's matrix (docs/api.md). The UI hides what a role
// can't do; the API's 403/404 are still handled wherever these are used.
export const can = {
  upload: (r: Role) => r === "teacher" || r === "admin",
  seeCentreSummary: (r: Role) => r === "owner" || r === "admin",
  manageUsers: (r: Role) => r === "admin",
  filterByTeacher: (r: Role) => r === "owner" || r === "admin",
} as const;

export const ROLE_LABEL: Readonly<Record<Role, string>> = {
  teacher: "Teacher",
  owner: "Centre owner",
  admin: "Admin",
};

/** Only same-origin app paths are allowed as a post-sign-in destination. */
export function safeRedirect(target: unknown): string {
  if (typeof target !== "string" || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/sign-in")) {
    return "/lectures";
  }
  return target;
}
