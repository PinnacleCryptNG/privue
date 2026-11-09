import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

export default function Terms() {
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-5 py-12 leading-relaxed text-mute">
      <h1 className="display text-4xl sm:text-5xl text-text">Terms of use</h1>
      <p className="label">Testnet demonstration · last updated November 2026</p>
      <p>
        Privue is currently a demonstration running on NEAR testnet. By using it you accept these terms. If you don&apos;t, please don&apos;t use the
        service.
      </p>
      <h2 className="font-semibold text-text">No real money, no real trades</h2>
      <p>
        Every trade on Privue is a paper fill: it is priced from a live, signed NEAR Intents 1Click quote, but nothing is executed and no funds move.
        Passes are bought with NEAR testnet tokens, which have no monetary value. Profit, loss and every other figure shown are simulated.
      </p>
      <h2 className="font-semibold text-text">Not financial advice</h2>
      <p>
        Nothing on Privue, including trader profiles, track records and AI-written strategy notes, is investment, financial, legal or tax advice, or an
        offer to buy or sell anything. Past simulated performance says nothing about future results.
      </p>
      <h2 className="font-semibold text-text">Your account</h2>
      <p>
        You can use Privue as a guest or by signing in with a NEAR testnet wallet. You are responsible for your wallet and its keys; Privue never holds
        them. Don&apos;t abuse the service: no automated account creation, no attempts to drain sponsored passes, and no trying to read data your passes
        don&apos;t grant. Rate limits apply, and we may suspend access that breaks these rules.
      </p>
      <h2 className="font-semibold text-text">Traders and passes</h2>
      <p>
        Traders choose their pass prices and supply. The testnet contract pays 90% of each sale to the trader and keeps 10%. A pass grants access for its
        stated period; a copy pass mirrors trades into a paper account and never reveals them. Testnet passes may be reset if the testnet or the contract
        is reset.
      </p>
      <h2 className="font-semibold text-text">The service is provided as is</h2>
      <p>
        Privue is pre-release software provided as is, without warranties. It may be unavailable, lose data, or change at any time. To the extent the law
        allows, we are not liable for any loss arising from its use.
      </p>
      <h2 className="font-semibold text-text">Before any real-money launch</h2>
      <p>
        A mainnet version handling real funds would come with new terms, and could be restricted by jurisdiction. These terms do not cover real-money
        trading.
      </p>
    </div>
  );
}
