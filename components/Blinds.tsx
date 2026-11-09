import type { ReactNode } from "react";

/**
 * Venetian blinds over a backlit message. Slats tilt open in a slow wave (and on hover), so the
 * light behind shows through the gaps. Each slat's face can carry its own row, e.g. a fill hash.
 */
export function Blinds({
  rows,
  count = rows?.length ?? 8,
  slat = 44,
  behind,
  open = false,
  still = false,
  offsetMs = 0,
  className = "",
}: {
  rows?: ReactNode[];
  count?: number;
  slat?: number;
  behind?: ReactNode;
  open?: boolean;
  still?: boolean;
  offsetMs?: number;
  className?: string;
}) {
  return (
    <div
      className={`blinds relative overflow-hidden ${open ? "is-open" : ""} ${still ? "is-still" : ""} ${className}`}
      style={{ ["--tilt-offset" as string]: `${offsetMs}ms` }}
    >
      <div aria-hidden={!behind} className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_50%_45%,#f5b83d_0%,#c98a12_38%,#3a2a10_75%,#171512_100%)] px-6 text-center">
        {behind}
      </div>
      <div className="relative">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="slat flex items-center border-b border-black/40 bg-[linear-gradient(to_bottom,#26221d,#1b1915_70%,#141210)] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            style={{ ["--i" as string]: i, height: slat }}
          >
            {rows?.[i]}
          </div>
        ))}
      </div>
    </div>
  );
}
