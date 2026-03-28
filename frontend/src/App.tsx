import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Database, Settings as SettingsIcon, ShieldBan, Heart, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Exclusions from './pages/Exclusions';
import Favorites from './pages/Favorites';
import Login from './pages/Login';

function NavLink({ to, icon, label, activeColor = 'text-cyan-400' }: { to: string; icon: React.ReactNode; label: string; activeColor?: string }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium group ${active ? 'bg-slate-700/50 text-white' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`}
    >
      <span className={`transition-colors ${active ? activeColor : `text-slate-400 group-hover:${activeColor}`}`}>{icon}</span>
      {label}
    </Link>
  );
}

function AppShell() {
  const { authenticated, loading, username, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400" />
      </div>
    );
  }

  if (!authenticated) return <Login />;

  return (
    <div className="min-h-screen flex text-slate-100 bg-slate-900 font-sans selection:bg-cyan-500/30">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800/50 border-r border-slate-700/50 backdrop-blur-xl flex flex-col py-8 sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-8 px-6">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-cyan-400 to-blue-600 flex justify-center items-center shadow-lg shadow-cyan-500/20">
            <Database className="text-white w-5 h-5" />
          </div>
          <h1 className="font-bold text-xl tracking-tight bg-linear-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Kirby</h1>
        </div>

        <nav className="flex flex-col gap-2 flex-1 px-4 text-sm font-medium">
          <NavLink to="/" icon={<Database className="w-4 h-4" />} label="Dashboard" />
          <NavLink to="/exclusions" icon={<ShieldBan className="w-4 h-4" />} label="Exclusions" />
          <NavLink to="/favorites" icon={<Heart className="w-4 h-4" />} label="Favorites" activeColor="text-pink-400" />
          <NavLink to="/settings" icon={<SettingsIcon className="w-4 h-4" />} label="Settings" />
        </nav>

        {/* User / logout */}
        <div className="px-4 mt-4 border-t border-slate-700/50 pt-4">
          <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-slate-900/50">
            <span className="text-sm text-slate-400 truncate">{username}</span>
            <button
              onClick={logout}
              title="Sign out"
              className="text-slate-500 hover:text-red-400 transition-colors ml-2 shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/exclusions" element={<Exclusions />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppShell />
      </Router>
    </AuthProvider>
  );
}

export default App;
