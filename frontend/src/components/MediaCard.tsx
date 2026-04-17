import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { EllipsisVertical, Loader2 } from 'lucide-react';

export interface MediaCardMobileAction {
  key: string;
  label: string;
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
  toneClassName?: string;
}

interface MediaCardProps {
  posterUrl: string | null;
  title: string;
  loading?: boolean;
  containerClass?: string;
  imageClass?: string;
  topLeft?: ReactNode;
  topRight?: ReactNode;
  hoverOverlay?: ReactNode;
  mobileActions?: MediaCardMobileAction[];
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
  mobileActions,
  info,
}: MediaCardProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const [shouldRenderImage, setShouldRenderImage] = useState(() => !posterUrl);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setShouldRenderImage(!posterUrl);
    setImageLoaded(false);
    setImageFailed(false);
    setMobileMenuOpen(false);
  }, [posterUrl]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!mobileMenuRef.current?.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [mobileMenuOpen]);

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
          <div className="media-card-top-right absolute top-2 right-2 flex flex-col gap-1 items-end">{topRight}</div>
        )}

        {mobileActions && mobileActions.length > 0 && (
          <div ref={mobileMenuRef} className="media-card-mobile-menu absolute top-2 right-2 z-30">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setMobileMenuOpen((open) => !open);
              }}
              className="media-card-mobile-menu-trigger flex items-center justify-center rounded-lg bg-slate-950/90 text-slate-100 shadow-lg"
              aria-label="Open actions"
              aria-expanded={mobileMenuOpen}
            >
              <EllipsisVertical className="w-4 h-4" />
            </button>

            {mobileMenuOpen && (
              <div className="media-card-mobile-menu-panel mt-2 min-w-36 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/95 shadow-2xl backdrop-blur-sm">
                {mobileActions.map((action) =>
                  action.href ? (
                    <a
                      key={action.key}
                      href={action.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => {
                        event.stopPropagation();
                        setMobileMenuOpen(false);
                      }}
                      className={`block px-3 py-2.5 text-sm font-medium transition-colors hover:bg-slate-800 ${action.toneClassName || 'text-slate-100'}`}
                    >
                      {action.label}
                    </a>
                  ) : (
                    <button
                      key={action.key}
                      type="button"
                      disabled={action.disabled}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (action.disabled) return;
                        action.onSelect?.();
                        setMobileMenuOpen(false);
                      }}
                      className={`flex w-full items-center px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-slate-800 disabled:opacity-50 ${action.toneClassName || 'text-slate-100'}`}
                    >
                      {action.label}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        )}

        {hoverOverlay && (
          <div className="media-card-hover-overlay absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
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
