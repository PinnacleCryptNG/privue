# Privue

**Sell the view. Keep the trades.**

Privue is private copy trading on NEAR. A trader's track record is public and verifiable, but their trades are private. Followers buy a limited pass to **watch** the trades, or to **copy them blind**: their account mirrors every trade without ever seeing it, so the signal can't leak or be front-run.

- Live app: https://privue-app.vercel.app
- Pass contract: [`privue-app.testnet`](https://testnet.nearblocks.io/address/privue-app.testnet)
- Built for the NEAR Hackathon (Nov 2026). Our other entry is **[CodeCloak](https://github.com/PinnacleCryptNG/CodeCloak)**.

## Try it (no wallet, no funds)

| Do this | You'll see |
| --- | --- |
| Open https://privue-app.vercel.app/traders | Three demo traders (Atlas, Kestrel, Juno) ranked by return. Stats only; no trades. |
| Open a trader, e.g. `/t/atlas` | Equity curve, return, win rate, drawdown. The trade list is frosted out. |
| Click **Sign in to get it** → **Try it now** | A private demo account is created in one click. |
| Click **Get a free demo pass** on the **View pass** | A real `buy_pass` transaction on NEAR testnet (Privue pays the testnet gas and price). A link to the transaction appears, and the trade list unlocks. |
| Click **Get a free demo pass** on the **Copy pass** of another trader | That trader's feed stays locked (`copy passes are blind`), but **Your passes** (`/me`) now shows a copy account whose balance moves with their trades. |
| On `/me`, open a trader profile and place a buy | A live NEAR Intents 1Click quote is fetched, its signature is verified, and the paper fill is stored. It's mirrored to anyone copying you. |
| Click **Signed quote** on any fill, or open `/verify/<id>` | The 1Click quote hash and ed25519 signature, re-verified server-side. You see the proof, not the trade. |
| On `/me`, after 3 trades, click **Write a note** | NEAR AI Cloud writes a strategy note from your trade *statistics* (no symbols, prices or times are sent). It appears on your profile with its proof. |
| `curl https://privue-app.vercel.app/api/traders/atlas/feed` | `403` unless you hold a view pass. |

To use a real wallet instead, choose **Connect a NEAR testnet wallet** (Meteor or Intear). Sign-in is a NEP-413 signed message; passes are bought from your own testnet balance with `buy_pass`.

### Check the wallet path from a terminal

`npm run e2e:testnet -- <account>.testnet` runs the whole wallet path against the live app on testnet. You need an account with a key in `~/.near-credentials/testnet`, and `near account create-account sponsor-by-faucet-service` gives you one with 10 free testnet NEAR. The script:

1. signs in with a NEP-413 message, and checks that the same signature can't sign in as another account;
2. buys a View pass and a Copy pass with `buy_pass`, paid from the account's own testnet NEAR;
3. checks on-chain that the contract paid the trader 90% of each sale;
4. checks that Privue reads each pass back from the chain;
5. checks that the View pass unlocks the trade feed and the Copy pass stays blind (403).

## What's real and what isn't

- **Prices are real.** Every fill uses a live, signed quote from the NEAR Intents 1Click API (`POST /v0/quote` with `dry: true`). Privue verifies the signature with `verifyQuoteSignature` before storing the fill, and stores the whole quote.
- **Fills are paper fills.** No funds move during the hackathon. Each account starts with $10,000 in paper USDC.
- **Passes are real testnet transactions.** The contract enforces supply, expiry and price, and pays the trader 90% of every sale.
- **Confidential settlement is next.** Executing the same orders through Confidential Intents needs a partner JWT with confidential access, which is invite-only. The code takes `ONECLICK_JWT` when it's available.
- **Demo traders are bots** with simple, published rules (momentum, mean reversion, range swing). A GitHub Actions job runs them every 15 minutes against live quotes, so their records build up over time and are not backfilled.

## How it works

```
trader order ──► 1Click dry quote (signed) ──► verify signature ──► store fill + quote
                                                                    │
                    public: return, win rate, drawdown, hourly curve ◄┤
                    view pass holders: every fill                     ◄┤
                    copy pass holders: risk check ─► mirrored fill    ◄┘ (never shown)
```

- **Privacy.** Public endpoints return aggregates only. The equity curve is bucketed hourly so trade timing can't be read off it. `/api/traders/:handle/feed` checks for an active view pass, held in Neon and synced from the contract.
- **Blind copy.** When a trader fills, each copy-pass holder's paper account places the same trade at the same share of equity. A risk check skips copies under $5 or ones that would put over 60% of the account in one asset.
- **Strategy notes (NEAR AI Cloud).** Before every note, Privue fetches a fresh attestation report with its own nonce and verifies it fail-closed: Intel TDX quote via `dcap-qvl`, NVIDIA GPU evidence via NRAS, nonce echo and signer addresses (ported from CodeCloak's verifier). Only then does it send the model aggregate behaviour (trade count, hold time, sizing as % of equity, win rate). The model's ECDSA response signature is checked against the attested signer. Drafts that name an asset or a price are discarded. Bots get a fresh note weekly; traders can request one an hour.
- **Contract** (`contracts/passes`, Rust, near-sdk): `set_offer`, `buy_pass` (payable), `has_pass`, `get_pass`, `get_offer`, `list_offers`. It emits a `pass_bought` NEP-297 event.

## Run it locally

Requires Node 22+, a Neon (or any Postgres) database, and a funded NEAR testnet account for the sponsor key.

```bash
npm ci
cp .env.example .env.local   # fill in DATABASE_URL, SESSION_SECRET, NEAR_SPONSOR_KEY
npm run dev                  # http://localhost:3000, tables are created on first request
curl -X POST localhost:3000/api/cron/tick   # run one bot tick
```

Checks:

```bash
npm run lint && npm run typecheck && npm test && npm run build
cd contracts/passes && cargo test
```

Deploy the contract to your own account:

```bash
cd contracts/passes
cargo near deploy build-non-reproducible-wasm <you>.testnet with-init-call new json-args '{"admin":"<you>.testnet"}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send
```

## Stack

Next.js 16, Tailwind 4, Neon Postgres, NEAR Intents 1Click (`@defuse-protocol/one-click-sdk-typescript`), near-api-js / `@near-js/*`, NEAR Wallet Selector, near-sdk 5 (Rust), Vitest.

## License

[MIT](LICENSE)
