import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/bear-cafe/PageHeader';
import { StepIndicator } from '@/components/bear-cafe/StepIndicator';
import { CategoryCard } from '@/components/bear-cafe/CategoryCard';
import { ExpandableRoleCard } from '@/components/bear-cafe/ExpandableRoleCard';
import { IconDisplay } from '@/components/bear-cafe/IconDisplay';
import { RulesSection } from '@/components/bear-cafe/RulesSection';
import { MilestonePopup, MilestoneData } from '@/components/bear-cafe/MilestonePopup';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowRight, ArrowLeft, Mic, AlertCircle, Loader2, Check, CheckCircle2, Clock, Eye, MessageCircle, Users2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DiscordMessagePreview } from '@/components/bear-cafe/DiscordMessagePreview';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { readRoleBanPayload } from '@/lib/role-ban';
import { readFunctionsErrorPayload } from '@/lib/function-error';
import { useVoiceState } from '@/hooks/useVoiceState';
import { useCooldown } from '@/hooks/useCooldown';
import { TurnstileWidget, TurnstileHandle } from '@/components/security/TurnstileWidget';

interface TldrPoint {
  icon: string;
  text: string;
}

interface DoDontExample {
  doExample: string;
  dontExample: string;
}

interface Category {
  id: string;
  icon: string;
  name: string;
  description: string | null;
  allow_voice_channel: boolean;
  require_role_selection: boolean;
  rules_text: string | null;
  tldr_points: TldrPoint[] | null;
  do_dont_examples: DoDontExample[] | null;
}

// แก้ไข 1: ใส่ ? เพื่อให้ description เป็น Optional (มีหรือไม่มีก็ได้)
interface DiscordRole {
  id: string;
  emoji: string | null;
  display_name: string;
  description?: string | null; 
  discord_role_id: string;
  color: string | null;
}

interface CategoryRoleRow {
  category_id: string;
  discord_roles: DiscordRole | null;
}

interface BannedWord {
  id: string;
  word: string;
  category_id: string | null;
}

const STEPS = [
  { id: 1, label: 'เลือกหมวดหมู่' },
  { id: 2, label: 'รายละเอียด' },
  { id: 3, label: 'ยืนยัน' },
];

const DEFAULT_DURATION = 30;

