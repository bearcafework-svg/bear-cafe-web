import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Banner {
  id: string;
  image_url: string;
  title: string | null;
  link_url: string | null;
  description: string | null;
  button_text: string | null;
  button_url: string | null;
}

export function BannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBanners = async () => {
      const { data, error } = await supabase
        .from('banners')
        .select('id, image_url, title, link_url, description, button_text, button_url')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data) {
        setBanners(data);
      }
      setIsLoading(false);
    };

    fetchBanners();
  }, []);

  // Auto-slide every 7 seconds
  useEffect(() => {
    if (banners.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 7000);

    return () => clearInterval(interval);
  }, [banners.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  if (isLoading) {
    return (
      <div className="relative w-full aspect-[16/9] sm:aspect-[909/304] rounded-xl sm:rounded-2xl overflow-hidden bg-gradient-to-br from-peach/30 to-blush/30 dark:from-coffee/30 dark:to-mocha/30 animate-pulse">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl sm:text-4xl">🐻</span>
        </div>
      </div>
    );
  }

  if (banners.length === 0) {
    return (
      <div className="relative w-full aspect-[16/9] sm:aspect-[909/304] rounded-xl sm:rounded-2xl overflow-hidden bg-gradient-to-br from-peach/40 to-blush/40 dark:from-coffee/40 dark:to-mocha/40 border border-latte/30 dark:border-coffee/30">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span className="text-4xl sm:text-5xl">🐻☕</span>
          <p className="text-xs sm:text-sm text-muted-foreground">Bear Café</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[16/9] sm:aspect-[909/304] rounded-xl sm:rounded-2xl overflow-hidden group isolate">
      {/* Banner Images */}
      <div 
        className="flex transition-transform duration-500 ease-out h-full"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {banners.map((banner) => (
          <div
            key={banner.id}
            className="min-w-full h-full relative"
          >
            <img
              src={banner.image_url}
              alt={banner.title || 'Banner'}
              className="w-full h-full object-cover"
            />
            
            {/* Content overlay - positioned at bottom left */}
            {(banner.title || banner.description || banner.button_text) && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />
            )}
            
            {(banner.title || banner.description || banner.button_text) && (
              <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 md:bottom-6 md:left-6 md:right-auto md:max-w-[60%]">
                {banner.title && (
                  <h3 className="text-white font-bold text-sm sm:text-lg md:text-xl drop-shadow-lg mb-0.5 sm:mb-1 line-clamp-1">
                    {banner.title}
                  </h3>
                )}
                {banner.description && (
                  <p className="text-white/90 text-xs sm:text-sm md:text-base drop-shadow-md mb-2 sm:mb-3 line-clamp-2">
                    {banner.description}
                  </p>
                )}
                {banner.button_text && banner.button_url && (
                  <a
                    href={banner.button_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium text-xs sm:text-sm transition-colors shadow-lg pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {banner.button_text}
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Navigation Arrows - contained within carousel */}
      {banners.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center text-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-white dark:hover:bg-black/70"
            aria-label="Previous banner"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center text-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-white dark:hover:bg-black/70"
            aria-label="Next banner"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </>
      )}

      {/* Dots Indicator - contained within carousel */}
      {banners.length > 1 && (
        <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5 sm:gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all",
                index === currentIndex
                  ? "bg-white w-4 sm:w-6"
                  : "bg-white/50 hover:bg-white/70"
              )}
              aria-label={`Go to banner ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
