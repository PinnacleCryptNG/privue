"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/components/MeProvider";

export default function AuthCallback() {
  const router = useRouter();
  const { refresh } = useMe();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    const accountId = h.get("accountId");
    const publicKey = h.get("publicKey");
    const signature = h.get("signature");
    if (!accountId || !publicKey || !signature) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(h.get("error") ?? "The wallet didn't return a signature.");
      return;
    }
    import("@/lib/wallet")
      .then(({ finishNearSignIn }) => finishNearSignIn({ accountId, publicKey, signature, callbackUrl: `${window.location.origin}/auth/callback` }))
      .then(refresh)
      .then(() => router.replace("/me"))
      .catch((e) => setError(e instanceof Error ? e.message : "Sign-in failed."));
  }, [refresh, router]);
  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      {error ? <p className="text-loss">{error}</p> : <p className="text-mute">Checking your wallet signature…</p>}
    </div>
  );
}
