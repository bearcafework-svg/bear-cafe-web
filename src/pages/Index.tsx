import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { HomeSidebar } from '@/components/bear-cafe/HomeSidebar';
import { BannerCarousel } from '@/components/bear-cafe/BannerCarousel';
import { HomeCategoryCard, MoreCategoriesCard } from '@/components/bear-cafe/HomeCategoryCard';
import { AllCategoriesModal } from '@/components/bear-cafe/AllCategoriesModal';
import { LoadingBear } from '@/components/bear-cafe/LoadingBear';
import { Footer } from '@/components/bear-cafe/Footer';
import { GreenTeaWarningPopup } from '@/components/bear-cafe/GreenTeaWarningPopup';
import { CategoryGuidance } from '@/components/bear-cafe/CategoryGuidance';
import { CooldownBox } from '@/components/bear-cafe/CooldownBox';
import { SecretTableWidget } from '@/components/bear-cafe/SecretTableWidget';
import { useCooldown } from '@/hooks/useCooldown';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Menu, X, Users2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface Category {
  id: string;
  icon: string;
  name: string;
  description: string | null;
}

// Number of categories to show in the main grid (5 items)
// Show "More" card only if there are 6+ categories
const VISIBLE_CATEGORIES = 5;
const MIN_CATEGORIES_FOR_MORE = 6;
const VOICE_STATE_STALE_MINUTES = 3;

export default function Index() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverCount, setServerCount] = useState<number | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Match Stats (for role milestones)
  const [matchCount, setMatchCount] = useState(0);
  const [nextMilestone, setNextMilestone] = useState(25);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const { data } = await supabase
        .from('user_gacha_stats')
        .select('match_count')
        .eq('discord_id', user.discord_id)
        .maybeSingle();
      
      if (data) {
        const count = data.match_count || 0;
        setMatchCount(count);
        const milestones = [25, 50, 100, 500, 1000];
        setNextMilestone(milestones.find(m => m > count) || 1000);
      }
    };
    fetchStats();
  }, [user]);

  // Cooldown state
  const { isOnCooldown, formattedTime, remainingMinutes } = useCooldown(user?.id ?? null);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('id, icon, name, description')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data) {
        setCategories(data);
      }
      setLoading(false);
    };

    fetchCategories();
  }, []);

  // Fetch server count with realtime updates
  useEffect(() => {
    let isMounted = true;

    const fetchServerCount = async () => {
      const thresholdTime = new Date(
        Date.now() - VOICE_STATE_STALE_MINUTES * 60 * 1000
      ).toISOString();

      const { count, error } = await supabase
        .from('voice_states')
        .select('discord_user_id', { count: 'exact', head: true })
        .eq('is_connected', true)
        .not('channel_id', 'is', null)
        .gte('updated_at', thresholdTime);

      if (!error && isMounted) {
        setServerCount(count ?? 0);
      }
    };

    fetchServerCount();

    const channel = supabase
      .channel('voice-states-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'voice_states' },
        () => {
          fetchServerCount();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Voice states subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Voice states subscription error');
        }
      });

    // Smart polling fallback: refresh every 15 seconds in case realtime fails
    const fallbackInterval = setInterval(fetchServerCount, 15000);

    return () => {
      isMounted = false;
      clearInterval(fallbackInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch Discord member count
  const [memberCount, setMemberCount] = useState<number | null>(null);
  
  useEffect(() => {
    const fetchMemberCount = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('discord-member-count');
        if (!error && data) {
          setMemberCount(data.member_count);
        }
      } catch (err) {
        console.error('Failed to fetch member count:', err);
      }
    };

    fetchMemberCount();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchMemberCount, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const visibleCategories = categories.slice(0, VISIBLE_CATEGORIES);
  const remainingCount = Math.max(0, categories.length - VISIBLE_CATEGORIES);
  const showMoreCard = categories.length >= MIN_CATEGORIES_FOR_MORE;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream via-peach/20 to-blush/30 dark:from-background dark:via-background dark:to-muted/20 flex items-center justify-center">
        <LoadingBear message="กำลังโหลด..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-cream via-peach/20 to-blush/30 dark:from-background dark:via-background dark:to-muted/20">
      {/* Green Tea Warning Popup */}
      <GreenTeaWarningPopup userId={user?.id} />

      {/* Cooldown Box - Fixed on right side */}
      <CooldownBox 
        isOnCooldown={isOnCooldown}
        formattedTime={formattedTime}
        remainingMinutes={remainingMinutes}
      />

      <div className="flex-1 flex">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden fixed top-4 left-4 z-50 w-11 h-11 rounded-full bg-white dark:bg-mocha shadow-lg flex items-center justify-center border border-latte/30 dark:border-coffee/30"
          aria-label="เปิดเมนู"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Sidebar - Desktop */}
        <div className="hidden lg:block sticky top-0 h-screen">
          <HomeSidebar onlineCount={serverCount} memberCount={memberCount} />
        </div>

        {/* Sidebar - Mobile Overlay */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative z-50 w-[280px] max-w-[85vw] h-full">
              <HomeSidebar onlineCount={serverCount} memberCount={memberCount} />
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 pt-16 lg:pt-4 lg:p-8 overflow-auto">
          <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
            {/* Banner Carousel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <BannerCarousel />
            </motion.div>

            {/* Category Guidance */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <CategoryGuidance />
            </motion.div>

            {/* Secret Table Widget — Owner only */}
            {user?.is_owner && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
              >
                <SecretTableWidget />
              </motion.div>
            )}

            {/* Category Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4"
            >
              {visibleCategories.map((category, index) => (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                >
                  <HomeCategoryCard
                    id={category.id}
                    icon={category.icon}
                    name={category.name}
                    description={category.description}
                    isLocked={isOnCooldown}
                    formattedTime={formattedTime}
                    requireLogin={!isAuthenticated}
                  />
                </motion.div>
              ))}

              {/* More Categories Card - only show if 6+ categories */}
              {showMoreCard && remainingCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + VISIBLE_CATEGORIES * 0.05 }}
                >
                  <MoreCategoriesCard
                    remainingCount={remainingCount}
                    onClick={() => setShowAllCategories(true)}
                    isLocked={isOnCooldown}
                    formattedTime={formattedTime}
                  />
                </motion.div>
              )}
            </motion.div>

            {/* Match Count — subtle bar below grid */}
            {user && matchCount > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-card/60 dark:bg-card/40 backdrop-blur-sm border border-border/40"
              >
                <Users2 className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <Progress 
                    value={(matchCount / nextMilestone) * 100} 
                    className="h-2 bg-muted/30 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-[hsl(var(--honey))] [&>div]:to-primary [&>div]:rounded-full" 
                  />
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">
                  {matchCount}/{nextMilestone} ครั้ง
                </span>
              </motion.div>
            )}
          </div>
        </main>
      </div>

      {/* Footer */}
      <Footer />

      {/* All Categories Modal */}
      <AllCategoriesModal
        open={showAllCategories}
        onOpenChange={setShowAllCategories}
        categories={categories}
        isLocked={isOnCooldown}
        formattedTime={formattedTime}
      />
    </div>
  );
}
