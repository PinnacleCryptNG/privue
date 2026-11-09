import Link from "next/link";
import { Blinds } from "@/components/Blinds";

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-2">
      <div>
        <p className="num display text-7xl text-amber">404</p>
        <h1 className="display mt-4 text-4xl">The blinds are down on this one.</h1>
        <p className="mt-4 max-w-md text-lg text-mute">This page doesn&apos;t exist, or it&apos;s more private than most.</p>
        <Link href="/traders" className="btn btn-primary mt-8 h-12 px-6">See the traders</Link>
      </div>
      <div className="card overflow-hidden">
        <Blinds count={7} slat={50} />
      </div>
    </div>
  );
}
