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
        title: "Papermrks - Your Personalized Bookmark Manager",
        description: "Papermrks - Your Personalized Bookmark Manager",
        keywords: [
          "Papermrks",
          "Bookmark Manager",
          "Personalized Bookmark Manager",
          "Bookmarks",
        ],
        author: "Papermrks",
        publisher: "Papermrks",
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

    const isAuthRoute =
      location.pathname.startsWith("/sign-in") ||
      location.pathname.startsWith("/sign-up");

    if (!session && !isAuthRoute) {
      throw redirect({ to: "/sign-in" });
    }

    if (session && isAuthRoute) {
      throw redirect({ to: "/" });
    }

    return { user: session };
  },
  notFoundComponent: () => <div>Not Found</div>,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
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
