"use client";

import { useEffect, useRef, type ComponentProps } from "react";

/** Native modal semantics include focus containment, inert background and focus restoration. */
export function AccessibleDialog({ onDismiss, children, ...props }: Omit<ComponentProps<"dialog">, "open"> & { onDismiss: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    // Native dialogs intentionally handle Escape and clicks on their backdrop.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <dialog
      {...props}
      ref={ref}
      onCancel={(event) => { event.preventDefault(); onDismiss(); }}
      onKeyDown={(event) => {
        // Keep dashboard shortcuts from closing or navigating behind a modal.
        event.stopPropagation();
        if (event.key === "Tab") {
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, summary, [tabindex]"))
            .filter((element) => element.tabIndex >= 0 && !element.matches(":disabled, [hidden]") && element.getClientRects().length > 0);
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
        props.onKeyDown?.(event);
      }}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) { event.stopPropagation(); onDismiss(); }
        else props.onClick?.(event);
      }}
    >{children}</dialog>
  );
}
