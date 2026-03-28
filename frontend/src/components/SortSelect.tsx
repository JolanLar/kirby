import { ArrowUpDown } from 'lucide-react';

export interface SortOption {
  value: string;
  label: string;
}

interface SortSelectProps {
  value: string;
  options: SortOption[];
  onChange: (value: string) => void;
  sortOrder?: 'asc' | 'desc';
  onSortOrderToggle?: () => void;
}

export default function SortSelect({ value, options, onChange, sortOrder, onSortOrderToggle }: SortSelectProps) {
  return (
    <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2">
      <ArrowUpDown className="w-4 h-4 text-slate-400" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm text-slate-300 focus:outline-none cursor-pointer"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {sortOrder !== undefined && onSortOrderToggle && (
        <>
          <div className="w-px h-4 bg-slate-700 mx-1" />
          <button
            onClick={onSortOrderToggle}
            className="text-xs font-bold text-slate-400 hover:text-slate-200 w-8"
          >
            {sortOrder.toUpperCase()}
          </button>
        </>
      )}
    </div>
  );
}
