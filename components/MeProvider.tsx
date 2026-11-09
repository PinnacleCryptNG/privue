"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { PublicStats } from "@/lib/stats";

export type MePass = { handle: string; tier: "view" | "delayed" | "copy"; expires_at: string; allocation: number; tx: string | null };
export type Me = {
  session: { sub: string; kind: "near" | "guest" } | null;
  passes: MePass[];
  traders: string[];
  copies: { handle: string; stats: PublicStats }[];
};

type Ctx = { me: Me | null; loading: boolean; refresh: () => Promise<void>; signInOpen: boolean; setSignInOpen: (v: boolean) => void };

const MeContext = createContext<Ctx | null>(null);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [signInOpen, setSignInOpen] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      const d = await r.json();
      setMe(d.session ? d : { session: null, passes: [], traders: [], copies: [] });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return <MeContext.Provider value={{ me, loading, refresh, signInOpen, setSignInOpen }}>{children}</MeContext.Provider>;
}

export function useMe(): Ctx {
  const c = useContext(MeContext);
  if (!c) throw new Error("useMe outside MeProvider");
  return c;
}

export function shortId(sub: string): string {
  if (sub.startsWith("guest-")) return `Guest ${sub.slice(6, 10)}`;
  return sub.length > 22 ? `${sub.slice(0, 10)}…${sub.slice(-8)}` : sub;
}
