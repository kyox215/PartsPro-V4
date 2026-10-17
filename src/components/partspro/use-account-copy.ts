"use client";
import { useCallback } from "react";
import { accountCopy } from "@/lib/partspro-account-copy";
import { accountTranslationKeys } from "@/i18n/account-translation-keys";
import { useI18n } from "./i18n-provider";
export function useAccountCopy() {
  const {locale,t}=useI18n();
  return useCallback((text:string)=>accountTranslationKeys[text] ? t(accountTranslationKeys[text]) : accountCopy(text,locale),[locale,t]);
}
