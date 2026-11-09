"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconMenu } from "./Icons";
import { Wordmark } from "./Logo";
import { shortId, useMe } from "./MeProvider";

const NAV = [
  { href: "/traders", label: "Traders" },
  { href: "/how", label: "How it works" },
  { href: "/#earn", label: "For traders" },
];

export function Header() {
  const { me, loading, setSignInOpen } = useMe();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMenu(false), [path]);

  const active = (href: string) => !href.includes("#") && path.startsWith(href);
  const account = me?.session ? (
    <Link href="/me" className="btn btn-ghost h-10 px-3.5 text-sm">
      <span className="text-mute">{me.session.kind === "guest" ? "Demo" : "Wallet"}</span>
      <span className="num">{shortId(me.session.sub)}</span>
    </Link>
  ) : (
    <button className="btn btn-primary h-10 px-4 text-sm" onClick={() => setSignInOpen(true)}>
      Sign in
    </button>
  );

  return (
    <header className={`sticky top-0 z-30 transition-colors ${scrolled || menu ? "border-b border-line bg-ink/90 backdrop-blur-md" : "border-b border-transparent"}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center px-5">
        <Link href="/" aria-label="Privue home" className="shrink-0">
          <Wordmark />
        </Link>
        <nav className="ml-10 hidden h-16 items-stretch gap-7 text-[0.92rem] md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`relative flex items-center transition-colors ${active(n.href) ? "text-text" : "text-mute hover:text-text"}`}>
              {n.label}
              {active(n.href) ? <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-sm bg-amber" /> : null}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {loading ? <span className="h-10 w-20" /> : account}
          <button className="btn btn-ghost h-10 w-10 px-0 md:hidden" aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu} onClick={() => setMenu(!menu)}>
            <IconMenu open={menu} />
          </button>
        </div>
      </div>
      {menu ? (
        <nav className="border-t border-line px-5 pb-5 pt-2 md:hidden">
          {[...NAV, { href: "/me", label: "Your desk" }].map((n) => (
            <Link key={n.href} href={n.href} className={`flex items-center justify-between border-b border-line py-3.5 text-lg font-semibold tracking-[-0.02em] ${active(n.href) ? "text-amber" : ""}`}>
              {n.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
