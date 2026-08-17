import { useEffect } from "react";

// Closes a modal/overlay on the Escape key. Every modal in the app should call
// this — it's easy to open a full-screen overlay (camera, scanner) with no
// obvious way back out otherwise.
export function useEscapeToClose(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);
}
