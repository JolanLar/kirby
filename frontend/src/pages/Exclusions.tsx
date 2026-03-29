import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { ShieldBan, ShieldCheck, Bot } from 'lucide-react';
import SearchInput from '../components/SearchInput';
import PageSizeSelect from '../components/PageSizeSelect';
import SortSelect from '../components/SortSelect';
import Pagination from '../components/Pagination';
import MediaCard from '../components/MediaCard';

interface ExclusionItem {
  tmdbId: string;
  title: string;
  type: string;
  posterUrl: string | null;
  isAuto: number;
  lastSeenAt: number;
  createdAt: string;
}

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Date Excluded' },
  { value: 'lastSeenAt', label: 'Last Seen' },
  { value: 'title', label: 'Title' },
];

export default function Exclusions() {
  const [exclusions, setExclusions] = useState<ExclusionItem[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(48);

  const [showAutoOnly, setShowAutoOnly] = useState(false);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get('/api/exclusions');
      setExclusions(res.data);
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

  async function removeExclusion(tmdbId: string, type: string) {
    try {
      await axios.delete(`/api/exclusions/${type}/${tmdbId}`);
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

            <label className="flex items-center gap-2 cursor-pointer bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 hover:bg-slate-800 transition-colors">
              <input
                type="checkbox"
                checked={showAutoOnly}
                onChange={(e) => { setShowAutoOnly(e.target.checked); setCurrentPage(1); }}
                className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500/50 bg-slate-900"
              />
              <span className="text-sm text-slate-300 flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-indigo-400" /> Auto Only
              </span>
            </label>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            {exclusions.length === 0 ? "No exclusions yet. You can exclude medias from the Dashboard." : "No exclusions match your filters."}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {paginated.map((item) => (
                <MediaCard
                  key={item.type + '-' + item.tmdbId}
                  posterUrl={item.posterUrl}
                  title={item.title}
                  containerClass="border-slate-800 hover:border-red-500/30 hover:shadow-[0_0_20px_rgba(239,68,68,0.15)]"
                  imageClass="opacity-60 group-hover:opacity-100 mix-blend-luminosity group-hover:mix-blend-normal"
                  hoverOverlay={
                    <button
                      onClick={() => removeExclusion(item.tmdbId, item.type)}
                      title="Remove Exclusion"
                      className="px-4 py-2 bg-emerald-500/80 hover:bg-emerald-500 text-white rounded-lg backdrop-blur-sm transition-colors shadow-lg flex items-center gap-2 font-medium"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Restore
                    </button>
                  }
                  info={
                    <>
                      <h4 className="font-bold text-sm text-balance line-clamp-2 leading-tight drop-shadow-md text-red-50">{item.title}</h4>
                        <p className="text-xs text-slate-400 font-mono mt-1">Seen: {new Date(item.lastSeenAt).toLocaleDateString()}</p>
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-900/80 text-red-300">{item.type}</span>
                        {item.isAuto === 1 && (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-900/80 text-indigo-300 flex items-center gap-1">
                            <Bot className="w-3 h-3" /> Auto
                          </span>
                        )}
                      </div>
                    </>
                  }
                />
              ))}
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
