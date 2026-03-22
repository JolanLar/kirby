import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Settings as SettingsIcon, Save, Server, Shield, HardDrive, CheckCircle2, XCircle, Loader2, Trash } from 'lucide-react';

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
  className
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
      <label className="text-sm font-medium text-slate-400">{label}</label>
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
        className="px-4 py-2.5 bg-slate-900 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all font-mono text-sm placeholder:text-slate-600 w-full"
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
    autoExcludeThreshold: '0'
  });

  const [storages, setStorages] = useState<StorageConfig[]>([]);
  const [plexPaths, setPlexPaths] = useState<string[]>([]);
  const [jellyfinPaths, setJellyfinPaths] = useState<string[]>([]);
  const [sonarrPaths, setSonarrPaths] = useState<string[]>([]);
  const [radarrPaths, setRadarrPaths] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'testing' | 'success' | 'failed'>>({});

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const dataPromises = [
        axios.get('/api/settings'),
        axios.get('/api/paths/plex').catch(() => ({ data: [] })),
        axios.get('/api/paths/jellyfin').catch(() => ({ data: [] })),
        axios.get('/api/paths/sonarr').catch(() => ({ data: [] })),
        axios.get('/api/paths/radarr').catch(() => ({ data: [] }))
      ];
      
      const [resSettings, resPlex, resJellyfin, resSonarr, resRadarr] = await Promise.all(dataPromises);

      const data = resSettings.data;
      if (data.storages) {
        try {
          setStorages(JSON.parse(data.storages));
        } catch { /* ignore */ }
      }
      setSettings(prev => ({ ...prev, ...data }));

      setPlexPaths(resPlex.data || []);
      setJellyfinPaths(resJellyfin.data || []);
      setSonarrPaths(resSonarr.data || []);
      setRadarrPaths(resRadarr.data || []);
    } catch (err) {
      console.error(err);
    }
  }

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
  }

  async function handleSave() {
    setSaving(true);
    try {
      await axios.post('/api/settings', {
        ...settings,
        storages: JSON.stringify(storages)
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
            />
          </div>
          <p className="text-xs text-slate-400 mt-3 hover:text-slate-300">
            Automatically exclude media items that have been deleted across time by this amount. Enter 0 to disable.
          </p>
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
               <InputGroup label="Plex Token" name="plexToken" value={settings.plexToken} onChange={handleChange} type="password" />
               <InputGroup label="Plex Public URL" name="plexPublicUrl" value={settings.plexPublicUrl} onChange={handleChange} placeholder="http://[IP_ADDRESS]" />
               <TestButton service="plex" status={testStatus['plex'] || 'idle'} onTest={handleTest} />
            </div>
            <div className="space-y-4">
               <h4 className="font-medium text-slate-300 border-b border-slate-700 pb-2">Jellyfin Integration</h4>
               <InputGroup label="Jellyfin URL" name="jellyfinUrl" value={settings.jellyfinUrl} onChange={handleChange} placeholder="http://192.168.50.1:8096" />
               <InputGroup label="Jellyfin API Key" name="jellyfinApiKey" value={settings.jellyfinApiKey} onChange={handleChange} type="password" />
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
               <InputGroup label="Sonarr API Key" name="sonarrApiKey" value={settings.sonarrApiKey} onChange={handleChange} type="password" />
               <TestButton service="sonarr" status={testStatus['sonarr'] || 'idle'} onTest={handleTest} />
            </div>
            
            <div className="space-y-4">
               <h4 className="font-medium text-slate-300 border-b border-slate-700 pb-2">Radarr (Movies)</h4>
               <InputGroup label="Radarr URL" name="radarrUrl" value={settings.radarrUrl} onChange={handleChange} placeholder="http://192.168.1.100:7878" />
               <InputGroup label="Radarr API Key" name="radarrApiKey" value={settings.radarrApiKey} onChange={handleChange} type="password" />
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

      </div>
    </div>
  );
}
