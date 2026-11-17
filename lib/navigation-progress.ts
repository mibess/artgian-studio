import { useSyncExternalStore } from "react";

// Client-side "something is loading" flag for the header logo. Navigations
// start it (link clicks are caught by NavigationProgress; code that calls
// router.push calls beginNavigation itself) and the URL change ends it.

const SAFETY_TIMEOUT = 12_000;
const listeners = new Set<() => void>();
let navigating = false;
let timer: ReturnType<typeof setTimeout> | undefined;

function emit() {
  for (const listener of listeners) listener();
}

export function beginNavigation() {
  clearTimeout(timer);
  // A cancelled or failed navigation never changes the URL; don't spin forever.
  timer = setTimeout(endNavigation, SAFETY_TIMEOUT);
  if (navigating) return;
  navigating = true;
  emit();
}

export function endNavigation() {
  clearTimeout(timer);
  if (!navigating) return;
  navigating = false;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNavigationBusy() {
  return useSyncExternalStore(
    subscribe,
    () => navigating,
    () => false,
  );
}

/** True when following this link loads another page (not a hash jump or a new tab). */
export function startsNavigation(link: HTMLAnchorElement, event: MouseEvent) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return false;
  let url: URL;
  try {
    url = new URL(link.href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return false;
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}
