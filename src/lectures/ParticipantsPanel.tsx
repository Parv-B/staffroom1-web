import { useRef, useState } from "react";
import { Button, FileTrigger, Input, Label, RadioButton, RadioField, RadioGroup, TextArea, TextField } from "react-aria-components";
import { isApiError } from "~/api/client";
import {
  EMPTY_LIST,
  addRow,
  checkChatFile,
  fromParsed,
  hasTeacher,
  listProblem,
  parseParticipants,
  setTeacher,
  uploadChat,
  type ParticipantList,
} from "./participants";

const field = "t-ui w-full rounded-[3px] border border-slate bg-sheet px-2 py-1.5";

interface ParticipantsProps {
  list: ParticipantList;
  onChange: (l: ParticipantList) => void;
  /** Whose lecture it is, for finding the teacher's row (admins pick a teacher first). */
  teacherName: string | null;
  isAdmin: boolean;
  serverError: string | null;
}

/** "Who was in the class": an optional paste box, read by the API into an editable list. */
export function ParticipantsPanel({ list, onChange, teacherName, isAdmin, serverError }: ParticipantsProps) {
  const [text, setText] = useState("");
  const [state, setState] = useState<{ kind: "idle" } | { kind: "reading" } | { kind: "error"; message: string }>({ kind: "idle" });
  const problem = listProblem(list);
  const you = isAdmin ? "the teacher" : "you";

  const read = async () => {
    if (!text.trim()) {
      setState({ kind: "error", message: "Paste the list into the box first." });
      return;
    }
    setState({ kind: "reading" });
    try {
      const out = await parseParticipants(text, teacherName);
      onChange(fromParsed(out));
      setText("");
      setState({ kind: "idle" });
    } catch (e) {
      setState({
        kind: "error",
        message: isApiError(e, "too_large")
          ? "That's more text than a participant list. Paste only the list."
          : isApiError(e) && e.status === 422
            ? "The list couldn't be read. Paste it as exported, or type one name per line."
            : "The list couldn't be read because Staffroom1 couldn't be reached. Try again.",
      });
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="t-ui m-0 font-semibold">Participant list</h3>
      <p className="t-small measure m-0">
        Student names on this list are removed from the transcript before any analysis. They are not stored in reports or shown to anyone, and the list is
        used for nothing else.
      </p>
      {list.rows.length === 0 ? (
        <>
          <TextField value={text} onChange={setText} className="measure flex flex-col gap-1">
            <Label className="t-small font-semibold">Paste the participant list</Label>
            <TextArea rows={5} className={`${field} t-small font-ui`} spellCheck={false} />
          </TextField>
          <p className="t-small measure m-0 text-slate">
            A Zoom participants report (Reports, Usage, Participants, Export), a Google Meet attendance report, or one name per line copied from the
            participants panel. Phone numbers and meeting bots are left out.
          </p>
          <Button className="button" isDisabled={state.kind === "reading"} onPress={() => void read()}>
            {state.kind === "reading" ? "Reading the list" : "Read the list"}
          </Button>
        </>
      ) : (
        <ParticipantEditor list={list} onChange={onChange} you={you} />
      )}
      <div aria-live="polite">
        {state.kind === "error" ? (
          <p className="t-small m-0 border-l-[3px] border-ochre py-1 pl-3" role="alert">
            {state.message}
          </p>
        ) : null}
        {list.rows.length > 0 && problem ? (
          <p className="t-small m-0 mt-2 text-ochre" data-participants-problem>
            {problem}
          </p>
        ) : null}
        {serverError ? (
          <p className="t-small m-0 mt-2 border-l-[3px] border-ochre py-1 pl-3" role="alert">
            {serverError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ParticipantEditor({ list, onChange, you }: { list: ParticipantList; onChange: (l: ParticipantList) => void; you: string }) {
  const teacherKey = list.rows.find((r) => r.role === "teacher")?.key ?? null;
  const students = list.rows.filter((r) => r.role === "student").length;
  return (
    <div className="space-y-3">
      {list.summary ? <p className="t-small m-0 text-slate">{list.summary}</p> : null}
      {list.warnings.length > 0 ? (
        <ul className="t-small m-0 list-disc space-y-0.5 pl-5" aria-label="Notes from reading the list">
          {list.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
      {list.teacherUnknown && !hasTeacher(list) ? (
        <p className="t-small measure m-0 border-l-[3px] border-heather py-1 pl-3" role="status">
          Staffroom1 couldn't tell which name is {you === "you" ? "yours" : "the teacher's"}. Choose {you === "you" ? "your" : "the teacher's"} row below, so{" "}
          {you === "you" ? "your" : "their"} name isn't removed as a student's.
        </p>
      ) : null}
      <RadioGroup
        value={teacherKey}
        onChange={(k) => {
          onChange(setTeacher(list, k));
        }}
        aria-label="Which row is the teacher"
        className="m-0"
      >
        <ol className="m-0 max-h-80 list-none space-y-1 overflow-y-auto p-0 pr-2" aria-label={`${students.toString()} students and ${teacherKey ? "the teacher" : "no teacher yet"}`}>
          {list.rows.map((r, i) => (
            <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3" data-participant-row={r.role}>
              <TextField
                value={r.name}
                onChange={(v) => {
                  onChange({ ...list, rows: list.rows.map((x) => (x.key === r.key ? { ...x, name: v } : x)) });
                }}
                aria-label={`Name ${(i + 1).toString()}`}
              >
                <Input className={`${field} t-small`} autoComplete="off" spellCheck={false} />
              </TextField>
              <RadioField value={r.key}>
              <RadioButton className="group t-small flex w-32 cursor-pointer items-center gap-1.5 whitespace-nowrap">
                <span
                  aria-hidden="true"
                  className="inline-block size-3.5 rounded-full border border-slate bg-sheet group-data-[selected]:border-[4px] group-data-[selected]:border-pen group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-pen"
                />
                {r.role === "teacher" ? <span className="font-semibold">{you === "you" ? "Teacher (you)" : "Teacher"}</span> : <span>Student</span>}
              </RadioButton>
              </RadioField>
              <Button
                className="action t-small"
                onPress={() => {
                  onChange({ ...list, rows: list.rows.filter((x) => x.key !== r.key) });
                }}
              >
                Remove<span className="sr-only"> name {(i + 1).toString()}</span>
              </Button>
            </li>
          ))}
        </ol>
      </RadioGroup>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Button
          className="action t-small"
          onPress={() => {
            onChange(addRow(list));
          }}
        >
          Add a name
        </Button>
        {!hasTeacher(list) ? (
          <Button
            className="action t-small"
            aria-pressed={list.teacherAbsentConfirmed}
            onPress={() => {
              onChange({ ...list, teacherAbsentConfirmed: !list.teacherAbsentConfirmed });
            }}
          >
            {list.teacherAbsentConfirmed ? "The teacher isn't on this list (confirmed)" : "The teacher isn't on this list"}
          </Button>
        ) : null}
        <Button
          className="action t-small"
          onPress={() => {
            onChange(EMPTY_LIST);
          }}
        >
          Clear the list
        </Button>
      </div>
    </div>
  );
}

export type ChatState = { kind: "none" } | { kind: "uploading"; name: string } | { kind: "ready"; name: string; uploadId: string } | { kind: "error"; message: string };

/** An optional chat file: uploaded on its own, sent as chat_upload_id. */
export function ChatLogPanel({ chat, onChange }: { chat: ChatState; onChange: (c: ChatState) => void }) {
  const abort = useRef<AbortController | null>(null);
  const choose = async (file: File) => {
    const check = checkChatFile(file);
    if (!check.ok) {
      onChange({ kind: "error", message: check.message });
      return;
    }
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    onChange({ kind: "uploading", name: file.name });
    try {
      const id = await uploadChat(file, check.contentType, ac.signal);
      if (!ac.signal.aborted) onChange({ kind: "ready", name: file.name, uploadId: id });
    } catch {
      if (!ac.signal.aborted) onChange({ kind: "error", message: "The chat file didn't upload. Check your connection and choose it again." });
    }
  };
  return (
    <div className="space-y-3">
      <h3 className="t-ui m-0 font-semibold">Chat log</h3>
      <p className="t-small measure m-0">
        The meeting's chat, as a .txt or .csv file. The names of everyone who wrote in it are removed from the transcript too. If it's the chat file from a
        Zoom cloud recording, students' typed answers also count in the wait-time measures. A chat saved from the meeting window can't be lined up with the
        recording, so it's used only for removing names.
      </p>
      {chat.kind === "ready" ? (
        <p className="t-small m-0 flex flex-wrap items-center gap-x-4">
          <span>
            <span className="font-semibold">{chat.name}</span> uploaded.
          </span>
          <Button
            className="action"
            onPress={() => {
              onChange({ kind: "none" });
            }}
          >
            Don't use this chat file
          </Button>
        </p>
      ) : chat.kind === "uploading" ? (
        <p className="t-small m-0" role="status">
          Uploading {chat.name}
        </p>
      ) : (
        <FileTrigger
          acceptedFileTypes={[".txt", ".csv", "text/plain", "text/csv"]}
          onSelect={(files) => {
            const f = files?.[0];
            if (f) void choose(f);
          }}
        >
          <Button className="button">Choose the chat file</Button>
        </FileTrigger>
      )}
      {chat.kind === "error" ? (
        <p className="t-small m-0 border-l-[3px] border-ochre py-1 pl-3" role="alert">
          {chat.message}
        </p>
      ) : null}
    </div>
  );
}
