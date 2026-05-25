"use client";

import { useFormStatus } from "react-dom";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

type LoginSubmitButtonProps = {
  disabled?: boolean;
};

type GoogleLoginButtonProps = LoginSubmitButtonProps & {
  href: string;
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

export function GoogleLoginButton({ disabled = false, href }: GoogleLoginButtonProps) {
  const content = (
    <>
      <span className="grid size-5 place-items-center rounded-full text-sm font-black text-[#4285f4]">
        G
      </span>
      Continua con Google
    </>
  );

  if (disabled) {
    return (
      <Button
        className="h-11 w-full border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
        type="button"
        variant="outline"
        disabled
      >
        {content}
      </Button>
    );
  }

  return (
    <Button
      className="h-11 w-full border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
      asChild
      variant="outline"
    >
      <a href={href}>{content}</a>
    </Button>
  );
}
