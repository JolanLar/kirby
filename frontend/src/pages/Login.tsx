import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Database, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { isFirstRun, oauthEnabled, refresh } = useAuth();
  const [searchParams] = useSearchParams();
  const callbackError = searchParams.get('error');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post('/api/auth/login', { username, password });
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Database className="text-white w-7 h-7" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold bg-linear-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Kirby</h1>
            <p className="text-slate-400 text-sm mt-1">
              {isFirstRun ? 'Create your admin account' : 'Sign in to continue'}
            </p>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-8 border border-slate-700/50 shadow-2xl space-y-6">

          {isFirstRun && (
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-sm text-cyan-300 text-center">
              First run — choose a username and password to secure this instance.
            </div>
          )}

          {(error || callbackError) && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300 text-center">
              {error || callbackError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-400">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                required
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-sm placeholder:text-slate-600"
                placeholder="admin"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-400">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={isFirstRun ? 'new-password' : 'current-password'}
                  required
                  className="w-full px-4 py-2.5 pr-10 bg-slate-900 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-sm placeholder:text-slate-600"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-900 font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isFirstRun ? 'Create account' : 'Sign in'}
            </button>
          </form>

          {oauthEnabled && (
            <>
              <div className="flex items-center gap-3 text-slate-600 text-xs">
                <div className="flex-1 h-px bg-slate-700" />
                or
                <div className="flex-1 h-px bg-slate-700" />
              </div>
              <a
                href="/api/auth/oauth/start"
                className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-xl transition-all border border-slate-600 hover:border-cyan-500/50 flex items-center justify-center gap-2 text-sm"
              >
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                Sign in with SSO
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
