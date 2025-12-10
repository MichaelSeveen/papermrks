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
