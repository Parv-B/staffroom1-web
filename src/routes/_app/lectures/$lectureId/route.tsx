import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { SwitchButton, SwitchField } from "react-aria-components";
import { isApiError } from "~/api/client";
import type { Role } from "~/auth/session";
import { orgSummaryQuery } from "~/centre/queries";
import { StatusMark } from "~/components/StatusMark";
import { lectureDetailQuery, setShared, type LectureDetail } from "~/lectures/detail";
import { STATUS_LABEL, lectureFacts, lectureTitle } from "~/lectures/vocab";
import { longDate } from "~/lib/format";
import { PlayerProvider } from "~/media/player";

export const Route = createFileRoute("/_app/lectures/$lectureId")({
  component: LectureLayout,
});

function LectureLayout() {
  const { lectureId } = Route.useParams();
  const { me } = Route.useRouteContext();
  const detail = useQuery(lectureDetailQuery(lectureId));
  const org = useQuery({ ...orgSummaryQuery(), enabled: me.role !== "teacher" });

  if (detail.isPending) return <p className="t-reading pt-10 text-slate">Loading the lecture</p>;
  if (detail.isError) {
    return (
      <main className="measure pt-6">
        <BackLink />
        <p className="t-reading mt-6" role="alert">
          {isApiError(detail.error) && detail.error.status === 404
            ? "This lecture doesn't exist, or it isn't one you can see."
            : "The lecture couldn't be loaded. Check your connection, then reload the page."}
        </p>
      </main>
    );
  }
  const d = detail.data;
  const teacherName = me.role === "teacher" ? null : (org.data?.teachers.find((t) => t.teacher_user_id === d.teacher_user_id)?.display_name ?? null);
  const done = d.status === "done";
  const canPlay = done && (me.role !== "owner" || d.shared_with_owner);
  const body = (
    <main className="pt-6">
      <BackLink />
      <header className="mt-4">
        <h1 className="t-display measure">{lectureTitle(d.metadata)}</h1>
        <p className="t-reading measure mt-2 text-slate">
          {teacherName ? `${teacherName}. ` : ""}
          {lectureFacts(d.metadata, d.duration_ms)}. Uploaded {longDate(d.created_at)}.
          {done ? null : ` ${STATUS_LABEL[d.status]}.`}
        </p>
        <Sharing detail={d} role={me.role} isOwnLecture={d.teacher_user_id === me.user_id} />
      </header>
      <Tabs lectureId={lectureId} done={done} />
      <div className="bg-sheet px-5 pt-2 pb-12 sm:px-10">
        <Outlet />
      </div>
    </main>
  );
  return canPlay ? (
    <PlayerProvider lectureId={lectureId} durationMs={d.duration_ms ?? 0}>
      {body}
    </PlayerProvider>
  ) : (
    body
  );
}

function BackLink() {
  return (
    <p className="t-small" data-no-print>
      <Link to="/lectures" className="action">
        All lectures
      </Link>
    </p>
  );
}

const tab =
  "t-ui -mb-px inline-block border-b-[3px] border-transparent px-1 pt-2 pb-1.5 text-ink no-underline hover:border-slate/40 data-[status=active]:border-pen data-[status=active]:font-semibold";

function Tabs({ lectureId, done }: { lectureId: string; done: boolean }) {
  const params = { lectureId };
  return (
    <nav aria-label="Lecture" className="mt-6 flex flex-wrap gap-x-6 gap-y-1 border-b border-slate/30" data-no-print>
      {done ? (
        <>
          <Link to="/lectures/$lectureId/analysis/overview" params={params} className={tab}>
            Overview
          </Link>
          <Link to="/lectures/$lectureId/analysis/findings" params={params} className={tab}>
            Findings
          </Link>
          <Link to="/lectures/$lectureId/analysis/structure" params={params} className={tab}>
            Structure
          </Link>
          <Link to="/lectures/$lectureId/analysis/coverage" params={params} className={tab}>
            Coverage
          </Link>
          <Link to="/lectures/$lectureId/analysis/metrics" params={params} className={tab}>
            Measures
          </Link>
          <Link to="/lectures/$lectureId/transcript" params={params} className={tab}>
            Transcript
          </Link>
        </>
      ) : null}
      <Link to="/lectures/$lectureId/status" params={params} className={tab}>
        Processing
      </Link>
    </nav>
  );
}

function Sharing({ detail: d, role, isOwnLecture }: { detail: LectureDetail; role: Role; isOwnLecture: boolean }) {
  const queryClient = useQueryClient();
  const share = useMutation({
    mutationFn: (shared: boolean) => setShared(d.lecture_id, shared),
    onSuccess: (out) => {
      queryClient.setQueryData<LectureDetail>(["lecture", d.lecture_id, "detail"], (old) => (old ? { ...old, shared_with_owner: out.shared_with_owner } : old));
      void queryClient.invalidateQueries({ queryKey: ["lectures"] });
    },
  });
  if (role === "teacher" && isOwnLecture) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2" data-no-print>
        <SwitchField isSelected={d.shared_with_owner} isDisabled={share.isPending} onChange={(v) => { share.mutate(v); }}>
        <SwitchButton className="group t-ui flex cursor-pointer items-center gap-3">
          <span aria-hidden="true" className="relative inline-block h-6 w-11 rounded-full border border-slate bg-sheet transition-colors group-data-[selected]:border-pen group-data-[selected]:bg-pen group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-pen">
            <span className="absolute top-0.5 left-0.5 size-[1.125rem] rounded-full bg-slate transition-transform group-data-[selected]:translate-x-5 group-data-[selected]:bg-sheet" />
          </span>
          Shared with the centre owner
        </SwitchButton>
        </SwitchField>
        <span className="t-small text-slate">
          {d.shared_with_owner
            ? "The owner can read this analysis, its transcript and the notes. Your responses to findings stay private."
            : "Only you (and the centre's admins) can read this analysis."}
        </span>
        {share.isError ? (
          <span className="t-small" role="alert">
            The sharing setting wasn't changed. Try again.
          </span>
        ) : null}
      </div>
    );
  }
  return (
    <p className="mt-3">
      {d.shared_with_owner ? <span className="t-small text-slate">Shared with the centre owner by the teacher.</span> : role === "owner" ? <StatusMark kind="not-shared" /> : <span className="t-small text-slate">Not shared with the centre owner.</span>}
    </p>
  );
}
