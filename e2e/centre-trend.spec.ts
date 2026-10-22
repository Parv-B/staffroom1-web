import { expect, test, type APIRequestContext } from "@playwright/test";
import { API_URL, apiToken, signIn } from "./helpers";

// Against the real API: the centre's measures over time and the group-by control. Assertions
// are data-driven (the E2E centre's lectures change as other runs add or rerun them).

type Agg = { n_lectures_with_value: number; median: number | null };
type Bucket = { start: string; n_lectures: number; metrics: Record<string, Agg> };
type Trend = { bucket: string; buckets: Bucket[]; metric_names: string[] };
type Group = { key: string | null; label: string; n_lectures: number };
type Summary = { org: { n_lectures: number }; groups: Group[]; teachers: { display_name: string | null }[] };

async function api<T>(request: APIRequestContext, path: string): Promise<T> {
  const token = await apiToken(request, "owner");
  const r = await request.get(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  expect(r.ok()).toBe(true);
  return (await r.json()) as T;
}

test("owner: measures over time show every week, gaps for empty weeks and n for few-lecture weeks", async ({ page, request }) => {
  const trend = await api<Trend>(request, "/org/trend?bucket=week");
  await signIn(page, "owner");
  await page.goto("/centre");
  await expect(page.getByRole("heading", { name: "Measures over time" })).toBeVisible();
  const charts = page.locator("[data-centre-trend]");
  await expect(charts).toHaveCount(trend.metric_names.length);

  const wpm = page.locator('[data-centre-trend="teacher_wpm"]');
  const expectedStates = trend.buckets.map((b) => (b.n_lectures === 0 ? "no-lectures" : (b.metrics.teacher_wpm?.median ?? null) === null ? "na" : "value"));
  const states = await wpm.locator("[data-bucket-state]").evaluateAll((els) => els.map((e) => e.getAttribute("data-bucket-state")));
  expect(states).toEqual(expectedStates);
  const few = trend.buckets.filter((b) => (b.metrics.teacher_wpm?.median ?? null) !== null && (b.metrics.teacher_wpm?.n_lectures_with_value ?? 0) <= 2);
  await expect(wpm.locator("[data-few-label]")).toHaveCount(few.length);
  for (const [i, b] of few.entries()) await expect(wpm.locator("[data-few-label]").nth(i)).toHaveText(`n=${(b.metrics.teacher_wpm?.n_lectures_with_value ?? 0).toString()}`);

  // Every bucket is focusable and explains itself.
  const first = wpm.locator("[data-bucket-state]").first();
  await first.focus();
  await expect(wpm.locator("[data-trend-tooltip]")).toBeVisible();

  // The exact values table has one row per bucket.
  await expect(page.getByRole("region", { name: /Measures week by week/ }).locator("[data-bucket-row]")).toHaveCount(trend.buckets.length);

  // Month toggle.
  const months = await api<Trend>(request, "/org/trend?bucket=month");
  await page.getByRole("radio", { name: "Month" }).click({ force: true });
  await expect(page).toHaveURL(/bucket=month/);
  await expect(page.getByRole("region", { name: /Measures month by month/ }).locator("[data-bucket-row]")).toHaveCount(months.buckets.length);
  for (const word of [/\brank/i, /\bscore/i, /best|worst/i, /forecast/i, /\btrend\b/i]) await expect(page.getByText(word)).toHaveCount(0);
});

test("owner: group by subject and grade switches the tables, in the API's order", async ({ page, request }) => {
  const bySubject = await api<Summary>(request, "/org/summary?group_by=subject");
  const byGrade = await api<Summary>(request, "/org/summary?group_by=grade");
  await signIn(page, "owner");
  await page.goto("/centre");
  await expect(page.getByRole("region", { name: "Lectures by teacher" })).toBeVisible();

  await page.getByRole("radiogroup", { name: "Group the tables by" }).getByRole("radio", { name: "Subject", exact: true }).click({ force: true });
  await expect(page).toHaveURL(/group=subject/);
  const subjects = page.getByRole("region", { name: "Lectures by subject" });
  await expect(subjects.getByRole("rowheader")).toHaveText(["Whole centre", ...bySubject.groups.map((g) => g.label)]);

  await page.getByRole("radiogroup", { name: "Group the tables by" }).getByRole("radio", { name: "Grade", exact: true }).click({ force: true });
  const grades = page.getByRole("region", { name: "Lectures by grade" });
  await expect(grades.getByRole("rowheader")).toHaveText(["Whole centre", ...byGrade.groups.map((g) => (g.key === null ? g.label : `Grade ${g.label}`))]);
  await expect(page.getByRole("region", { name: /by grade$/ })).toHaveCount(3); // lectures, findings, measures

  await page.getByRole("radiogroup", { name: "Group the tables by" }).getByRole("radio", { name: "Teacher", exact: true }).click({ force: true });
  await expect(page).not.toHaveURL(/group=/);
  await expect(page.getByRole("region", { name: "Lectures by teacher" })).toBeVisible();
});

test("owner: a subject filter narrows the tables and the charts", async ({ page, request }) => {
  const bySubject = await api<Summary>(request, "/org/summary?group_by=subject");
  const pick = bySubject.groups.find((g) => g.key !== null);
  test.skip(!pick, "no lecture has a subject");
  if (!pick?.key) return;
  const narrowed = await api<Summary>(request, `/org/summary?subject=${encodeURIComponent(pick.key)}`);
  const trend = await api<Trend>(request, `/org/trend?subject=${encodeURIComponent(pick.key)}`);
  await signIn(page, "owner");
  await page.goto("/centre");
  await page.getByRole("button", { name: /Subject/ }).click();
  await page.getByRole("option", { name: pick.label }).click();
  await expect(page).toHaveURL(new RegExp(`subject=${pick.key}`));
  await expect(page.locator("[data-filters-text]")).toContainText(pick.label);
  const centreRow = page.getByRole("region", { name: "Lectures by teacher" }).getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Whole centre" }) });
  await expect(centreRow.getByRole("cell").first()).toHaveText(narrowed.org.n_lectures.toString());
  await expect(page.getByRole("region", { name: /Measures week by week/ }).locator("[data-bucket-row]")).toHaveCount(trend.buckets.length);
  await page.getByRole("button", { name: /Subject/ }).click();
  await page.getByRole("option", { name: "All subjects" }).click();
  await expect(page).not.toHaveURL(/subject=/);
});

test("teacher: the trend and the subject breakdown are refused by the API", async ({ request }) => {
  const token = await apiToken(request, "teacher");
  for (const path of ["/org/trend", "/org/summary?group_by=subject"]) {
    const r = await request.get(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(r.status(), path).toBe(403);
  }
});

test("tablet portrait: the centre page doesn't scroll sideways", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await signIn(page, "owner");
  await page.goto("/centre?group=subject");
  await expect(page.locator("[data-centre-trend]").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // Charts sit in one column at this width.
  const boxes = await page.locator("[data-centre-trend]").evaluateAll((els) => els.slice(0, 2).map((e) => e.getBoundingClientRect().left));
  expect(boxes[0]).toBe(boxes[1]);
});
