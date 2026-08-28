/**
 * Polyfill for React.useEffectEvent
 *
 * Next.js 15.x bundles its own React canary build which does not export
 * useEffectEvent. Mantine 9.x imports useEffectEvent directly from "react",
 * so it gets undefined and crashes at runtime.
 *
 * This file patches the React module object at import time. It must be
 * imported before any Mantine imports in Providers.tsx.
 */
import React from 'react'

type AnyFn = (...args: unknown[]) => unknown

if (!(React as unknown as Record<string, unknown>)['useEffectEvent']) {
  // Minimal polyfill: just return the function as-is.
  // The real useEffectEvent creates a stable reference, but for Mantine's
  // useWindowEvent (event listener registration), returning fn directly is
  // functionally correct — the effect simply re-subscribes when the listener
  // reference changes, which is harmless.
  ;(React as unknown as Record<string, unknown>)['useEffectEvent'] =
    function useEffectEvent<T extends AnyFn>(fn: T): T {
      return fn
    }
}
