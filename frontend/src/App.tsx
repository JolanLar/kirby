import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Database, Settings as SettingsIcon, ShieldBan } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Exclusions from './pages/Exclusions';

function App() {
  return (
    <Router>
      <div className="min-h-screen flex text-slate-100 bg-slate-900 font-sans selection:bg-cyan-500/30">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-slate-800/50 border-r border-slate-700/50 backdrop-blur-xl flex flex-col items-center py-8 gap-4 sticky top-0 h-screen">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-cyan-400 to-blue-600 flex justify-center items-center shadow-lg shadow-cyan-500/20">
              <Database className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight bg-linear-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Kirby</h1>
          </div>
          
          <nav className="flex flex-col gap-2 w-full px-4 text-sm font-medium">
            <Link to="/" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-700/50 transition-colors text-slate-300 hover:text-white group">
              <Database className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
              Dashboard
            </Link>
            <Link to="/exclusions" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-700/50 transition-colors text-slate-300 hover:text-white group">
              <ShieldBan className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
              Exclusions
            </Link>
            <Link to="/settings" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-700/50 transition-colors text-slate-300 hover:text-white group">
              <SettingsIcon className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
              Settings
            </Link>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-8 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/exclusions" element={<Exclusions />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