export default function CreateSessionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, session: authSession } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRoleBanned, setIsRoleBanned] = useState(false);
  const turnstileRef = useRef<TurnstileHandle | null>(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  
  // Data from database
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryRoles, setCategoryRoles] = useState<Record<string, DiscordRole[]>>({});
  const [activeDiscordRoles, setActiveDiscordRoles] = useState<DiscordRole[]>([]);
  const [bannedWords, setBannedWords] = useState<BannedWord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  // Real-time voice state from Discord Bot
  const { voiceState, isLoading: loadingVoice } = useVoiceState(user?.discord_id || null);
  
  // Cooldown check
  const { isOnCooldown, formattedTime, remainingMinutes, isLoading: loadingCooldown, refresh: refreshCooldown } = useCooldown(user?.id || null);
  
  // Form state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<'dm' | 'voice_room'>('dm');
  const [note, setNote] = useState('');
  const [agreeToRules, setAgreeToRules] = useState(false);
  const [bannedWordError, setBannedWordError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Milestone popup
  const [milestoneData, setMilestoneData] = useState<MilestoneData | null>(null);
  const [showMilestone, setShowMilestone] = useState(false);

  // Pre-select category from URL params and optionally jump to step 2
  useEffect(() => {
    const categoryFromUrl = searchParams.get('category');
    const stepFromUrl     = searchParams.get('step');
    if (categoryFromUrl) {
      setSelectedCategory(categoryFromUrl);
      // If ?step=2 is present, skip straight to step 2 once data is loaded
      if (stepFromUrl === '2' && !loadingData) {
        setCurrentStep(2);
      }
    }
  }, [searchParams, loadingData]);

  // Fetch categories, roles, and banned words from database
  useEffect(() => {
    async function fetchData() {
      setLoadingData(true);
      try {
        // Fetch active categories
        const { data: categoriesData, error: catError } = await supabase
          .from('categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (catError) throw catError;
        // Map the data to our Category interface, handling JSON fields
        const mappedCategories: Category[] = (categoriesData || []).map((cat) => ({
          id: cat.id,
          icon: cat.icon,
          name: cat.name,
          description: cat.description,
          allow_voice_channel: cat.allow_voice_channel,
          require_role_selection: cat.require_role_selection,
          rules_text: cat.rules_text,
          tldr_points: Array.isArray(cat.tldr_points) ? (cat.tldr_points as unknown as TldrPoint[]) : null,
          do_dont_examples: Array.isArray(cat.do_dont_examples) ? (cat.do_dont_examples as unknown as DoDontExample[]) : null,
        }));
        setCategories(mappedCategories);

        // Fetch category roles logic
        const rolesSelectWithDescription = `
          category_id,
          discord_roles (
            id,
            emoji,
            display_name,
            description,
            discord_role_id,
            color
          )
        `;
        

        // Fetch category roles with description
        const { data: categoryRolesData, error: rolesError } = await supabase
          .from('category_roles')
          .select(rolesSelectWithDescription);

        if (rolesError) {
          console.error('Error fetching roles:', rolesError);
        } else if (!categoryRolesData || categoryRolesData.length === 0) {
          console.warn('[RLS Debug] category_roles returned 0 rows', {
            categoryRolesCount: categoryRolesData?.length ?? 0,
            isAuthenticated: Boolean(authSession),
            sessionUserId: authSession?.user?.id ?? null,
            profileId: user?.id ?? null,
            discordId: user?.discord_id ?? null,
          });
        }

        // Group roles by category
        const rolesMap: Record<string, DiscordRole[]> = {};
        categoryRolesData?.forEach((cr: CategoryRoleRow) => {
          if (cr.discord_roles) {
            if (!rolesMap[cr.category_id]) {
              rolesMap[cr.category_id] = [];
            }
            // Ensure description is set (even if null/undefined)
            const roleWithDescription: DiscordRole = {
              ...cr.discord_roles,
              description: cr.discord_roles.description ?? null,
            };
            rolesMap[cr.category_id].push(roleWithDescription);
          }
        });
        setCategoryRoles(rolesMap);

        // Fetch active discord roles (fallback)
        const { data: activeRolesData, error: activeRolesError } = await supabase
          .from('discord_roles')
          .select('id, emoji, display_name, description, discord_role_id, color')
          .eq('is_active', true)
          .order('display_name', { ascending: true });

        if (activeRolesError) {
          console.error('Error fetching active roles:', activeRolesError);
        } else if (!activeRolesData || activeRolesData.length === 0) {
          console.warn('[RLS Debug] discord_roles returned 0 rows', {
            activeRolesCount: activeRolesData?.length ?? 0,
            isAuthenticated: Boolean(authSession),
            sessionUserId: authSession?.user?.id ?? null,
            profileId: user?.id ?? null,
            discordId: user?.discord_id ?? null,
          });
        }

        const activeRolesWithDescription = (activeRolesData || []).map((role) => ({
          ...role,
          description: role.description ?? null,
        }));
        setActiveDiscordRoles(activeRolesWithDescription);

        // Fetch banned words
        const { data: bannedWordsData, error: bwError } = await supabase
          .from('banned_words')
          .select('id, word, category_id');

        if (bwError) throw bwError;
        setBannedWords(bannedWordsData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('ไม่สามารถโหลดข้อมูลได้');
      } finally {
        setLoadingData(false);
      }
    }
    fetchData();
  }, []);

  // Check for banned words in note
  const checkBannedWords = (text: string, categoryId: string | null): string | null => {
    if (!text.trim()) return null;
    
    const lowerText = text.toLowerCase();
    
    // Get applicable banned words (global + category-specific)
    const applicableWords = bannedWords.filter(bw => 
      bw.category_id === null || bw.category_id === categoryId
    );
    
    for (const bw of applicableWords) {
      if (lowerText.includes(bw.word.toLowerCase())) {
        return bw.word;
      }
    }
    
    return null;
  };

  const checkLinks = (text: string): string | null => {
    if (!text.trim()) return null;

    const linkPattern = /(?:https?:\/\/|www\.)\S+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/i;
    if (linkPattern.test(text)) {
      return 'ไม่อนุญาตให้ใส่ลิงก์ในหมายเหตุ';
    }

    return null;
  };

  // Validate note when it changes
  useEffect(() => {
    if (note && selectedCategory) {
      const foundBannedWord = checkBannedWords(note, selectedCategory);
      if (foundBannedWord) {
        setBannedWordError(`พบคำต้องห้าม: "${foundBannedWord}"`);
      } else {
        setBannedWordError(null);
      }
    } else {
      setBannedWordError(null);
    }
  }, [note, selectedCategory, bannedWords]);

  useEffect(() => {
    setLinkError(checkLinks(note));
  }, [note]);

  const category = categories.find((c) => c.id === selectedCategory);
  const mappedRoles = selectedCategory ? categoryRoles[selectedCategory] || [] : [];
  const availableRoles = selectedCategory
    ? mappedRoles.length > 0
      ? mappedRoles
      : activeDiscordRoles
    : [];

  const needsVoiceForMode = sessionMode === 'voice_room' && category?.allow_voice_channel && !voiceState?.is_connected;
  const canProceedStep1 = selectedCategory !== null;
  const canProceedStep2 = 
    (!category?.require_role_selection || selectedRole !== null) &&
    note.length >= 10 &&
    note.length <= 200 &&
    !bannedWordError &&
    !linkError &&
    !needsVoiceForMode;
  const canSubmit = agreeToRules && !bannedWordError && !linkError && !isRoleBanned;

  const handleNext = () => {
    if (currentStep === 1 && canProceedStep1) {
      setCurrentStep(2);
    } else if (currentStep === 2 && canProceedStep2) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting || !user || !selectedCategory) return;
    
    setIsSubmitting(true);
    
    try {
      if (!authSession?.access_token) {
        toast.error('กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
        return;
      }

      if (!siteKey) {
        toast.error('ระบบความปลอดภัยยังไม่พร้อมใช้งาน');
        return;
      }

      const token = await turnstileRef.current?.execute();
      if (!token) {
        throw new Error('Missing Turnstile token');
      }

      // Check cooldown using the hook state (refresh to get latest)
      await refreshCooldown();
      
      if (isOnCooldown) {
        toast.error('รอแป๊บนึงก่อนนะ', {
          description: `อีก ${remainingMinutes} นาทีถึงจะสร้างแมตช์ใหม่ได้`,
        });
        setIsSubmitting(false);
        return;
      }

      // Calculate end time with default duration
      const endsAt = new Date(Date.now() + DEFAULT_DURATION * 60 * 1000).toISOString();
      
      // Use voice state from real-time tracking
      const hasVoiceChannel = sessionMode === 'voice_room' && voiceState?.is_connected && voiceState.channel_id;

      const roleId = selectedRole || null;
      
      const { data: sessionResponse, error: sessionError } = await supabase.functions.invoke(
        'session-create',
        {
          headers: {
            Authorization: `Bearer ${authSession.access_token}`,
          },
          body: {
            category_id: selectedCategory,
            selected_role_id: roleId,
            duration_minutes: DEFAULT_DURATION,
            ends_at: endsAt,
            note: note || null,
            include_voice_channel: !!hasVoiceChannel,
            voice_channel_id: hasVoiceChannel ? voiceState.channel_id : null,
            voice_channel_name: hasVoiceChannel ? voiceState.channel_name : null,
            session_mode: sessionMode,
          },
        },
      );

      if (sessionError || !sessionResponse?.session) {
        const roleBanPayload = await readRoleBanPayload(sessionError);
        if (roleBanPayload) {
          setIsRoleBanned(true);
          toast.error(roleBanPayload.message || 'บัญชีถูกระงับการใช้งาน');
          navigate('/banned-role', { replace: true });
          return;
        }

        const errorPayload = await readFunctionsErrorPayload(sessionError);
        const fallbackMessage = sessionError?.message || 'กรุณาลองใหม่อีกครั้ง';
        const errorCode = errorPayload?.error;
        const message = errorPayload?.message || errorPayload?.error || fallbackMessage;
        const retryAfter = errorPayload?.retryAfterSeconds;

        console.error('Database error:', sessionError);
        
        // Show specific error based on error code
        if (errorCode === 'ACTIVE_SESSION_EXISTS') {
          toast.error('มีแมตช์ที่ยังไม่หมดเวลาอยู่', {
            description: 'รอให้หมดเวลาก่อน หรือยุติแมตช์แล้วค่อยสร้างใหม่',
          });
        } else {
          toast.error('บันทึกไม่สำเร็จ', {
            description: retryAfter
              ? `${message} (${Math.ceil(retryAfter / 60)} นาที)`
              : message,
          });
        }
        return;
      }

      const session = sessionResponse.session;

      // Call process-match-reward to update match stats
      try {
        const { data: rewardData, error: rewardError } = await supabase.functions.invoke('process-match-reward', {
          body: { discord_id: user.discord_id },
        });
        if (rewardError) {
          console.error('process-match-reward error:', rewardError);
        } else {
          console.log('process-match-reward success:', rewardData);
          // Show milestone popup if milestone reached
          if (rewardData?.milestone_reached && rewardData?.role_info) {
            setMilestoneData({
              milestoneCount: rewardData.milestone_count,
              roleName: rewardData.role_info.name,
              roleIcon: rewardData.role_info.icon,
              roleColor: rewardData.role_info.color,
            });
            setShowMilestone(true);
          }
        }
      } catch (rewardErr) {
        console.error('process-match-reward error (non-blocking):', rewardErr);
      }

      // Get role info if selected
      const selectedRoleData = selectedRole ? availableRoles.find((r) => r.id === selectedRole) : null;
      
      // Send session message to Discord via Bot API (supports buttons)
      const { error: sessionWebhookError } = await supabase.functions.invoke('send-session-webhook', {
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
        },
          body: {
          sessionId: session.id,
          categoryIcon: category?.icon || '📁',
          categoryName: category?.name || 'ไม่ระบุ',
          duration: DEFAULT_DURATION,
          note: note || undefined,
          roleName: selectedRoleData?.display_name,
          roleEmoji: selectedRoleData?.emoji,
          discordRoleId: selectedRoleData?.discord_role_id,
          voiceChannelName: hasVoiceChannel ? voiceState?.channel_name : undefined,
          voiceChannelId: hasVoiceChannel ? voiceState?.channel_id : undefined,
          appUrl: window.location.origin,
          turnstileToken: token,
          sessionMode: sessionMode,
        },
      });

      if (sessionWebhookError) {
        const roleBanPayload = await readRoleBanPayload(sessionWebhookError);
        if (roleBanPayload) {
          setIsRoleBanned(true);
          toast.error(roleBanPayload.message || 'บัญชีถูกระงับการใช้งาน');
          navigate('/banned-role', { replace: true });
          return;
        }

        console.error('Session Bot API error:', sessionWebhookError);
        toast.warning('สร้างแมตช์แล้ว', {
          description: 'แต่ส่งไปยัง Discord ไม่ได้',
        });
      } else {
        toast.success('เริ่มแมตช์สำเร็จ! 🐻', {
          description: 'ข้อความถูกส่งไปยัง Discord แล้ว',
        });
      }
      
      navigate('/');
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('เกิดข้อผิดพลาด', {
        description: 'ลองใหม่อีกทีนะ',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-latte/30 to-peach/20 dark:from-mocha dark:via-mocha/80 dark:to-espresso/60 pb-16 sm:pb-20">
      {/* Header */}
      <header className="border-b border-latte dark:border-espresso/50 bg-cream/50 dark:bg-mocha/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-2.5 sm:py-3">
          <PageHeader
            title="หาเพื่อนลงห้อง ʕ •ᴥ• ʔ"
            showBack
            backTo="/"
          />
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-8">
        <StepIndicator steps={STEPS} currentStep={currentStep} />

        {isRoleBanned && (
          <div className="mt-3 sm:mt-4 rounded-xl sm:rounded-2xl border border-destructive/40 bg-destructive/10 p-3 sm:p-4 text-xs sm:text-sm text-destructive">
            บัญชีถูกจำกัดสิทธิ์จาก Role ใน Discord ติดต่อทีมงานได้เลยถ้าคิดว่าผิดพลาด
          </div>
        )}

        {/* Step 1: Select Category */}
        {currentStep === 1 && (
          <div className="animate-fade-in">
            <h2 className="font-display font-bold text-base sm:text-lg md:text-xl text-center mb-3 sm:mb-4 md:mb-6 text-foreground">
              เลือกหมวดหมู่ที่ชอบเลย
            </h2>
            {loadingData ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin mx-auto mb-2" />
                กำลังโหลดข้อมูล...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
                {categories.map((cat) => (
                  <CategoryCard
                    key={cat.id}
                    icon={cat.icon}
                    name={cat.name}
                    description={cat.description || ''}
                    isSelected={selectedCategory === cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setSelectedRole(null);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Details */}
        {currentStep === 2 && category && (
          <div className="animate-fade-in space-y-3 sm:space-y-4 md:space-y-6">
            {/* Selected Category Display */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-2.5 sm:p-3 md:p-4 flex items-center gap-2 sm:gap-3">
                <IconDisplay icon={category.icon} fallback="📁" size="xl" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground text-xs sm:text-sm md:text-base truncate">{category.name}</h3>
                  <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground line-clamp-1">{category.description}</p>
                </div>
              </CardContent>
            </Card>

            {/* Role Selection (if available) */}
            {availableRoles.length > 0 ? (
              <Card>
                <CardHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                  <CardTitle className="text-sm sm:text-base md:text-lg flex items-center gap-2">
                    เลือกยศ {category.require_role_selection && <span className="text-destructive">*</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid items-start gap-2 sm:gap-3 md:gap-4 grid-cols-2 sm:grid-cols-3 px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                  {availableRoles.map((role) => (
                    <ExpandableRoleCard
                      key={role.id}
                      emoji={role.emoji}
                      name={role.display_name}
                      description={role.description}
                      isSelected={selectedRole === role.id}
                      onClick={() => setSelectedRole(role.id)}
                    />
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                  <CardTitle className="text-sm sm:text-base md:text-lg flex items-center gap-2">
                    เลือกยศ {category.require_role_selection && <span className="text-destructive">*</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-muted-foreground px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                  <p>ยังไม่มียศให้เลือกตอนนี้</p>
                  <p>ไปเพิ่มได้ที่หน้า Admin แล้วกลับมาเลือกใหม่ได้เลย</p>
                  <Button variant="outline" asChild size="sm">
                    <Link to="/admin">ไปหน้า Admin</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Session Mode Selection */}
            {category.allow_voice_channel && (
              <Card>
                <CardHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                  <CardTitle className="text-sm sm:text-base md:text-lg">
                    รูปแบบการเข้าร่วม <span className="text-destructive">*</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {/* DM Option */}
                    <button
                      type="button"
                      onClick={() => setSessionMode('dm')}
                      className={`relative flex flex-col items-center gap-2 p-4 sm:p-5 rounded-xl border-2 transition-all duration-200 ${
                        sessionMode === 'dm'
                          ? 'border-primary bg-primary/10 shadow-md'
                          : 'border-border hover:border-primary/40 hover:bg-secondary/30'
                      }`}
                    >
                      <MessageCircle className={`w-7 h-7 sm:w-8 sm:h-8 ${sessionMode === 'dm' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`font-medium text-xs sm:text-sm ${sessionMode === 'dm' ? 'text-primary' : 'text-foreground'}`}>
                        แชทส่วนตัว
                      </span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground text-center">
                        ทักผ่าน DM
                      </span>
                      {sessionMode === 'dm' && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        </div>
                      )}
                    </button>

                    {/* Voice Room Option */}
                    <button
                      type="button"
                      onClick={() => setSessionMode('voice_room')}
                      className={`relative flex flex-col items-center gap-2 p-4 sm:p-5 rounded-xl border-2 transition-all duration-200 ${
                        sessionMode === 'voice_room'
                          ? 'border-primary bg-primary/10 shadow-md'
                          : 'border-border hover:border-primary/40 hover:bg-secondary/30'
                      }`}
                    >
                      <Users2 className={`w-7 h-7 sm:w-8 sm:h-8 ${sessionMode === 'voice_room' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`font-medium text-xs sm:text-sm ${sessionMode === 'voice_room' ? 'text-primary' : 'text-foreground'}`}>
                        ลงห้องคุย
                      </span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground text-center">
                        เข้าร่วมห้องเสียง
                      </span>
                      {sessionMode === 'voice_room' && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        </div>
                      )}
                    </button>
                  </div>

                  {/* Voice Channel Status - show when voice_room selected */}
                  {sessionMode === 'voice_room' && (
                    <Card className={voiceState?.is_connected ? "border-success/50 bg-success/5" : "border-border"}>
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${
                            voiceState?.is_connected ? "bg-success/20" : "bg-muted"
                          }`}>
                            <Mic className={`w-4 h-4 sm:w-5 sm:h-5 ${
                              voiceState?.is_connected ? "text-success" : "text-muted-foreground"
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            {loadingVoice ? (
                              <div className="flex items-center gap-2 text-muted-foreground text-xs sm:text-sm">
                                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin shrink-0" />
                                <span>กำลังเช็กสถานะ...</span>
                              </div>
                            ) : voiceState?.is_connected ? (
                              <>
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success shrink-0" />
                                  <p className="font-medium text-success text-xs sm:text-sm">กำลังอยู่ในห้องเสียง</p>
                                </div>
                                <p className="text-[10px] sm:text-sm text-muted-foreground truncate">
                                  🔊 {voiceState.channel_name}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="font-medium text-muted-foreground text-xs sm:text-sm">ยังไม่ได้อยู่ในห้องเสียง</p>
                                <p className="text-[10px] sm:text-sm text-muted-foreground">
                                  เข้าห้องเสียงใน Discord ก่อนเลย
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Warning Alert - voice_room selected but not connected */}
                  {sessionMode === 'voice_room' && !loadingVoice && !voiceState?.is_connected && (
                    <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs sm:text-sm">
                        เข้าห้องเสียงใน Discord ก่อนนะ ถ้าห้องยังไม่ขึ้นทั้งที่เข้าอยู่แล้ว ลองออกแล้วเข้าใหม่ หรือรีเฟรชหน้าเว็บสักครั้ง
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Note */}
            <Card className={bannedWordError || linkError ? "border-destructive/50" : ""}>
              <CardHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                <CardTitle className="text-sm sm:text-base md:text-lg">
                  เขียนอะไรสักนิด <span className="text-xs text-muted-foreground font-normal">(ไม่บังคับ)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                <Textarea
                  placeholder="บอกอะไรสักนิดก็ได้ เช่น ชอบเล่นเกมอะไร หรืออยากคุยเรื่องอะไร (10-200 ตัวอักษร)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                  rows={3}
                  className={`text-sm ${bannedWordError || linkError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                <div className="flex justify-between items-center">
                  {bannedWordError ? (
                    <p className="text-[10px] sm:text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span className="truncate">{bannedWordError}</span>
                    </p>
                  ) : linkError ? (
                    <p className="text-[10px] sm:text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span className="truncate">{linkError}</span>
                    </p>
                  ) : (
                    <span />
                  )}
                  <p className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
                    {note.length}/200
                  </p>
                </div>

                {/* Banned Words Warning */}
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 sm:p-5">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="space-y-2 sm:space-y-2.5 text-sm sm:text-base min-w-0">
                      <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm sm:text-base">
                        ห้ามเลี่ยงคำต้องห้าม
                      </p>
                      <p className="text-amber-700/80 dark:text-amber-400/70 leading-relaxed text-xs sm:text-sm">
                        ห้ามดัดแปลงคำต้องห้ามไม่ว่าจะเปลี่ยนตัวอักษร ใช้สัญลักษณ์แทน หรือสะกดผิดโดยตั้งใจ
                      </p>
                      <div className="bg-amber-100/50 dark:bg-amber-900/20 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 space-y-1 sm:space-y-1.5">
                        <p className="text-[11px] sm:text-xs text-amber-600 dark:text-amber-500 font-medium">ตัวอย่างที่ไม่อนุญาต:</p>
                        <div className="flex flex-wrap gap-x-4 sm:gap-x-5 gap-y-1 sm:gap-y-1.5 text-[11px] sm:text-xs text-amber-700/70 dark:text-amber-400/60">
                          <span>แฟน → llฟน</span>
                          <span>แฟน → f@n / fæn / แฝน</span>
                        </div>
                      </div>
                      <p className="text-[11px] sm:text-xs text-amber-600/80 dark:text-amber-500/70 italic">
                        ⚠️ การกระทำดังกล่าวถือเป็นการละเมิดกฎโดยเจตนา และจะถูกลงโทษทันที
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {currentStep === 3 && category && (
          <div className="animate-fade-in space-y-4 sm:space-y-6">
            {/* Summary */}
            <Card>
              <CardHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                <CardTitle className="text-sm sm:text-base md:text-lg">สรุปรายละเอียด</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                <div className="flex justify-between items-center py-1.5 sm:py-2 border-b">
                  <span className="text-muted-foreground text-xs sm:text-sm">หมวดหมู่</span>
                  <span className="font-medium flex items-center gap-1.5 sm:gap-2 text-foreground text-xs sm:text-sm">
                    <IconDisplay icon={category.icon} fallback="📁" size="sm" />
                    <span className="truncate max-w-[120px] sm:max-w-none">{category.name}</span>
                  </span>
                </div>
                {selectedRole && (
                  <div className="flex justify-between items-center py-1.5 sm:py-2 border-b">
                    <span className="text-muted-foreground text-xs sm:text-sm">ยศ</span>
                    <span className="font-medium text-foreground flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                      <IconDisplay 
                        icon={availableRoles.find((r) => r.id === selectedRole)?.emoji} 
                        fallback="🎭" 
                        size="sm" 
                      />
                      <span className="truncate max-w-[120px] sm:max-w-none">
                        {availableRoles.find((r) => r.id === selectedRole)?.display_name}
                      </span>
                    </span>
                  </div>
                )}
                {category.allow_voice_channel && (
                  <div className="flex justify-between items-center py-1.5 sm:py-2 border-b">
                    <span className="text-muted-foreground text-xs sm:text-sm">รูปแบบ</span>
                    <span className="font-medium text-foreground text-xs sm:text-sm flex items-center gap-1.5">
                      {sessionMode === 'voice_room' ? (
                        <><Users2 className="w-3.5 h-3.5" /> ลงห้องคุย</>
                      ) : (
                        <><MessageCircle className="w-3.5 h-3.5" /> แชทส่วนตัว</>
                      )}
                    </span>
                  </div>
                )}
                {sessionMode === 'voice_room' && voiceState?.is_connected && (
                  <div className="flex justify-between items-center py-1.5 sm:py-2 border-b">
                    <span className="text-muted-foreground text-xs sm:text-sm">ห้องเสียง</span>
                    <span className="font-medium text-success text-xs sm:text-sm truncate max-w-[150px] sm:max-w-none">
                      🔊 {voiceState.channel_name}
                    </span>
                  </div>
                )}
                {note && (
                  <div className="py-1.5 sm:py-2">
                    <span className="text-muted-foreground block mb-1 text-xs sm:text-sm">หมายเหตุ</span>
                    <p className="font-medium bg-secondary/50 p-2.5 sm:p-3 rounded-lg text-foreground text-xs sm:text-sm">{note}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Discord Message Preview */}
            <DiscordMessagePreview
              username={user?.username || 'ผู้ใช้'}
              avatarUrl={user?.avatar_url || undefined}
              categoryIcon={category.icon}
              categoryName={category.name}
              duration={DEFAULT_DURATION}
              roleName={selectedRole ? availableRoles.find((r) => r.id === selectedRole)?.display_name : undefined}
              roleEmoji={selectedRole ? availableRoles.find((r) => r.id === selectedRole)?.emoji || undefined : undefined}
              discordRoleId={selectedRole ? availableRoles.find((r) => r.id === selectedRole)?.discord_role_id : undefined}
              voiceChannelName={sessionMode === 'voice_room' ? (voiceState?.channel_name || undefined) : undefined}
              note={note || undefined}
              hasVoiceChannel={sessionMode === 'voice_room' && voiceState?.is_connected && category.allow_voice_channel}
              sessionMode={sessionMode}
            />

            {/* Rules Section - Progressive Disclosure */}
            <RulesSection
              categoryRulesText={category.rules_text}
              agreeToRules={agreeToRules}
              onAgreeChange={setAgreeToRules}
              specificRoleEmoji={activeDiscordRoles.find(r => r.discord_role_id === '1156930837573546126')?.emoji}
            />
            
            {/* Cooldown Warning */}
            {isOnCooldown && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="flex items-center gap-2.5 sm:gap-3 py-3 sm:py-4 px-3 sm:px-4">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-destructive animate-pulse shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-destructive text-xs sm:text-sm">ยังสร้างแมตช์ไม่ได้</p>
                    <p className="text-[10px] sm:text-sm text-muted-foreground">
                      กรุณารออีก <span className="font-bold text-destructive">{formattedTime}</span> ก่อนสร้างแมตช์ใหม่
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-background border-t safe-area-inset-bottom">
          <div className="container max-w-3xl mx-auto flex gap-2 sm:gap-3">
            {currentStep > 1 && (
              <Button variant="outline" onClick={handleBack} className="flex-1 h-10 sm:h-11 text-sm sm:text-base">
                <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                ย้อนกลับ
              </Button>
            )}
            {currentStep < 3 ? (
              <Button
                onClick={handleNext}
                disabled={
                  (currentStep === 1 && !canProceedStep1) ||
                  (currentStep === 2 && !canProceedStep2)
                }
                className="flex-1 gradient-bear h-10 sm:h-11 text-sm sm:text-base"
              >
                ถัดไป
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1.5 sm:ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting || isOnCooldown}
                className="flex-1 gradient-bear h-10 sm:h-11 text-sm sm:text-base"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-spin" />
                ) : isOnCooldown ? (
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-pulse" />
                ) : (
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                )}
                {isSubmitting ? 'กำลังส่ง...' : isOnCooldown ? `รอ ${formattedTime}` : 'เสร็จสิ้น'}
              </Button>
            )}
          </div>
        </div>
        <TurnstileWidget ref={turnstileRef} siteKey={siteKey} action="create_session" />
      </main>

      {/* Milestone Popup */}
      <MilestonePopup
        open={showMilestone}
        onOpenChange={setShowMilestone}
        data={milestoneData}
      />
    </div>
  );
}
