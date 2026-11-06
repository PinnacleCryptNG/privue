export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#b8c4ff" />
      <rect x="7" y="7" width="18" height="18" rx="5" fill="#0c0e13" />
      <rect x="7" y="14" width="18" height="4" fill="#b8c4ff" />
      <circle cx="20.5" cy="16" r="1.4" fill="#0c0e13" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <Mark />
      <span className="text-[1.15rem] font-semibold tracking-[-0.02em]">Privue</span>
    </span>
  );
}
