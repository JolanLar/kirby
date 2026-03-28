import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Heart, EyeOff, Flame } from 'lucide-react';
import SearchInput from '../components/SearchInput';
import PageSizeSelect from '../components/PageSizeSelect';
import SortSelect from '../components/SortSelect';
import Pagination from '../components/Pagination';
import MediaCard from '../components/MediaCard';

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

const SORT_OPTIONS = [
  { value: 'seen', label: 'Last Seen' },
  { value: 'alpha', label: 'Title' },
  { value: 'fav', label: 'Most Favorited' },
];

export default function Favorites() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(48);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState('seen');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
      let cmp = 0;
      if (sortBy === 'alpha') cmp = a.title.localeCompare(b.title);
      else if (sortBy === 'fav') cmp = a.favoritedBy.length - b.favoritedBy.length;
      else cmp = a.lastSeenAt - b.lastSeenAt;
      return sortOrder === 'asc' ? cmp : -cmp;
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
            <SortSelect
              value={sortBy}
              options={SORT_OPTIONS}
              onChange={(v) => { setSortBy(v); setCurrentPage(1); }}
              sortOrder={sortOrder}
              onSortOrderToggle={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
            />
            <SearchInput
              value={searchQuery}
              onChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
            />
            <PageSizeSelect value={pageSize} onChange={(v) => { setPageSize(v); setCurrentPage(1); }} />
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {paginated.map((item) => {
                const isIgnored = item.ignoreFavorite === 1;
                const isToggling = toggling.has(item.type + '-' + item.tmdbId);
                return (
                  <MediaCard
                    key={item.type + '-' + item.tmdbId}
                    posterUrl={item.posterUrl}
                    title={item.title}
                    containerClass={isIgnored
                      ? 'border-slate-700 hover:border-orange-500/30 hover:shadow-[0_0_20px_rgba(249,115,22,0.12)]'
                      : 'border-slate-800 hover:border-pink-500/30 hover:shadow-[0_0_20px_rgba(236,72,153,0.15)]'
                    }
                    imageClass={`group-hover:scale-105 ${isIgnored ? 'opacity-40 saturate-0' : 'opacity-80 group-hover:opacity-100'}`}
                    topLeft={
                      (item.sources?.includes('plex') || item.sources?.includes('jellyfin')) ? (
                        <>
                          {item.sources.includes('plex') && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/80 text-white backdrop-blur-sm">P</span>}
                          {item.sources.includes('jellyfin') && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/80 text-white backdrop-blur-sm">J</span>}
                        </>
                      ) : undefined
                    }
                    topRight={
                      isIgnored ? (
                        <div className="px-2 py-1 bg-orange-500/80 backdrop-blur-sm rounded text-[10px] font-bold text-white flex items-center gap-1">
                          <EyeOff className="w-3 h-3" /> Ignored
                        </div>
                      ) : undefined
                    }
                    hoverOverlay={
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
                    }
                    info={
                      <>
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
                      </>
                    }
                  />
                );
              })}
            </div>

            <Pagination
              currentPage={validPage}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={pageSize}
              startIndex={startIndex}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
