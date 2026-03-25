import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Heart, Search, ListFilter, EyeOff, Flame, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface FavoriteItem {
  tmdbId: string;
  title: string;
  type: string;
  posterUrl: string | null;
  favoritedBy: string[];
  ignoreFavorite: number;
  lastSeenAt: number;
  sources: string[];
}

export default function Favorites() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(48);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'alpha' | 'seen' | 'fav'>('seen');

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get('/api/favorites');
      setFavorites(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function toggleIgnore(item: FavoriteItem) {
    const key = item.type + '-' + item.tmdbId;
    setToggling(prev => new Set(prev).add(key));
    const newIgnore = item.ignoreFavorite === 0;
    try {
      await axios.patch(`/api/favorites/${item.type}/${item.tmdbId}/ignore`, { ignore: newIgnore });
      setFavorites(prev =>
        prev.map(f => (f.tmdbId === item.tmdbId && f.type === item.type) ? { ...f, ignoreFavorite: newIgnore ? 1 : 0 } : f)
      );
    } catch (err) {
      console.error(err);
    } finally {
      setToggling(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  const filtered = favorites
    .filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'alpha') return a.title.localeCompare(b.title);
      if (sortBy === 'fav') return b.favoritedBy.length - a.favoritedBy.length;
      return b.lastSeenAt - a.lastSeenAt; // 'seen' — most recent first
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const paginated = filtered.slice(startIndex, startIndex + pageSize);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <header className="mb-8 flex items-center gap-4">
        <div className="p-3 bg-pink-500/10 rounded-2xl border border-pink-500/20">
          <Heart className="w-8 h-8 text-pink-400" />
        </div>
        <div>
          <h2 className="text-3xl font-bold bg-linear-to-r from-white to-slate-400 bg-clip-text text-transparent">Favorites</h2>
          <p className="text-slate-400 mt-1">Medias favorited by users — excluded from deletion unless ignored.</p>
        </div>
      </header>

      <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-slate-700/50 shadow-xl flex flex-col gap-6">

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <h3 className="text-xl font-semibold hidden sm:flex items-center gap-2">
            All Favorites
            <span className="text-xs font-normal px-2 py-1 bg-slate-900 rounded-md text-slate-400">Total: {filtered.length}</span>
          </h3>

          <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2">
                <select
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value as 'alpha' | 'seen' | 'fav'); setCurrentPage(1); }}
                  className="bg-transparent text-sm text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="seen">Sort: Last Seen</option>
                  <option value="alpha">Sort: A–Z</option>
                  <option value="fav">Sort: Most Favorited</option>
                </select>
              </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-pink-500 transition-all w-full sm:w-48"
              />
            </div>

            <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2">
              <ListFilter className="w-4 h-4 text-slate-400" />
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-transparent text-sm text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value={24}>24 per page</option>
                <option value={48}>48 per page</option>
                <option value={96}>96 per page</option>
                <option value={999999}>All</option>
              </select>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            {favorites.length === 0
              ? "No favorites detected yet. Enable favorites exclusion in Settings and trigger a sync."
              : "No favorites match your search."}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {paginated.map((item) => {
                const isIgnored = item.ignoreFavorite === 1;
                const isToggling = toggling.has(item.type + '-' + item.tmdbId);
                return (
                  <div
                    key={item.type + '-' + item.tmdbId}
                    className={`group relative bg-slate-900 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 border ${
                      isIgnored
                        ? 'border-slate-700 hover:border-orange-500/30 hover:shadow-[0_0_20px_rgba(249,115,22,0.12)]'
                        : 'border-slate-800 hover:border-pink-500/30 hover:shadow-[0_0_20px_rgba(236,72,153,0.15)]'
                    }`}
                  >
                    <div className="aspect-2/3 w-full relative overflow-hidden bg-slate-800">
                      {item.posterUrl ? (
                        <img
                          src={item.posterUrl}
                          alt={item.title}
                          className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${isIgnored ? 'opacity-40 saturate-0' : 'opacity-80 group-hover:opacity-100'}`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-4 text-center">
                          <span className="text-slate-600 text-sm font-medium">{item.title}</span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent opacity-90" />

                      {/* Source badges */}
                      {(item.sources?.includes('plex') || item.sources?.includes('jellyfin')) && (
                        <div className="absolute top-2 left-2 flex gap-1">
                          {item.sources.includes('plex') && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/80 text-white backdrop-blur-sm">P</span>}
                          {item.sources.includes('jellyfin') && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/80 text-white backdrop-blur-sm">J</span>}
                        </div>
                      )}

                      {/* Ignored badge */}
                      {isIgnored && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-orange-500/80 backdrop-blur-sm rounded text-[10px] font-bold text-white flex items-center gap-1">
                          <EyeOff className="w-3 h-3" /> Ignored
                        </div>
                      )}

                      {/* Hover action */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm">
                        <button
                          onClick={() => toggleIgnore(item)}
                          disabled={isToggling}
                          title={isIgnored ? "Re-activate favorite protection" : "Ignore favorite (re-enter deletion queue)"}
                          className={`px-4 py-2 rounded-lg backdrop-blur-sm transition-colors shadow-lg flex items-center gap-2 font-medium text-sm disabled:opacity-50 ${
                            isIgnored
                              ? 'bg-pink-500/80 hover:bg-pink-500 text-white'
                              : 'bg-orange-500/80 hover:bg-orange-500 text-white'
                          }`}
                        >
                          {isIgnored ? <Flame className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          {isIgnored ? 'Restore' : 'Ignore'}
                        </button>
                      </div>

                      {/* Info */}
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h4 className="font-bold text-sm text-balance line-clamp-2 leading-tight drop-shadow-md text-white">{item.title}</h4>
                        {item.lastSeenAt > 0 && (
                          <p className="text-xs text-slate-400 font-mono mt-0.5">Seen: {new Date(item.lastSeenAt).toLocaleDateString()}</p>
                        )}
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-700/80 ${item.type === 'movie' ? 'text-blue-300' : 'text-purple-300'}`}>
                            {item.type}
                          </span>
                        </div>
                        {item.favoritedBy && item.favoritedBy.length > 0 && (
                          <p className="text-[10px] text-pink-300 mt-1 truncate" title={item.favoritedBy.join(', ')}>
                            ♥ {item.favoritedBy.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-800/50 pt-4 mt-6">
                <div className="text-sm text-slate-400">
                  Showing <span className="font-semibold text-slate-300">{startIndex + 1}</span> to <span className="font-semibold text-slate-300">{Math.min(startIndex + pageSize, filtered.length)}</span> of <span className="font-semibold text-slate-300">{filtered.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPage(1)} disabled={validPage === 1} className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronsLeft className="w-4 h-4" /></button>
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={validPage === 1} className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                  <div className="px-4 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-medium text-slate-300">Page {validPage} of {totalPages}</div>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={validPage === totalPages} className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronRight className="w-4 h-4" /></button>
                  <button onClick={() => setCurrentPage(totalPages)} disabled={validPage === totalPages} className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronsRight className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
