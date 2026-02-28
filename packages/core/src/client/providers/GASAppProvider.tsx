import React, { createContext, useContext, type ReactNode } from 'react';
import type { GASFrameworkConfig } from '../../types/config';
import { useAuth } from '../hooks/useAuth';

// ─── Config Context ─────────────────────────────────────────────────────────

const ConfigContext = createContext<GASFrameworkConfig | null>(null);

export function useAppConfig(): GASFrameworkConfig {
  const config = useContext(ConfigContext);
  if (!config) throw new Error('useAppConfig must be used within <GASAppProvider>');
  return config;
}

// ─── Auth Context ───────────────────────────────────────────────────────────

interface AuthContextValue {
  token: string | null;
  email: string | null;
  role: string | null;
  isAuthenticated: boolean;
  login: (email: string) => Promise<{ success: boolean; requiresOTP?: boolean; message: string }>;
  verifyOTP: (email: string, otp: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAppAuth(): AuthContextValue {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAppAuth must be used within <GASAppProvider>');
  return auth;
}

// ─── Provider ───────────────────────────────────────────────────────────────

interface GASAppProviderProps {
  config: GASFrameworkConfig;
  children: ReactNode;
}

/**
 * Root provider that supplies app configuration and auth state to the entire tree.
 *
 * @example
 * <GASAppProvider config={appConfig}>
 *   <App />
 * </GASAppProvider>
 */
export function GASAppProvider({ config, children }: GASAppProviderProps) {
  const auth = useAuth(config.auth.tokenKey);

  return (
    <ConfigContext.Provider value={config}>
      <AuthContext.Provider value={auth}>
        {children}
      </AuthContext.Provider>
    </ConfigContext.Provider>
  );
}
