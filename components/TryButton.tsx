"use client";

import { useRouter } from "next/navigation";
import { useMe } from "./MeProvider";

export function TryButton({ label = "Try it free, no wallet" }: { label?: string }) {
  const { me, setSignInOpen } = useMe();
  const router = useRouter();
  return (
    <button className="btn btn-primary h-12 px-6" onClick={() => (me?.session ? router.push("/traders") : setSignInOpen(true))}>
      {me?.session ? "Browse traders" : label}
    </button>
  );
}
