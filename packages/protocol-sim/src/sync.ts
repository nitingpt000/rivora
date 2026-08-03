'use client';

import { useEffect } from 'react';

import { useProtocol } from './store';

/** How often the background refresh runs while the tab is visible. */
const REFRESH_MS = 30_000;

/**
 * Restores the session and keeps protocol data current.
 *
 * Mounted once, in the app chrome. There is one hook rather than a per-route
 * one because a wallet holds exactly one role: the surface a session can read
 * is decided at sign-in, not by which page happens to be open.
 *
 * The poll pauses when the tab is hidden and fires immediately on return, so a
 * backgrounded tab neither burns requests nor shows a stale position at the
 * moment somebody looks at it again.
 */
export function useProtocolSync(): void {
  const restoreSession = useProtocol((s) => s.restoreSession);
  const load = useProtocol((s) => s.load);
  const refresh = useProtocol((s) => s.refresh);
  const token = useProtocol((s) => s.token);
  const role = useProtocol((s) => s.user?.role);

  const loadBorrower = useProtocol((s) => s.loadBorrower);
  const loadVault = useProtocol((s) => s.loadVault);
  const loadRisk = useProtocol((s) => s.loadRisk);
  const loadPartner = useProtocol((s) => s.loadPartner);

  // Session first, then data — loading before the token is restored would
  // fetch the public view and then immediately refetch as authenticated.
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    void load();
  }, [load, token]);

  /**
   * The signed-in role's own surface.
   *
   * Each set of endpoints is role-gated server-side, so firing the wrong one
   * would produce a 403 rather than data. Keying on the role means a borrower
   * never requests the vault surface at all.
   */
  useEffect(() => {
    if (!role) return;

    if (role === 'borrower') void loadBorrower();
    else if (role === 'lp') void loadVault();
    else if (role === 'ops') void loadRisk();
    else if (role === 'partner') void loadPartner();
  }, [role, token, loadBorrower, loadVault, loadRisk, loadPartner]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => void refresh(), REFRESH_MS);
    };

    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        void refresh();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);
}
