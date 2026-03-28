import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import axios from 'axios';

interface AuthState {
  authenticated: boolean;
  username: string | null;
  isFirstRun: boolean;
  oauthEnabled: boolean;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    authenticated: false,
    username: null,
    isFirstRun: false,
    oauthEnabled: false,
    loading: true,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await axios.get('/api/auth/check');
      setState({ ...res.data, loading: false });
    } catch {
      setState(s => ({ ...s, authenticated: false, loading: false }));
    }
  }, []);

  const logout = useCallback(async () => {
    await axios.post('/api/auth/logout');
    setState(s => ({ ...s, authenticated: false, username: null }));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Redirect to login on any 401
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      r => r,
      err => {
        if (err.response?.status === 401 && !err.config.url?.includes('/api/auth/')) {
          setState(s => ({ ...s, authenticated: false }));
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  return <AuthContext.Provider value={{ ...state, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
