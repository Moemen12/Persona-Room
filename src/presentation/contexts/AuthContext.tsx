'use client';

import React, { createContext, useContext, ReactNode, useCallback } from 'react';
import { AuthUser } from '@/features/auth/auth.types';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Load current user on mount
  React.useEffect(() => {
    (async () => {
      try {
        const { getCurrentAuthUser } = await import('@/server/actions/auth.actions');
        const response = await getCurrentAuthUser();
        if (response.success && response.data) {
          setUser(response.data);
        }
      } catch (error) {
        console.error('Failed to load auth user:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { handleAuthSignIn } = await import('@/server/actions/auth.actions');
    const response = await handleAuthSignIn({ email, password });
    if (response.success && response.data) {
      setUser(response.data.user);
    } else {
      throw new Error(response.error?.message || 'Sign in failed');
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const { handleAuthSignUp } = await import('@/server/actions/auth.actions');
    const response = await handleAuthSignUp({ email, password, name });
    if (response.success && response.data) {
      setUser(response.data.user);
    } else {
      throw new Error(response.error?.message || 'Sign up failed');
    }
  }, []);

  const signOut = useCallback(async () => {
    const { handleAuthSignOut } = await import('@/server/actions/auth.actions');
    const response = await handleAuthSignOut({});
    if (response.success) {
      setUser(null);
    } else {
      throw new Error(response.error?.message || 'Sign out failed');
    }
  }, []);

  const refetch = useCallback(async () => {
    const { getCurrentAuthUser } = await import('@/server/actions/auth.actions');
    const response = await getCurrentAuthUser();
    if (response.success && response.data) {
      setUser(response.data);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        signIn,
        signUp,
        signOut,
        refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
