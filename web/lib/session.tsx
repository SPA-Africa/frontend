'use client';

// Session state for the whole app.
// Live mode: tokens come from identity endpoints; the access token is kept in memory only
// and refreshed from the httpOnly cookie on load (SRS NFR-SEC.3).
// Mock mode: the chosen demo role is remembered in localStorage.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Role, User } from './types';
import { demoUsers } from './mock/users';
import { API_MODE } from './api/config';
import { setAccessToken } from './api/http';
import { setMockUserResolver } from './api/define';
import * as identity from './api/services/core/identity';

interface SessionValue {
  user: User | null;
  ready: boolean;
  /** Mock mode: sign in as a demo role. */
  signIn: (role: Role) => User;
  /** Apply a real sign-in result (login, verify, Google). */
  acceptAuth: (r: identity.AuthResult) => User;
  signOut: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);
const KEY = 'spa-session-role';

const storedDemoUser = (): User | null => {
  try {
    const role = localStorage.getItem(KEY) as Role | null;
    return role && demoUsers[role] ? demoUsers[role] : null;
  } catch {
    return null;
  }
};

// mocks resolve "who is calling" straight from storage so it works before React renders
setMockUserResolver(storedDemoUser);

export const homeFor: Record<Role, string> = {
  beneficiary: '/app',
  org_client: '/org',
  pillar_rep: '/console',
  judge_mentor: '/judge',
  executive_admin: '/admin',
  board_auditor: '/board',
};

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (API_MODE === 'mock') {
      setUser(storedDemoUser());
      setReady(true);
      return;
    }
    identity.refresh()
      .then(r => { setAccessToken(r.accessToken); return identity.me(); })
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  const acceptAuth = useCallback((r: identity.AuthResult) => {
    setAccessToken(r.accessToken);
    setUser(r.user);
    if (API_MODE === 'mock') try { localStorage.setItem(KEY, r.user.role); } catch {}
    return r.user;
  }, []);

  const signIn = useCallback((role: Role) => acceptAuth(identity.demoSignIn(role)), [acceptAuth]);

  const signOut = useCallback(() => {
    if (API_MODE === 'live') identity.logout().catch(() => {});
    setAccessToken(null);
    setUser(null);
    try { localStorage.removeItem(KEY); } catch {}
  }, []);

  return <SessionContext.Provider value={{ user, ready, signIn, acceptAuth, signOut }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
