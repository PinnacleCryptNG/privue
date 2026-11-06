import Link from "next/link";
import { HeroLedger } from "@/components/HeroLedger";
import { LiveBoard } from "@/components/LiveBoard";
import { TryButton } from "@/components/TryButton";

const POINTS = [
  { h: "Your record, signed", p: "Return, win rate and drawdown are computed from fills priced by live NEAR Intents quotes. 1Click signs every quote, and anyone can check the signature." },
  { h: "Your trades, private", p: "Followers see the numbers, not the positions. Only the people you sell a pass to see the trades, and you set how many passes exist." },
  { h: "Copy without leaking", p: "Copy passes mirror your trades into each holder's account without showing them. Your signal can't be screenshotted or front-run." },
];

export default function Home() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-14 md:grid-cols-[1.1fr_1fr] md:pt-24">
        <div className="fade-up">
          <h1 className="text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[3.4rem]">
            Sell the view.
            <br />
            <span className="text-frost">Keep the trades.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-mute">
            Privue lets traders publish a verified track record while every trade stays private. Followers buy a limited pass to watch, or to copy
            blind.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <TryButton />
            <Link href="/traders" className="btn btn-ghost">See the traders</Link>
          </div>
        </div>
        <div className="fade-up" style={{ animationDelay: "120ms" }}>
          <HeroLedger />
        </div>
      </section>

      <section className="border-y border-line bg-panel/50">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-3">
          {POINTS.map((p) => (
            <div key={p.h}>
              <h2 className="font-semibold">{p.h}</h2>
              <p className="mt-2 leading-relaxed text-mute">{p.p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">Trading now</h2>
          <Link href="/traders" className="text-sm text-frost">All traders</Link>
        </div>
        <LiveBoard />
      </section>

      <section className="mx-auto max-w-6xl px-5">
        <div className="card grid gap-8 p-6 sm:p-10 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.02em]">Built on NEAR</h2>
            <p className="mt-3 leading-relaxed text-mute">
              Prices come from NEAR Intents 1Click, which settles confidentially. Passes are minted by a NEAR contract that pays the trader on
              every sale. Strategy notes are written by NEAR AI Cloud models running in TEEs.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-5 text-sm">
            <div><dt className="label">Pricing</dt><dd className="mt-1">NEAR Intents 1Click</dd></div>
            <div><dt className="label">Passes</dt><dd className="mt-1">privue-app.testnet</dd></div>
            <div><dt className="label">Notes</dt><dd className="mt-1">NEAR AI Cloud, TEE</dd></div>
            <div><dt className="label">Trader share</dt><dd className="mt-1">90% of each pass</dd></div>
          </dl>
        </div>
      </section>
    </>
  );
}
