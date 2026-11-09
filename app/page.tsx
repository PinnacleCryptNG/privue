import Link from "next/link";
import { Blinds } from "@/components/Blinds";
import { IconArrow, IconCopy, IconPayout, IconRecord } from "@/components/Icons";
import { Earn } from "@/components/landing/Earn";
import { PassPreview } from "@/components/landing/PassPreview";
import { Proof } from "@/components/landing/Proof";
import { Tape } from "@/components/landing/Tape";
import { Tiers } from "@/components/landing/Tiers";
import { LiveBoard } from "@/components/LiveBoard";
import { RevealOnScroll } from "@/components/Reveal";
import { TryButton } from "@/components/TryButton";

const TRADER_POINTS = [
  { Icon: IconPayout, h: "Keep 90% of every pass", p: "You are paid the moment someone buys. Privue keeps 10%." },
  { Icon: IconRecord, h: "You set the price and the limit", p: "Choose what a pass costs and how many exist. Fewer followers means less crowding on your trades." },
  { Icon: IconCopy, h: "Copiers can't leak your trades", p: "People who copy you never see your trades, so there is nothing to screenshot or trade ahead of." },
];

export default function Home() {
  return (
    <>
      <RevealOnScroll />
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-12 md:pt-20 lg:grid-cols-[1.08fr_1fr]">
        <div className="fade-up">
          <h1 className="display text-[3.4rem] sm:text-[4.6rem] lg:text-[5.4rem]">
            Show the record.
            <br />
            <span className="text-amber">Sell the view.</span>
          </h1>
          <p className="mt-7 max-w-[34rem] text-lg leading-relaxed text-mute">
            Traders show their results in public and keep their trades private. You pick a trader by their record, then buy a pass to watch
            their trades or to copy them automatically.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <TryButton />
            <Link href="/traders" className="btn btn-ghost h-12 px-6">
              Browse traders <IconArrow />
            </Link>
          </div>
          <p className="label mt-5">Free to try. Runs on NEAR testnet with practice money at real market prices.</p>
        </div>
        <div className="fade-up" style={{ animationDelay: "140ms" }}>
          <PassPreview />
        </div>
      </section>

      <Tape />

      <section className="mx-auto max-w-6xl px-5 pt-28">
        <div className="max-w-2xl" data-reveal>
          <h2 className="display text-4xl sm:text-5xl">Four ways to follow a trader.</h2>
          <p className="mt-4 text-lg leading-relaxed text-mute">Anyone can see a trader&apos;s results. A pass shows you more, or copies their trades for you.</p>
        </div>
        <div className="mt-12">
          <Tiers />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-28">
        <div className="mb-12 max-w-2xl" data-reveal>
          <h2 className="display text-4xl sm:text-5xl">Don&apos;t take the record on trust.</h2>
          <p className="mt-4 text-lg leading-relaxed text-mute">Results only matter if they&apos;re real. Here is how Privue keeps them honest, with a live link to check each one.</p>
        </div>
        <Proof />
      </section>

      <section id="earn" className="mx-auto max-w-6xl scroll-mt-24 px-5 pt-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-center">
          <div data-reveal>
            <h2 className="display text-4xl sm:text-5xl">Trade well? Get paid for it.</h2>
            <ul className="mt-9 space-y-6">
              {TRADER_POINTS.map((t) => (
                <li key={t.h} className="flex gap-4">
                  <t.Icon size={26} className="mt-0.5 shrink-0 text-amber" />
                  <div>
                    <h3 className="font-bold tracking-[-0.015em]">{t.h}</h3>
                    <p className="mt-1 leading-relaxed text-mute">{t.p}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/me" className="btn btn-ghost mt-9 h-12 px-6">
              Open a trader profile <IconArrow />
            </Link>
          </div>
          <div data-reveal>
            <Earn />
            <p className="label mt-3 px-1">Illustration. During the demo, passes sell for NEAR testnet tokens.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-28">
        <div className="mb-8 flex items-end justify-between gap-4" data-reveal>
          <h2 className="display text-4xl sm:text-5xl">On the desk now.</h2>
          <Link href="/traders" className="link hidden shrink-0 text-sm font-medium sm:block">All traders</Link>
        </div>
        <LiveBoard />
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-28">
        <div className="card relative overflow-hidden" data-reveal>
          <Blinds count={7} slat={52} offsetMs={900} className="absolute inset-0 opacity-90" />
          <div className="relative grid gap-6 bg-gradient-to-r from-ink via-ink/85 to-transparent p-8 sm:p-14">
            <h2 className="display max-w-xl text-4xl sm:text-5xl">Try it in under a minute.</h2>
            <p className="max-w-md text-lg leading-relaxed text-mute">Start a free guest account, open a trader and take a free pass. No wallet, no money, nothing to install.</p>
            <div>
              <TryButton label="Start free" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
