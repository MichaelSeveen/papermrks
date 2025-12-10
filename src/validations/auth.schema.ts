import { z } from "zod/v4";
import { isDisposable } from "@/lib/utils";

const emailSchema = z
  .email({ pattern: z.regexes.rfc5322Email, error: "Invalid email" })
  .superRefine((email, ctx) => {
    if (isDisposable(email)) {
      ctx.addIssue({
        code: "custom",
        message: "Disposable email addresses are not allowed",
      });
    }

    if (email.includes("+")) {
      ctx.addIssue({
        code: "custom",
        message: "Email should not contain '+'",
      });
    }

    const domainParts = email.split("@")[1]?.split(".");
    if (domainParts && domainParts.length > 2) {
      ctx.addIssue({
        code: "custom",
        message: "Email should not contain subdomains",
      });
    }
  });

const getPasswordSchema = (type: "Password" | "Confirm Password") =>
  z
    .string({
      error: `${type} is required`,
    })
    .min(8, `${type} must be at least 8 characters`)
    .max(64, `${type} can not exceed 64 characters`)
    .regex(/[A-Z]/, `${type} must contain at least one uppercase letter`)
    .regex(/[a-z]/, `${type} must contain at least one lowercase letter`)
    .regex(/[0-9]/, `${type} must contain at least one number`)
    .regex(
      /[^a-zA-Z0-9]/,
      `${type} must contain at least one special character`
    );

const getNameSchema = () =>
  z
    .string()
    .min(2, "Name is required")
    .max(50, "Name must be less than 50 characters");

export const SignUpSchema = z
  .object({
    name: getNameSchema(),
    email: emailSchema,
    password: getPasswordSchema("Password"),
    confirmPassword: getPasswordSchema("Confirm Password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match. Try again",
    path: ["confirmPassword"],
  });

export type SignUpDataType = z.infer<typeof SignUpSchema>;

export const SignInSchema = z.object({
  email: emailSchema,
  password: getPasswordSchema("Password"),
});

export type SignInDataType = z.infer<typeof SignInSchema>;