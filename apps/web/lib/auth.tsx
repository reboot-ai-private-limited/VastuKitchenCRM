'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { LoginResponseDto, UserDto } from '@vastu/contracts';
import { api } from './api/client';
import {
  SESSION_HINT_COOKIE,
  clearSession,
  onSessionLost,
  refreshAccessToken,
  setSession,
  type SessionLostReason,
} from './api/session';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: UserDto | null;
  login(phone: string, password: string): Promise<UserDto>;
  redeemInvite(token: string): Promise<UserDto>;
  /** Asks for a login code to be sent. Answers the same for every number. */
  requestOtp(phone: string): Promise<void>;
  verifyOtp(phone: string, code: string): Promise<UserDto>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const hasHint = (): boolean =>
  typeof document !== 'undefined' &&
  document.cookie.split('; ').some((c) => c.startsWith(`${SESSION_HINT_COOKIE}=`));

const LOST_MESSAGE: Record<SessionLostReason, string> = {
  expired: 'expired',
  network: 'network',
  'signed-out': 'signed-out',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserDto | null>(null);

  // On every page load the access token is gone: get a new one with the refresh cookie, then ask who we are.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasHint()) {
        if (!cancelled) setStatus('anonymous');
        return;
      }
      const token = await refreshAccessToken();
      if (!token) {
        if (!cancelled) setStatus('anonymous');
        return;
      }
      try {
        const me = await api<UserDto>('/identity/auth/me');
        if (!cancelled) {
          setUser(me);
          setStatus('authenticated');
        }
      } catch {
        clearSession();
        if (!cancelled) setStatus('anonymous');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // If a refresh fails while the app is open (expired, offline, or signed out in another tab), leave politely.
  useEffect(
    () =>
      onSessionLost((reason) => {
        setUser(null);
        setStatus('anonymous');
        queryClient.clear();
        router.replace(`/login?reason=${LOST_MESSAGE[reason]}`);
      }),
    [queryClient, router],
  );

  const accept = useCallback((res: LoginResponseDto): UserDto => {
    setSession(res.accessToken, res.expiresIn);
    setUser(res.user);
    setStatus('authenticated');
    return res.user;
  }, []);

  const login = useCallback(
    async (phone: string, password: string) =>
      accept(
        await api<LoginResponseDto>('/identity/auth/login', {
          method: 'POST',
          body: { phone, password },
          anonymous: true,
        }),
      ),
    [accept],
  );

  const redeemInvite = useCallback(
    async (token: string) =>
      accept(
        await api<LoginResponseDto>('/identity/auth/invite/redeem', {
          method: 'POST',
          body: { token },
          anonymous: true,
        }),
      ),
    [accept],
  );

  const requestOtp = useCallback(async (phone: string) => {
    await api('/identity/auth/otp/request', { method: 'POST', body: { phone }, anonymous: true });
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, code: string) =>
      accept(
        await api<LoginResponseDto>('/identity/auth/otp/verify', {
          method: 'POST',
          body: { phone, code },
          anonymous: true,
        }),
      ),
    [accept],
  );

  const logout = useCallback(async () => {
    try {
      await api('/identity/auth/logout', { method: 'POST' });
    } catch {
      /* signing out must always work locally */
    }
    clearSession(true);
    setUser(null);
    setStatus('anonymous');
    queryClient.clear();
    router.replace('/login');
  }, [queryClient, router]);

  const value = useMemo(
    () => ({ status, user, login, redeemInvite, requestOtp, verifyOtp, logout }),
    [status, user, login, redeemInvite, requestOtp, verifyOtp, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
