import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { HardDrive, AlertTriangle, ShieldBan, RefreshCw, Trash, Loader2 } from 'lucide-react';
import SearchInput from '../components/SearchInput';
import PageSizeSelect from '../components/PageSizeSelect';
import SortSelect from '../components/SortSelect';
import Pagination from '../components/Pagination';
import MediaCard from '../components/MediaCard';

interface DiskStatus {
  storageId: string;
  name: string;
  freeBytes: number;
  error?: string;
}

interface MediaItem {
  plexId?: string;
  jellyfinId?: string;
  tmdbId: string;
  title: string;
  type: 'movie' | 'show';
  lastSeenAt: number;
  posterUrl: string;
  sizeOnDisk: number;
  deleting?: boolean;
  deletionCount?: number;
  deltaDays?: number;
  radarrId?: number;
  sonarrId?: number;
}

interface StorageConfig {
  id: string;
  name: string;
  targetFreeSpace: number;
}

const SORT_OPTIONS = [
  { value: 'rank', label: 'Queue Order' },
  { value: 'title', label: 'Title' },
  { value: 'lastSeenAt', label: 'Last Seen' },
  { value: 'size', label: 'Size' },
];

export default function Dashboard() {
  const [diskStatuses, setDiskStatuses] = useState<DiskStatus[]>([]);
  const [queues, setQueues] = useState<Record<string, MediaItem[]>>({});
  const [storageConfigs, setStorageConfigs] = useState<StorageConfig[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(48);
  const [sortBy, setSortBy] = useState('rank');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [serviceUrls, setServiceUrls] = useState({ plexPublicUrl: '', plexMachineId: '', jellyfinPublicUrl: '', radarrUrl: '', sonarrUrl: '' });

  const disableAutoRefresh = useRef(false);
  const pendingOperations = useRef(0);
  const deletedRef = useRef<Set<string>>(new Set());
  const isRefreshingRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backendSyncing, setBackendSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const dbRes = await axios.get('/api/status');
      setDiskStatuses(dbRes.data.storages || []);
      setBackendSyncing(dbRes.data.syncing ?? false);

      const qRes = await axios.get('/api/deletion-queue');
      setQueues(prev => {
        const newQueues: Record<string, MediaItem[]> = {};
        for (const storageId in qRes.data) {
          newQueues[storageId] = qRes.data[storageId]
            .filter((item: MediaItem) => !deletedRef.current.has(item.type + '-' + item.tmdbId))
            .map((newItem: MediaItem) => {
              const oldItem = prev[storageId]?.find(i => i.tmdbId === newItem.tmdbId && i.type === newItem.type);
              if (oldItem?.deleting) {
                return { ...newItem, deleting: true };
              }
              return newItem;
            });
        }
        return newQueues;
      });

      const sRes = await axios.get('/api/settings');
      if (sRes.data.storages) {
        try {
          const parsed = JSON.parse(sRes.data.storages) as StorageConfig[];
          setStorageConfigs(parsed);
          setActiveTab(prev => (prev || (parsed.length > 0 ? parsed[0].id : '')));
        } catch (e) {
          console.error("Failed to parse storage configs:", e);
          setStorageConfigs([]);
          setActiveTab('');
        }
      } else {
        setStorageConfigs([]);
        setActiveTab('');
      }
      setServiceUrls({
        plexPublicUrl: sRes.data.plexPublicUrl || sRes.data.plexUrl || '',
        plexMachineId: sRes.data.plexMachineId || '',
        jellyfinPublicUrl: sRes.data.jellyfinPublicUrl || sRes.data.jellyfinUrl || '',
        radarrUrl: sRes.data.radarrUrl || '',
        sonarrUrl: sRes.data.sonarrUrl || '',
      });
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => { await fetchData(); };
    init();
    const interval = setInterval(() => { if (!disableAutoRefresh.current) fetchData(); }, 10000);
    return () => { clearInterval(interval); };
  }, [fetchData]);

  function removeItemFromQueues(item: MediaItem) {
    setQueues(prev => {
      const newQueues = { ...prev };
      newQueues[activeTab] = newQueues[activeTab].filter(i => !(i.tmdbId === item.tmdbId && i.type === item.type));
      return newQueues;
    });
  }

  async function excludeItem(item: MediaItem) {
    pendingOperations.current += 1;
    disableAutoRefresh.current = true;
    try {
      removeItemFromQueues(item);
      await axios.post('/api/exclusions', {
        tmdbId: item.tmdbId,
        title: item.title,
        type: item.type,
        posterUrl: item.posterUrl,
        lastSeenAt: item.lastSeenAt
      });
      deletedRef.current.add(item.type + '-' + item.tmdbId);
    } catch (err) {
      console.error(err);
    } finally {
      pendingOperations.current -= 1;
      if (pendingOperations.current === 0) {
        disableAutoRefresh.current = false;
        handleRefresh();
      }
    }
  }

  async function deleteItem(item: MediaItem) {
    setQueues(prev => {
      const newQueues = { ...prev };
      newQueues[activeTab] = newQueues[activeTab].map(i => (i.tmdbId === item.tmdbId && i.type === item.type) ? { ...i, deleting: true } : i);
      return newQueues;
    });
    pendingOperations.current += 1;
    disableAutoRefresh.current = true;
    try {
      await axios.post('/api/delete', {
        plexId: item.plexId,
        jellyfinId: item.jellyfinId,
        tmdbId: item.tmdbId,
        title: item.title,
        type: item.type,
        lastSeenAt: item.lastSeenAt,
        posterUrl: item.posterUrl,
        sizeOnDisk: item.sizeOnDisk
      });
      deletedRef.current.add(item.type + '-' + item.tmdbId);
    } catch (err) {
      console.error(err);
    } finally {
      pendingOperations.current -= 1;
      if (pendingOperations.current === 0) {
        disableAutoRefresh.current = false;
        handleRefresh();
      }
    }
  }

  async function handleRefresh() {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setRefreshing(true);
    try {
      await axios.post('/api/refresh');
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      isRefreshingRef.current = false;
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  if (storageConfigs.length === 0) {
    return (
      <div className="max-w-7xl mx-auto text-center py-20 text-slate-400">
        <p className="mb-4">No storages configured.</p>
        <p>Please head over to Settings to configure your Path Mappings and target free space limits.</p>
      </div>
    );
  }

  const activeConfig = storageConfigs.find(s => s.id === activeTab) || storageConfigs[0];
  const activeDisk = diskStatuses.find(d => d.storageId === activeConfig.id);
  const activeQueue = queues[activeConfig.id] || [];

  const targetFreeSpace = activeConfig?.targetFreeSpace || 100;
  const isExceeded = (activeDisk?.freeBytes ?? 0) < targetFreeSpace;

  // Annotate items with original rank before filtering/sorting
  const rankedQueue = activeQueue.map((item, idx) => ({ ...item, rank: idx + 1 }));

  const filteredQueue = rankedQueue
    .filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'rank') return sortOrder === 'asc' ? a.rank - b.rank : b.rank - a.rank;
      if (sortBy === 'title') {
        const cmp = a.title.localeCompare(b.title);
        return sortOrder === 'asc' ? cmp : -cmp;
      }
      if (sortBy === 'lastSeenAt') {
        const cmp = a.lastSeenAt - b.lastSeenAt;
        return sortOrder === 'asc' ? cmp : -cmp;
      }
      if (sortBy === 'size') {
        const cmp = a.sizeOnDisk - b.sizeOnDisk;
        return sortOrder === 'asc' ? cmp : -cmp;
      }
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(filteredQueue.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const paginatedQueue = filteredQueue.slice(startIndex, startIndex + pageSize);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-linear-to-r from-white to-slate-400 bg-clip-text text-transparent">Overview</h2>
          <p className="text-slate-400 mt-1">Monitor disk space and upcoming deletions per storage.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || backendSyncing}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all duration-300 border border-slate-700 flex items-center gap-2 hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(34,211,238,0.15)] disabled:opacity-50 w-fit"
        >
          <RefreshCw className={`w-4 h-4 ${(refreshing || backendSyncing) ? 'animate-spin text-cyan-400' : ''}`} />
          <span className="text-sm font-semibold">{backendSyncing && !refreshing ? 'Syncing...' : 'Sync Now'}</span>
        </button>
      </header>

      {/* Storage tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-slate-800 pb-2 custom-scrollbar">
        {storageConfigs.map(storage => (
          <button
            key={storage.id}
            onClick={() => {
              setActiveTab(storage.id);
              setCurrentPage(1);
              setSearchQuery('');
            }}
            className={`px-5 py-2.5 rounded-t-lg font-semibold text-sm transition-all whitespace-nowrap ${
              activeTab === storage.id
                ? 'bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-400'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            {storage.name}
          </button>
        ))}
      </div>

      {!activeDisk && (
        <div className="text-slate-500 p-8 text-center bg-slate-900 rounded-xl border border-slate-800">
          Failed to load disk status for this storage or no disk found yet. Ensure paths are correctly mapped.
        </div>
      )}

      {/* Disk widget */}
      {activeDisk && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
          <div className="col-span-1 md:col-span-2 bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-slate-700/50 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <HardDrive className="w-32 h-32" />
            </div>
            <div className="relative z-10 flex items-center justify-between mb-8">
              <h3 className="text-xl font-semibold text-slate-200">{activeConfig.name} Saturation</h3>
              <span className={`px-3 py-1 text-sm font-bold rounded-full ${isExceeded ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {isExceeded ? 'Critical' : 'Healthy'}
              </span>
            </div>
            <div className="relative z-10">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">{activeDisk.freeBytes.toFixed(2)} GB free</span>
              </div>
              <div className="h-4 w-full bg-slate-900 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${isExceeded ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.5)]'}`}
                  style={{ width: `${Math.max(targetFreeSpace - activeDisk.freeBytes, 0)}%` }}
                />
              </div>
              <div className="mt-4 flex items-center justify-end gap-2 text-slate-300">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <span>Target limit: <span className="font-mono font-bold">{targetFreeSpace} GB</span></span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-slate-700/50 shadow-xl flex flex-col justify-center items-center text-center">
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
              <span className="text-2xl font-bold text-cyan-400">{activeQueue.length}</span>
            </div>
            <h3 className="font-semibold text-slate-200">Pending Deletions</h3>
            <p className="text-sm text-slate-400 mt-2">Oldest medias queued for removal on this storage when limit is reached.</p>
          </div>
        </div>
      )}

      {/* Queue */}
      {activeConfig && (
        <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-slate-700/50 shadow-xl flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              Deletion Queue
              <span className="text-xs font-normal px-2 py-1 bg-slate-900 rounded-md text-slate-400">Total: {filteredQueue.length}</span>
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
                placeholder="Search media..."
              />
              <PageSizeSelect value={pageSize} onChange={(v) => { setPageSize(v); setCurrentPage(1); }} />
            </div>
          </div>

          {filteredQueue.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {activeQueue.length === 0
                ? "No media items identified for this storage block. Ensure Jellyfin/Plex is configured properly and paths match."
                : "No media items match your search."}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {paginatedQueue.map((item) => (
                  <MediaCard
                    key={item.type + '-' + item.tmdbId}
                    posterUrl={item.posterUrl}
                    title={item.title}
                    loading={item.deleting}
                    containerClass="border-slate-800 hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                    imageClass={`group-hover:scale-105 ${item.deleting ? 'opacity-30' : ''}`}
                    topLeft={
                      <span className="px-2 py-1 bg-black/60 backdrop-blur-md rounded text-xs font-mono font-bold text-cyan-400">
                        #{item.rank}
                      </span>
                    }
                    topRight={
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 items-end">
                        <div className="flex gap-1">
                          {item.plexId && serviceUrls.plexMachineId && serviceUrls.plexPublicUrl && (
                            <a href={`${serviceUrls.plexPublicUrl}/web/index.html#!/server/${serviceUrls.plexMachineId}/details?key=%2Flibrary%2Fmetadata%2F${item.plexId}`}
                              target="_blank" rel="noopener noreferrer" title="Open in Plex"
                              className="px-2 py-1 bg-orange-500/80 hover:bg-orange-500 text-white rounded text-[10px] font-bold backdrop-blur-sm transition-colors"
                              onClick={e => e.stopPropagation()}>Plex</a>
                          )}
                          {item.jellyfinId && serviceUrls.jellyfinPublicUrl && (
                            <a href={`${serviceUrls.jellyfinPublicUrl}/web/index.html#!/details?id=${item.jellyfinId}`}
                              target="_blank" rel="noopener noreferrer" title="Open in Jellyfin"
                              className="px-2 py-1 bg-blue-500/80 hover:bg-blue-500 text-white rounded text-[10px] font-bold backdrop-blur-sm transition-colors"
                              onClick={e => e.stopPropagation()}>Jelly</a>
                          )}
                          {item.type === 'movie' && item.radarrId && serviceUrls.radarrUrl && (
                            <a href={`${serviceUrls.radarrUrl}/movie/${item.radarrId}`}
                              target="_blank" rel="noopener noreferrer" title="Open in Radarr"
                              className="px-2 py-1 bg-yellow-600/80 hover:bg-yellow-600 text-white rounded text-[10px] font-bold backdrop-blur-sm transition-colors"
                              onClick={e => e.stopPropagation()}>Radarr</a>
                          )}
                          {item.type === 'show' && item.sonarrId && serviceUrls.sonarrUrl && (
                            <a href={`${serviceUrls.sonarrUrl}/series/${item.sonarrId}`}
                              target="_blank" rel="noopener noreferrer" title="Open in Sonarr"
                              className="px-2 py-1 bg-teal-600/80 hover:bg-teal-600 text-white rounded text-[10px] font-bold backdrop-blur-sm transition-colors"
                              onClick={e => e.stopPropagation()}>Sonarr</a>
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => excludeItem(item)} title="Exclude from deletion"
                            className="p-2 bg-orange-500/80 hover:bg-orange-500 text-white rounded-lg backdrop-blur-sm transition-colors shadow-lg">
                            <ShieldBan className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteItem(item)} title="Delete item"
                            className={`p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg backdrop-blur-sm transition-colors shadow-lg ${item.deleting ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                            {item.deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    }
                    info={
                      <div className="translate-y-2 group-hover:translate-y-0 transition-transform">
                        <h4 className="font-bold text-sm text-balance line-clamp-2 leading-tight drop-shadow-md">{item.title}</h4>
                        <p className="text-xs text-slate-400 font-mono mt-1">Seen: {new Date(item.lastSeenAt).toLocaleDateString()}</p>
                        {item.deletionCount != null && item.deletionCount > 0 && item.deltaDays != null && item.deltaDays > 0 && (
                          <p className="text-xs text-amber-400 font-mono mt-0.5">+{item.deletionCount * item.deltaDays}d postponed</p>
                        )}
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-700/80 ${item.type === 'movie' ? 'text-blue-300' : 'text-purple-300'}`}>{item.type}</span>
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-700/80 ${item.sizeOnDisk !== 0 ? 'text-green-300' : 'text-red-300'}`}>{(item.sizeOnDisk / 1e9).toFixed(2)} GB</span>
                          {item.plexId && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-600/70 text-white">P</span>}
                          {item.jellyfinId && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600/70 text-white">J</span>}
                        </div>
                      </div>
                    }
                  />
                ))}
              </div>

              <Pagination
                currentPage={validPage}
                totalPages={totalPages}
                totalItems={filteredQueue.length}
                pageSize={pageSize}
                startIndex={startIndex}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
