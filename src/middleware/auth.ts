import { createMiddleware } from "@tanstack/react-start";
import { auth } from "@/lib/auth";

export const authenticationMiddleware = createMiddleware({
  type: "request",
}).server(async ({ next, request }) => {
  const session = await auth.api.getSession({ headers: request.headers });

  return await next({
    context: {
      user: session?.user ?? null,
      session: session?.session ?? null,
    },
  });
});
