"use client";
import { useEffect } from "react";

/**
 * Links like /personalizados#orcamento from another page land on the root
 * loading screen first; Next.js looks for the anchor there, finds nothing and
 * stays at the top. Rendered inside the page, this runs once the real content
 * has mounted and finishes the jump.
 */
export default function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const target = document.getElementById(id);
    if (target && Math.abs(target.getBoundingClientRect().top) > 120) {
      target.scrollIntoView({ block: "start" });
    }
  }, []);
  return null;
}
