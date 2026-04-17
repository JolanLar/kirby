import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
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

function MediaCard({
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
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [shouldRenderImage, setShouldRenderImage] = useState(() => !posterUrl);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setShouldRenderImage(!posterUrl);
    setImageLoaded(false);
    setImageFailed(false);
  }, [posterUrl]);

  useEffect(() => {
    if (!posterUrl || shouldRenderImage) return;

    if (typeof IntersectionObserver === 'undefined') {
      setShouldRenderImage(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRenderImage(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px 0px' },
    );

    if (shellRef.current) observer.observe(shellRef.current);

    return () => observer.disconnect();
  }, [posterUrl, shouldRenderImage]);

  return (
    <div ref={shellRef} className={`media-card-shell group relative bg-slate-900 rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 border transform-gpu ${containerClass}`}>
      <div className="media-card-poster-frame aspect-2/3 w-full relative overflow-hidden bg-slate-800">
        {posterUrl && shouldRenderImage && !imageFailed ? (
          <img
            src={posterUrl}
            alt={title}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1280px) 18vw, 220px"
            draggable={false}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageFailed(true)}
            className={`media-card-image w-full h-full object-cover transition-all duration-300 transform-gpu ${imageLoaded ? 'opacity-100' : 'opacity-0'} ${imageClass}`}
          />
        ) : posterUrl && !imageFailed ? (
          <div className="media-card-placeholder absolute inset-0 animate-pulse bg-linear-to-br from-slate-800 via-slate-700/60 to-slate-800" />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 text-center">
            <span className="text-slate-600 text-sm font-medium">{title}</span>
          </div>
        )}

        {posterUrl && shouldRenderImage && !imageLoaded && !imageFailed && (
          <div className="media-card-placeholder absolute inset-0 animate-pulse bg-linear-to-br from-slate-800 via-slate-700/60 to-slate-800" />
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
          </div>
        )}

        <div className="media-card-gradient absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent opacity-90" />

        {topLeft && (
          <div className="absolute top-2 left-2 flex gap-1">{topLeft}</div>
        )}
        {topRight && (
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">{topRight}</div>
        )}

        {hoverOverlay && (
          <div className="media-card-hover-overlay absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm">
            {hoverOverlay}
          </div>
        )}

        <div className="media-card-info absolute bottom-0 left-0 right-0 p-3">
          {info}
        </div>
      </div>
    </div>
  );
}

export default memo(MediaCard);
