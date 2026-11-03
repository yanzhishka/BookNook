import { useEffect, useRef } from "react";

interface OpenDialog {
  element: HTMLElement | null;
  previous: HTMLElement | null;
  focus: () => void;
}

// Portals share one keyboard/scroll owner, including when a parent dialog stays mounted.
const openDialogs: OpenDialog[] = [];
let originalBodyOverflow = "";
const focusableSelector =
  'button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]';

export function useDialog<T extends HTMLElement = HTMLElement>(
  onClose: () => void,
  busy = false,
  suspended = false,
  enabled = true,
) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  const registration = useRef<OpenDialog | null>(null);
  close.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (!openDialogs.length) originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog: OpenDialog = {
      element: ref.current,
      previous,
      focus: () => {
        const items = [...(ref.current?.querySelectorAll<HTMLElement>(focusableSelector) || [])]
          .filter((element) => element.getClientRects().length > 0);
        (items.find((element) => element.hasAttribute("data-autofocus")) || items[0] || ref.current)?.focus();
      },
    };
    registration.current = dialog;
    openDialogs.push(dialog);
    dialog.focus();

    return () => {
      const wasTop = openDialogs[openDialogs.length - 1] === dialog;
      const index = openDialogs.indexOf(dialog);
      if (index !== -1) openDialogs.splice(index, 1);
      for (const remaining of openDialogs) {
        if (remaining.previous && dialog.element?.contains(remaining.previous)) {
          remaining.previous = dialog.previous;
        }
      }
      registration.current = null;
      const top = openDialogs[openDialogs.length - 1];
      if (!top) document.body.style.overflow = originalBodyOverflow;
      if (!wasTop) return;
      if (dialog.previous?.isConnected && (!top || top.element?.contains(dialog.previous))) {
        dialog.previous.focus();
        if (document.activeElement === dialog.previous) return;
      }
      top?.focus();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || suspended) return;
    const keydown = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== registration.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!busy) close.current();
        return;
      }
      if (event.key !== "Tab" || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>(focusableSelector)]
        .filter((element) => element.getClientRects().length > 0);
      const first = items[0],
        last = items[items.length - 1];
      if (!first) {
        event.preventDefault();
        ref.current.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !ref.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !ref.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [busy, suspended, enabled]);
  return ref;
}
