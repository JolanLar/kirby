import { ListFilter } from 'lucide-react';

interface PageSizeSelectProps {
  value: number;
  onChange: (size: number) => void;
}

export default function PageSizeSelect({ value, onChange }: PageSizeSelectProps) {
  return (
    <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2">
      <ListFilter className="w-4 h-4 text-slate-400" />
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-transparent text-sm text-slate-300 focus:outline-none cursor-pointer"
      >
        <option value={24}>24 per page</option>
        <option value={48}>48 per page</option>
        <option value={96}>96 per page</option>
        <option value={999999}>All</option>
      </select>
    </div>
  );
}
