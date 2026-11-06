"use client";

import { useRouter } from "next/navigation";
import { useMe } from "./MeProvider";

export function TryButton() {
  const { me, setSignInOpen } = useMe();
  const router = useRouter();
  return (
    <button className="btn btn-primary" onClick={() => (me?.session ? router.push("/traders") : setSignInOpen(true))}>
      Try it, no wallet needed
    </button>
  );
}
