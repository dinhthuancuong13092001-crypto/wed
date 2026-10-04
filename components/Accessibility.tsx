import { useEffect } from "react";

// Dialogs share keyboard behavior, including nested media pickers.
export default function Accessibility() {
  useEffect(() => {
    let active: HTMLElement | null = null;
    let previous: HTMLElement | null = null;
    function dialogs() {
      return Array.from(
        document.querySelectorAll<HTMLElement>(
          '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]',
        ),
      );
    }
    function update() {
      const next = dialogs().at(-1) || null;
      if (next === active) return;
      if (next) {
        previous = document.activeElement as HTMLElement;
        active = next;
        const first = next.querySelector<HTMLElement>(
          "button:not([disabled]),input,select,textarea,a[href]",
        );
        first?.focus();
      } else {
        active = null;
        if (previous?.isConnected) previous.focus();
        previous = null;
      }
    }
    function key(e: KeyboardEvent) {
      if (!active || e.key !== "Tab") return;
      const elements = Array.from(
        active.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]',
        ),
      ).filter((x) => x.getClientRects().length > 0);
      const first = elements[0],
        last = elements.at(-1);
      if (!first) {
        e.preventDefault();
        return;
      }
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !active.contains(document.activeElement))
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !active.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    }
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", key);
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", key);
    };
  }, []);
  return null;
}
