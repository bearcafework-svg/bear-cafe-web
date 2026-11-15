import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { TAROT_CARDS, TarotCard } from '@/data/tarotCards';
import { TarotQueueManager } from '@/components/tarot/TarotQueueManager';
import { 
  Search, 
  Copy, 
  Check, 
  ShieldAlert, 
  ArrowLeft, 
  Trash2, 
  Sparkles, 
  RotateCcw,
  Layers,
  Flame,
  Wine,
  Sword,
  Coins,
  X,
  Image as ImageIcon,
  ImageOff,
  RotateCw,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

type TabType = 'all' | 'major' | 'wands' | 'cups' | 'swords' | 'pentacles';

interface SelectedCardItem {
  name: string;
  isReversed: boolean;
}

// Robust fallback copy function that works across all browsers, mobile webviews & insecure contexts
async function copyTextToClipboard(text: string): Promise<boolean> {
  // 1. Modern Clipboard API
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, trying fallback:', err);
    }
  }

  // 2. Legacy execCommand fallback
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, 99999);
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('execCommand copy fallback failed:', err);
    return false;
  }
}

export default function TarotPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [pageMode, setPageMode] = useState<'queue' | 'picker'>('queue');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedCards, setSelectedCards] = useState<SelectedCardItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [copyFormat, setCopyFormat] = useState<'en' | 'th'>('en');
  const [showImages, setShowImages] = useState(true);

  // Filtered cards based on search and active tab
  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return TAROT_CARDS.filter((card) => {
      // Tab filter
      if (activeTab === 'major' && card.category !== 'major') return false;
      if (activeTab === 'wands' && card.subCategory !== 'Wands') return false;
      if (activeTab === 'cups' && card.subCategory !== 'Cups') return false;
      if (activeTab === 'swords' && card.subCategory !== 'Swords') return false;
      if (activeTab === 'pentacles' && card.subCategory !== 'Pentacles') return false;

      // Search filter
      if (!q) return true;
      return (
        card.name.toLowerCase().includes(q) ||
        card.thaiName.toLowerCase().includes(q) ||
        card.subCategory.toLowerCase().includes(q) ||
        String(card.id).includes(q)
      );
    });
  }, [searchQuery, activeTab]);

  // Handle card selection toggle
  const toggleCard = (cardName: string) => {
    setSelectedCards((prev) => {
      const exists = prev.find((item) => item.name === cardName);
      if (exists) {
        return prev.filter((item) => item.name !== cardName);
      }
      return [...prev, { name: cardName, isReversed: false }];
    });
  };

  // Toggle reversed state for a specific selected card
  const toggleCardReversed = (cardName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent unselecting the card
    setSelectedCards((prev) => {
      const exists = prev.find((item) => item.name === cardName);
      if (!exists) {
        // If not selected yet, select it directly as reversed
        return [...prev, { name: cardName, isReversed: true }];
      }
      return prev.map((item) =>
        item.name === cardName ? { ...item, isReversed: !item.isReversed } : item
      );
    });
  };

  // Select all visible cards (default upright)
  const selectAllVisible = () => {
    const visibleNames = filteredCards.map((c) => c.name);
    setSelectedCards((prev) => {
      const currentNames = new Set(prev.map((item) => item.name));
      const newItems = visibleNames
        .filter((name) => !currentNames.has(name))
        .map((name) => ({ name, isReversed: false }));
      return [...prev, ...newItems];
    });
    toast({
      title: 'เลือกไพ่ทั้งหมดแล้ว',
      description: `เลือกเพิ่มในหน้านี้เรียบร้อย`,
    });
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedCards([]);
  };

  // Generate comma-separated output with (กลับหัว) suffix when reversed
  const copiedString = useMemo(() => {
    return selectedCards
      .map((item) => {
        let baseName = item.name;
        if (copyFormat === 'th') {
          const found = TAROT_CARDS.find((c) => c.name === item.name);
          baseName = found ? found.thaiName.split(' (')[0] : item.name;
        }
        return item.isReversed ? `${baseName} (กลับหัว)` : baseName;
      })
      .join(',');
  }, [selectedCards, copyFormat]);

  // Handle Copy to clipboard with robust fallback
  const handleCopy = async () => {
    if (selectedCards.length === 0) {
      toast({
        title: 'ยังไม่ได้เลือกไพ่',
        description: 'กรุณาคลิกเลือกไพ่อย่างน้อย 1 ใบก่อนคัดลอกครับ',
        variant: 'destructive',
      });
      return;
    }

    const success = await copyTextToClipboard(copiedString);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast({
        title: 'คัดลอกสำเร็จ!',
        description: `คัดลอกรายชื่อไพ่ ${selectedCards.length} ใบแล้ว`,
      });
    } else {
      // Fallback: prompt window for manual copy if browser blocks all programmatic clipboard access
      window.prompt('คัดลอกรายชื่อไพ่ (กด Ctrl+C เพื่อคัดลอก):', copiedString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // 1. Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground text-sm">กำลังตรวจสอบสิทธิ์...</p>
      </div>
    );
  }

  // 2. Owner-only Gate
  if (!isAuthenticated || !user?.is_owner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-center">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mb-4 border border-rose-500/20 text-rose-500">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">เฉพาะ Owner เท่านั้น</h1>
        <p className="text-muted-foreground max-w-md text-sm mb-6">
          หน้านี้ถูกจำกัดการเข้าถึงเฉพาะบัญชีผู้สร้างหรือเจ้าของระบบ (Owner) เท่านั้นครับ
        </p>
        <Button onClick={() => navigate('/')} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          กลับหน้าแรก
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-36">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="text-muted-foreground hover:text-foreground -ml-2 h-8 px-2"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                หน้าแรก
              </Button>
              <div className="h-4 w-[1px] bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="text-lg">🔮</span>
                <h1 className="font-bold text-sm sm:text-base text-foreground">ระบบทาโรต์ & จัดการคิว</h1>
              </div>
            </div>

            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] px-2 py-0.5">
              Owner Only
            </Badge>
          </div>

          {/* Navigation Mode Switcher Pills */}
          <div className="flex items-center justify-center gap-1 bg-card/80 border border-border p-1 rounded-xl shadow-inner">
            <button
              type="button"
              onClick={() => setPageMode('queue')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                pageMode === 'queue'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>ตารางคิวดูดวง</span>
            </button>
            <button
              type="button"
              onClick={() => setPageMode('picker')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                pageMode === 'picker'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>เลือกไพ่ทาโรต์ (78 ใบ)</span>
              {selectedCards.length > 0 && (
                <span className="ml-1 bg-black/20 text-black px-1.5 py-0.2 rounded-full text-[10px]">
                  {selectedCards.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {pageMode === 'queue' ? (
          /* TAB 1: Queue Manager Table */
          <TarotQueueManager />
        ) : (
          /* TAB 2: Tarot Card Picker */
          <div className="space-y-6">
            {/* Description & Overview */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/50 border border-border/60 rounded-2xl p-4 sm:p-5">
              <div>
                <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  คัดเลือกไพ่ทาโรต์ 78 ใบ (รองรับไพ่กลับหัว)
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  คลิกการ์ดเพื่อเลือก/ยกเลิก • กดปุ่ม <strong>🔄 กลับหัว</strong> บนการ์ดเพื่อตั้งค่าไพ่กลับหัว • เมื่อกดคัดลอกจะมี <code>(กลับหัว)</code> ต่อท้ายให้อัตโนมัติ
                </p>
              </div>

              {/* Quick Clear & Select All & Image Toggle */}
              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowImages(!showImages)}
                  className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                  title="สลับโหมดเปิด/ซ่อนรูปเพื่อประหยัดเน็ต"
                >
                  {showImages ? (
                    <>
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                      รูปภาพ (เปิด)
                    </>
                  ) : (
                    <>
                      <ImageOff className="w-3.5 h-3.5 text-muted-foreground" />
                      โหมดประหยัดเน็ต
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllVisible}
                  className="text-xs h-8"
                  disabled={filteredCards.length === 0}
                >
                  เลือกทั้งหมด ({filteredCards.length})
                </Button>

                {selectedCards.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="text-xs h-8 text-rose-400 hover:text-rose-500 hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    ล้าง ({selectedCards.length})
                  </Button>
                )}
              </div>
            </div>

        {/* Search & Filter Controls */}
        <div className="space-y-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อไพ่... เช่น The Fool, ไม้เท้า, Cups, Queen, ดาบ, กลับหัว"
              className="pl-10 pr-9 h-11 bg-card/60 border-border text-sm rounded-xl focus-visible:ring-amber-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Tabs Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <Button
              variant={activeTab === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('all')}
              className={`rounded-lg text-xs h-8 whitespace-nowrap ${
                activeTab === 'all' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''
              }`}
            >
              <Layers className="w-3.5 h-3.5 mr-1" />
              ทั้งหมด (78)
            </Button>
            <Button
              variant={activeTab === 'major' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('major')}
              className={`rounded-lg text-xs h-8 whitespace-nowrap ${
                activeTab === 'major' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''
              }`}
            >
              ✨ เมเจอร์ (22)
            </Button>
            <Button
              variant={activeTab === 'wands' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('wands')}
              className={`rounded-lg text-xs h-8 whitespace-nowrap ${
                activeTab === 'wands' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''
              }`}
            >
              <Flame className="w-3.5 h-3.5 mr-1 text-orange-400" />
              ไมเนอร์: ไม้เท้า (14)
            </Button>
            <Button
              variant={activeTab === 'cups' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('cups')}
              className={`rounded-lg text-xs h-8 whitespace-nowrap ${
                activeTab === 'cups' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''
              }`}
            >
              <Wine className="w-3.5 h-3.5 mr-1 text-sky-400" />
              ไมเนอร์: ถ้วย (14)
            </Button>
            <Button
              variant={activeTab === 'swords' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('swords')}
              className={`rounded-lg text-xs h-8 whitespace-nowrap ${
                activeTab === 'swords' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''
              }`}
            >
              <Sword className="w-3.5 h-3.5 mr-1 text-emerald-400" />
              ไมเนอร์: ดาบ (14)
            </Button>
            <Button
              variant={activeTab === 'pentacles' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('pentacles')}
              className={`rounded-lg text-xs h-8 whitespace-nowrap ${
                activeTab === 'pentacles' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''
              }`}
            >
              <Coins className="w-3.5 h-3.5 mr-1 text-yellow-400" />
              ไมเนอร์: เหรียญ (14)
            </Button>
          </div>
        </div>

        {/* Cards Grid */}
        {filteredCards.length === 0 ? (
          <div className="text-center py-16 bg-card/30 rounded-2xl border border-dashed border-border">
            <p className="text-muted-foreground text-sm">ไม่พบไพ่ทาโรต์ที่ตรงกับคำค้นหา "{searchQuery}"</p>
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setActiveTab('all');
              }}
              className="mt-2 text-amber-500"
            >
              ล้างตัวกรอง
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {filteredCards.map((card) => {
              const selectedItem = selectedCards.find((item) => item.name === card.name);
              const isSelected = !!selectedItem;
              const isReversed = selectedItem?.isReversed ?? false;

              // Optimized CDN thumbnail with size & quality compression parameters (only ~3-5KB per image)
              const optimizedThumbUrl = `${card.img}&w=150&q=75`;

              return (
                <div
                  key={card.id}
                  onClick={() => toggleCard(card.name)}
                  className={`group relative flex flex-col justify-between rounded-xl overflow-hidden cursor-pointer transition-all duration-200 border text-left select-none ${
                    isSelected
                      ? isReversed
                        ? 'bg-purple-950/20 border-purple-500 ring-2 ring-purple-500/40 shadow-lg shadow-purple-500/10 scale-[1.02]'
                        : 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/40 shadow-lg shadow-amber-500/10 scale-[1.02]'
                      : 'bg-card/70 border-border/70 hover:border-border hover:bg-card hover:scale-[1.01]'
                  }`}
                >
                  {/* Selected Badge Checkmark */}
                  <div
                    className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      isSelected
                        ? isReversed
                          ? 'bg-purple-500 text-white shadow-md scale-100'
                          : 'bg-amber-500 text-black shadow-md scale-100'
                        : 'bg-black/40 text-transparent border border-white/20 group-hover:border-white/40'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>

                  {/* Card Category Tag */}
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded backdrop-blur-md ${
                        card.category === 'major'
                          ? 'bg-purple-900/80 text-purple-200 border border-purple-500/30'
                          : 'bg-black/60 text-muted-foreground border border-white/10'
                      }`}
                    >
                      {card.category === 'major' ? 'Major' : card.subCategory}
                    </span>
                  </div>

                  {/* Card Image (with lazy loading & bandwidth optimization) */}
                  {showImages ? (
                    <div className="relative aspect-[2/3] w-full bg-black/40 overflow-hidden">
                      <img
                        src={optimizedThumbUrl}
                        alt={card.name}
                        loading="lazy"
                        decoding="async"
                        className={`w-full h-full object-cover transition-transform duration-300 ${
                          isSelected ? 'scale-105' : 'group-hover:scale-105 opacity-90 group-hover:opacity-100'
                        }`}
                        onError={(e) => {
                          // Hide broken image placeholder
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="aspect-[3/2] w-full bg-card/40 flex items-center justify-center border-b border-border/30">
                      <span className="text-2xl opacity-60">
                        {card.category === 'major' ? '🔮' : card.subCategory === 'Wands' ? '🪵' : card.subCategory === 'Cups' ? '🏆' : card.subCategory === 'Swords' ? '⚔️' : '🪙'}
                      </span>
                    </div>
                  )}

                  {/* Card Title & Thai name + Reversed Button */}
                  <div className="p-2.5 bg-card/90 border-t border-border/50 flex flex-col justify-between gap-1.5">
                    <div>
                      <h3
                        className={`text-xs sm:text-sm font-semibold truncate ${
                          isSelected
                            ? isReversed
                              ? 'text-purple-400'
                              : 'text-amber-400'
                            : 'text-foreground'
                        }`}
                        title={card.name}
                      >
                        {card.name}
                      </h3>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={card.thaiName}>
                        {card.thaiName}
                      </p>
                    </div>

                    {/* Button / Toggle for 'กลับหัว' (Reversed) */}
                    <div className="pt-1 flex items-center justify-between border-t border-border/40">
                      <button
                        type="button"
                        onClick={(e) => toggleCardReversed(card.name, e)}
                        className={`w-full flex items-center justify-center gap-1 py-1 px-1.5 rounded-md text-[10px] font-medium transition-all ${
                          isSelected && isReversed
                            ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 hover:bg-purple-600/40'
                            : isSelected
                            ? 'bg-muted/80 text-muted-foreground hover:bg-purple-500/20 hover:text-purple-300'
                            : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50'
                        }`}
                        title={isReversed ? 'คลิกเพื่อเปลี่ยนเป็นไพ่ตั้งตรง' : 'คลิกเพื่อตั้งค่าเป็นไพ่กลับหัว'}
                      >
                        <RotateCw className={`w-3 h-3 ${isReversed ? 'text-purple-400 rotate-180' : ''}`} />
                        <span>{isReversed ? 'กลับหัว' : 'ตั้งตรง'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </div>
        )}
      </main>

      {/* Sticky Bottom Action Bar (Only visible in Tarot Picker mode) */}
      {pageMode === 'picker' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-lg border-t border-border shadow-2xl p-3 sm:p-4">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Output Preview */}
            <div className="flex-1 min-w-0 flex items-center gap-2 bg-card/70 border border-border/80 rounded-xl px-3 py-1.5 focus-within:border-amber-500">
              <span className="text-xs text-muted-foreground shrink-0 font-medium hidden sm:inline">
                ผลลัพธ์ ({selectedCards.length}):
              </span>
              <input
                type="text"
                readOnly
                value={copiedString}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                placeholder="ยังไม่ได้เลือกไพ่ (คลิกเลือกไพ่ที่ต้องการด้านบน)"
                className="flex-1 bg-transparent font-mono text-xs text-amber-400 placeholder:text-muted-foreground/60 placeholder:italic outline-none w-full cursor-pointer select-all"
              />
              {selectedCards.length > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-muted-foreground hover:text-rose-400 p-1 rounded transition-colors shrink-0"
                  title="ล้างทั้งหมด"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Action Buttons & Format Options */}
            <div className="flex items-center justify-between md:justify-end gap-2 shrink-0">
              {/* Format toggle: EN vs TH */}
              <div className="flex items-center bg-card border border-border rounded-lg p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setCopyFormat('en')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    copyFormat === 'en'
                      ? 'bg-amber-600 text-white font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  อังกฤษ (EN)
                </button>
                <button
                  type="button"
                  onClick={() => setCopyFormat('th')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    copyFormat === 'th'
                      ? 'bg-amber-600 text-white font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  ไทย (TH)
                </button>
              </div>

              {/* Copy Button */}
              <Button
                onClick={handleCopy}
                disabled={selectedCards.length === 0}
                className={`h-10 px-5 rounded-xl font-medium shadow-md transition-all ${
                  copied
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-black'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1.5" />
                    คัดลอกแล้ว!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1.5" />
                    คัดลอกชื่อไพ่ ({selectedCards.length})
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
