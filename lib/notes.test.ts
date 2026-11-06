import { describe, expect, it } from "vitest";
import { behaviour, cleanNote, findLeaks } from "./notes";

const at = (h: number) => new Date(Date.UTC(2026, 10, 6, h)).toISOString();

describe("strategy note inputs", () => {
  it("summarises behaviour without symbols", () => {
    const b = behaviour(
      [
        { side: "buy", symbol: "NEAR", qty: 100, usdc: 1000, createdAt: at(0) },
        { side: "sell", symbol: "NEAR", qty: 100, usdc: 1100, createdAt: at(4) },
        { side: "buy", symbol: "SOL", qty: 10, usdc: 2000, createdAt: at(5) },
        { side: "sell", symbol: "SOL", qty: 10, usdc: 1800, createdAt: at(7) },
      ],
      10_000,
    );
    expect(b).toMatchObject({ trades: 4, closedTrades: 2, winRatePct: 50, avgHoldHours: 3, avgBuyPctOfStart: 15, largestBuyPctOfStart: 20, marketsTraded: 2 });
    expect(JSON.stringify(b)).not.toMatch(/NEAR|SOL/);
  });

  it("flags notes that name or price a position", () => {
    expect(findLeaks("Rotates between BTC and majors")).toEqual(["BTC"]);
    expect(findLeaks("A Solana-heavy book")).toEqual(["solana"]);
    expect(findLeaks("Buys dips near $3.70")).toEqual(["price"]);
    expect(findLeaks("Sizes near a fifth of the account and cuts losers within hours.")).toEqual([]);
  });

  it("strips reasoning and markdown", () => {
    expect(cleanNote("<think>x</think> **Patient** trader.")).toBe("Patient trader.");
  });
});
