"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Desktop content stays visible; phones can expand the same content in place. */
export function MobileDisclosure({
  id,
  title,
  hashTarget = id,
  description,
  className = "",
  children,
}: {
  id: string;
  title: string;
  hashTarget?: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const revealHashTarget = () => {
      if (window.location.hash === `#${hashTarget}`) setOpen(true);
    };
    const revealAnchorTarget = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (anchor?.getAttribute("href") === `#${hashTarget}`) setOpen(true);
    };
    const frame = requestAnimationFrame(revealHashTarget);
    window.addEventListener("hashchange", revealHashTarget);
    document.addEventListener("click", revealAnchorTarget);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", revealHashTarget);
      document.removeEventListener("click", revealAnchorTarget);
    };
  }, [hashTarget]);

  return (
    <section id={id} className={`pp-mobile-disclosure ${className}`} data-expanded={open}>
      <div className="pp-disclosure-heading">
        <h2>
          <span className="pp-disclosure-desktop-title">{title}</span>
          <button type="button" className="pp-disclosure-toggle" aria-expanded={open} aria-controls={`${id}-content`} onClick={() => setOpen(value => !value)}>
            {title}<ChevronDown aria-hidden="true" />
          </button>
        </h2>
        {description ? <p className="pp-disclosure-description">{description}</p> : null}
      </div>
      <div id={`${id}-content`} className="pp-disclosure-content">{children}</div>
    </section>
  );
}
