import Link from "next/link";
import { Mark } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 text-sm text-mute sm:grid-cols-[1fr_auto]">
        <div className="max-w-md space-y-3">
          <div className="flex items-center gap-2 text-text">
            <Mark size={20} />
            <span className="font-medium">Privue</span>
          </div>
          <p>
            Trades during the hackathon are paper fills priced from live, signed NEAR Intents 1Click quotes. Passes are
            real NEAR testnet transactions. No real funds move.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 sm:justify-end">
          <Link href="/traders" className="hover:text-text">Traders</Link>
          <Link href="/how" className="hover:text-text">How it works</Link>
          <Link href="/me" className="hover:text-text">Your passes</Link>
          <Link href="/terms" className="hover:text-text">Terms</Link>
          <Link href="/privacy" className="hover:text-text">Privacy</Link>
          <a href="https://github.com/PinnacleCryptNG/privue" className="hover:text-text">GitHub</a>
          <a href="https://testnet.nearblocks.io/address/privue-app.testnet" className="hover:text-text">Contract</a>
        </nav>
      </div>
    </footer>
  );
}
