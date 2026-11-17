'use client';
import { useEffect, useState } from 'react';

export type Load<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

/** Runs a request when enabled and its key changes, ignoring responses that arrive after a newer request. */
export function useLoad<T>(request: () => Promise<T>, enabled: boolean, key: string): Load<T> {
  const [load, setLoad] = useState<Load<T>>({ status: 'loading' });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoad({ status: 'loading' });
    request()
      .then(data => { if (active) setLoad({ status: 'ready', data }); })
      .catch(() => { if (active) setLoad({ status: 'error' }); });
    return () => { active = false; };
    // The key identifies the request; `request` is recreated on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);
  return load;
}
