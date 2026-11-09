import Link from "next/link";
import { Wordmark } from "./Logo";

const COLS = [
  { h: "Product", links: [["Traders", "/traders"], ["How it works", "/how"], ["For traders", "/#earn"], ["Your desk", "/me"]] },
  { h: "Proof", links: [["Passes contract", "https://testnet.nearblocks.io/address/privue-app.testnet"], ["Check a record", "/verify/record/atlas"], ["Source code", "https://github.com/PinnacleCryptNG/privue"]] },
  { h: "Legal", links: [["Terms", "/terms"], ["Privacy", "/privacy"]] },
];

export function Footer() {
  return (
    <footer className="mt-28 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 md:grid-cols-[1.4fr_2fr]">
        <div className="max-w-sm space-y-4">
          <Wordmark size={30} />
          <p className="text-sm leading-relaxed text-mute">
            The track record is public. The trades are for the people you choose. Built on NEAR Intents, NEAR AI Cloud and a passes contract on
            NEAR testnet.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
          {COLS.map((c) => (
            <div key={c.h}>
              <h2 className="font-semibold">{c.h}</h2>
              <ul className="mt-3 space-y-2.5 text-mute">
                {c.links.map(([label, href]) => (
                  <li key={href}>
                    {href.startsWith("http") ? (
                      <a href={href} className="hover:text-text" target="_blank" rel="noreferrer">{label}</a>
                    ) : (
                      <Link href={href} className="hover:text-text">{label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-5 py-5 text-xs leading-relaxed text-faint">
          Testnet demonstration. Trades are paper fills priced from live, signed NEAR Intents 1Click quotes; nothing executes and no real funds move.
          Passes are NEAR testnet transactions. Nothing here is financial advice.
        </p>
      </div>
    </footer>
  );
}
