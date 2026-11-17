'use client';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createApiClient, type ApiClient, type Role, type Session } from './api';

type SessionState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; session: Session };

interface SessionContextValue {
  state: SessionState;
  api: ApiClient;
  signIn: (identifier: string, password: string) => Promise<Session>;
  signOut: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<Session>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export const homeFor = (role: Role) => (role === 'ADMIN' ? '/admin/' : '/student/');

export function SessionProvider({ children, api: provided }: { children: ReactNode; api?: ApiClient }) {
  const [api] = useState(() => provided ?? createApiClient(process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'));
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    api.restore()
      .then(session => { if (active) setState({ status: 'authenticated', session }); })
      .catch(() => { if (active) setState({ status: 'anonymous' }); });
    return () => { active = false; };
  }, [api]);

  const authenticate = useCallback(async (action: Promise<Session>) => {
    const session = await action;
    setState({ status: 'authenticated', session });
    return session;
  }, []);

  const value = useMemo<SessionContextValue>(() => ({
    state,
    api,
    signIn: (identifier, password) => authenticate(api.login(identifier, password)),
    changePassword: (current, next) => authenticate(api.changePassword(current, next)),
    signOut: async () => {
      await api.logout().catch(() => undefined);
      setState({ status: 'anonymous' });
    }
  }), [api, authenticate, state]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}

/**
 * Client-side routing only; the API enforces every permission itself.
 * Returns the session once it is allowed to render the page.
 */
export function useRequireRole(role: Role): Session | undefined {
  const { state } = useSession();
  const router = useRouter();
  const session = state.status === 'authenticated' ? state.session : undefined;
  const destination =
    state.status === 'anonymous' ? '/'
    : session?.passwordChangeRequired ? '/change-password/'
    : session && session.role !== role ? homeFor(session.role)
    : undefined;

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  return destination ? undefined : session;
}
