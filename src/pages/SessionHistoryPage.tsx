import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingBear } from '@/components/bear-cafe/LoadingBear';
import { IconDisplay } from '@/components/bear-cafe/IconDisplay';
import { Footer } from '@/components/bear-cafe/Footer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { ArrowLeft, Mic, Calendar, Coffee, Sparkles, Info, Tag, MessageCircle, Users2 } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { motion } from 'framer-motion';

interface Session {
  id: string;
  duration_minutes: number;
  note: string | null;
  session_mode: string;
  include_voice_channel: boolean;
  voice_channel_name: string | null;
  status: string;
  created_at: string;
  ends_at: string;
  completed_at: string | null;
  category: {
    name: string;
    icon: string;
  } | null;
  selected_role: {
    display_name: string;
    emoji: string | null;
  } | null;
}

// Helper to check if icon is a URL
const isIconUrl = (icon: string) => {
  return icon.startsWith('http') || icon.startsWith('/');
};

export default function SessionHistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchSessions = async () => {
      // Only fetch sessions from the last 7 days
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          duration_minutes,
          note,
          session_mode,
          include_voice_channel,
          voice_channel_name,
          status,
          created_at,
          ends_at,
          completed_at,
          category:categories(name, icon),
          selected_role:discord_roles(display_name, emoji)
        `)
        .eq('user_id', user.id)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false });

      try {
        if (error) throw error;
        setSessions((data as Session[]) || []);
      } catch (err) {
        console.error('Error fetching sessions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, [user?.id]);

  const renderCategoryIcon = (icon: string | undefined) => {
    const fallbackIcon = '📁';
    const iconValue = icon || fallbackIcon;
    
    if (isIconUrl(iconValue)) {
      return (
        <img 
          src={iconValue} 
          alt="Category" 
          className="w-6 h-6 rounded object-cover"
        />
      );
    }
    return <span className="text-lg">{iconValue}</span>;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream via-peach/20 to-blush/30 dark:from-mocha dark:via-coffee dark:to-mocha/80 flex items-center justify-center">
        <LoadingBear message="กำลังโหลดประวัติ..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-peach/20 to-blush/30 dark:from-mocha dark:via-coffee dark:to-mocha/80">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-cream/85 dark:bg-mocha/85 border-b border-latte/40 dark:border-coffee/40">
        <div className="max-w-2xl mx-auto flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/')}
            className="rounded-xl bg-secondary/50 hover:bg-secondary w-10 h-10 sm:w-11 sm:h-11 shrink-0 transition-all duration-200 hover:scale-105"
          >
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-lg sm:text-xl text-foreground truncate">📜 ประวัติหาเพื่อน</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">ย้อนหลัง 7 วัน</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto py-5 sm:py-8 px-3 sm:px-4 space-y-4 sm:space-y-5">
        {/* 7-day notice */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, type: 'spring' }}
          className="flex items-start gap-3 sm:gap-4 bg-primary/10 dark:bg-primary/20 border border-primary/20 rounded-xl sm:rounded-2xl p-4 sm:p-5"
        >
          <Info className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0 mt-0.5" />
          <div className="text-sm sm:text-base text-foreground min-w-0">
            <p className="font-semibold">เก็บประวัติย้อนหลัง 7 วัน</p>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1 sm:mt-1.5">
              ข้อมูลเก่ากว่า 7 วันจะถูกลบออกอัตโนมัติ
            </p>
          </div>
        </motion.div>

        {sessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, type: 'spring' }}
          >
            <Card className="border-dashed border-2 border-primary/30 bg-card/70 backdrop-blur-sm rounded-2xl sm:rounded-3xl overflow-hidden">
              <CardContent className="py-14 sm:py-20 text-center px-6">
                <motion.div 
                  className="w-18 h-18 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-peach/50 to-blush/50 dark:from-coffee/50 dark:to-mocha/50 flex items-center justify-center mx-auto mb-5 sm:mb-7"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                >
                  <Coffee className="w-9 h-9 sm:w-12 sm:h-12 text-primary" />
                </motion.div>
                <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground">ยังไม่มีประวัติเลย</h2>
                <p className="text-sm sm:text-base text-muted-foreground mt-2 sm:mt-3">ออกไปหาเพื่อนกันเถอะ! 🐻</p>
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button 
                    className="mt-6 sm:mt-8 rounded-xl sm:rounded-2xl bg-gradient-to-r from-primary to-bear-light hover:from-primary/90 hover:to-bear-light/90 text-primary-foreground font-bold px-8 sm:px-10 py-6 sm:py-7 shadow-lg shadow-primary/20 text-base sm:text-lg"
                    onClick={() => navigate('/')}
                  >
                    <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 mr-2.5" />
                    เริ่มหาเพื่อน
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {sessions.map((session, index) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                whileHover={{ scale: 1.01, y: -2 }}
                transition={{ delay: index * 0.04, duration: 0.3 }}
              >
                <Card className="bg-card/80 backdrop-blur-sm border-latte/30 dark:border-coffee/30 rounded-xl sm:rounded-2xl overflow-hidden hover:shadow-lg hover:border-primary/20 transition-all duration-300">
                  <CardContent className="p-4 sm:p-5">
                    {/* Category Header */}
                    <div className="flex items-center gap-2.5 mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-border/50">
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-gradient-to-br from-peach/40 to-blush/40 dark:from-coffee/40 dark:to-mocha/40 flex items-center justify-center shrink-0">
                        {renderCategoryIcon(session.category?.icon)}
                      </div>
                      <span className="font-display font-semibold text-foreground flex-1 text-base sm:text-lg truncate">
                        {session.category?.name || 'ไม่ระบุหมวดหมู่'}
                      </span>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm sm:text-base">
                      {/* Date/Time */}
                      <div className="flex items-start gap-2 sm:gap-2.5">
                        <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm text-muted-foreground">วันเวลา</p>
                          <p className="text-foreground font-medium text-sm sm:text-base">
                            {format(new Date(session.created_at), 'd MMM yy', { locale: th })}
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {format(new Date(session.created_at), 'HH:mm น.', { locale: th })}
                          </p>
                        </div>
                      </div>

                      {/* Session Mode */}
                      <div className="flex items-start gap-2 sm:gap-2.5">
                        {session.session_mode === 'voice_room' ? (
                          <Users2 className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mt-0.5 shrink-0" />
                        ) : (
                          <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mt-0.5 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm text-muted-foreground">รูปแบบ</p>
                          <p className="text-foreground font-medium text-sm sm:text-base">
                            {session.session_mode === 'voice_room' ? 'ลงห้องคุย' : 'แชทส่วนตัว'}
                          </p>
                        </div>
                      </div>

                      {/* Voice Channel - only show for voice_room mode */}
                      {session.session_mode === 'voice_room' && (
                        <div className="flex items-start gap-2 sm:gap-2.5">
                          <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-muted-foreground">ห้อง</p>
                            <p className="text-foreground font-medium text-sm sm:text-base truncate">
                              {session.voice_channel_name || <span className="text-muted-foreground italic">ไม่ระบุ</span>}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Selected Role */}
                      {session.selected_role && (
                        <div className="flex items-start gap-2 sm:gap-2.5 col-span-2">
                          <Tag className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-muted-foreground">ยศที่เลือก</p>
                            <Badge variant="secondary" className="mt-1 sm:mt-1.5 font-medium gap-1.5 sm:gap-2 text-xs sm:text-sm py-1 px-2.5">
                              {session.selected_role.emoji && (
                                <IconDisplay 
                                  icon={session.selected_role.emoji} 
                                  size="sm" 
                                  fallback="" 
                                />
                              )}
                              <span className="truncate">{session.selected_role.display_name}</span>
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Note */}
                    {session.note && (
                      <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/50">
                        <p className="text-xs sm:text-sm text-muted-foreground mb-1.5">📝 หมายเหตุ</p>
                        <p className="text-sm sm:text-base text-foreground bg-secondary/30 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 leading-relaxed">
                          {session.note}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
