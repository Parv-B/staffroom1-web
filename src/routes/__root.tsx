import type { QueryClient } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => <Outlet />,
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="t-heading">There's no page at this address</h1>
      <p className="t-reading mt-3">Check the link, or go back to the previous page.</p>
    </main>
  ),
});
