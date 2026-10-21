import { readFileSync } from "node:fs";

// Reads the E2E users' passwords at run time into env vars for the tests. The file is
// root-only and outside the repo; nothing here is printed or written anywhere.
export default function globalSetup(): void {
  const path = process.env.STAFFROOM_E2E_CREDENTIALS ?? "/opt/staffroom1/.e2e_credentials";
  const lines = readFileSync(path, "utf8").trim().split("\n");
  for (const line of lines) {
    const [email, password] = line.trim().split(/\s+/);
    const role = email?.split("@")[0];
    if (email && password && role) {
      process.env[`E2E_${role.toUpperCase()}_EMAIL`] = email;
      process.env[`E2E_${role.toUpperCase()}_PASSWORD`] = password;
    }
  }
  for (const role of ["TEACHER", "OWNER", "ADMIN"]) {
    if (!process.env[`E2E_${role}_PASSWORD`]) throw new Error(`No E2E credentials for ${role.toLowerCase()} in ${path}`);
  }
}
