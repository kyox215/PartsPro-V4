"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

// Large menus must not prefetch every visible SKU/model. Next handles request
// deduplication; only a pointer or keyboard intention enables its route prefetch.
export function IntentLink({ prefetch = true, onPointerEnter, onFocus, ...props }: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  return <Link {...props} prefetch={prefetch !== false && intent ? null : false}
    onPointerEnter={(event) => { setIntent(true); onPointerEnter?.(event); }}
    onFocus={(event) => { setIntent(true); onFocus?.(event); }} />;
}
