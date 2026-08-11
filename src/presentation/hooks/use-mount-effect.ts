"use client";

import { useEffect } from "react";

/** Use only for one-time external synchronization, such as auth or browser subscriptions. */
export function useMountEffect(effect: () => void | (() => void)) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}
