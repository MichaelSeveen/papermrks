import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { SignInDataType, SignInSchema } from "@/validations/auth.schema";
import { signIn } from "@/lib/auth-client";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import PasswordInput from "./-components/password-input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/(auth)/sign-in")({
  component: SignInForm,
});

function SignInForm() {
  const navigate = useNavigate({
    from: Route.fullPath,
  });

  const form = useForm<SignInDataType>({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { isSubmitting } = form.formState;

  const handleFormSubmit = async (data: SignInDataType) => {
    await signIn.email(
      {
        email: data.email,
        password: data.password,
      },
      {
        onSuccess() {
          navigate({ to: "/" });
        },
        onError(ctx) {
          console.log(ctx);
          // toast.error("Something went wrong", {
          //   description: ctx.error.message ?? "Something went wrong.",
          // });
        },
      }
    );
  };

  return (
    <div className="flex items-center justify-center h-svh">
      <div className="rounded-lg flex w-full max-w-xs flex-col gap-4">
        <div className="flex flex-col items-center pb-6">
          <svg
            className="size-7 text-center mb-4"
            viewBox="0 0 30 30"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M15.35 18.655c3.764.216 4.194 4.986 2.307 3.115-1.06-1.05-1.63-1.49-3.15-1.22-.728.13-1.261.556-2.074 1.12-1.095.761-1.09-.947-.554-1.595.877-1.058 1.795-1.492 3.471-1.42m7.922-6.864c-.044-.622-.97-.946-1.18-.195-.117.416-.252.852-.472 1.227-.62 1.087-2.076.354-2.402-.575-.39-1.11-1.32-1.12-1.176.066.435 3.598 5.237 3.291 5.23-.523M0 15.469c0 19.624 29.72 19.2 30-.235C30-5.226 0-5.007 0 15.47m27.462-2.364c2.593 18.13-25.317 20.107-25.151 1.378 1.013-15.645 22.265-16.136 25.15-1.378m-15.22-1.011c-.03-.707-.56-1.23-.908-.534-.221.443-.35.93-.565 1.375-.49 1.116-1.99.398-2.339-.467-.417-1.034-1.314-1.378-1.301-.135.034 3.431 5.427 3.938 5.113-.24"
              fill="var(--accent-foreground)"
            />
          </svg>
          <p className="text-xl font-medium">Welcome Back</p>
          <p className="text-sm text-muted-foreground">
            Log in to your account to continue
          </p>
        </div>
        <Form
          className="flex flex-col gap-5"
          onSubmit={form.handleSubmit(handleFormSubmit)}
        >
          <Controller
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  Email Address
                  <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id={field.name}
                  type="email"
                  placeholder="joe@gmail.com"
                  {...field}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError match={fieldState.invalid}>
                  {fieldState.error?.message}
                </FieldError>
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  Password
                  <span className="text-destructive">*</span>
                </FieldLabel>
                <PasswordInput id={field.name} {...field} />
                <FieldError match={fieldState.invalid}>
                  {fieldState.error?.message}
                </FieldError>
              </Field>
            )}
          />

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                {" "}
                <Spinner /> Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/sign-up" className="text-blue-500">
              Sign up
            </Link>
          </p>
        </Form>
      </div>
    </div>
  );
}
