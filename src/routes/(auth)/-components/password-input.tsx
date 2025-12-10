import { useState } from "react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";


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
            size="icon-xs"
            type="button"
            variant="ghost"
            onClick={checkPasswordVisibility}
            aria-label={isPasswordHidden ? "Hide password" : "Show password"}
            aria-pressed={isPasswordHidden}
            aria-controls="password"
          >
            {isPasswordHidden ?  <Icon icon="solar:eye-bold-duotone" /> : <Icon icon="solar:eye-closed-line-duotone" />}
          </Button>
        </InputGroupAddon>
      </InputGroup>   
  );
}