export type Fill = {
  side: "buy" | "sell";
  symbol: string;
  qty: number;
  usdc: number;
  createdAt: string;
};

export type Position = { symbol: string; qty: number; cost: number };

export type Book = {
  cash: number;
  positions: Record<string, Position>;
  realized: number;
  closed: number;
  wins: number;
};

export function replay(startCash: number, fills: Fill[]): Book {
  const book: Book = { cash: startCash, positions: {}, realized: 0, closed: 0, wins: 0 };
  for (const f of fills) {
    const p = (book.positions[f.symbol] ??= { symbol: f.symbol, qty: 0, cost: 0 });
    if (f.side === "buy") {
      book.cash -= f.usdc;
      p.qty += f.qty;
      p.cost += f.usdc;
    } else {
      const qty = Math.min(f.qty, p.qty);
      const basis = p.qty > 0 ? (p.cost * qty) / p.qty : 0;
      const pnl = f.usdc - basis;
      book.cash += f.usdc;
      book.realized += pnl;
      book.closed += 1;
      if (pnl > 0) book.wins += 1;
      p.qty -= qty;
      p.cost -= basis;
      if (p.qty <= 1e-12) {
        p.qty = 0;
        p.cost = 0;
      }
    }
  }
  return book;
}

export function equity(book: Book, prices: Record<string, number>): number {
  let v = book.cash;
  for (const p of Object.values(book.positions)) v += p.qty * (prices[p.symbol] ?? 0);
  return v;
}

export function maxDrawdown(series: number[]): number {
  let peak = -Infinity;
  let dd = 0;
  for (const v of series) {
    peak = Math.max(peak, v);
    if (peak > 0) dd = Math.max(dd, (peak - v) / peak);
  }
  return dd;
}

export type PublicStats = {
  startCash: number;
  equity: number;
  pnl: number;
  pnlPct: number;
  realized: number;
  winRate: number | null;
  closedTrades: number;
  totalFills: number;
  maxDrawdown: number;
  exposure: number;
  lastFillAt: string | null;
};

export function publicStats(startCash: number, fills: Fill[], prices: Record<string, number>, equitySeries: number[]): PublicStats {
  const book = replay(startCash, fills);
  const eq = equity(book, prices);
  const invested = eq - book.cash;
  return {
    startCash,
    equity: eq,
    pnl: eq - startCash,
    pnlPct: (eq - startCash) / startCash,
    realized: book.realized,
    winRate: book.closed ? book.wins / book.closed : null,
    closedTrades: book.closed,
    totalFills: fills.length,
    maxDrawdown: maxDrawdown([startCash, ...equitySeries, eq]),
    exposure: eq > 0 ? invested / eq : 0,
    lastFillAt: fills.at(-1)?.createdAt ?? null,
  };
}
