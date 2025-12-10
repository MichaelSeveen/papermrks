import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { SignUpDataType, SignUpSchema } from "@/validations/auth.schema";
import { signUp } from "@/lib/auth-client";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import PasswordInput from "./-components/password-input";

export const Route = createFileRoute("/(auth)/sign-up")({
  component: SignUpForm,
});

function SignUpForm() {
  const navigate = useNavigate({
    from: Route.fullPath,
  });

  const form = useForm<SignUpDataType>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const { isSubmitting } = form.formState;

  const handleFormSubmit = async (data: SignUpDataType) => {
    await signUp.email(
      {
        name: data.name,
        email: data.email,
        password: data.password,
      },
      {
        onSuccess() {
          form.reset();
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
          <p className="text-xl font-medium">Welcome</p>
          <p className="text-sm text-muted-foreground">
            Sign up to get started.
          </p>
        </div>
        <Form
          className="flex flex-col gap-5"
          onSubmit={form.handleSubmit(handleFormSubmit)}
        >
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  Full Name
                  <span className="text-destructive-foreground">*</span>
                </FieldLabel>
                <Input
                  id={field.name}
                  type="text"
                  placeholder="John Doe"
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
            name="email"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  Email Address
                  <span className="text-destructive-foreground">*</span>
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
                  <span className="text-destructive-foreground">*</span>
                </FieldLabel>
                <PasswordInput id={field.name} {...field} />

                <FieldError match={fieldState.invalid}>
                  {fieldState.error?.message}
                </FieldError>
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="confirmPassword"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  Confirm Password
                  <span className="text-destructive-foreground">*</span>
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
                <Spinner /> Signing up...
              </>
            ) : (
              "Sign up"
            )}
          </Button>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/sign-in" className="text-blue-500">
              Sign in
            </Link>
          </p>
        </Form>
      </div>
    </div>
  );
}
