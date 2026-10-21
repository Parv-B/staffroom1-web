import { useState, type ReactNode, type SyntheticEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Button, Dialog, FieldError, Heading, Input, Label, Modal, ModalOverlay, RadioButton, RadioField, RadioGroup, Text, TextField } from "react-aria-components";
import { ROLE_LABEL, can } from "~/auth/roles";
import { meQuery, type Me } from "~/auth/session";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { longDate } from "~/lib/format";
import {
  PASSWORD_MIN,
  ROLE_HELP,
  createUser,
  displayName,
  generatePassword,
  orderUsers,
  updateUser,
  userError,
  usersQuery,
  type Role,
  type User,
  type UserField,
} from "~/users/model";

export const Route = createFileRoute("/_app/admin/users")({
  beforeLoad: ({ context }) => {
    if (!can.manageUsers(context.me.role)) throw redirect({ to: "/lectures" });
  },
  component: Users,
});

const ROLES: readonly Role[] = ["teacher", "owner", "admin"];

function Users() {
  const { me } = Route.useRouteContext();
  const q = useQuery(usersQuery);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const groups = q.data ? orderUsers(q.data) : null;
  return (
    <main className="pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="t-heading m-0">Users</h1>
        {!adding ? (
          <Button
            className="button"
            data-variant="primary"
            onPress={() => {
              setFlash(null);
              setAdding(true);
            }}
          >
            Add a user
          </Button>
        ) : null}
      </div>
      <p className="t-reading measure mt-2 text-slate">
        Everyone who can sign in to Staffroom1 at this centre. There's no self sign-up: add each person here and give them their first password in person. They
        can change it under Change password.
      </p>
      <div aria-live="polite">
        {flash ? (
          <p className="t-small measure mt-4 border-l-[3px] border-pen py-1 pl-3" role="status">
            {flash}
          </p>
        ) : null}
      </div>
      {adding ? (
        <AddUser
          onCancel={() => {
            setAdding(false);
          }}
          onAdded={(u) => {
            setAdding(false);
            setFlash(`${displayName(u)} was added as ${ROLE_LABEL[u.role].toLowerCase()}. Give them their password in person.`);
          }}
        />
      ) : null}
      <div className="mt-6 bg-sheet px-5 pt-2 pb-10 sm:px-8">
        {q.isPending ? <p className="t-reading py-8 text-slate">Loading users</p> : null}
        {q.isError ? (
          <p className="t-reading py-8" role="alert">
            The users couldn't be loaded. Check your connection, then reload the page.
          </p>
        ) : null}
        {groups ? (
          <>
            <UserTable caption="Active users" users={groups.active} me={me} onEdit={setEditing} />
            {groups.active.length === 0 ? <p className="t-reading">No active users.</p> : null}
            {groups.inactive.length > 0 ? (
              <>
                <h2 className="t-subheading mt-10 mb-0">Deactivated</h2>
                <p className="t-small mt-1 text-slate">They can't sign in. Their lectures and analyses are kept.</p>
                <UserTable caption="Deactivated users" users={groups.inactive} me={me} onEdit={setEditing} />
              </>
            ) : null}
          </>
        ) : null}
      </div>
      {editing ? (
        <EditUser
          user={editing}
          me={me}
          onClose={(message) => {
            setEditing(null);
            if (message) setFlash(message);
          }}
        />
      ) : null}
    </main>
  );
}

