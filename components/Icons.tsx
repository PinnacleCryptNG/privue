import type { SVGProps } from "react";

/** Line icons drawn on the slat motif: a window with blinds at different angles. */
type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size: number, p: P) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p });

/** Public record: blinds shut, only the numbers on the outside. */
export function IconRecord({ size = 24, ...p }: P) {
  return (
    <svg {...base(size, p)}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M3.5 8.5h17M3.5 12h17M3.5 15.5h17" />
    </svg>
  );
}

/** View pass: blinds open. */
export function IconView({ size = 24, ...p }: P) {
  return (
    <svg {...base(size, p)}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M6 7.5l3 1.4M6 11.5l3 1.4M6 15.5l3 1.4M11 7.5l3 1.4M11 11.5l3 1.4M11 15.5l3 1.4M16 7.5l2 .9M16 11.5l2 .9M16 15.5l2 .9" />
    </svg>
  );
}

/** Delayed view: half-open blinds and a clock hand. */
export function IconDelayed({ size = 24, ...p }: P) {
  return (
    <svg {...base(size, p)}>
      <path d="M12.5 20.5H6a2.5 2.5 0 0 1-2.5-2.5V6A2.5 2.5 0 0 1 6 3.5h12A2.5 2.5 0 0 1 20.5 6v5.5" />
      <path d="M3.5 8.5h17M3.5 12.5h8" />
      <circle cx="17.5" cy="17.5" r="3.5" />
      <path d="M17.5 15.8v1.9l1.2.8" />
    </svg>
  );
}

/** Copy pass: blinds shut, trades flow through into your account. */
export function IconCopy({ size = 24, ...p }: P) {
  return (
    <svg {...base(size, p)}>
      <rect x="3.5" y="3.5" width="11" height="17" rx="2.5" />
      <path d="M3.5 8.5h11M3.5 12h11M3.5 15.5h11" />
      <path d="M17 9l3.5 3-3.5 3M14.5 12h6" />
    </svg>
  );
}

/** Hash chain: three linked slats. */
export function IconChain({ size = 24, ...p }: P) {
  return (
    <svg {...base(size, p)}>
      <rect x="3" y="4" width="7" height="4.5" rx="1.2" />
      <rect x="14" y="9.75" width="7" height="4.5" rx="1.2" />
      <rect x="3" y="15.5" width="7" height="4.5" rx="1.2" />
      <path d="M10 6.25h2a2 2 0 0 1 2 2v1.5M14 14.25v1.5a2 2 0 0 1-2 2h-2" />
    </svg>
  );
}

/** Signed quote: a ticket with a check. */
export function IconSigned({ size = 24, ...p }: P) {
  return (
    <svg {...base(size, p)}>
      <path d="M5 3.5h10l4 4V20a.5.5 0 0 1-.5.5h-13A.5.5 0 0 1 5 20z" />
      <path d="M15 3.5v4h4M8.5 9.5h4M8.5 13l2.2 2.2 4.3-4.4" />
    </svg>
  );
}

/** Enclave: a chip inside a frame. */
export function IconEnclave({ size = 24, ...p }: P) {
  return (
    <svg {...base(size, p)}>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
      <path d="M9.5 10h5M9.5 12h5M9.5 14h3M9 3.5v3M15 3.5v3M9 17.5v3M15 17.5v3M3.5 9h3M3.5 15h3M17.5 9h3M17.5 15h3" />
    </svg>
  );
}

/** Payout: a coin dropping through a slot. */
export function IconPayout({ size = 24, ...p }: P) {
  return (
    <svg {...base(size, p)}>
      <path d="M3.5 7.5h17" />
      <circle cx="12" cy="14.5" r="5" />
      <path d="M12 12v5M10.5 13.2c0-.7.7-1.2 1.5-1.2s1.5.4 1.5 1-.6.9-1.5 1.1-1.5.5-1.5 1.1.7 1.1 1.5 1.1 1.5-.5 1.5-1.2" />
    </svg>
  );
}

export function IconArrow({ size = 18, ...p }: P) {
  return (
    <svg {...base(size, p)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconMenu({ size = 22, open = false, ...p }: P & { open?: boolean }) {
  return <svg {...base(size, p)}>{open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>;
}
