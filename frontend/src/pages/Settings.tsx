import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Settings as SettingsIcon, Save, Server, Shield, HardDrive, CheckCircle2, XCircle, Loader2, Trash, HelpCircle, ExternalLink, Heart, ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Tooltip = ({ text }: { text: string }) => (
  <div className="group relative inline-flex items-center">
    <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-help transition-colors" />
    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-700 border border-slate-600 rounded-lg text-xs text-slate-300 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 leading-relaxed whitespace-pre-line">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700" />
    </div>
  </div>
);

const InputGroup = ({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  list,
  options,
  onFocus,
  className,
  helpUrl,
  tooltip,
  disabled
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  list?: string;
  options?: string[];
  onFocus?: () => void;
  className?: string;
  helpUrl?: string;
  tooltip?: string;
  disabled?: boolean;
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`flex flex-col gap-1.5 relative ${className}`} ref={containerRef}>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-slate-400">{label}</label>
        {tooltip && <Tooltip text={tooltip} />}
        {helpUrl && (
          <a
            href={helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-cyan-400 transition-colors"
            title="How to find this?"
          >
            <HelpCircle className="w-4 h-4" />
          </a>
        )}
      </div>
      <input 
        type={type} 
        name={name} 
        value={value} 
        onChange={onChange} 
        placeholder={placeholder}
        onFocus={() => {
          setShowDropdown(true);
          onFocus?.();
        }}
        autoComplete="off"
        className={`px-4 py-2.5 bg-slate-900 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all font-mono text-sm placeholder:text-slate-600 w-full ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={disabled}
      />
      {list && options && showDropdown && options.length > 0 && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-48 overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {options.map((opt, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-400 transition-colors font-mono truncate border-b border-slate-700 last:border-0"
              onClick={() => {
                const event = {
                  target: { name, value: opt }
                } as React.ChangeEvent<HTMLInputElement>;
                onChange(event);
                setShowDropdown(false);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const TestButton = ({ 
  service, 
  status, 
  onTest 
}: { 
  service: string; 
  status: 'idle' | 'testing' | 'success' | 'failed'; 
  onTest: (service: string) => void; 
}) => {
  return (
    <button
      onClick={() => onTest(service)}
      disabled={status === 'testing'}
      className="mt-3 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-600 flex items-center gap-2 w-fit disabled:opacity-50"
    >
      {status === 'idle' && 'Test Connection'}
      {status === 'testing' && <><Loader2 className="w-3 h-3 animate-spin"/> Testing...</>}
      {status === 'success' && <><CheckCircle2 className="w-3 h-3 text-emerald-400"/> OK</>}
      {status === 'failed' && <><XCircle className="w-3 h-3 text-red-400"/> Failed</>}
    </button>
  );
};

export default function Settings() {
  interface StorageConfig {
    id: string;
    name: string;
    plexPath: string;
    jellyfinPath?: string;
    sonarrPath?: string;
    radarrPath?: string;
    targetFreeSpace: number;
  }

  const [settings, setSettings] = useState<Record<string, string>>({
    plexUrl: '', plexToken: '', plexPublicUrl: '',
    jellyfinUrl: '', jellyfinApiKey: '', jellyfinPublicUrl: '',
    sonarrUrl: '', sonarrApiKey: '',
    radarrUrl: '', radarrApiKey: '',
    qbUrl: '', qbUser: '', qbPass: '',
    autoExcludeThreshold: '0',
    deletionDeltaDays: '0',
    excludeFavorites: 'false',
    excludeFavoritesAllUsers: 'true',
    excludeFavoritesUsers: '[]',
  });

  // Dual-column user picker state
  const [ignoredUsers, setIgnoredUsers] = useState<string[]>([]); // left column
  const [excludedUsers, setExcludedUsers] = useState<string[]>([]); // right column
  const [selectedLeft, setSelectedLeft] = useState<string[]>([]);
  const [selectedRight, setSelectedRight] = useState<string[]>([]);

  const [storages, setStorages] = useState<StorageConfig[]>([]);
  const [plexPaths, setPlexPaths] = useState<string[]>([]);
  const [jellyfinPaths, setJellyfinPaths] = useState<string[]>([]);
  const [sonarrPaths, setSonarrPaths] = useState<string[]>([]);
  const [radarrPaths, setRadarrPaths] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'testing' | 'success' | 'failed'>>({});
  const [plexAuthLoading, setPlexAuthLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);

  const { username: currentUsername, refresh: refreshAuth } = useAuth();
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [credsSaving, setCredsSaving] = useState(false);
  const [credsMsg, setCredsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [oauthTestStatus, setOauthTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [oauthTestMsg, setOauthTestMsg] = useState('');

  useEffect(() => {
    function syncUserColumns(allUsers: string[], savedExcluded: string[]) {
      setExcludedUsers(savedExcluded.filter(u => allUsers.includes(u)));
      setIgnoredUsers(allUsers.filter(u => !savedExcluded.includes(u)));
    }

    async function fetchData() {
      try {
        const dataPromises = [
          axios.get('/api/settings'),
          axios.get('/api/paths/plex').catch(() => ({ data: [] })),
          axios.get('/api/paths/jellyfin').catch(() => ({ data: [] })),
          axios.get('/api/paths/sonarr').catch(() => ({ data: [] })),
          axios.get('/api/paths/radarr').catch(() => ({ data: [] })),
          axios.get('/api/favorites/users').catch(() => ({ data: [] })),
        ];
        
        const [resSettings, resPlex, resJellyfin, resSonarr, resRadarr, resUsers] = await Promise.all(dataPromises);

        const data = resSettings.data;
        if (data.storages) {
          try { setStorages(JSON.parse(data.storages)); } catch { /* ignore */ }
        }
        setSettings(prev => ({ ...prev, ...data }));

        setPlexPaths(resPlex.data || []);
        setJellyfinPaths(resJellyfin.data || []);
        setSonarrPaths(resSonarr.data || []);
        setRadarrPaths(resRadarr.data || []);

        const users: string[] = resUsers.data || [];
        let savedExcluded: string[] = [];
        try { savedExcluded = JSON.parse(data.excludeFavoritesUsers || '[]'); } catch { savedExcluded = []; }
        syncUserColumns(users, savedExcluded);
      } catch (err) {
        console.error(err);
      }
    }

    fetchData();
  }, []);

  // Refresh possible paths for a service
  async function refreshPaths(service: string) {
    try {
      let params: Record<string, string> = {};
      if (service === 'plex') params = { url: settings.plexUrl, token: settings.plexToken };
      if (service === 'jellyfin') params = { url: settings.jellyfinUrl, apiKey: settings.jellyfinApiKey };
      if (service === 'sonarr') params = { url: settings.sonarrUrl, apiKey: settings.sonarrApiKey };
      if (service === 'radarr') params = { url: settings.radarrUrl, apiKey: settings.radarrApiKey };

      const res = await axios.get(`/api/paths/${service}`, { params });
      if (service === 'plex') setPlexPaths(res.data);
      if (service === 'jellyfin') setJellyfinPaths(res.data);
      if (service === 'sonarr') setSonarrPaths(res.data);
      if (service === 'radarr') setRadarrPaths(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSettings({ ...settings, [e.target.name]: e.target.value });
    setTestStatus({});
    if (e.target.name.startsWith('oauth')) setOauthTestStatus('idle');
  }

  async function handleSave() {
    setSaving(true);
    try {
      await axios.post('/api/settings', {
        ...settings,
        storages: JSON.stringify(storages),
        excludeFavoritesUsers: JSON.stringify(excludedUsers),
      });
      setMsg('Settings saved successfully!');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      console.error(err);
      setMsg('Error saving settings.');
    } finally {
      setSaving(false);
    }
  }

  async function refreshFavoriteUsers() {
    setUsersLoading(true);
    try {
      const res = await axios.get('/api/favorites/users');
      const users: string[] = res.data || [];
      // New users always go to left (ignored) column
      setIgnoredUsers(prev => {
        const newUsers = users.filter(u => !excludedUsers.includes(u) && !prev.includes(u));
        return [...prev.filter(u => users.includes(u)), ...newUsers];
      });
      setExcludedUsers(prev => prev.filter(u => users.includes(u)));
    } catch (err) {
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  }

  // Dual-column transfers
  function moveToRight(all = false) {
    const toMove = all ? ignoredUsers : selectedLeft;
    setExcludedUsers(prev => [...prev, ...toMove.filter(u => !prev.includes(u))]);
    setIgnoredUsers(prev => prev.filter(u => !toMove.includes(u)));
    setSelectedLeft([]);
  }
  function moveToLeft(all = false) {
    const toMove = all ? excludedUsers : selectedRight;
    setIgnoredUsers(prev => [...prev, ...toMove.filter(u => !prev.includes(u))]);
    setExcludedUsers(prev => prev.filter(u => !toMove.includes(u)));
    setSelectedRight([]);
  }
  function toggleColSelection(col: 'left' | 'right', user: string, e: React.MouseEvent) {
    const setter = col === 'left' ? setSelectedLeft : setSelectedRight;
    const list = col === 'left' ? selectedLeft : selectedRight;
    if (e.ctrlKey || e.metaKey) {
      setter(list.includes(user) ? list.filter(u => u !== user) : [...list, user]);
    } else {
      setter(list.includes(user) && list.length === 1 ? [] : [user]);
    }
  }

  async function handleTest(service: string) {
    setTestStatus(prev => ({ ...prev, [service]: 'testing' }));
    
    let config: Record<string, string> = {};
    if (service === 'plex') config = { url: settings.plexUrl, token: settings.plexToken };
    if (service === 'jellyfin') config = { url: settings.jellyfinUrl, apiKey: settings.jellyfinApiKey };
    if (service === 'sonarr') config = { url: settings.sonarrUrl, apiKey: settings.sonarrApiKey };
    if (service === 'radarr') config = { url: settings.radarrUrl, apiKey: settings.radarrApiKey };
    if (service === 'qbittorrent') config = { url: settings.qbUrl, user: settings.qbUser, pass: settings.qbPass };

    try {
      const res = await axios.post('/api/test-connection', { service, config });
      if (res.data.success) {
        setTestStatus(prev => ({ ...prev, [service]: 'success' }));
      } else {
        setTestStatus(prev => ({ ...prev, [service]: 'failed' }));
      }
    } catch {
      setTestStatus(prev => ({ ...prev, [service]: 'failed' }));
    }
  }

  async function handlePlexLogin() {
    setPlexAuthLoading(true);
    try {
      const pinRes = await axios.get('/api/plex/auth/pin');
      const { id, code } = pinRes.data;

      const authUrl = `https://app.plex.tv/auth/#!?clientID=Kirby-Media-Manager-Auth&code=${code}&context[device][product]=Kirby&context[device][platform]=Web&context[device][device]=Kirby%20Web`;
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(authUrl, 'Plex Auth', `width=${width},height=${height},left=${left},top=${top}`);

      const pollInterval = setInterval(async () => {
        try {
          const tokenRes = await axios.get(`/api/plex/auth/token/${id}`);
          if (tokenRes.data.token) {
            const token = tokenRes.data.token;
            clearInterval(pollInterval);
            setSettings(prev => ({ ...prev, plexToken: token }));
            
            // Fetch resources
            try {
              await axios.get(`/api/plex/auth/resources?token=${token}`);
            } catch (err) {
              console.error('[Plex] Resource fetch failed:', err);
            }

            setPlexAuthLoading(false);
            if (popup) popup.close();
            setMsg('Plex authenticated! Please select your server.');
            setTimeout(() => setMsg(''), 5000);
          }
        } catch (err) {
          console.error('[Plex] Polling error:', err);
        }
      }, 2000);

      // Stop polling after 10 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setPlexAuthLoading(false);
      }, 10 * 60 * 1000);

    } catch (err) {
      console.error('[Plex] Login failed:', err);
      setPlexAuthLoading(false);
    }
  }

  async function handleOAuthTest() {
    setOauthTestStatus('testing');
    setOauthTestMsg('');
    try {
      const params = new URLSearchParams();
      if (settings.oauthIssuerUrl) params.set('issuerUrl', settings.oauthIssuerUrl);
      if (settings.oauthClientId) params.set('clientId', settings.oauthClientId);
      const { data } = await axios.get(`/api/auth/oauth/test?${params}`);
      if (data.ok) {
        setOauthTestStatus('ok');
        setOauthTestMsg(`Connected — Issuer: ${data.issuer}\nCallback URL: ${data.redirectUri}`);
      } else {
        setOauthTestStatus('error');
        setOauthTestMsg(data.error);
      }
    } catch (err) {
      setOauthTestStatus('error');
      setOauthTestMsg(axios.isAxiosError(err) ? (err.response?.data?.error ?? err.message) : String(err));
    }
  }

  async function handleCredentialsSave() {
    if (!newUsername && !newPassword) return;
    if (newPassword && newPassword !== confirmPassword) {
      setCredsMsg({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    setCredsSaving(true);
    setCredsMsg(null);
    try {
      await axios.post('/api/auth/credentials', {
        username: newUsername || currentUsername,
        password: newPassword,
      });
      setCredsMsg({ type: 'success', text: 'Credentials updated' });
      setNewPassword('');
      setConfirmPassword('');
      await refreshAuth();
    } catch (err) {
      setCredsMsg({ type: 'error', text: axios.isAxiosError(err) ? (err.response?.data?.error ?? 'Failed to update credentials') : 'Failed to update credentials' });
    } finally {
      setCredsSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 shadow-[0_0_30px_rgba(34,211,238,0.15)]">
            <SettingsIcon className="w-8 h-8 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-3xl font-bold bg-linear-to-r from-white to-slate-400 bg-clip-text text-transparent">Settings</h2>
            <p className="text-slate-400 mt-1">Configure your integrations and deletion thresholds.</p>
          </div>
        </div>
        
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Config'}
        </button>
      </header>
      
      {msg && (
        <div className="p-4 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-xl text-center font-medium animate-in fade-in">
          {msg}
        </div>
      )}

      <div className="grid gap-6">

        {/* Global Rules */}
        <section className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-slate-700/50 shadow-xl">
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-2 text-slate-200">
            <Shield className="w-5 h-5 text-indigo-400" /> 
            Global Automation Rules
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputGroup
              label="Auto-Exclude Deletion Threshold"
              name="autoExcludeThreshold"
              type="number"
              value={settings.autoExcludeThreshold || '0'}
              onChange={handleChange}
              placeholder="e.g. 3 (0 to disable)"
              tooltip="Automatically add media to the exclusion list after it has been deleted this many times. Prevents the same item from being repeatedly re-downloaded and deleted. Set to 0 to disable."
            />
            <InputGroup
              label="Deletion Delta Days"
              name="deletionDeltaDays"
              type="number"
              value={settings.deletionDeltaDays || '0'}
              onChange={handleChange}
              placeholder="e.g. 7 (0 to disable)"
              tooltip="Add this many days to a media's next eligible deletion date for each time it has previously been deleted. Gives recently-deleted items a grace period before being eligible again. Set to 0 to disable."
            />
          </div>
          <p className="text-xs text-slate-400 mt-3">Auto-Exclude: automatically exclude media deleted this many times. Deletion Delta: days added per deletion event to postpone re-deletion. Set to 0 to disable each.</p>

          {/* Favorite Exclusion */}
          <div className="mt-6 pt-6 border-t border-slate-700/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Heart className="w-5 h-5 text-pink-400" />
                <span className="font-semibold text-slate-200">Exclude Favorite Medias</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.excludeFavorites === 'true'}
                  onChange={e => setSettings(s => ({ ...s, excludeFavorites: e.target.checked ? 'true' : 'false' }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:ring-2 peer-focus:ring-pink-500/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:inset-s-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
              </label>
            </div>
            <p className="text-xs text-slate-400">Medias favorited by Plex or Jellyfin users will not be deleted. Manage exclusions on the Favorites page.</p>

            {settings.excludeFavorites === 'true' && (
              <div className="space-y-4 pl-2 border-l-2 border-pink-500/30">
                {/* All users toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300 font-medium">Apply to all users</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.excludeFavoritesAllUsers !== 'false'}
                      onChange={e => setSettings(s => ({ ...s, excludeFavoritesAllUsers: e.target.checked ? 'true' : 'false' }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:ring-2 peer-focus:ring-pink-500/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:inset-s-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
                  </label>
                </div>

                {/* Per-user dual column picker */}
                {settings.excludeFavoritesAllUsers === 'false' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Select which users' favorites exclude medias from deletion</span>
                      <button
                        type="button"
                        onClick={refreshFavoriteUsers}
                        disabled={usersLoading}
                        className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1 disabled:opacity-50"
                      >
                        {usersLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        Refresh Users
                      </button>
                    </div>

                    <div className="flex gap-3 items-stretch">
                      {/* Left column — Ignored */}
                      <div className="flex-1 flex flex-col">
                        <div className="text-xs font-semibold text-slate-400 mb-1.5 px-1">Ignored Users</div>
                        <div className="flex-1 min-h-[120px] bg-slate-900 border border-slate-700 rounded-lg overflow-y-auto">
                          {ignoredUsers.length === 0 ? (
                            <p className="text-xs text-slate-600 text-center p-4">No ignored users</p>
                          ) : (
                            ignoredUsers.map(u => (
                              <button
                                key={u}
                                type="button"
                                onClick={(e) => toggleColSelection('left', u, e)}
                                className={`w-full text-left px-3 py-2 text-sm transition-colors border-b border-slate-800 last:border-0 ${
                                  selectedLeft.includes(u)
                                    ? 'bg-pink-500/20 text-pink-300'
                                    : 'text-slate-300 hover:bg-slate-800'
                                }`}
                              >
                                {u}
                              </button>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Transfer buttons */}
                      <div className="flex flex-col justify-center gap-1">
                        <button type="button" onClick={() => moveToRight(false)} disabled={selectedLeft.length === 0}
                          title="Move selected →"
                          className="p-1.5 rounded bg-slate-700 hover:bg-pink-500/30 text-slate-300 hover:text-pink-300 disabled:opacity-30 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => moveToRight(true)} disabled={ignoredUsers.length === 0}
                          title="Move all →"
                          className="p-1.5 rounded bg-slate-700 hover:bg-pink-500/30 text-slate-300 hover:text-pink-300 disabled:opacity-30 transition-colors">
                          <ChevronsRight className="w-4 h-4" />
                        </button>
                        <div className="h-2" />
                        <button type="button" onClick={() => moveToLeft(false)} disabled={selectedRight.length === 0}
                          title="← Move selected"
                          className="p-1.5 rounded bg-slate-700 hover:bg-slate-500/30 text-slate-300 hover:text-slate-200 disabled:opacity-30 transition-colors">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => moveToLeft(true)} disabled={excludedUsers.length === 0}
                          title="← Move all"
                          className="p-1.5 rounded bg-slate-700 hover:bg-slate-500/30 text-slate-300 hover:text-slate-200 disabled:opacity-30 transition-colors">
                          <ChevronsLeft className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Right column — Excluded */}
                      <div className="flex-1 flex flex-col">
                        <div className="text-xs font-semibold text-pink-400 mb-1.5 px-1">Excluded Users</div>
                        <div className="flex-1 min-h-[120px] bg-slate-900 border border-pink-500/30 rounded-lg overflow-y-auto">
                          {excludedUsers.length === 0 ? (
                            <p className="text-xs text-slate-600 text-center p-4">No excluded users</p>
                          ) : (
                            excludedUsers.map(u => (
                              <button
                                key={u}
                                type="button"
                                onClick={(e) => toggleColSelection('right', u, e)}
                                className={`w-full text-left px-3 py-2 text-sm transition-colors border-b border-slate-800 last:border-0 ${
                                  selectedRight.includes(u)
                                    ? 'bg-pink-500/20 text-pink-300'
                                    : 'text-slate-300 hover:bg-slate-800'
                                }`}
                              >
                                {u}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">New users default to the left (ignored) column. Ctrl+click for multi-select.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
        
        {/* Core Settings */}
        <section className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-slate-700/50 shadow-xl z-20">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold flex items-center gap-2 text-slate-200">
                <HardDrive className="w-5 h-5 text-cyan-400" /> 
                Storage Configuration
              </h3>
              <button 
                onClick={() => setStorages([...storages, { id: Date.now().toString(), name: 'New Storage', plexPath: '/', targetFreeSpace: 100 }])}
                className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm font-semibold hover:bg-cyan-500/30 transition-colors"
               >
                 + Add Storage
               </button>
           </div>
           
           <div className="space-y-6">
             {storages.length === 0 && <p className="text-slate-500 text-sm">No storages defined. Add one to track space and deletions.</p>}
             {storages.map((storage, idx) => (
               <div key={storage.id} className="p-4 bg-slate-900/50 rounded-xl border border-slate-700 relative">
                 <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                   <h4 className="font-semibold text-slate-300">Storage #{idx + 1}</h4>
                   <button 
                     onClick={() => setStorages(s => s.filter(x => x.id !== storage.id))}
                     className="text-red-400 hover:text-red-300 transition-colors"
                     title="Delete storage"
                   >
                     <Trash className="w-4 h-4" />
                   </button>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   <InputGroup 
                     label="Name" 
                     name={`name_${idx}`} 
                     value={storage.name} 
                     onChange={e => {
                       const newS = [...storages];
                       newS[idx].name = e.target.value;
                       setStorages(newS);
                     }}
                   />
                   <InputGroup 
                     label="Target Free Space (GB)" 
                     name={`targetFreeSpace_${idx}`} 
                     type="number"
                     value={(storage.targetFreeSpace ?? 0).toString()} 
                     onChange={e => {
                       const newS = [...storages];
                       newS[idx].targetFreeSpace = parseFloat(e.target.value) || 0;
                       setStorages(newS);
                     }}
                   />
                   <InputGroup 
                    className="z-999"
                     label="Plex Root Path" 
                     name={`plexPath_${idx}`} 
                     value={storage.plexPath} 
                     placeholder="/nas"
                     list={`plexPathsList_${idx}`}
                     options={plexPaths}
                     onChange={e => {
                       const newS = [...storages];
                       newS[idx].plexPath = e.target.value;
                       setStorages(newS);
                     }}
                     onFocus={() => refreshPaths('plex')}
                   />
                   <InputGroup 
                     label="Jellyfin Mapping Path (Optional)" 
                     name={`jellyfinPath_${idx}`} 
                     value={storage.jellyfinPath || ''} 
                     placeholder="/nas"
                     list={`jellyfinPathsList_${idx}`}
                     options={jellyfinPaths}
                     onChange={e => {
                       const newS = [...storages];
                       newS[idx].jellyfinPath = e.target.value;
                       setStorages(newS);
                     }}
                     onFocus={() => refreshPaths('jellyfin')}
                   />
                   <InputGroup 
                     label="Sonarr Mapping Path (Optional)" 
                     name={`sonarrPath_${idx}`} 
                     value={storage.sonarrPath || ''} 
                     placeholder="/nas"
                     list={`sonarrPathsList_${idx}`}
                     options={sonarrPaths}
                     onChange={e => {
                       const newS = [...storages];
                       newS[idx].sonarrPath = e.target.value;
                       setStorages(newS);
                     }}
                     onFocus={() => refreshPaths('sonarr')}
                   />
                   <InputGroup 
                     label="Radarr Mapping Path (Optional)" 
                     name={`radarrPath_${idx}`} 
                     value={storage.radarrPath || ''} 
                     placeholder="/nas"
                     list={`radarrPathsList_${idx}`}
                     options={radarrPaths}
                     onChange={e => {
                       const newS = [...storages];
                       newS[idx].radarrPath = e.target.value;
                       setStorages(newS);
                     }}
                     onFocus={() => refreshPaths('radarr')}
                   />
                 </div>
               </div>
             ))}
           </div>
        </section>

        {/* Media Providers */}
        <section className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-slate-700/50 shadow-xl z-10">
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-2 text-slate-200">
            <Server className="w-5 h-5 text-purple-400" /> 
            Media Providers
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
               <h4 className="font-medium text-slate-300 border-b border-slate-700 pb-2">Plex Integration</h4>
                <InputGroup label="Plex URL" name="plexUrl" value={settings.plexUrl} onChange={handleChange} placeholder="http://192.168.1.100:32400" />
                <div className="flex flex-col gap-2">
                  <InputGroup 
                    label="Plex Token" 
                    name="plexToken" 
                    value={settings.plexToken} 
                    onChange={handleChange} 
                    type="password" 
                    helpUrl="https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/"
                    disabled
                  />
                  <button
                    onClick={handlePlexLogin}
                    disabled={plexAuthLoading}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-semibold transition-all border border-slate-600 hover:border-cyan-500/50 group"
                  >
                    {plexAuthLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-cyan-400" />
                    )}
                    Login with Plex
                  </button>
                </div>
                <InputGroup label="Plex Public URL" name="plexPublicUrl" value={settings.plexPublicUrl} onChange={handleChange} placeholder="http://[IP_ADDRESS]" />
               <TestButton service="plex" status={testStatus['plex'] || 'idle'} onTest={handleTest} />
            </div>
            <div className="space-y-4">
               <h4 className="font-medium text-slate-300 border-b border-slate-700 pb-2">Jellyfin Integration</h4>
               <InputGroup label="Jellyfin URL" name="jellyfinUrl" value={settings.jellyfinUrl} onChange={handleChange} placeholder="http://192.168.50.1:8096" />
               <InputGroup
                  label="Jellyfin API Key"
                  name="jellyfinApiKey"
                  value={settings.jellyfinApiKey}
                  onChange={handleChange}
                  type="password"
                  tooltip="Found in Jellyfin Dashboard → Administration → API Keys. Click the + button to create a new key for Kirby."
                />
               <InputGroup label="Jellyfin Public URL" name="jellyfinPublicUrl" value={settings.jellyfinPublicUrl} onChange={handleChange} placeholder="http://[IP_ADDRESS]" />
               <TestButton service="jellyfin" status={testStatus['jellyfin'] || 'idle'} onTest={handleTest} />
            </div>
          </div>
        </section>

        {/* Download Clients */}
        <section className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-slate-700/50 shadow-xl">
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-2 text-slate-200">
            <Shield className="w-5 h-5 text-orange-400" /> 
            Download Clients
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-4">
               <h4 className="font-medium text-slate-300 border-b border-slate-700 pb-2">Sonarr (TV Shows)</h4>
               <InputGroup label="Sonarr URL" name="sonarrUrl" value={settings.sonarrUrl} onChange={handleChange} placeholder="http://192.168.1.100:8989" />
               <InputGroup label="Sonarr API Key" name="sonarrApiKey" value={settings.sonarrApiKey} onChange={handleChange} type="password" tooltip="Found in Sonarr → Settings → General → Security → API Key." />
               <TestButton service="sonarr" status={testStatus['sonarr'] || 'idle'} onTest={handleTest} />
            </div>
            
            <div className="space-y-4">
               <h4 className="font-medium text-slate-300 border-b border-slate-700 pb-2">Radarr (Movies)</h4>
               <InputGroup label="Radarr URL" name="radarrUrl" value={settings.radarrUrl} onChange={handleChange} placeholder="http://192.168.1.100:7878" />
               <InputGroup label="Radarr API Key" name="radarrApiKey" value={settings.radarrApiKey} onChange={handleChange} type="password" tooltip="Found in Radarr → Settings → General → Security → API Key." />
               <TestButton service="radarr" status={testStatus['radarr'] || 'idle'} onTest={handleTest} />
            </div>

            <div className="space-y-4">
               <h4 className="font-medium text-slate-300 border-b border-slate-700 pb-2">qBittorrent (5.1.4)</h4>
               <InputGroup label="qBittorrent URL" name="qbUrl" value={settings.qbUrl} onChange={handleChange} placeholder="http://192.168.1.100:8080" />
               <InputGroup label="Username" name="qbUser" value={settings.qbUser} onChange={handleChange} />
               <InputGroup label="Password" name="qbPass" value={settings.qbPass} onChange={handleChange} type="password" />
               <TestButton service="qbittorrent" status={testStatus['qbittorrent'] || 'idle'} onTest={handleTest} />
            </div>
          </div>
        </section>

        {/* OAuth / SSO */}
        <section className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-slate-700/50 shadow-xl">
          <h3 className="text-xl font-semibold mb-2 flex items-center gap-2 text-slate-200">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            SSO / OAuth2
          </h3>
          <p className="text-xs text-slate-400 mb-6">
            Compatible with Authentik, Keycloak, Auth0 and any OIDC provider.
            Register <span className="font-mono text-slate-300">{window.location.origin}/api/auth/oauth/callback</span> as the redirect URI in your provider.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputGroup
              label="Issuer URL"
              name="oauthIssuerUrl"
              value={settings.oauthIssuerUrl || ''}
              onChange={handleChange}
              placeholder="https://auth.example.com/application/o/kirby"
              tooltip={"The base URL of your OIDC provider. Kirby appends /.well-known/openid-configuration to fetch the discovery document.\n\nAuthentik: https://auth.example.com/application/o/<app-slug>\nKeycloak: https://keycloak.example.com/realms/<realm>\nAuth0: https://<tenant>.auth0.com\nAuthelia: https://auth.example.com"}
            />
            <InputGroup
              label="Client ID"
              name="oauthClientId"
              value={settings.oauthClientId || ''}
              onChange={handleChange}
              placeholder="kirby"
              tooltip="The client / application ID from your identity provider. Created when you register Kirby as an OAuth2 application."
            />
            <InputGroup
              label="Client Secret"
              name="oauthClientSecret"
              type="password"
              value={settings.oauthClientSecret || ''}
              onChange={handleChange}
              placeholder="••••••••••••"
              tooltip="The client secret generated by your identity provider. Required for confidential clients (most providers)."
            />
            <InputGroup
              label="Scopes"
              name="oauthScopes"
              value={settings.oauthScopes || 'openid profile email'}
              onChange={handleChange}
              placeholder="openid profile email"
              tooltip={"Space-separated OAuth2 scopes to request.\n\nopenid — required for OIDC\nprofile — provides preferred_username / name claims\nemail — provides email claim\n\nThese claims are used (in order) to derive the Kirby username."}
            />
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-400">Redirect URI override <span className="text-slate-600 font-normal">(optional)</span></label>
                <Tooltip text={"Leave empty — Kirby auto-derives the callback URL from the incoming request headers (including X-Forwarded-Proto / X-Forwarded-Host set by reverse proxies).\n\nOnly set this if auto-detection produces the wrong URL, e.g. behind a non-standard proxy configuration."} />
              </div>
              <input
                type="text"
                name="oauthRedirectUri"
                value={settings.oauthRedirectUri || ''}
                onChange={handleChange}
                placeholder={`${window.location.origin}/api/auth/oauth/callback`}
                autoComplete="off"
                className="px-4 py-2.5 bg-slate-900 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all font-mono text-sm placeholder:text-slate-600 w-full"
              />
              <p className="text-xs text-slate-500">Register this URL in your provider: <span className="font-mono text-slate-400">{window.location.origin}/api/auth/oauth/callback</span></p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={handleOAuthTest}
              disabled={oauthTestStatus === 'testing'}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-semibold transition-colors border border-slate-600 disabled:opacity-50 w-fit"
            >
              {oauthTestStatus === 'testing'
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing…</>
                : oauthTestStatus === 'ok'
                ? <><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Connected</>
                : oauthTestStatus === 'error'
                ? <><XCircle className="w-4 h-4 text-red-400" /> Failed</>
                : <><ShieldCheck className="w-4 h-4" /> Test Connection</>
              }
            </button>
            {oauthTestMsg && (
              <pre className={`text-xs font-mono p-3 rounded-lg whitespace-pre-wrap ${oauthTestStatus === 'ok' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'}`}>
                {oauthTestMsg}
              </pre>
            )}
          </div>
        </section>

        {/* Security */}
        <section className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-slate-700/50 shadow-xl">
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-2 text-slate-200">
            <KeyRound className="w-5 h-5 text-cyan-400" />
            Security
          </h3>

          {credsMsg && (
            <div className={`mb-4 p-3 rounded-lg text-sm text-center font-medium ${credsMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'}`}>
              {credsMsg.text}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputGroup
              label="Username"
              name="newUsername"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              placeholder={currentUsername || 'admin'}
            />
            <div />
            <InputGroup
              label="New Password"
              name="newPassword"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
            <InputGroup
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            onClick={handleCredentialsSave}
            disabled={credsSaving || (!newUsername && !newPassword)}
            className="mt-4 px-5 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 flex items-center gap-2"
          >
            {credsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Update Credentials
          </button>
        </section>

      </div>
    </div>
  );
}
