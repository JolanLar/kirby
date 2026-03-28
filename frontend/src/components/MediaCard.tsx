import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface MediaCardProps {
  posterUrl: string | null;
  title: string;
  loading?: boolean;
  containerClass?: string;
  imageClass?: string;
  topLeft?: ReactNode;
  topRight?: ReactNode;
  hoverOverlay?: ReactNode;
  info: ReactNode;
}

export default function MediaCard({
  posterUrl,
  title,
  loading,
  containerClass = '',
  imageClass = '',
  topLeft,
  topRight,
  hoverOverlay,
  info,
}: MediaCardProps) {
  return (
    <div className={`group relative bg-slate-900 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 border ${containerClass}`}>
      <div className="aspect-2/3 w-full relative overflow-hidden bg-slate-800">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            className={`w-full h-full object-cover transition-all duration-500 ${imageClass}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 text-center">
            <span className="text-slate-600 text-sm font-medium">{title}</span>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
          </div>
        )}

        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent opacity-90" />

        {topLeft && (
          <div className="absolute top-2 left-2 flex gap-1">{topLeft}</div>
        )}
        {topRight && (
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">{topRight}</div>
        )}

        {hoverOverlay && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm">
            {hoverOverlay}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-3">
          {info}
        </div>
      </div>
    </div>
  );
}
