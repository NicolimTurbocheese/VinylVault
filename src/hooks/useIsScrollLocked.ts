import { useEffect, useState } from "react";

// Tracks whether any modal currently has the page scroll-locked (see
// useBodyScrollLock, which toggles a "scroll-locked" class on <body>). Lets a
// component far from the modal that triggered the lock — the sticky header,
// specifically — react to "some modal is open" without prop-drilling every
// modal's open state through the whole tree.
export function useIsScrollLocked(): boolean {
  const [isLocked, setIsLocked] = useState(() => document.body.classList.contains("scroll-locked"));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsLocked(document.body.classList.contains("scroll-locked"));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isLocked;
}
