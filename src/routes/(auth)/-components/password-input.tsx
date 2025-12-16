import { useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";

export default function PasswordInput(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  const [isPasswordHidden, setIsPasswordHidden] = useState(true);

  function checkPasswordVisibility() {
    setIsPasswordHidden((prev) => !prev);
  }

  return (
    <InputGroup>
      <InputGroupInput
        placeholder="************"
        {...props}
        type={isPasswordHidden ? "password" : "text"}
      />

      <InputGroupAddon align="inline-end">
        <Button
          size="icon-sm"
          type="button"
          variant="ghost"
          onClick={checkPasswordVisibility}
          aria-label={isPasswordHidden ? "Hide password" : "Show password"}
          aria-pressed={isPasswordHidden}
          aria-controls="password"
        >
          {isPasswordHidden ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-.722-3.25" />
              <path d="M2 8a10.645 10.645 0 0 0 20 0" />
              <path d="m20 15-1.726-2.05" />
              <path d="m4 15 1.726-2.05" />
              <path d="m9 18 .722-3.25" />
            </svg>
          )}
        </Button>
      </InputGroupAddon>
    </InputGroup>
  );
}
