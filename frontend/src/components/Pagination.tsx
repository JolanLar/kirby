import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  startIndex: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, totalItems, pageSize, startIndex, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  const btnClass = 'p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
  return (
    <div className="flex items-center justify-between border-t border-slate-800/50 pt-4 mt-6">
      <div className="text-sm text-slate-400">
        Showing <span className="font-semibold text-slate-300">{startIndex + 1}</span> to{' '}
        <span className="font-semibold text-slate-300">{Math.min(startIndex + pageSize, totalItems)}</span> of{' '}
        <span className="font-semibold text-slate-300">{totalItems}</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onPageChange(1)} disabled={currentPage === 1} className={btnClass}>
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className={btnClass}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="px-4 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-medium text-slate-300">
          Page {currentPage} of {totalPages}
        </div>
        <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className={btnClass}>
          <ChevronRight className="w-4 h-4" />
        </button>
        <button onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className={btnClass}>
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
