"use client";

import { useEffect, useState } from "react";
import type { PublicTrader } from "@/lib/public";
import type { RecordCheck } from "@/lib/record";

let cache: Promise<PublicTrader[]> | null = null;

/** Shared, single fetch of the public trader list for every landing section. */
export function useTraders() {
  const [list, setList] = useState<PublicTrader[] | null>(null);
  useEffect(() => {
    cache ??= fetch("/api/traders")
      .then((r) => r.json())
      .then((d) => (d.traders ?? []) as PublicTrader[])
      .catch(() => []);
    cache.then(setList);
  }, []);
  return list;
}

export function useRecord(handle: string | undefined) {
  const [rec, setRec] = useState<RecordCheck | null>(null);
  useEffect(() => {
    if (!handle) return;
    fetch(`/api/traders/${handle}/record`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setRec)
      .catch(() => undefined);
  }, [handle]);
  return rec;
}
