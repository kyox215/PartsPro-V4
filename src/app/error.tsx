"use client";
import { StoreRecoveryPage } from "@/components/partspro/store-recovery-page";
export default function ErrorPage({reset}:{error:Error & {digest?:string};reset:()=>void}) { return <StoreRecoveryPage error onRetry={reset} />; }
