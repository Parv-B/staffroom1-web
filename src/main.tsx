import "./styles/app.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { queryClient } from "./lib/queryClient";
import { routeTree } from "./routeTree.gen";

// An unexpected failure while showing a page: say so plainly, never show a stack or data.
function PageError() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16" role="alert">
      <h1 className="t-heading">This page couldn't be shown</h1>
      <p className="t-reading mt-3">Something went wrong while showing it. Reload the page; if it happens again, go back to the lectures and try once more.</p>
      <p className="t-reading mt-3">
        <a href="/lectures" className="action">
          Go to the lectures
        </a>
      </p>
    </main>
  );
}

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultErrorComponent: PageError,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}
