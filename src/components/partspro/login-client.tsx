"use client";

import { useFormStatus } from "react-dom";
import { Loader2, LogIn, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type LoginSubmitButtonProps = {
  disabled?: boolean;
  label?: string;
  pendingLabel?: string;
};

type GoogleLoginButtonProps = LoginSubmitButtonProps & {
  href: string;
  label?: string;
};

type WeChatLoginButtonProps = GoogleLoginButtonProps;

export function LoginSubmitButton({
  disabled = false,
  label = "Accedi",
  pendingLabel = "Accesso in corso...",
}: LoginSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button className="h-11 w-full" type="submit" disabled={disabled || pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function GoogleLoginButton({
  disabled = false,
  href,
  label = "Continua con Google",
}: GoogleLoginButtonProps) {
  const content = (
    <>
      <span className="grid size-5 place-items-center rounded-full text-sm font-black text-[#4285f4]">
        G
      </span>
      {label}
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

export function WeChatLoginButton({
  disabled = false,
  href,
  label = "Continua con WeChat",
}: WeChatLoginButtonProps) {
  const content = (
    <>
      <MessageCircle className="size-5 text-[#07c160]" />
      {label}
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
