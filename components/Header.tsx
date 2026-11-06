"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./Logo";
import { shortId, useMe } from "./MeProvider";

const NAV = [
  { href: "/traders", label: "Traders" },
  { href: "/how", label: "How it works" },
];

export function Header() {
  const { me, loading, setSignInOpen } = useMe();
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Link href="/" aria-label="Privue home">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-mute sm:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={path.startsWith(n.href) ? "text-text" : "hover:text-text"}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {loading ? null : me?.session ? (
            <Link href="/me" className="btn btn-ghost h-10 px-3.5 text-sm">
              <span className="h-2 w-2 rounded-full bg-frost" />
              {shortId(me.session.sub)}
            </Link>
          ) : (
            <button className="btn btn-primary h-10 px-4 text-sm" onClick={() => setSignInOpen(true)}>
              Sign in
            </button>
          )}
        </div>
      </div>
      <nav className="flex gap-5 border-t border-line/60 px-5 py-2.5 text-sm text-mute sm:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={path.startsWith(n.href) ? "text-text" : ""}>
            {n.label}
          </Link>
        ))}
        <Link href="/me" className={path.startsWith("/me") ? "text-text" : ""}>
          Your passes
        </Link>
      </nav>
    </header>
  );
}
