"use client";
import { useCallback } from "react";
import { accountCopy } from "@/lib/partspro-account-copy";
import { useI18n } from "./i18n-provider";
export function useAccountCopy() {
  const {locale}=useI18n();
  return useCallback((text:string)=>accountCopy(text,locale),[locale]);
}
