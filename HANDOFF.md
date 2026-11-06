# Privue — handoff

Second NEAR HACKATHON entry by PinnacleCrypt (the first is CodeCloak, https://github.com/PinnacleCryptNG/CodeCloak). Deadline: 14 Nov 2026 23:59 UTC. Tracks: `defi`, `privacy`, `agents`.

## Product
Private copy-trading. Traders keep their trades hidden and show only verified performance. They sell a limited number of passes:
- **View pass:** live trade feed, or a delayed feed depending on tier.
- **Copy pass ("blind copy"):** the holder's paper account mirrors each trade, sized to their allocation. The holder never sees the trade.

NEAR AI Cloud (TEE model, attestation verified using code ported from CodeCloak) writes strategy notes that never name positions.

## Hard rules
- **Zero funds.** The user has no money for demos. Every trade is a *paper fill at a live 1Click dry quote*. Label it that way everywhere, and never claim real execution.
- **Every fill stores the full signed 1Click quote** (`signature`, `timestamp`, `quoteRequest`, `quote`). Anyone can re-verify it with `verifyQuoteSignature` from `@defuse-protocol/one-click-sdk-typescript`. Verified working on 2026-11-06; a tampered quote fails.
- **Trades stay hidden.** The public API exposes aggregate stats only. Trades are revealed only to the owner, view-pass holders (with delay) and the copy engine.
- **Passes live on a NEAR testnet contract.** Contract account: `privue-app.testnet` (key in `~/.near-credentials`, 10 testnet NEAR).

## Verified API facts (2026-11-06)
- **Dry quotes:** `POST https://1click.chaindefuser.com/v0/quote` with `dry:true` and `depositType`/`recipientType`/`refundType` = `INTENTS` works with no API key and no balance, even for 0.1 wNEAR.
- **Token list:** `GET /v0/tokens` returns about 216 tokens with a `price` field (used for marking positions).
- **Asset IDs:** wNEAR `nep141:wrap.near` (24 decimals); USDC on NEAR `nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1` (6 decimals).
- **Sign-in:** `POST /v0/auth/authenticate` with an erc191-signed empty intent from a brand-new unfunded EVM key returns 201 and a User-Session.
  - `/v0/account/balances` returns 200.
  - `/v0/account/history` returns 403 "invite-only".
  - Quotes and orders reject the user token alone; they need a partner JWT.
- **Confidential quotes** (`confidentiality: basic`) return 401 without auth. Confidential Intents itself is invite-only (Partner Portal).
- **`@defuse-protocol/intents-sdk`** must be loaded with `require` (its ESM import fails on a near-api-js path).

## Bots
Seeded demo traders trade on a schedule from GitHub Actions; Vercel Hobby only allows daily crons. Each trade uses real dry quotes, so genuine history builds up before judging.

## Log
- 2026-11-06 · scaffolded Next 16 app, testnet account, research doc.
