"use client";

import { useFormStatus } from "react-dom";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

type LoginSubmitButtonProps = {
  disabled?: boolean;
};

export function LoginSubmitButton({ disabled = false }: LoginSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button className="h-11 w-full" type="submit" disabled={disabled || pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
      {pending ? "Accesso in corso..." : "Accedi"}
    </Button>
  );
}
