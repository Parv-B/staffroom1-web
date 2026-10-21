import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Button, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import { ROLE_LABEL, can } from "~/auth/roles";
import { ensureSession, meQuery, signOut, type Me } from "~/auth/session";

// Everything behind sign-in renders inside this layout.
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    if (!(await ensureSession())) throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    try {
      const me = await context.queryClient.query(meQuery);
      return { me };
    } catch {
      // The session expired or was revoked (the auth module has already dropped it).
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
  },
  component: AppFrame,
});

function AppFrame() {
  const { me: initial } = Route.useRouteContext();
  const me = useQuery({ ...meQuery, initialData: initial }).data;
  return (
    <div className="min-h-screen">
      <a href="#main" className="t-small sr-only bg-sheet px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2">
        Skip to content
      </a>
      <Header me={me} />
      <div id="main" className="mx-auto max-w-[78rem] px-4 pb-16 sm:px-8">
        <Outlet />
      </div>
    </div>
  );
}

const navLink = "t-ui py-1 text-ink no-underline hover:underline data-[status=active]:font-semibold data-[status=active]:underline data-[status=active]:decoration-2 data-[status=active]:underline-offset-[0.45em]";

function Header({ me }: { me: Me }) {
  const navigate = useNavigate();
  return (
    <header className="mx-auto flex max-w-[78rem] flex-wrap items-center gap-x-8 gap-y-2 px-4 py-4 sm:px-8" data-no-print>
      <Link to="/lectures" className="t-subheading text-ink no-underline">
        Staffroom1
      </Link>
      <nav aria-label="Main" className="flex flex-wrap gap-x-6">
        <Link to="/lectures" className={navLink} activeOptions={{ exact: true }}>
          Lectures
        </Link>
        <Link to="/progress" className={navLink}>
          {me.role === "teacher" ? "Your measures" : "Measures over time"}
        </Link>
        {can.seeCentreSummary(me.role) ? (
          <Link to="/centre" className={navLink}>
            Centre
          </Link>
        ) : null}
        {can.manageUsers(me.role) ? (
          <Link to="/admin/users" className={navLink}>
            Users
          </Link>
        ) : null}
      </nav>
      <MenuTrigger>
        <Button className="t-small ml-auto rounded-[3px] px-2 py-1 text-left hover:bg-sheet" aria-label={`Account: ${me.display_name ?? me.email}`}>
          <span className="block font-semibold">{me.display_name ?? me.email}</span>
          <span className="block text-slate">{ROLE_LABEL[me.role]}</span>
        </Button>
        <Popover placement="bottom end" className="min-w-56 border border-slate/40 bg-sheet py-1 shadow-[0_6px_20px_rgb(23_32_30/0.12)]">
          <Menu
            className="t-ui outline-none"
            onAction={(key) => {
              if (key === "password") void navigate({ to: "/account/password" });
              if (key === "sign-out") void signOut().then(() => navigate({ to: "/sign-in" }));
            }}
          >
            <MenuItem id="email" isDisabled className="t-small px-4 py-2 text-slate">
              {me.email}
            </MenuItem>
            <MenuItem id="password" className="cursor-pointer px-4 py-2 outline-none data-[focused]:bg-pen-tint">
              Change password
            </MenuItem>
            <MenuItem id="sign-out" className="cursor-pointer px-4 py-2 outline-none data-[focused]:bg-pen-tint">
              Sign out
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
    </header>
  );
}
