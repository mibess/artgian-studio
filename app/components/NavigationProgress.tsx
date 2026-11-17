"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { beginNavigation, endNavigation, startsNavigation } from "../../lib/navigation-progress";

/** Feeds the header logo's loading animation from link clicks and URL changes. */
export default function NavigationProgress() {
  const pathname = usePathname();
  const params = useSearchParams();
  const location = `${pathname}?${params.toString()}`;

  useEffect(() => {
    endNavigation();
  }, [location]);

  useEffect(() => {
    // Capture phase: next/link calls preventDefault before a bubbling listener runs.
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (link instanceof HTMLAnchorElement && startsNavigation(link, event)) beginNavigation();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
