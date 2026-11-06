import Link from "next/link";
import { Mark } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 py-28 text-center">
      <Mark size={44} />
      <h1 className="mt-6 text-2xl font-semibold">Nothing to see here</h1>
      <p className="mt-2 text-mute">This page doesn&apos;t exist, or it&apos;s more private than most.</p>
      <Link href="/traders" className="btn btn-primary mt-8">See the traders</Link>
    </div>
  );
}
