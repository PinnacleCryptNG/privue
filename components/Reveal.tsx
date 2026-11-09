"use client";

import { useEffect } from "react";

/** Adds .is-in to every [data-reveal] element once it scrolls into view, including ones rendered later. */
export function RevealOnScroll() {
  useEffect(() => {
    const show = (e: Element) => e.classList.add("is-in");
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll("[data-reveal]").forEach(show);
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            show(e.target);
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -8% 0px" },
    );
    const scan = () => document.querySelectorAll("[data-reveal]:not(.is-in)").forEach((e) => io.observe(e));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
