import { useState, useCallback, useEffect } from 'react';
import { executeFn } from '../lib/execute-fn';

interface AuthState {
  token: string | null;
  email: string | null;
  role: string | null;
  isAuthenticated: boolean;
}

interface UseAuthResult extends AuthState {
  login: (email: string) => Promise<{ success: boolean; requiresOTP?: boolean; message: string }>;
  verifyOTP: (email: string, otp: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
}

/**
 * Hook that manages authentication state.
 *
 * @param tokenKey - sessionStorage key for the auth token (from config)
 */
export function useAuth(tokenKey: string): UseAuthResult {
  const [state, setState] = useState<AuthState>(() => {
    const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(tokenKey) : null;
    return {
      token,
      email: null,
      role: null,
      isAuthenticated: !!token,
    };
  });

  // Validate existing token on mount
  useEffect(() => {
    if (state.token) {
      executeFn<{ email: string; role: string } | null>('validateSession', [state.token])
        .then((payload) => {
          if (payload) {
            setState((s) => ({ ...s, email: payload.email, role: payload.role, isAuthenticated: true }));
          } else {
            sessionStorage.removeItem(tokenKey);
            setState({ token: null, email: null, role: null, isAuthenticated: false });
          }
        })
        .catch(() => {
          sessionStorage.removeItem(tokenKey);
          setState({ token: null, email: null, role: null, isAuthenticated: false });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string) => {
    const result = await executeFn<{
      success: boolean;
      requiresOTP?: boolean;
      email?: string;
      message: string;
    }>('login', [email]);
    return result;
  }, []);

  const verifyOTP = useCallback(
    async (email: string, otp: string) => {
      const result = await executeFn<{
        success: boolean;
        token?: string;
        message: string;
      }>('verifyOTP', [email, otp]);

      if (result.success && result.token) {
        sessionStorage.setItem(tokenKey, result.token);
        setState({
          token: result.token,
          email,
          role: null, // Will be populated by profile fetch
          isAuthenticated: true,
        });
      }

      return result;
    },
    [tokenKey]
  );

  const logout = useCallback(() => {
    sessionStorage.removeItem(tokenKey);
    setState({ token: null, email: null, role: null, isAuthenticated: false });
  }, [tokenKey]);

  return { ...state, login, verifyOTP, logout };
}
