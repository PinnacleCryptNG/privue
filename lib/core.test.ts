import { describe, expect, it } from "vitest";
import { KeyPair } from "@near-js/crypto";
import { fromUnits, toUnits } from "./assets";
import { decide } from "./bots";
import { riskGuard } from "./engine";
import { nep413Hash } from "./near";
import { maxDrawdown, publicStats, replay, type Fill } from "./stats";

const f = (side: "buy" | "sell", symbol: string, qty: number, usdc: number): Fill => ({ side, symbol, qty, usdc, createdAt: "2026-11-06T00:00:00Z" });

describe("units", () => {
  it("round-trips and never rounds up", () => {
    expect(toUnits(1.5, 6)).toBe("1500000");
    expect(toUnits(0.1, 24)).toBe("100000000000000000000000");
    expect(BigInt(toUnits(133.67324393515472, 24))).toBeLessThanOrEqual(133673243935154720000000000n);
    expect(fromUnits("1500000", 6)).toBe(1.5);
  });
});

describe("stats", () => {
  it("computes realized pnl, win rate and drawdown from fills", () => {
    const fills = [f("buy", "NEAR", 100, 300), f("sell", "NEAR", 100, 330), f("buy", "ETH", 1, 2000), f("sell", "ETH", 1, 1900)];
    const book = replay(10000, fills);
    expect(book.realized).toBeCloseTo(-70);
    expect(book.closed).toBe(2);
    expect(book.wins).toBe(1);
    const s = publicStats(10000, fills, {}, [10000, 10030, 9930]);
    expect(s.winRate).toBe(0.5);
    expect(s.equity).toBeCloseTo(9930);
    expect(s.maxDrawdown).toBeCloseTo(100 / 10030);
  });
  it("marks open positions at current prices", () => {
    const s = publicStats(1000, [f("buy", "NEAR", 100, 300)], { NEAR: 4 }, []);
    expect(s.equity).toBeCloseTo(1100);
    expect(s.exposure).toBeCloseTo(400 / 1100);
  });
  it("max drawdown of a rising series is zero", () => {
    expect(maxDrawdown([1, 2, 3])).toBe(0);
  });
});

describe("copy risk guard", () => {
  it("skips tiny and concentrated copies", () => {
    expect(riskGuard(0, 3, 2, 1000)).toMatch(/minimum/);
    expect(riskGuard(150, 3, 200, 1000)).toMatch(/60%/);
    expect(riskGuard(0, 3, 200, 1000)).toBeNull();
  });
});

describe("bot rules", () => {
  it("momentum buys strength and sells weakness", () => {
    expect(decide("Momentum", 101, [100, 100, 100, 100], false, 1, 0)).toBe("buy");
    expect(decide("Momentum", 99, [100, 100, 100, 100], true, 0.5, 0)).toBe("sell");
    expect(decide("Momentum", 100, [100, 100], false, 1, 0)).toBeNull();
  });
  it("mean reversion fades moves", () => {
    expect(decide("Mean reversion", 99, [100, 100, 100, 100], false, 1, 0)).toBe("buy");
    expect(decide("Mean reversion", 101, [100, 100, 100, 100], true, 0.5, 0)).toBe("sell");
  });
});

describe("NEP-413", () => {
  it("hash matches a signature made over the same payload", () => {
    const kp = KeyPair.fromRandom("ed25519");
    const nonce = Buffer.alloc(32, 7);
    const h = nep413Hash("Sign in to Privue", nonce, "privue.app", null);
    const { signature } = kp.sign(new Uint8Array(h));
    expect(kp.getPublicKey().verify(new Uint8Array(nep413Hash("Sign in to Privue", nonce, "privue.app", null)), signature)).toBe(true);
    expect(kp.getPublicKey().verify(new Uint8Array(nep413Hash("other", nonce, "privue.app", null)), signature)).toBe(false);
  });
});
