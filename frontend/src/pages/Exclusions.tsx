import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { ShieldBan, ShieldCheck, Search, ListFilter, ArrowUpDown, Bot } from 'lucide-react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface ExclusionItem {
  tmdbId: string;
  title: string;
  type: string;
  posterUrl: string | null;
  isAuto: number;
  lastSeenAt: number;
  createdAt: string;
}

export default function Exclusions() {
  const [exclusions, setExclusions] = useState<ExclusionItem[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(48);
  
  const [showAutoOnly, setShowAutoOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'createdAt' | 'title' | 'lastSeenAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async () => {
    try {
      const dbRes = await axios.get('/api/exclusions');
      setExclusions(dbRes.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    axios.get('/api/exclusions').then(res => {
      if (mounted) setExclusions(res.data);
    }).catch(console.error);
    return () => { mounted = false; };
  }, []);

  async function removeExclusion(tmdbId: string) {
    try {
      await axios.delete(`/api/exclusions/${tmdbId}`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  let filtered = exclusions;
  
  if (showAutoOnly) {
    filtered = filtered.filter(item => item.isAuto === 1);
  }
  
  if (searchQuery) {
    filtered = filtered.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }

  filtered = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'title') {
      cmp = a.title.localeCompare(b.title);
    } else if (sortBy === 'lastSeenAt') {
      cmp = (a.lastSeenAt || 0) - (b.lastSeenAt || 0);
    } else {
      cmp = String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const paginated = filtered.slice(startIndex, startIndex + pageSize);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <header className="mb-8 flex items-center gap-4">
        <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
          <ShieldBan className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <h2 className="text-3xl font-bold bg-linear-to-r from-white to-slate-400 bg-clip-text text-transparent">Exclusions</h2>
          <p className="text-slate-400 mt-1">Medias listed below will never be deleted by the system.</p>
        </div>
      </header>

      <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-slate-700/50 shadow-xl flex flex-col gap-6">
        
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <h3 className="text-xl font-semibold hidden sm:flex items-center gap-2">
            All Exclusions
            <span className="text-xs font-normal px-2 py-1 bg-slate-900 rounded-md text-slate-400">Total: {filtered.length}</span>
          </h3>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all w-full sm:w-48"
              />
            </div>

            <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2">
              <ListFilter className="w-4 h-4 text-slate-400" />
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-transparent text-sm text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value={24}>24 per page</option>
                <option value={48}>48 per page</option>
                <option value={96}>96 per page</option>
                <option value={999999}>All</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2">
              <ArrowUpDown className="w-4 h-4 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'title' | 'lastSeenAt')}
                className="bg-transparent text-sm text-slate-300 focus:outline-none cursor-pointer w-24"
              >
                <option value="createdAt">Date (Excl)</option>
                <option value="lastSeenAt">Date (Seen)</option>
                <option value="title">Title</option>
              </select>
              <div className="w-px h-4 bg-slate-700 mx-1"></div>
              <button 
                onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                className="text-xs font-bold text-slate-400 hover:text-slate-200 w-8"
              >
                {sortOrder.toUpperCase()}
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 hover:bg-slate-800 transition-colors">
              <input 
                type="checkbox" 
                checked={showAutoOnly} 
                onChange={(e) => {
                  setShowAutoOnly(e.target.checked);
                  setCurrentPage(1);
                }}
                className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500/50 bg-slate-900"
              />
              <span className="text-sm text-slate-300 flex items-center gap-1.5"><Bot className="w-4 h-4 text-indigo-400" /> Auto Only</span>
            </label>
            
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
             {exclusions.length === 0 ? "No exclusions yet. You can exclude medias from the Dashboard." : "No exclusions match your filters."}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {paginated.map((item) => (
              <div key={item.tmdbId} className="group relative bg-slate-900 rounded-xl overflow-hidden hover:shadow-[0_0_20px_rgba(239,68,68,0.15)] transition-all duration-300 hover:-translate-y-1 border border-slate-800 hover:border-red-500/30">
                <div className="aspect-2/3 w-full relative overflow-hidden bg-slate-800">
                  {item.posterUrl ? (
                    <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500 mix-blend-luminosity group-hover:mix-blend-normal" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                       <span className="text-slate-600 text-sm font-medium">{item.title}</span>
                    </div>
                  )}
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent opacity-90" />
                  
                  {/* Actions */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm">
                    <button 
                      onClick={() => removeExclusion(item.tmdbId)}
                      title="Remove Exclusion" 
                      className="px-4 py-2 bg-emerald-500/80 hover:bg-emerald-500 text-white rounded-lg backdrop-blur-sm transition-colors shadow-lg flex items-center gap-2 font-medium"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Restore
                    </button>
                  </div>
                  
                  {/* Info */}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h4 className="font-bold text-sm text-balance line-clamp-2 leading-tight drop-shadow-md text-red-50">{item.title}</h4>
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                       <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-900/80 text-red-300">{item.type}</span>
                       {item.isAuto === 1 && (
                         <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-900/80 text-indigo-300 flex items-center gap-1">
                           <Bot className="w-3 h-3" /> Auto
                         </span>
                       )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-800/50 pt-4 mt-6">
              <div className="text-sm text-slate-400">
                Showing <span className="font-semibold text-slate-300">{startIndex + 1}</span> to <span className="font-semibold text-slate-300">{Math.min(startIndex + pageSize, filtered.length)}</span> of <span className="font-semibold text-slate-300">{filtered.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={validPage === 1}
                  className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={validPage === 1}
                  className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-4 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-medium text-slate-300">
                  Page {validPage} of {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={validPage === totalPages}
                  className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={validPage === totalPages}
                  className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}
