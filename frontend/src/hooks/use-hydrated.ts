"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `false` during SSR and hydration (also for Suspense boundaries that hydrate late, after
 * queries have resolved), `true` afterwards. Use it to keep query-dependent markup identical
 * to the server HTML until hydration is done.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