function UserTable({ caption, users, me, onEdit }: { caption: string; users: readonly User[]; me: Me; onEdit: (u: User) => void }) {
  if (users.length === 0) return null;
  return (
    <div className="mt-4 overflow-x-auto" role="region" aria-label={caption} tabIndex={0}>
      <table className="t-ui w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="t-small text-left text-slate">
            <th scope="col" className="pr-6 pb-2 font-semibold">
              Name
            </th>
            <th scope="col" className="pr-6 pb-2 font-semibold">
              Email
            </th>
            <th scope="col" className="pr-6 pb-2 font-semibold">
              Role
            </th>
            <th scope="col" className="pr-6 pb-2 font-semibold">
              Password
            </th>
            <th scope="col" className="pr-6 pb-2 font-semibold">
              Added
            </th>
            <th scope="col" className="pb-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-slate/25" data-user-row={u.email}>
              <th scope="row" className="py-2.5 pr-6 text-left align-top font-semibold">
                {u.display_name?.trim() || <span className="font-normal text-slate">No name</span>}
                {u.id === me.user_id ? <span className="t-small font-normal text-slate"> (you)</span> : null}
              </th>
              <td className="py-2.5 pr-6 align-top break-all">{u.email}</td>
              <td className="py-2.5 pr-6 align-top">{ROLE_LABEL[u.role]}</td>
              <td className="t-small py-2.5 pr-6 align-top">{u.has_password ? "Set" : <span className="text-ochre">Not set: they can't sign in yet</span>}</td>
              <td className="t-small nums py-2.5 pr-6 align-top">{longDate(u.created_at)}</td>
              <td className="py-2.5 text-right align-top">
                <Button
                  className="action t-small"
                  onPress={() => {
                    onEdit(u);
                  }}
                  aria-label={`Change ${displayName(u)}`}
                >
                  Change
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const field = "t-ui w-full rounded-[3px] border border-slate bg-sheet px-2 py-1.5 data-[invalid]:border-2 data-[invalid]:border-ochre";
const labelCls = "t-small font-semibold";

function AddUser({ onCancel, onAdded }: { onCancel: () => void; onAdded: (u: User) => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("teacher");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<{ field: UserField; message: string } | null>(null);
  const add = useMutation({
    mutationFn: () => createUser({ email: email.trim(), role, display_name: name.trim() || null, password }),
    onSuccess: (u) => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["org"] });
      onAdded(u);
    },
    onError: (e) => {
      setProblem(userError(e));
    },
  });
  const submit = (e: SyntheticEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setProblem({ field: "email", message: "Enter their email address." });
      return;
    }
    if (password.length < PASSWORD_MIN) {
      setProblem({ field: "password", message: `Use at least ${PASSWORD_MIN.toString()} characters.` });
      return;
    }
    setProblem(null);
    add.mutate();
  };
  return (
    <form className="measure mt-6 bg-sheet px-5 py-6 sm:px-8" aria-labelledby="add-user-h" onSubmit={submit} noValidate>
      <h2 id="add-user-h" className="t-subheading m-0">
        Add a user
      </h2>
      <div className="mt-4 space-y-4">
        <TextField value={name} onChange={setName} className="flex flex-col gap-1" isInvalid={problem?.field === "display_name"}>
          <Label className={labelCls}>Name</Label>
          <Input className={field} autoComplete="off" />
          <Text slot="description" className="t-small text-slate">
            As colleagues know them. Shown in lists and the centre summary.
          </Text>
          <FieldError className="t-small text-ochre">{problem?.field === "display_name" ? problem.message : null}</FieldError>
        </TextField>
        <TextField value={email} onChange={setEmail} type="email" className="flex flex-col gap-1" isInvalid={problem?.field === "email"} isRequired>
          <Label className={labelCls}>Email</Label>
          <Input className={field} autoComplete="off" />
          <FieldError className="t-small text-ochre">{problem?.field === "email" ? problem.message : null}</FieldError>
        </TextField>
        <RoleChoice value={role} onChange={setRole} />
        <PasswordInput label="First password" value={password} onChange={setPassword} problem={problem?.field === "password" ? problem.message : null} />
      </div>
      {problem && problem.field === null ? (
        <p className="t-small mt-4 border-l-[3px] border-ochre py-1 pl-3" role="alert">
          {problem.message}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="submit" className="button" data-variant="primary" isDisabled={add.isPending}>
          {add.isPending ? "Adding user" : "Add user"}
        </Button>
        <Button className="button" onPress={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function RoleChoice({ value, onChange, isDisabled = false }: { value: Role; onChange: (r: Role) => void; isDisabled?: boolean }) {
  return (
    <RadioGroup
      value={value}
      onChange={(v) => {
        if (v === "teacher" || v === "owner" || v === "admin") onChange(v);
      }}
      isDisabled={isDisabled}
      className="flex flex-col gap-2"
    >
      <Label className={labelCls}>Role</Label>
      {ROLES.map((r) => (
        <RadioField key={r} value={r}>
        <RadioButton className="group flex cursor-pointer items-start gap-2.5">
          <span
            aria-hidden="true"
            className="mt-1 inline-block size-4 shrink-0 rounded-full border border-slate bg-sheet group-data-[selected]:border-[5px] group-data-[selected]:border-pen group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-pen"
          />
          <span>
            <span className="t-ui block font-semibold">{ROLE_LABEL[r]}</span>
            <span className="t-small block text-slate">{ROLE_HELP[r]}</span>
          </span>
        </RadioButton>
        </RadioField>
      ))}
    </RadioGroup>
  );
}

function PasswordInput({ label, value, onChange, problem }: { label: string; value: string; onChange: (v: string) => void; problem: string | null }) {
  const [shown, setShown] = useState(false);
  return (
    <TextField value={value} onChange={onChange} type={shown ? "text" : "password"} className="flex flex-col gap-1" isInvalid={problem !== null}>
      <Label className={labelCls}>{label}</Label>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Input className={`${field} nums max-w-xs`} autoComplete="new-password" spellCheck={false} />
        <Button
          className="action t-small"
          onPress={() => {
            setShown((s) => !s);
          }}
        >
          {shown ? "Hide" : "Show"}
        </Button>
        <Button
          className="action t-small"
          onPress={() => {
            onChange(generatePassword());
            setShown(true);
          }}
        >
          Make one up for me
        </Button>
      </div>
      <Text slot="description" className="t-small text-slate">
        At least {PASSWORD_MIN} characters. Give it to them in person or by phone, not by email.
      </Text>
      <FieldError className="t-small text-ochre">{problem}</FieldError>
    </TextField>
  );
}

type Confirm = { kind: "deactivate" } | { kind: "self-role"; role: Role } | null;

function EditUser({ user: u, me, onClose }: { user: User; me: Me; onClose: (message: string | null) => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isSelf = u.id === me.user_id;
  const [name, setName] = useState(u.display_name ?? "");
  const [role, setRole] = useState<Role>(u.role);
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<{ where: "details" | "password" | "status"; field: UserField; message: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const patch = useMutation({
    mutationFn: (v: { body: Parameters<typeof updateUser>[1]; where: "details" | "password" | "status"; done: string }) => updateUser(u.id, v.body),
    onSuccess: async (out, v) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["org"] });
      if (isSelf) {
        const next = await queryClient.query({ ...meQuery, staleTime: 0 }).catch(() => null);
        if (next && next.role !== "admin") {
          onClose(null);
          void navigate({ to: "/lectures" });
          return;
        }
      }
      onClose(v.done.replace("{name}", displayName(out)));
    },
    onError: (e, v) => {
      setProblem({ where: v.where, ...userError(e) });
    },
  });

  const saveDetails = () => {
    if (isSelf && role !== "admin" && u.role === "admin" && confirm === null) {
      setConfirm({ kind: "self-role", role });
      return;
    }
    setConfirm(null);
    setProblem(null);
    patch.mutate({ body: { display_name: name.trim() || null, role }, where: "details", done: "{name}'s details were saved." });
  };

  const detailsChanged = (name.trim() || null) !== (u.display_name?.trim() || null) || role !== u.role;
  const inline = (where: "details" | "password" | "status") =>
    problem && problem.where === where && problem.field === null ? (
      <p className="t-small mt-3 mb-0 border-l-[3px] border-ochre py-1 pl-3" role="alert">
        {problem.message}
      </p>
    ) : null;

  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={(open) => {
        if (!open) onClose(null);
      }}
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/30 p-4 sm:py-10"
    >
      <Modal className="w-full max-w-xl bg-sheet p-6 shadow-[0_6px_20px_rgb(23_32_30/0.18)]">
        <Dialog className="outline-none" aria-labelledby="edit-user-h">
          <Heading id="edit-user-h" slot="title" className="t-subheading m-0">
            {displayName(u)}
            {isSelf ? <span className="t-small font-normal text-slate"> (you)</span> : null}
          </Heading>
          <p className="t-small mt-1 mb-0 break-all text-slate">{u.email}</p>

          <EditSection title="Name and role">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveDetails();
              }}
              className="space-y-4"
            >
              <TextField value={name} onChange={setName} className="flex flex-col gap-1" isInvalid={problem?.where === "details" && problem.field === "display_name"}>
                <Label className={labelCls}>Name</Label>
                <Input className={field} autoComplete="off" />
                <FieldError className="t-small text-ochre">{problem?.where === "details" ? problem.message : null}</FieldError>
              </TextField>
              <RoleChoice value={role} onChange={setRole} isDisabled={!u.active} />
              {!u.active ? <p className="t-small m-0 text-slate">Reactivate this account to change its role.</p> : null}
              <Button type="submit" className="button" isDisabled={!detailsChanged || patch.isPending}>
                Save name and role
              </Button>
              {inline("details")}
            </form>
          </EditSection>

          {u.active ? (
            <EditSection title={u.has_password ? "Set a new password" : "Set a password"}>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (password.length < PASSWORD_MIN) {
                    setProblem({ where: "password", field: "password", message: `Use at least ${PASSWORD_MIN.toString()} characters.` });
                    return;
                  }
                  setProblem(null);
                  patch.mutate({ body: { password }, where: "password", done: "{name}'s new password is set. They've been signed out everywhere; give them the new password in person." });
                }}
              >
                <p className="t-small m-0 text-slate">
                  {isSelf ? "To change your own password, use Change password in your account menu." : "This signs them out on every device."}
                </p>
                {!isSelf ? (
                  <>
                    <PasswordInput label="New password" value={password} onChange={setPassword} problem={problem?.where === "password" && problem.field === "password" ? problem.message : null} />
                    <Button type="submit" className="button" isDisabled={patch.isPending || password === ""}>
                      Set password
                    </Button>
                  </>
                ) : null}
                {inline("password")}
              </form>
            </EditSection>
          ) : null}

          <EditSection title={u.active ? "Deactivate" : "Reactivate"}>
            <p className="t-small m-0 text-slate">
              {u.active
                ? "A deactivated person is signed out and can't sign in. Their lectures, analyses and notes are kept, and you can reactivate them later."
                : "They'll be able to sign in again with their existing password."}
            </p>
            <Button
              className="button mt-3"
              isDisabled={patch.isPending}
              onPress={() => {
                setProblem(null);
                if (u.active) setConfirm({ kind: "deactivate" });
                else patch.mutate({ body: { active: true }, where: "status", done: "{name} can sign in again." });
              }}
            >
              {u.active ? `Deactivate ${isSelf ? "your account" : displayName(u)}` : `Reactivate ${displayName(u)}`}
            </Button>
            {inline("status")}
          </EditSection>

          <div className="mt-6 flex justify-end">
            <Button
              className="button"
              onPress={() => {
                onClose(null);
              }}
            >
              Close
            </Button>
          </div>
        </Dialog>
      </Modal>
      <ConfirmDialog
        isOpen={confirm?.kind === "deactivate"}
        title={isSelf ? "Deactivate your own account?" : `Deactivate ${displayName(u)}?`}
        confirmLabel="Deactivate"
        onCancel={() => {
          setConfirm(null);
        }}
        onConfirm={() => {
          setConfirm(null);
          patch.mutate({ body: { active: false }, where: "status", done: "{name} was deactivated and signed out." });
        }}
      >
        {isSelf ? "You'll be signed out and won't be able to sign in again until another admin reactivates you." : "They'll be signed out on every device and won't be able to sign in."}
      </ConfirmDialog>
      <ConfirmDialog
        isOpen={confirm?.kind === "self-role"}
        title="Stop being an admin?"
        confirmLabel={`Change my role to ${ROLE_LABEL[role].toLowerCase()}`}
        onCancel={() => {
          setConfirm(null);
        }}
        onConfirm={() => {
          setConfirm(null);
          setProblem(null);
          patch.mutate({ body: { display_name: name.trim() || null, role }, where: "details", done: "{name}'s details were saved." });
        }}
      >
        You won't be able to manage users after this, unless another admin changes it back.
      </ConfirmDialog>
    </ModalOverlay>
  );
}

function EditSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 border-t border-slate/25 pt-4">
      <h3 className="t-ui m-0 mb-3 font-semibold">{title}</h3>
      {children}
    </section>
  );
}
