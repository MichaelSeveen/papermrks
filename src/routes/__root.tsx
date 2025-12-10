import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  redirect,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";
import type { QueryClient } from "@tanstack/react-query";
import { getCurrentUserFn } from "@/server-functions/user";

interface MyRouterContext {
  queryClient: QueryClient;
}

// const getCurrentSession = createServerFn({ method: "GET" }).handler(
//   async () => {
//     const headers = getRequestHeaders();
//     console.log("Server Fn Headers:", headers);
//     const session = await auth.api.getSession({
//       headers: headers,
//     });
//     console.log("Server Fn Session:", session);
//     return session;
//   }
// );

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "TanStack Start Starter",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  beforeLoad: async ({ location }) => {
    const session = await getCurrentUserFn();

    // Check if the current route is an auth route
    const isAuthRoute =
      location.pathname.startsWith("/sign-in") ||
      location.pathname.startsWith("/sign-up");

    // If not authenticated and not on an auth route, redirect to login
    if (!session && !isAuthRoute) {
      throw redirect({ to: "/sign-in" });
    }

    // If authenticated and on login page, redirect to home
    if (session && isAuthRoute) {
      throw redirect({ to: "/" });
    }

    return { user: session };
  },
  notFoundComponent: () => <div>Not Found</div>,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
