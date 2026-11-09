"use client";

import { useRouter } from "next/navigation";
import { useMe } from "./MeProvider";

export function TryButton({ label = "Try it free, no wallet" }: { label?: string }) {
  const { me, setSignInOpen } = useMe();
  const router = useRouter();
  return (
    <button className="btn btn-primary h-12 px-6" onClick={() => (me?.session ? router.push("/me") : setSignInOpen(true))}>
      {me?.session ? "Go to your desk" : label}
    </button>
  );
}
