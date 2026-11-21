import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Megaphone,
  Search,
  ExternalLink,
  CheckCircle2,
  Clock,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
  Globe,
  Loader2,
  Eye,
  EyeOff,
  Server,
  KeyRound,
  ShieldAlert,
  LogOut,
  UserCheck,
  Settings,
  AlertCircle,
  Plus,
  X,
  Layers,
  Terminal,
  Activity,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  Hash
} from 'lucide-react';

interface ScrapedPost {
  url: string;
  text: string;
  timeText: string;
  keyword: string;
  groupId: string;
}

interface WorkerLog {
  time: string;
  msg: string;
}

interface ScrapeProgress {
  status: 'idle' | 'running' | 'completed' | 'error';
  lastMsg?: string;
  logs: WorkerLog[];
  count?: number;
}

const STORAGE_CONFIG_KEY = 'bear_cafe_fb_scraper_config_v2';
const STORAGE_PROMOTED_KEY = 'bear_cafe_fb_promoted_urls_v1';

const PRESET_KEYWORDS = ['หาดิสสิง', 'หาดิสเข้า', 'หาคนเข้าดิส', 'หาดิสลง', 'หาดิส'];
const WORKER_URL = 'http://103.245.164.156:3000';

export function PromotionManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const currentUserId = user?.discord_id || user?.id || 'default';

  // Settings State - Separated Lists (Max 5 each)
  const [groups, setGroups] = useState<string[]>(['https://www.facebook.com/groups/890491118790452']);
  const [keywords, setKeywords] = useState<string[]>(['หาดิสสิง', 'หาดิสเข้า', 'หาคนเข้าดิส', 'หาดิสลง']);
  const [keywordInput, setKeywordInput] = useState('');
  const [maxDays, setMaxDays] = useState(7);
  const [excludeLinks, setExcludeLinks] = useState(true);
  const [headless, setHeadless] = useState(true);

  // Scraping & Results State
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<ScrapedPost[]>([]);
  const [promotedUrls, setPromotedUrls] = useState<string[]>([]);
  const [hidePromoted, setHidePromoted] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Live Progress & Log State
  const [progress, setProgress] = useState<ScrapeProgress | null>(null);
  const [showLiveLogs, setShowLiveLogs] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Worker & Facebook Session Status
  const [workerOnline, setWorkerOnline] = useState<boolean | null>(null);
  const [fbLoggedIn, setFbLoggedIn] = useState<boolean | null>(null);

  // Facebook Login Modal State
  const [fbModalOpen, setFbModalOpen] = useState(false);
  const [fbEmail, setFbEmail] = useState('');
  const [fbPassword, setFbPassword] = useState('');
  const [fb2faCode, setFb2faCode] = useState('');
  const [fbStep, setFbStep] = useState<'credentials' | '2fa'>('credentials');
  const [fbAuthLoading, setFbAuthLoading] = useState(false);
  const [fbError, setFbError] = useState<string | null>(null);

  // Load saved config & promoted history from localStorage
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (Array.isArray(parsed.groups) && parsed.groups.length > 0) {
          setGroups(parsed.groups.slice(0, 5));
        }
        if (Array.isArray(parsed.keywords) && parsed.keywords.length > 0) {
          setKeywords(parsed.keywords.slice(0, 5));
        }
        if (parsed.maxDays) setMaxDays(parsed.maxDays);
        if (typeof parsed.excludeLinks === 'boolean') setExcludeLinks(parsed.excludeLinks);
        if (typeof parsed.headless === 'boolean') setHeadless(parsed.headless);
      }

      const savedPromoted = localStorage.getItem(STORAGE_PROMOTED_KEY);
      if (savedPromoted) {
        setPromotedUrls(JSON.parse(savedPromoted));
      }
    } catch (e) {
      console.error('Failed to load local storage:', e);
    }
  }, []);

  // Check Worker & Facebook User Session Status
  const checkWorkerAndStatus = useCallback(async () => {
    try {
      const cleanUrl = WORKER_URL.replace(/\/$/, '');
      const res = await fetch(`${cleanUrl}/api/status?userId=${encodeURIComponent(currentUserId)}`, {
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const data = await res.json();
        setWorkerOnline(true);
        setFbLoggedIn(Boolean(data.loggedIn));
      } else {
        setWorkerOnline(false);
        setFbLoggedIn(false);
      }
    } catch (err) {
      setWorkerOnline(false);
      setFbLoggedIn(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    checkWorkerAndStatus();
    const interval = setInterval(checkWorkerAndStatus, 15000);
    return () => clearInterval(interval);
  }, [checkWorkerAndStatus]);

  // Save config changes to localStorage
  const saveCurrentConfig = (newGroups?: string[], newKeywords?: string[], newDays?: number) => {
    try {
      const config = {
        groups: newGroups || groups,
        keywords: newKeywords || keywords,
        maxDays: newDays !== undefined ? newDays : maxDays,
        excludeLinks,
        headless
      };
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save config:', e);
    }
  };

  // Group Handlers (Max 5)
  const handleAddGroup = () => {
    if (groups.length >= 5) {
      toast({ title: 'จำกัดสูงสุด 5 กลุ่ม', description: 'สามารถกำหนดกลุ่ม Facebook ได้สูงสุดไม่เกิน 5 กลุ่มค่ะ', variant: 'destructive' });
      return;
    }
    const updated = [...groups, ''];
    setGroups(updated);
    saveCurrentConfig(updated);
  };

  const handleUpdateGroup = (index: number, value: string) => {
    const updated = [...groups];
    updated[index] = value;
    setGroups(updated);
    saveCurrentConfig(updated);
  };

  const handleRemoveGroup = (index: number) => {
    if (groups.length <= 1) {
      setGroups(['']);
      saveCurrentConfig(['']);
      return;
    }
    const updated = groups.filter((_, i) => i !== index);
    setGroups(updated);
    saveCurrentConfig(updated);
  };

  // Helper to validate individual group input
  const getGroupType = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return null;
    if (trimmed.includes('facebook.com/groups/')) return 'url';
    if (/^\d+$/.test(trimmed)) return 'id';
    return 'invalid';
  };

  // Keyword Handlers (Max 5)
  const handleAddKeyword = (kw?: string) => {
    const targetKw = (kw || keywordInput).trim();
    if (!targetKw) return;

    if (keywords.length >= 5) {
      toast({ title: 'จำกัดสูงสุด 5 คำค้นหา', description: 'กำหนดคีย์เวิร์ดค้นหาได้สูงสุดไม่เกิน 5 คำค่ะ', variant: 'destructive' });
      return;
    }

    if (keywords.includes(targetKw)) {
      toast({ title: 'มีคำค้นหานี้อยู่แล้ว' });
      setKeywordInput('');
      return;
    }

    const updated = [...keywords, targetKw];
    setKeywords(updated);
    setKeywordInput('');
    saveCurrentConfig(undefined, updated);
  };

  const handleRemoveKeyword = (kwToRemove: string) => {
    const updated = keywords.filter(k => k !== kwToRemove);
    setKeywords(updated);
    saveCurrentConfig(undefined, updated);
  };

  const handleDaysChange = (val: number) => {
    const clamped = Math.min(Math.max(val, 1), 30);
    setMaxDays(clamped);
    saveCurrentConfig(undefined, undefined, clamped);
  };

  // Facebook Login Actions
  const handleFacebookLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFbAuthLoading(true);
    setFbError(null);

    const cleanUrl = WORKER_URL.replace(/\/$/, '');

    try {
      if (fbStep === 'credentials') {
        if (!fbEmail.trim() || !fbPassword.trim()) {
          setFbError('กรุณากรอกอีเมลหรือเบอร์โทร และรหัสผ่าน');
          setFbAuthLoading(false);
          return;
        }

        const res = await fetch(`${cleanUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            email: fbEmail.trim(),
            password: fbPassword.trim()
          })
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          throw new Error(data.error || 'เข้าสู่ระบบ Facebook ไม่สำเร็จ');
        }

        if (data.require2FA) {
          setFbStep('2fa');
          toast({
            title: 'ต้องการรหัส 2FA',
            description: data.message || 'กรุณากรอกรหัสความปลอดภัย 6 หลักจากแอปยืนยันตัวตนหรือ SMS'
          });
        } else if (data.success) {
          setFbLoggedIn(true);
          setFbModalOpen(false);
          setFbPassword('');
          setFb2faCode('');
          toast({
            title: 'เชื่อมต่อบัญชีสำเร็จ 🎉',
            description: 'บันทึกเซสชัน Facebook ของคุณพร้อมใช้งานแล้ว'
          });
        }
      } else {
        // 2FA Step
        if (!fb2faCode.trim()) {
          setFbError('กรุณากรอกรหัส 2FA (6 หลัก)');
          setFbAuthLoading(false);
          return;
        }

        const res = await fetch(`${cleanUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            twoFactorCode: fb2faCode.trim()
          })
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          throw new Error(data.error || 'การยืนยันรหัส 2FA ไม่ถูกต้อง');
        }

        setFbLoggedIn(true);
        setFbModalOpen(false);
        setFbPassword('');
        setFb2faCode('');
        setFbStep('credentials');
        toast({
          title: 'ยืนยัน 2FA สำเร็จ 🎉',
          description: 'เชื่อมต่อบัญชี Facebook ของคุณเรียบร้อยแล้ว'
        });
      }
    } catch (err: any) {
      setFbError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setFbAuthLoading(false);
    }
  };

  const handleFacebookLogout = async () => {
    if (!confirm('คุณต้องการตัดการเชื่อมต่อบัญชี Facebook ของคุณออกจากเซิร์ฟเวอร์หรือไม่?')) return;
    try {
      const cleanUrl = WORKER_URL.replace(/\/$/, '');
      const res = await fetch(`${cleanUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId })
      });
      if (res.ok) {
        setFbLoggedIn(false);
        toast({ title: 'ออกจากระบบ Facebook แล้ว' });
      }
    } catch (err: any) {
      toast({ title: 'ไม่สามารถออกจากระบบได้', description: err.message, variant: 'destructive' });
    }
  };

  // Promoted URLs management
  const markAsPromoted = (url: string) => {
    if (!promotedUrls.includes(url)) {
      const updated = [...promotedUrls, url];
      setPromotedUrls(updated);
      localStorage.setItem(STORAGE_PROMOTED_KEY, JSON.stringify(updated));
    }
  };

  const togglePromoteStatus = (url: string) => {
    let updated: string[];
    if (promotedUrls.includes(url)) {
      updated = promotedUrls.filter(u => u !== url);
      toast({ title: 'ยกเลิกสถานะโปรโมทแล้ว' });
    } else {
      updated = [...promotedUrls, url];
      toast({ title: 'มาร์กว่าโปรโมทแล้ว 🎉' });
    }
    setPromotedUrls(updated);
    localStorage.setItem(STORAGE_PROMOTED_KEY, JSON.stringify(updated));
  };

  const openAndPromote = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    markAsPromoted(url);
  };

  const clearPromotedHistory = () => {
    if (promotedUrls.length === 0) return;
    if (confirm(`คุณต้องการล้างประวัติโพสต์ที่เคยโปรโมททั้งหมด (${promotedUrls.length} รายการ) หรือไม่?`)) {
      setPromotedUrls([]);
      localStorage.removeItem(STORAGE_PROMOTED_KEY);
      toast({ title: 'ล้างประวัติเรียบร้อยแล้ว' });
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast({ title: 'คัดลอกลิงก์โพสต์แล้ว 📋' });
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  // Poll progress while scraping
  const startProgressPolling = () => {
    const cleanUrl = WORKER_URL.replace(/\/$/, '');
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${cleanUrl}/api/scrape/status?userId=${encodeURIComponent(currentUserId)}`);
        if (res.ok) {
          const data = await res.json();
          setProgress(data);
        }
      } catch (e) {
        // ignore polling errors
      }
    }, 1500);
  };

  const stopProgressPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // Run Scraper Request
  const handleStartScrape = async () => {
    const cleanGroups = groups.map(g => g.trim()).filter(Boolean);
    const cleanKeywords = keywords.map(k => k.trim()).filter(Boolean);

    if (cleanGroups.length === 0) {
      toast({ title: 'กรุณากรอกกลุ่ม Facebook', description: 'ระบุลิงก์หรือ Group ID อย่างน้อย 1 กลุ่ม (สูงสุด 5 กลุ่ม)', variant: 'destructive' });
      return;
    }
    if (cleanKeywords.length === 0) {
      toast({ title: 'กรุณากรอกคีย์เวิร์ด', description: 'ระบุคำค้นหาอย่างน้อย 1 คำ (สูงสุด 5 คำ)', variant: 'destructive' });
      return;
    }

    if (fbLoggedIn === false) {
      setFbModalOpen(true);
      toast({
        title: 'ยังไม่ได้เชื่อมต่อ Facebook',
        description: 'กรุณาเข้าสู่ระบบ Facebook ของคุณก่อนเริ่มดึงโพสต์',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    setProgress({
      status: 'running',
      lastMsg: 'กำลังส่งคำสั่งไปยังเซิร์ฟเวอร์...',
      logs: [{ time: new Date().toLocaleTimeString('th-TH'), msg: '🚀 ส่งคำขอค้นหาโพสต์ไปยังเซิร์ฟเวอร์แล้ว...' }]
    });

    startProgressPolling();
    saveCurrentConfig();

    try {
      const res = await fetch(`${WORKER_URL.replace(/\/$/, '')}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          groups: cleanGroups,
          keywords: cleanKeywords,
          maxDays,
          excludeLinks,
          headless
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ไม่สามารถดึงข้อมูลได้');

      setPosts(data.posts || []);
      toast({
        title: 'ดึงข้อมูลสำเร็จ 🎉',
        description: `พบทั้งหมด ${data.count || 0} โพสต์ที่เข้าเงื่อนไข (${maxDays} วันล่าสุด)`
      });
    } catch (err: any) {
      toast({
        title: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
        description: err.message || 'โปรดตรวจสอบสถานะการทำงานของ Worker และเซสชัน Facebook',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      stopProgressPolling();
    }
  };

  // Filtered posts based on hidePromoted switch
  const displayedPosts = posts.filter(post => {
    if (hidePromoted && promotedUrls.includes(post.url)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                งานโปรโมท ₊ หาคนเข้าดิส
              </h2>
              <p className="text-xs text-muted-foreground">
                ดึงโพสต์หาดิสคอร์ดจากกลุ่ม Facebook ผ่านเซิร์ฟเวอร์ (สูงสุด 5 กลุ่ม / 5 คีย์เวิร์ด / 1–30 วัน)
              </p>
            </div>
          </div>
        </div>

        {/* Worker & Facebook Connection Status */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Worker Service Status */}
          <div className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border shadow-2xs ${
            workerOnline === true
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              : workerOnline === false
              ? 'bg-destructive/15 text-destructive border-destructive/30'
              : 'bg-muted text-muted-foreground border-border/60'
          }`}>
            <span className={`w-2 h-2 rounded-full ${workerOnline ? 'bg-emerald-500 animate-pulse' : 'bg-destructive'}`} />
            <span>{workerOnline ? 'Worker ออนไลน์' : 'Worker ออฟไลน์'}</span>
          </div>

          {/* Facebook Account Status */}
          {workerOnline && (
            fbLoggedIn ? (
              <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-medium">
                <UserCheck className="w-3.5 h-3.5" />
                <span>เฟสเชื่อมต่อแล้ว</span>
                <button
                  type="button"
                  onClick={handleFacebookLogout}
                  className="ml-1 text-muted-foreground hover:text-destructive transition cursor-pointer"
                  title="ออกจากระบบ Facebook"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setFbStep('credentials'); setFbError(null); setFbModalOpen(true); }}
                className="h-8 gap-1.5 text-xs rounded-full border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>เชื่อมต่อ Facebook ของฉัน</span>
              </Button>
            )
          )}
        </div>
      </div>

      {/* ─── Configuration Form ─── */}
      <Card className="border border-border/60 shadow-xs bg-card/60 backdrop-blur-md">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            ตั้งค่าการค้นหาโพสต์
          </CardTitle>
          <CardDescription className="text-xs">
            กำหนดกลุ่มและคีย์เวิร์ด (จำกัดสูงสุดอย่างละ 5 รายการ เพื่อความรวดเร็วและประสิทธิภาพของระบบ)
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Target Groups (Separated Rows, Max 5) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-foreground flex items-center gap-2">
                  <span>กลุ่มเป้าหมาย</span>
                  <Badge variant="outline" className={`text-[11px] font-mono ${groups.length >= 5 ? 'border-amber-500 text-amber-500' : ''}`}>
                    {groups.length}/5 กลุ่ม
                  </Badge>
                </Label>
                {groups.length < 5 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAddGroup}
                    className="h-7 text-xs text-primary hover:text-primary gap-1 px-2 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มกลุ่ม</span>
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                {groups.map((groupVal, idx) => {
                  const gType = getGroupType(groupVal);
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[11px] font-mono text-muted-foreground shrink-0">
                        {idx + 1}
                      </div>
                      <div className="relative flex-1">
                        <Input
                          value={groupVal}
                          onChange={e => handleUpdateGroup(idx, e.target.value)}
                          placeholder="https://www.facebook.com/groups/xxxx หรือ Group ID"
                          className="h-9 text-xs font-mono rounded-xl pr-24 border-border/60"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                          {gType === 'url' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-sans flex items-center gap-1">
                              <LinkIcon className="w-2.5 h-2.5" /> ลิงก์กลุ่ม
                            </span>
                          )}
                          {gType === 'id' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 font-sans flex items-center gap-1">
                              <Hash className="w-2.5 h-2.5" /> Group ID
                            </span>
                          )}
                          {gType === 'invalid' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-sans">
                              ระบุ URL / ID
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveGroup(idx)}
                        className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                        title="ลบกลุ่มนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                รองรับทั้งลิงก์เต็มของกลุ่ม Facebook หรือตัวเลข Group ID สูงสุด 5 กลุ่ม
              </p>
            </div>

            {/* 2. Keywords (Chips/Tags, Max 5) */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-foreground flex items-center gap-2">
                    <span>คีย์เวิร์ดที่ต้องการหา</span>
                    <Badge variant="outline" className={`text-[11px] font-mono ${keywords.length >= 5 ? 'border-amber-500 text-amber-500' : ''}`}>
                      {keywords.length}/5 คำ
                    </Badge>
                  </Label>
                </div>

                {/* Tag Input */}
                <div className="flex items-center gap-2">
                  <Input
                    value={keywordInput}
                    disabled={keywords.length >= 5}
                    onChange={e => setKeywordInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddKeyword();
                      }
                    }}
                    placeholder={keywords.length >= 5 ? 'กำหนดครบ 5 คีย์เวิร์ดแล้ว' : 'พิมพ์คำค้นหาแล้วกด Enter หรือปุ่มเพิ่ม'}
                    className="h-9 text-xs rounded-xl border-border/60"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={keywords.length >= 5 || !keywordInput.trim()}
                    onClick={() => handleAddKeyword()}
                    className="h-9 gap-1 text-xs rounded-xl cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่ม</span>
                  </Button>
                </div>

                {/* Keyword Chips */}
                <div className="flex flex-wrap items-center gap-1.5 min-h-[32px] p-2 rounded-xl border border-border/50 bg-background/50">
                  {keywords.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">ยังไม่มีคำค้นหา</span>
                  ) : (
                    keywords.map(kw => (
                      <Badge
                        key={kw}
                        variant="secondary"
                        className="text-xs pl-2.5 pr-1 py-1 rounded-lg gap-1.5 font-medium bg-primary/10 text-primary border border-primary/20"
                      >
                        <span>{kw}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyword(kw)}
                          className="hover:bg-primary/20 rounded-md p-0.5 cursor-pointer text-primary transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>

                {/* Preset Suggestions */}
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <span className="text-[11px] text-muted-foreground mr-1">แนะนำ:</span>
                  {PRESET_KEYWORDS.map(p => (
                    <button
                      key={p}
                      type="button"
                      disabled={keywords.includes(p) || keywords.length >= 5}
                      onClick={() => handleAddKeyword(p)}
                      className={`text-[11px] px-2 py-0.5 rounded-md border transition cursor-pointer ${
                        keywords.includes(p)
                          ? 'opacity-40 line-through border-transparent text-muted-foreground cursor-not-allowed'
                          : 'bg-muted/60 hover:bg-muted text-foreground border-border/60'
                      }`}
                    >
                      + {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Days Slider & Presets */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">
                    อายุโพสต์ไม่เกิน: <span className="text-primary font-bold">{maxDays} วัน</span>
                  </Label>
                  <div className="flex items-center gap-1">
                    {[3, 7, 14, 30].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleDaysChange(d)}
                        className={`text-[11px] px-2 py-0.5 rounded-lg border transition cursor-pointer font-medium ${
                          maxDays === d
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted/60 hover:bg-muted text-muted-foreground border-border/60'
                        }`}
                      >
                        {d} วัน
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Slider
                    min={1}
                    max={30}
                    step={1}
                    value={[maxDays]}
                    onValueChange={vals => handleDaysChange(vals[0])}
                    className="flex-1 cursor-pointer"
                  />
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={maxDays}
                    onChange={e => handleDaysChange(parseInt(e.target.value, 10) || 7)}
                    className="w-16 h-8 text-xs text-center font-bold rounded-lg border-border/60"
                  />
                </div>
              </div>

              {/* Switches */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/50 bg-background/50">
                  <Label htmlFor="sw-links" className="text-xs cursor-pointer text-foreground">
                    🚫 กรองโพสต์ที่มีลิงก์ออก
                  </Label>
                  <Switch
                    id="sw-links"
                    checked={excludeLinks}
                    onCheckedChange={v => { setExcludeLinks(v); saveCurrentConfig(); }}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/50 bg-background/50">
                  <Label htmlFor="sw-headless" className="text-xs cursor-pointer text-foreground">
                    🖥️ รันเบื้องหลัง (Headless)
                  </Label>
                  <Switch
                    id="sw-headless"
                    checked={headless}
                    onCheckedChange={v => { setHeadless(v); saveCurrentConfig(); }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Server className="w-3.5 h-3.5" />
              <span>Session บัญชี Discord ID: <span className="font-mono text-foreground font-semibold">{currentUserId}</span></span>
            </div>

            <Button
              onClick={handleStartScrape}
              disabled={loading}
              className="gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 shadow-xs cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังค้นหาโพสต์...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>เริ่มดึงโพสต์ ({groups.filter(Boolean).length} กลุ่ม, {keywords.length} คำ)</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Real-time Progress & Stepper Section (When Scraping) ─── */}
      {loading && (
        <Card className="border border-primary/40 bg-primary/5 shadow-md rounded-2xl overflow-hidden animate-in fade-in duration-300">
          <CardHeader className="pb-3 border-b border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary animate-pulse" />
                <CardTitle className="text-sm font-semibold text-foreground">
                  สถานะการประมวลผลบนเซิร์ฟเวอร์แบบ Real-time
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLiveLogs(!showLiveLogs)}
                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2 cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>{showLiveLogs ? 'ย่อ Log' : 'ขยาย Log'}</span>
                {showLiveLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            {/* Live Status Message */}
            <div className="p-3 rounded-xl bg-background/80 border border-border/60 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">
                  {progress?.lastMsg || 'กำลังเชื่อมต่อและเริ่มทำงานบนเซิร์ฟเวอร์...'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  ระบบกำลังเปิดเบราว์เซอร์ Chromium จำลองบน VPS เพื่อค้นหาและคัดกรองโพสต์ให้อัตโนมัติ
                </p>
              </div>
            </div>

            {/* Stepper Progress */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
              <div className="p-2.5 rounded-xl border border-primary/30 bg-primary/10 text-xs font-medium text-primary">
                1. เริ่มเบราว์เซอร์
              </div>
              <div className="p-2.5 rounded-xl border border-primary/30 bg-primary/10 text-xs font-medium text-primary">
                2. ค้นหาตามกลุ่ม
              </div>
              <div className="p-2.5 rounded-xl border border-primary/30 bg-primary/10 text-xs font-medium text-primary">
                3. กรองวันที่ & ลิงก์
              </div>
              <div className="p-2.5 rounded-xl border border-border/60 bg-muted/40 text-xs font-medium text-muted-foreground">
                4. สรุปผลลัพธ์
              </div>
            </div>

            {/* Live Terminal Log Stream */}
            {showLiveLogs && progress?.logs && progress.logs.length > 0 && (
              <div className="rounded-xl bg-zinc-950 p-3 text-zinc-100 font-mono text-[11px] space-y-1 max-h-48 overflow-y-auto border border-zinc-800 shadow-inner">
                {progress.logs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-zinc-500 shrink-0">[{log.time}]</span>
                    <span className={log.msg.includes('✅') || log.msg.includes('🎉') ? 'text-emerald-400 font-semibold' : log.msg.includes('⚠️') ? 'text-amber-400' : 'text-zinc-200'}>
                      {log.msg}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Results Section ─── */}
      <Card className="border border-border/60 shadow-xs bg-card/60 backdrop-blur-md">
        <CardHeader className="pb-3 border-b border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
              <Sparkles className="w-4 h-4 text-amber-500" />
              รายการโพสต์ที่พบ ({displayedPosts.length} โพสต์)
            </CardTitle>
            <CardDescription className="text-xs">
              คลิก "เปิดโพสต์" เพื่อเปิดลิงก์ไปยัง Facebook โดยตรง ระบบจะบันทึกสถานะว่าโปรโมทแล้วให้อัตโนมัติ
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Toggle */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/60 bg-background/50 text-xs">
              <Switch
                id="sw-hide-promoted"
                checked={hidePromoted}
                onCheckedChange={setHidePromoted}
              />
              <Label htmlFor="sw-hide-promoted" className="cursor-pointer text-xs flex items-center gap-1.5">
                {hidePromoted ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>ซ่อนโพสต์ที่โปรโมทแล้ว</span>
              </Label>
            </div>

            {/* Total Promoted Badge & Clear Button */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>โปรโมทสะสม: <b className="text-emerald-600 dark:text-emerald-400">{promotedUrls.length}</b></span>
              {promotedUrls.length > 0 && (
                <button
                  type="button"
                  onClick={clearPromotedHistory}
                  className="text-muted-foreground hover:text-destructive transition cursor-pointer"
                  title="ล้างประวัติที่เคยคลิก"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {displayedPosts.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
                <Globe className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium">ยังไม่มีข้อมูลโพสต์ที่แสดงผล</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {posts.length > 0 && hidePromoted
                  ? 'โพสต์ทั้งหมดถูกทำเครื่องหมายว่า "โปรโมทแล้ว" (ลองปิดตัวเลือกซ่อนโพสต์ที่โปรโมทแล้ว)'
                  : 'กดปุ่ม "เริ่มดึงโพสต์" ด้านบน เพื่อให้บอทเปิดหน้ากลุ่มและคัดกรองโพสต์ที่ตรงเงื่อนไข'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedPosts.map((post, idx) => {
                const isDone = promotedUrls.includes(post.url);
                return (
                  <div
                    key={`${post.url}-${idx}`}
                    className={`p-4 rounded-2xl border transition-all ${
                      isDone
                        ? 'border-emerald-500/30 bg-emerald-500/5 opacity-80'
                        : 'border-border/60 bg-background/80 hover:border-primary/40 hover:shadow-2xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      {/* Left: Content & Badges */}
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {isDone ? (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px]">
                              <CheckCircle2 className="w-3 h-3" />
                              โปรโมทแล้ว
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-[11px]">
                              <Clock className="w-3 h-3" />
                              ยังไม่โปรโมท
                            </Badge>
                          )}

                          <Badge variant="secondary" className="text-[11px] font-semibold">
                            คำที่ตรง: {post.keyword}
                          </Badge>

                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {post.timeText || 'ไม่ระบุเวลา'}
                          </span>

                          <span className="text-xs text-muted-foreground font-mono">
                            กลุ่ม: {post.groupId}
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm text-foreground/90 line-clamp-3 leading-relaxed whitespace-pre-line">
                          {post.text || 'ไม่มีเนื้อหาข้อความ'}
                        </p>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => openAndPromote(post.url)}
                          className={`gap-1.5 rounded-xl text-xs font-semibold h-9 px-4 cursor-pointer shadow-2xs ${
                            isDone
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                          }`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>{isDone ? 'เปิดดูซ้ำ' : 'เปิดโพสต์'}</span>
                        </Button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(post.url)}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition p-1 cursor-pointer"
                            title="คัดลอกลิงก์"
                          >
                            {copiedUrl === post.url ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => togglePromoteStatus(post.url)}
                            className={`text-[11px] underline transition cursor-pointer ${
                              isDone ? 'text-muted-foreground hover:text-destructive' : 'text-primary hover:text-primary/80'
                            }`}
                          >
                            {isDone ? 'ยกเลิกสถานะ' : 'มาร์กว่าทำแล้ว'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Facebook Account Login Modal ─── */}
      <Dialog open={fbModalOpen} onOpenChange={setFbModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader className="space-y-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="w-5 h-5 text-primary" />
              <span>{fbStep === 'credentials' ? 'เชื่อมต่อบัญชี Facebook ของฉัน' : 'ยืนยันรหัสความปลอดภัย 2FA'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              {fbStep === 'credentials'
                ? 'ระบบจะบันทึกเซสชันแยกตาม Discord ID ของคุณบนเซิร์ฟเวอร์ โดยไม่แชร์บัญชีหรือข้อมูลกับสมาชิกท่านอื่น'
                : 'Facebook ตรวจพบการเข้าสู่ระบบใหม่ กรุณากรอกรหัสยืนยัน 2FA (รหัส 6 หลักจากแอป Authenticator หรือ SMS)'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFacebookLoginSubmit} className="space-y-4 pt-2">
            {fbError && (
              <div className="p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{fbError}</span>
              </div>
            )}

            {fbStep === 'credentials' ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">อีเมล หรือ หมายเลขโทรศัพท์ Facebook</Label>
                  <Input
                    type="text"
                    required
                    value={fbEmail}
                    onChange={e => setFbEmail(e.target.value)}
                    placeholder="example@email.com หรือ 08xxxxxxxx"
                    className="rounded-xl text-sm"
                    disabled={fbAuthLoading}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">รหัสผ่าน Facebook</Label>
                  <Input
                    type="password"
                    required
                    value={fbPassword}
                    onChange={e => setFbPassword(e.target.value)}
                    placeholder="••••••••"
                    className="rounded-xl text-sm"
                    disabled={fbAuthLoading}
                  />
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 text-[11px] leading-relaxed flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    แนะนำให้ใช้บัญชีเฟสสำรองสำหรับการโปรโมท ข้อมูลรหัสผ่านจะถูกส่งผ่านบอทเพื่อทำการ Login ครั้งเดียว และสร้าง Browser Session เก็บไว้
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">รหัส 2FA (6 หลัก)</Label>
                  <Input
                    type="text"
                    maxLength={8}
                    required
                    autoFocus
                    value={fb2faCode}
                    onChange={e => setFb2faCode(e.target.value)}
                    placeholder="เช่น 123456"
                    className="rounded-xl text-center text-lg font-mono tracking-widest"
                    disabled={fbAuthLoading}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  กรุณากรอกรหัสภายใน 3 นาที ก่อนที่เซสชันจะหมดอายุ
                </p>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              {fbStep === '2fa' && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setFbStep('credentials')}
                  disabled={fbAuthLoading}
                  className="rounded-xl text-xs cursor-pointer"
                >
                  ย้อนกลับ
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => setFbModalOpen(false)}
                disabled={fbAuthLoading}
                className="rounded-xl text-xs cursor-pointer"
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                disabled={fbAuthLoading}
                className="rounded-xl text-xs bg-primary text-primary-foreground font-semibold gap-1.5 cursor-pointer"
              >
                {fbAuthLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังเข้าสู่ระบบ (รอสักครู่)...</span>
                  </>
                ) : (
                  <span>{fbStep === 'credentials' ? 'เข้าสู่ระบบ Facebook' : 'ยืนยันรหัส 2FA'}</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
