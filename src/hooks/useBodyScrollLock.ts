import { useEffect } from "react";

// Prevents the page behind a modal from scrolling while it's open. Needed specifically for
// mobile browsers — a touch-scroll gesture over a `position: fixed` overlay can "leak through"
// to the body behind it unless the body itself is locked, even though the overlay has its own
// overflow-y: auto. Restores the exact prior scroll position on close.
export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    // Lets other components (the sticky header, notably) know a modal has the page
    // locked, via a plain DOM class rather than prop-drilling modal state through
    // every component tree — see useIsScrollLocked.
    body.classList.add("scroll-locked");

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      body.classList.remove("scroll-locked");
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);
}
