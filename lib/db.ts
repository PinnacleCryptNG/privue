import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;
let migrated: Promise<void> | null = null;

function raw(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url);
  }
  return client;
}

const SCHEMA = [
  `create table if not exists traders (
    handle text primary key,
    name text not null,
    owner text not null,
    bio text not null default '',
    style text not null default '',
    markets text[] not null default '{}',
    start_cash double precision not null default 10000,
    is_bot boolean not null default false,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists fills (
    id bigserial primary key,
    account text not null,
    handle text not null,
    side text not null,
    symbol text not null,
    qty double precision not null,
    usdc double precision not null,
    price double precision not null,
    quote jsonb not null,
    source_fill bigint,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists fills_account on fills(account, id)`,
  `create table if not exists equity (
    account text not null,
    ts timestamptz not null default now(),
    value double precision not null
  )`,
  `create index if not exists equity_account on equity(account, ts)`,
  `create table if not exists prices (
    symbol text not null,
    ts timestamptz not null default now(),
    price double precision not null
  )`,
  `create index if not exists prices_symbol on prices(symbol, ts)`,
  `create table if not exists passes (
    holder text not null,
    handle text not null,
    tier text not null,
    expires_at timestamptz not null,
    allocation double precision not null default 1000,
    tx text,
    created_at timestamptz not null default now(),
    primary key (holder, handle, tier)
  )`,
  `create table if not exists notes (
    id bigserial primary key,
    handle text not null,
    body text not null,
    model text not null,
    proof jsonb not null,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists ticks (
    id bigserial primary key,
    ts timestamptz not null default now()
  )`,
  `create table if not exists skipped_copies (
    id bigserial primary key,
    account text not null,
    source_fill bigint not null,
    reason text not null,
    created_at timestamptz not null default now()
  )`,
];

export async function migrate(): Promise<void> {
  migrated ??= (async () => {
    for (const stmt of SCHEMA) await raw().query(stmt);
  })().catch((e) => {
    migrated = null;
    throw e;
  });
  return migrated;
}

export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  await migrate();
  return (await raw().query(text, params)) as T[];
}
