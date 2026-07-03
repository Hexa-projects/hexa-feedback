import type { MouseEvent } from "react";

const APP_NAVIGATION_EVENT = "hexaos:navigation";

export function getCurrentPathname() {
  if (typeof window === "undefined") return "/";
  return window.location.pathname;
}

export function navigateInApp(to: string, options: { replace?: boolean } = {}) {
  if (typeof window === "undefined") return;

  const url = new URL(to, window.location.origin);
  if (url.origin !== window.location.origin) {
    window.location.assign(to);
    return;
  }

  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (next !== current) {
    if (options.replace) {
      window.history.replaceState(null, "", next);
    } else {
      window.history.pushState(null, "", next);
    }
  }

  window.dispatchEvent(new PopStateEvent("popstate"));
  window.dispatchEvent(new Event(APP_NAVIGATION_EVENT));
}

export function shouldHandleInAppNavigation(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    (!event.currentTarget.target || event.currentTarget.target === "_self")
  );
}