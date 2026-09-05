"use client";
import { useEffect, type RefObject } from "react";

export function useMenuKeyboard(open: boolean, root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const menu = root.current?.querySelector<HTMLElement>("[role='menu']");
    if (!menu) return;
    const trigger = root.current?.querySelector<HTMLButtonElement>("button");
    const items = Array.from(menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    (items.find((item) => item.getAttribute("aria-checked") === "true") || items[0])?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
      const index = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + direction + items.length) % items.length;
      items[index]?.focus();
    };
    menu.addEventListener("keydown", handleKey);
    return () => {
      menu.removeEventListener("keydown", handleKey);
      if (document.activeElement === document.body || menu.contains(document.activeElement)) trigger?.focus();
    };
  }, [open, root]);
}
