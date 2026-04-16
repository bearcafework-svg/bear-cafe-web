import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

export function CategoryGuidance() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    const storedHidden = sessionStorage.getItem('category-guidance-hidden');
    if (storedHidden === 'true') {
      setIsHidden(true);
    }
  }, []);

  const handleClose = () => {
    setIsHidden(true);
    setIsExpanded(false);
    sessionStorage.setItem('category-guidance-hidden', 'true');
  };

  const handleReopen = () => {
    setIsHidden(false);
    sessionStorage.removeItem('category-guidance-hidden');
  };

  return (
    <div className="relative">
      <div className="sticky top-2 sm:top-4 z-30">
        {isHidden ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleReopen}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-cream/95 dark:bg-mocha/90 px-3 py-1.5 text-xs sm:text-sm font-medium text-foreground shadow-sm border border-primary/20 hover:border-primary/40 transition-colors"
            >
              🧸 คำแนะนำ
            </button>
          </div>
        ) : (
          <div className="relative pointer-events-auto">
            <div className="bg-gradient-to-r from-cream/95 via-peach/80 to-blush/70 dark:from-mocha/90 dark:via-coffee/80 dark:to-mocha/90 rounded-2xl border border-primary/20 shadow-[0_8px_20px_-12px_rgba(82,41,16,0.45)] backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-white/70 dark:bg-white/10 flex items-center justify-center text-lg shadow-inner">
                    🧸
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-foreground text-sm sm:text-base">
                      เลือกหมวดหมู่ที่เหมาะกับคุณ
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate max-w-[240px] sm:max-w-[420px] md:max-w-[520px]">
                      พื้นที่นี้คือการหาเพื่อนและทำกิจกรรมอย่างสุภาพ ไม่ใช่หาคู่
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsExpanded((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded-full bg-white/70 dark:bg-white/10 px-2.5 py-1 text-xs sm:text-sm font-medium text-foreground hover:bg-white/90 dark:hover:bg-white/20 transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        <span className="hidden sm:inline">ย่อ</span>
                        <span className="sm:hidden">ย่อ</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        <span className="hidden sm:inline">อ่านเพิ่ม</span>
                        <span className="sm:hidden">อ่านเพิ่ม</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="inline-flex items-center justify-center rounded-full bg-white/70 dark:bg-white/10 w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-white/90 dark:hover:bg-white/20 transition-colors"
                    aria-label="ปิดคำแนะนำ"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div
              className={`absolute left-0 right-0 mt-2 rounded-2xl border border-primary/20 bg-gradient-to-br from-cream/95 via-peach/90 to-blush/80 dark:from-mocha/95 dark:via-coffee/90 dark:to-mocha/95 shadow-[0_16px_40px_-18px_rgba(82,41,16,0.5)] transition-all duration-200 ${
                isExpanded
                  ? 'opacity-100 translate-y-0 pointer-events-auto'
                  : 'opacity-0 -translate-y-2 pointer-events-none'
              }`}
            >
              <div className="max-h-60 sm:max-h-72 overflow-auto px-4 py-4 sm:px-5 sm:py-5 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p className="text-foreground font-medium mb-2">
                  เลือกหมวดเพื่อช่วยให้คุยกันได้ง่ายขึ้น
                </p>
                <p>
                  กรุณาใช้หมวดหมู่ให้ตรงกับบรรยากาศที่อยากพูดคุย เพื่อให้ทุกคนรู้สึกสบายใจ
                  เคารพขอบเขตกันและกัน และหลีกเลี่ยงการชักชวนในทางที่ไม่เหมาะสม
                  <span className="block mt-2">
                    พื้นที่นี้ไม่รองรับการแลกช่องทางติดต่อส่วนตัวหรือการหาคู่ หากต้องการพูดคุยเชิงลึก
                    สามารถเริ่มจากหัวข้อที่เหมาะสมและให้เกียรติกันเสมอ
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
