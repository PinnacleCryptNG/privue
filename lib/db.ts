import { neon, neonConfig, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;
let migrated: Promise<void> | null = null;

function raw(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    if (process.env.NEON_LOCAL_PROXY) {
      neonConfig.fetchEndpoint = (host) => `http://${host}:4444/sql`;
      neonConfig.useSecureWebSocket = false;
    }
    client = neon(url);
  }
  return client;
}

type Migration = { version: number; name: string; sql: string[]; run?: (sql: Sql) => Promise<void> };
export type Sql = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

/**
 * Versioned, append-only migrations. Each runs once (tracked in schema_migrations) under an
 * advisory lock, and every statement is idempotent so a crashed migration can safely re-run.
 * Never edit an applied migration: add a new one.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "base schema",
    sql: [
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
    ],
  },
  {
    version: 2,
    name: "sealed fills and hash chain",
    sql: [
      `alter table fills add column if not exists seq bigint`,
      `alter table fills add column if not exists prev_hash text`,
      `alter table fills add column if not exists hash text`,
      `alter table fills add column if not exists sealed text`,
      `alter table fills alter column side drop not null`,
      `alter table fills alter column symbol drop not null`,
      `alter table fills alter column qty drop not null`,
      `alter table fills alter column usdc drop not null`,
      `alter table fills alter column price drop not null`,
      `alter table fills alter column quote drop not null`,
      `create unique index if not exists fills_account_seq on fills(account, seq)`,
    ],
    run: async (sql) => (await import("./ledger-migrate")).sealLegacyFills(sql),
  },
  {
    version: 3,
    name: "job queue",
    sql: [
      `create table if not exists jobs (
        id bigserial primary key,
        kind text not null,
        lane text not null,
        payload jsonb not null,
        status text not null default 'queued',
        attempts int not null default 0,
        run_after timestamptz not null default now(),
        locked_until timestamptz,
        last_error text,
        created_at timestamptz not null default now(),
        finished_at timestamptz
      )`,
      `create index if not exists jobs_ready on jobs(status, run_after, id)`,
      `create index if not exists jobs_lane on jobs(lane, id) where status in ('queued', 'running')`,
    ],
  },
  {
    version: 4,
    name: "sessions and rate limits",
    sql: [
      `create table if not exists sessions (
        jti text primary key,
        sub text not null,
        kind text not null,
        created_at timestamptz not null default now(),
        last_seen timestamptz not null default now(),
        revoked_at timestamptz
      )`,
      `create index if not exists sessions_sub on sessions(sub)`,
      `create table if not exists rate_limits (
        bucket text not null,
        window_start timestamptz not null,
        hits int not null default 0,
        primary key (bucket, window_start)
      )`,
    ],
  },
  {
    version: 5,
    name: "chain indexer",
    sql: [
      `create table if not exists cursors (
        name text primary key,
        value bigint not null,
        updated_at timestamptz not null default now()
      )`,
      `create table if not exists pass_events (
        seq bigint primary key,
        kind text not null,
        handle text not null,
        tier text not null,
        holder text not null,
        from_holder text,
        expires_at timestamptz not null,
        at timestamptz not null
      )`,
      `create table if not exists commitments (
        handle text not null,
        count bigint not null,
        head text not null,
        at timestamptz not null,
        primary key (handle, count)
      )`,
    ],
  },
  {
    version: 6,
    name: "worker runs",
    sql: [
      `create table if not exists runs (
        id bigserial primary key,
        worker text not null,
        ok boolean not null,
        ms int not null,
        detail jsonb,
        created_at timestamptz not null default now()
      )`,
      `create index if not exists runs_worker on runs(worker, id desc)`,
    ],
  },
];

const exec: Sql = async (text, params = []) => (await raw().query(text, params)) as never;

export async function migrate(): Promise<void> {
  migrated ??= (async () => {
    await exec(`create table if not exists schema_migrations (
      version int primary key,
      name text not null,
      applied_at timestamptz not null default now()
    )`);
    const done = new Set((await exec<{ version: number }>("select version from schema_migrations")).map((r) => Number(r.version)));
    for (const m of MIGRATIONS) {
      if (done.has(m.version)) continue;
      await raw().transaction((tx) => [tx.query("select pg_advisory_xact_lock(4243)"), ...m.sql.map((s) => tx.query(s))]);
      await m.run?.(exec);
      await exec("insert into schema_migrations (version, name) values ($1, $2) on conflict do nothing", [m.version, m.name]);
    }
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
