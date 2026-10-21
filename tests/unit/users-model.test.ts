import { describe, expect, it } from "vitest";
import { ApiError } from "~/api/client";
import { generatePassword, orderUsers, userError, type User } from "~/users/model";

const user = (over: Partial<User>): User => ({ id: "u", email: "x@example.org", role: "teacher", display_name: null, active: true, created_at: "2026-10-21T00:00:00Z", has_password: true, ...over });

describe("user management", () => {
  it("lists active people first, each group by name only", () => {
    const { active, inactive } = orderUsers([
      user({ id: "1", display_name: "zara" }),
      user({ id: "2", display_name: "Amir", active: false }),
      user({ id: "3", display_name: null, email: "b@example.org" }),
      user({ id: "4", display_name: "Chen", role: "admin" }),
    ]);
    expect(active.map((u) => u.id)).toEqual(["3", "4", "1"]);
    expect(inactive.map((u) => u.id)).toEqual(["2"]);
  });

  it("explains 409 last_admin and puts other errors on their field", () => {
    expect(userError(new ApiError(409, "last_admin", "")).message).toMatch(/at least one active admin/);
    expect(userError(new ApiError(409, "email_taken", "")).field).toBe("email");
    expect(userError(new ApiError(422, "weak_password", "")).field).toBe("password");
    expect(userError(new ApiError(422, "validation_error", "", [{ loc: ["body", "email"], msg: "", type: "value_error" }])).field).toBe("email");
  });

  it("makes a 19-character password without look-alike characters", () => {
    for (let i = 0; i < 20; i++) {
      const p = generatePassword();
      expect(p).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{4}(-[a-km-zA-HJ-NP-Z2-9]{4}){3}$/);
    }
  });
});
