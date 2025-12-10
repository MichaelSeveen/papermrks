import { createServerFn } from "@tanstack/react-start";
import { authenticationMiddleware } from "../middleware/auth";

export const getCurrentUserFn = createServerFn({ method: "GET" })
  .middleware([authenticationMiddleware])
  .handler(async ({ context }) => {
    return context.user;
  });
