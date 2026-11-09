import { useId } from "react";

/** The mark: a P whose bowl is a set of blinds. */
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <defs>
        <clipPath id={id}>
          <path d="M13 6.5h4.6a6.25 6.25 0 0 1 0 12.5H13z" />
        </clipPath>
      </defs>
      <rect width="32" height="32" rx="8" fill="#f5b83d" />
      <rect x="7.5" y="6.5" width="4.4" height="19" rx="1.2" fill="#0e0d0b" />
      <g clipPath={`url(#${id})`} fill="#0e0d0b">
        <rect x="12" y="6.5" width="14" height="2.9" />
        <rect x="12" y="11.3" width="14" height="2.9" />
        <rect x="12" y="16.1" width="14" height="2.9" />
      </g>
    </svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <Mark size={size} />
      <span className="font-extrabold tracking-[-0.045em]" style={{ fontSize: size * 0.78 }}>
        privue
      </span>
    </span>
  );
}
