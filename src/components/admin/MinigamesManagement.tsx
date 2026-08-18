import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Gamepad2, Plus, Trash2, Save, RefreshCw, Trophy, Sparkles, Medal, Award, Crown,
  Calendar, Infinity as InfinityIcon, Settings2, Edit3, Search, Info, ListFilter,
  CheckCircle2, ChevronLeft, ChevronRight, HelpCircle, Layers, Check,
} from 'lucide-react';

export const MINIGAME_CONFIGS: Record<number, { id: number; name: string; icon: string; tag: string; type: string; desc: string }> = {
  1: { id: 1, name: 'เติมคำศัพท์ (ไทย)', icon: '🇹🇭', tag: 'คำศัพท์ไทย', type: 'single_thai', desc: 'เติมพยัญชนะ/สระในช่องว่าง (แชร์คลังคำศัพท์ไทยกับเกม 5)' },
  2: { id: 2, name: 'เติมคำศัพท์ (อังกฤษ)', icon: '🇬🇧', tag: 'คำศัพท์อังกฤษ', type: 'single_eng', desc: 'เติมตัวอักษรภาษาอังกฤษ (แชร์คลังคำศัพท์อังกฤษกับเกม 6)' },
  3: { id: 3, name: 'สุ่มโจทย์คณิตฯ', icon: '🔢', tag: 'คณิตศาสตร์', type: 'math', desc: 'สร้างสมการบวก ลบ คูณ อัตโนมัติจากโค้ดบอท' },
  4: { id: 4, name: 'ทายคำจากคำใบ้', icon: '💡', tag: 'คำใบ้', type: 'hints', desc: 'ทายคำจากคำใบ้ 3 ข้อ + เลือกระดับความยาก' },
  5: { id: 5, name: 'เรียงคำศัพท์ (ไทย)', icon: '🔤', tag: 'คำศัพท์ไทย', type: 'single_thai', desc: 'เรียงตัวอักษรไทยที่สลับตำแหน่ง (แชร์กับเกม 1)' },
  6: { id: 6, name: 'เรียงคำศัพท์ (อังกฤษ)', icon: '🔡', tag: 'คำศัพท์อังกฤษ', type: 'single_eng', desc: 'เรียงตัวอักษรอังกฤษที่สลับตำแหน่ง (แชร์กับเกม 2)' },
  7: { id: 7, name: 'พิมพ์คำต่อไปนี้ (ไทย)', icon: '⌨️', tag: 'พิมพ์เร็วไทย', type: 'typing_th', desc: 'พิมพ์ข้อความหรือประโยคภาษาไทยให้ถูกต้องรวดเร็ว' },
  8: { id: 8, name: 'พิมพ์คำต่อไปนี้ (อังกฤษ)', icon: '💻', tag: 'พิมพ์เร็วอังกฤษ', type: 'typing_en', desc: 'พิมพ์ข้อความหรือประโยคภาษาอังกฤษให้ถูกต้องรวดเร็ว' },
  9: { id: 9, name: 'ทายคำแปลภาษาอังกฤษ', icon: '🌐', tag: 'คู่คำแปล (EN ➔ TH)', type: 'translation', desc: 'โจทย์ภาษาอังกฤษ ➔ ตัวเลือกคำแปลไทย (แชร์ได้ 4 เกม)' },
  10: { id: 10, name: 'ทายคำแปลภาษาไทย', icon: '🇹🇭', tag: 'คู่คำแปล (TH ➔ EN)', type: 'translation', desc: 'โจทย์ภาษาไทย ➔ ตัวเลือกคำแปลอังกฤษ (แชร์ได้ 4 เกม)' },
  11: { id: 11, name: 'เกมต่อคำ', icon: '🔗', tag: 'ต่อคำ', type: 'word_chain', desc: 'ต่อคำศัพท์คำหน้าและคำหลัง เช่น น้ำ ➔ แข็ง' },
  12: { id: 12, name: 'ข้อไหนไม่เข้าพวก', icon: '🧩', tag: 'ไม่เข้าพวก', type: 'odd_one', desc: 'สุ่มคำศัพท์ตามหมวดหมู่เพื่อหาคำที่ไม่เข้าพวก' },
  13: { id: 13, name: 'จริงหรือเท็จ', icon: '❓', tag: 'จริง/เท็จ', type: 'true_false', desc: 'ทายว่าข้อความหรือข้อเท็จจริงนั้น จริง หรือ เท็จ' },
};

interface MinigameSetting {
  game_id: number;
  game_name: string;
  channel_id: string;
  is_enabled: boolean;
  min_points: number;
  max_points: number;
}

interface Question {
  id: number;
  game_id: number;
  word_or_question: string;
  answer: string;
  hints: string[];
  options: string[];
  difficulty: 'easy' | 'medium' | 'hard' | null;
  category?: string | null;
  is_active: boolean;
}

interface LeaderboardItem {
  discord_id: string;
  total_wins: number;
  total_points: number;
  last_win: string;
}

export function MinigamesManagement() {
  const { toast } = useToast();

  // Settings & Questions state
  const [settings, setSettings] = useState<MinigameSetting[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [selectedGameFilter, setSelectedGameFilter] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [searchMatchMode, setSearchMatchMode] = useState<'starts_with' | 'contains' | 'exact'>('starts_with');

  // Form Add Question state
  const [formGameId, setFormGameId] = useState<string>('9');
  const [formQuestion, setFormQuestion] = useState<string>('');
  const [formAnswer, setFormAnswer] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('คำทั่วไป');
  const [formDifficulty, setFormDifficulty] = useState<string>('medium');
  const [formHint1, setFormHint1] = useState<string>('');
  const [formHint2, setFormHint2] = useState<string>('');
  const [formHint3, setFormHint3] = useState<string>('');

  // Category filter state
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Edit Modal state
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editQuestion, setEditQuestion] = useState<string>('');
  const [editAnswer, setEditAnswer] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('คำทั่วไป');
  const [editDifficulty, setEditDifficulty] = useState<string>('medium');
  const [editHint1, setEditHint1] = useState<string>('');
  const [editHint2, setEditHint2] = useState<string>('');
  const [editHint3, setEditHint3] = useState<string>('');

  // Leaderboard state
  const [lbTimeFilter, setLbTimeFilter] = useState<'30d' | 'all'>('30d');
  const [lbGameFilter, setLbGameFilter] = useState<string>('all');
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [loadingLb, setLoadingLb] = useState(false);
  const [userProfilesMap, setUserProfilesMap] = useState<Record<string, { username: string; discord_username: string | null; avatar_url: string | null }>>({});
  const [lbPage, setLbPage] = useState(1);
  const [lbItemsPerPage, setLbItemsPerPage] = useState(10);

  // Question Pagination state
  const [qPage, setQPage] = useState(1);
  const [qItemsPerPage, setQItemsPerPage] = useState(15);

  useEffect(() => {
    setQPage(1);
  }, [searchKeyword, searchMatchMode, selectedCategoryFilter, selectedGameFilter]);

  useEffect(() => {
    setLbPage(1);
  }, [lbTimeFilter, lbGameFilter]);

  // Fetch Settings
  const fetchSettings = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('minigame_settings')
        .select('*')
        .order('game_id', { ascending: true });

      if (error) throw error;
      setSettings((data as any) || []);
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการโหลดตั้งค่ามินิเกม', description: err.message, variant: 'destructive' });
    }
  };

  // Fetch Questions
  const fetchQuestions = async () => {
    setLoadingQuestions(true);
    try {
      let query = (supabase as any)
        .from('minigame_questions')
        .select('*')
        .order('id', { ascending: false })
        .range(0, 9999);

      if (selectedGameFilter !== 'all') {
        query = query.eq('game_id', Number(selectedGameFilter));
      }

      const { data, error } = await query;
      if (error) throw error;
      setQuestions((data as any) || []);
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการโหลดคลังโจทย์', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Fetch Leaderboard
  const fetchLeaderboard = async () => {
    setLoadingLb(true);
    try {
      const daysParam = lbTimeFilter === '30d' ? 30 : null;
      const gameParam = lbGameFilter !== 'all' ? Number(lbGameFilter) : null;

      // 1. Try RPC get_minigame_leaderboard
      const { data: rpcData, error: rpcErr } = await (supabase as any).rpc('get_minigame_leaderboard', {
        days_limit: daysParam,
        filter_game_id: gameParam
      });

      if (!rpcErr && rpcData) {
        const sorted: LeaderboardItem[] = rpcData.map((row: any) => ({
          discord_id: row.discord_id,
          total_wins: Number(row.wins || 0),
          total_points: Number(row.points || 0),
          last_win: row.last_win || new Date().toISOString()
        }));
        setLeaderboard(sorted);
        return;
      }

      // 2. Fallback query with extended range
      let query = (supabase as any)
        .from('minigame_wins')
        .select('discord_id, game_id, points_earned, created_at')
        .range(0, 49999);

      if (lbTimeFilter === '30d') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query = query.gte('created_at', thirtyDaysAgo.toISOString());
      }

      if (lbGameFilter !== 'all') {
        query = query.eq('game_id', Number(lbGameFilter));
      }

      const { data, error } = await query;
      if (error) throw error;

      const statsMap = new Map<string, LeaderboardItem>();
      for (const row of (data || []) as any[]) {
        const uid = row.discord_id;
        if (!statsMap.has(uid)) {
          statsMap.set(uid, {
            discord_id: uid,
            total_wins: 0,
            total_points: 0,
            last_win: row.created_at
          });
        }

        const stat = statsMap.get(uid)!;
        stat.total_wins += 1;
        stat.total_points += Number(row.points_earned || 0);

        if (new Date(row.created_at) > new Date(stat.last_win)) {
          stat.last_win = row.created_at;
        }
      }

      const sorted = Array.from(statsMap.values()).sort((a, b) => {
        if (b.total_wins !== a.total_wins) return b.total_wins - a.total_wins;
        return b.total_points - a.total_points;
      });

      setLeaderboard(sorted);

      // Fetch profiles for leaderboard discord_ids
      const discordIds = sorted.map((item) => item.discord_id).filter(Boolean);
      if (discordIds.length > 0) {
        const uniqueIds = Array.from(new Set(discordIds));
        const profilesMap: Record<string, { username: string; discord_username: string | null; avatar_url: string | null }> = {};
        const chunkSize = 100;
        for (let i = 0; i < uniqueIds.length; i += chunkSize) {
          const chunk = uniqueIds.slice(i, i + chunkSize);
          const { data: pData } = await (supabase as any)
            .from('profiles')
            .select('discord_id, username, discord_username, avatar_url')
            .in('discord_id', chunk);
          if (pData) {
            for (const p of pData) {
              profilesMap[p.discord_id] = {
                username: p.username,
                discord_username: p.discord_username ?? null,
                avatar_url: p.avatar_url ?? null,
              };
            }
          }
        }
        setUserProfilesMap(profilesMap);
      }
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการดึงข้อมูลจัดอันดับ', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingLb(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchQuestions();
  }, [selectedGameFilter]);

  useEffect(() => {
    fetchLeaderboard();
  }, [lbTimeFilter, lbGameFilter]);

  const handleSettingUpdate = async (game: MinigameSetting) => {
    try {
      const { error } = await (supabase as any)
        .from('minigame_settings')
        .upsert({
          game_id: game.game_id,
          game_name: game.game_name,
          channel_id: game.channel_id,
          is_enabled: game.is_enabled,
          min_points: game.min_points,
          max_points: game.max_points,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      toast({ title: 'สำเร็จ', description: `บันทึกตั้งค่าเกม #${game.game_id} เรียบร้อยแล้ว` });
      fetchSettings();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const gId = Number(formGameId);
    if (gId === 3) return; // Game 3 is dynamically generated in code

    if (!formQuestion.trim() || !formAnswer.trim()) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบถ้วน', variant: 'destructive' });
      return;
    }

    const isDiffGame = (gId === 4);
    const finalDiff = isDiffGame ? formDifficulty : null;

    let hintsArray: string[] = [];
    if (gId === 4) {
      hintsArray = [formHint1.trim(), formHint2.trim(), formHint3.trim()].filter(Boolean);
    }

    try {
      const { error } = await (supabase as any)
        .from('minigame_questions')
        .insert({
          game_id: gId,
          word_or_question: formQuestion.trim(),
          answer: formAnswer.trim(),
          category: formCategory.trim() || 'คำทั่วไป',
          hints: hintsArray,
          options: [],
          difficulty: finalDiff,
          is_active: true
        });

      if (error) throw error;
      toast({ title: 'สำเร็จ', description: 'เพิ่มคำศัพท์/โจทย์ใหม่เข้าคลังเรียบร้อยแล้ว' });
      setFormQuestion('');
      setFormAnswer('');
      setFormHint1(''); setFormHint2(''); setFormHint3('');
      fetchQuestions();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการบันทึกโจทย์', description: err.message, variant: 'destructive' });
    }
  };

  const openEditModal = (q: Question) => {
    setEditingQuestion(q);
    setEditQuestion(q.word_or_question || '');
    setEditAnswer(q.answer || '');
    setEditCategory(q.category || 'คำทั่วไป');
    setEditDifficulty(q.difficulty || 'medium');
    setEditHint1(q.hints?.[0] || '');
    setEditHint2(q.hints?.[1] || '');
    setEditHint3(q.hints?.[2] || '');
    setEditDialogOpen(true);
  };

  const handleUpdateQuestion = async () => {
    if (!editingQuestion) return;
    const gId = editingQuestion.game_id;

    if (!editQuestion.trim() || !editAnswer.trim()) {
      toast({ title: 'กรุณากรอกข้อมูลโจทย์และเฉลย', variant: 'destructive' });
      return;
    }

    let hintsArray: string[] = [];
    if (gId === 4) {
      hintsArray = [editHint1.trim(), editHint2.trim(), editHint3.trim()].filter(Boolean);
    }

    const finalDiff = (gId === 4) ? editDifficulty : null;

    try {
      const { error } = await (supabase as any)
        .from('minigame_questions')
        .update({
          word_or_question: editQuestion.trim(),
          answer: editAnswer.trim(),
          category: editCategory.trim() || 'คำทั่วไป',
          hints: hintsArray,
          options: [],
          difficulty: finalDiff,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingQuestion.id);

      if (error) throw error;
      toast({ title: 'สำเร็จ', description: `แก้ไขคำศัพท์/โจทย์ #${editingQuestion.id} เรียบร้อยแล้ว` });
      setEditDialogOpen(false);
      fetchQuestions();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการแก้ไขโจทย์', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบคำศัพท์ข้อนี้ออกจากคลัง?')) return;
    try {
      const { error } = await (supabase as any).from('minigame_questions').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'ลบคำศัพท์เรียบร้อยแล้ว' });
      fetchQuestions();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการลบ', description: err.message, variant: 'destructive' });
    }
  };

  // Filter questions by search keyword, match mode, and category
  const filteredQuestions = questions
    .filter((q) => {
      if (selectedCategoryFilter !== 'all' && (q.category || 'คำทั่วไป') !== selectedCategoryFilter) {
        return false;
      }
      if (!searchKeyword.trim()) return true;
      const kw = searchKeyword.toLowerCase().trim();
      const word = (q.word_or_question || '').toLowerCase();
      const ans = (q.answer || '').toLowerCase();
      const cat = (q.category || '').toLowerCase();
      const idStr = String(q.id);

      if (idStr === kw) return true;

      if (searchMatchMode === 'starts_with') {
        return word.startsWith(kw) || ans.startsWith(kw) || cat.startsWith(kw);
      } else if (searchMatchMode === 'exact') {
        return word === kw || ans === kw || cat === kw;
      } else {
        // contains
        return word.includes(kw) || ans.includes(kw) || cat.includes(kw);
      }
    })
    .sort((a, b) => {
      if (!searchKeyword.trim()) return 0;
      const kw = searchKeyword.toLowerCase().trim();
      const aWord = (a.word_or_question || '').toLowerCase();
      const bWord = (b.word_or_question || '').toLowerCase();
      const aStarts = aWord.startsWith(kw) || (a.answer || '').toLowerCase().startsWith(kw);
      const bStarts = bWord.startsWith(kw) || (b.answer || '').toLowerCase().startsWith(kw);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return 0;
    });

  const categoriesList = Array.from(
    new Set(questions.map((q) => q.category || 'คำทั่วไป').filter(Boolean))
  );

  const selectedGId = Number(formGameId);
  const selectedConfig = MINIGAME_CONFIGS[selectedGId] || MINIGAME_CONFIGS[9];

  const top1 = leaderboard[0] || null;
  const top2 = leaderboard[1] || null;
  const top3 = leaderboard[2] || null;

  // Paginated Leaderboard
  const totalLbPages = Math.max(1, Math.ceil(leaderboard.length / lbItemsPerPage));
  const paginatedLeaderboard = leaderboard.slice((lbPage - 1) * lbItemsPerPage, lbPage * lbItemsPerPage);

  const isFiltered = searchKeyword.trim() !== '' || selectedCategoryFilter !== 'all';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Gamepad2 className="w-6 h-6 text-purple-500" />
            ระบบจัดการมินิเกมและคลังโจทย์ (Mini-Games Hub)
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            จัดการคลังคำศัพท์ทั้ง 13 มินิเกมของบอท, กำหนด Channel ID และตรวจสอบตารางจัดอันดับผู้ชนะ
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="questions" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-xl mb-6">
          <TabsTrigger value="questions" className="flex items-center gap-2 text-xs font-semibold">
            <Edit3 className="w-4 h-4 text-blue-500" /> คลังคำศัพท์/โจทย์
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2 text-xs font-semibold">
            <Settings2 className="w-4 h-4 text-purple-500" /> ตั้งค่า Channel ID (13 เกม)
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="flex items-center gap-2 text-xs font-semibold">
            <Trophy className="w-4 h-4 text-amber-500" /> ตารางจัดอันดับผู้ชนะ
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: QUESTION BANK MANAGER */}
        <TabsContent value="questions" className="space-y-6">
          
          {/* Section 1: Add New Question */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-500" />
                    เพิ่มคำศัพท์ / โจทย์ใหม่
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    เลือกมินิเกมที่ต้องการเพิ่มข้อมูล ระบบจะปรับช่องกรอกให้สอดคล้องกับเกมนั้นอัตโนมัติ
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1 bg-muted/50">
                  {selectedConfig.icon} {selectedConfig.name}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddQuestion} className="space-y-4">
                {/* Game Selector */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">เลือกมินิเกม</label>
                    <Select value={formGameId} onValueChange={(val) => setFormGameId(val)}>
                      <SelectTrigger className="h-10 text-sm font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">คลังคำแปล & คำศัพท์แชร์</div>
                        <SelectItem value="9">🌐 เกม 9: ทายคำแปลภาษาอังกฤษ (EN ➔ TH) — ⚡ แชร์ 4 เกม</SelectItem>
                        <SelectItem value="10">🇹🇭 เกม 10: ทายคำแปลภาษาไทย (TH ➔ EN) — ⚡ แชร์ 4 เกม</SelectItem>
                        <SelectItem value="1">🇹🇭 เกม 1: เติมคำศัพท์ (ไทย) — ⚡ แชร์กับเกม 5</SelectItem>
                        <SelectItem value="2">🇬🇧 เกม 2: เติมคำศัพท์ (อังกฤษ) — ⚡ แชร์กับเกม 6</SelectItem>
                        <SelectItem value="5">🔤 เกม 5: เรียงคำศัพท์ (ไทย)</SelectItem>
                        <SelectItem value="6">🔡 เกม 6: เรียงคำศัพท์ (อังกฤษ)</SelectItem>

                        <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-1 border-t">คำใบ้ & ฝึกพิมพ์</div>
                        <SelectItem value="4">💡 เกม 4: ทายคำจากคำใบ้ (3 ข้อความ + ความยาก)</SelectItem>
                        <SelectItem value="7">⌨️ เกม 7: พิมพ์คำต่อไปนี้ (ไทย)</SelectItem>
                        <SelectItem value="8">💻 เกม 8: พิมพ์คำต่อไปนี้ (อังกฤษ)</SelectItem>

                        <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-1 border-t">มินิเกมใหม่ & ต่อคำ</div>
                        <SelectItem value="11">🔗 เกม 11: เกมต่อคำ (คำหน้า ➔ คำหลัง)</SelectItem>
                        <SelectItem value="12">🧩 เกม 12: ข้อไหนไม่เข้าพวก (คำศัพท์ + หมวดหมู่)</SelectItem>
                        <SelectItem value="13">❓ เกม 13: จริงหรือเท็จ (ข้อความ + จริง/เท็จ)</SelectItem>

                        <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-1 border-t">เกมสร้างอัตโนมัติ</div>
                        <SelectItem value="3">🔢 เกม 3: สุ่มโจทย์คณิตฯ (สร้างจากโค้ดอัตโนมัติ)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Difficulty ONLY for Game 4 */}
                  {selectedGId === 4 ? (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1 block">ระดับความยาก (เกมที่ 4)</label>
                      <Select value={formDifficulty} onValueChange={(val) => setFormDifficulty(val)}>
                        <SelectTrigger className="h-10 text-sm font-semibold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">🟢 ง่าย (Easy: 2-3 แต้ม)</SelectItem>
                          <SelectItem value="medium">🟡 ปานกลาง (Medium: 4-6 แต้ม)</SelectItem>
                          <SelectItem value="hard">🔴 ยาก (Hard: 7-10 แต้ม)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <div className="w-full p-2.5 rounded-lg bg-muted/40 border text-xs text-muted-foreground flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />
                        <span>{selectedConfig.desc}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* GAME 3 SPECIAL NOTICE */}
                {selectedGId === 3 ? (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-amber-600 dark:text-amber-400 text-xs">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block">สุ่มโจทย์คณิตศาสตร์ (เกมที่ 3)</strong>
                      เกมนี้ใช้ระบบสร้างสมการบวก ลบ คูณ แบบไดนามิกอัตโนมัติจากโค้ดบอท ไม่จำเป็นต้องเพิ่มโจทย์ในฐานข้อมูลครับ
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                          {selectedGId === 9 || selectedGId === 10
                            ? 'คำศัพท์ภาษาอังกฤษ (English Word)'
                            : selectedGId === 11
                            ? 'คำขึ้นต้น (เช่น น้ำ, รถ)'
                            : selectedGId === 12
                            ? 'คำศัพท์ / อีโมจิ (เช่น 🍎, สุนัข)'
                            : selectedGId === 13
                            ? 'ข้อความ / คำถาม'
                            : selectedGId === 7 || selectedGId === 8
                            ? 'ประโยค / ข้อความฝึกพิมพ์'
                            : 'โจทย์ / คำศัพท์'}
                        </label>
                        <Input
                          className="h-10 text-sm"
                          placeholder={
                            selectedGId === 9 || selectedGId === 10
                              ? 'เช่น Apple, Banana, Cat'
                              : selectedGId === 11
                              ? 'เช่น น้ำ, ไฟ, รถ'
                              : selectedGId === 12
                              ? 'เช่น 🐶, 🍎, 🚗'
                              : selectedGId === 13
                              ? 'เช่น ดวงอาทิตย์ขึ้นทางทิศตะวันออก'
                              : selectedGId === 7 || selectedGId === 8
                              ? 'เช่น ยินดีต้อนรับสู่ Bear Cafe'
                              : 'เช่น สวัสดี, ความสุข'
                          }
                          value={formQuestion}
                          onChange={(e) => setFormQuestion(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                          {selectedGId === 9 || selectedGId === 10
                            ? 'คำแปลภาษาไทย (Thai Translation)'
                            : selectedGId === 11
                            ? 'คำต่อท้าย (เช่น แข็ง, ไฟ)'
                            : selectedGId === 12
                            ? 'คำตอบ / ตัวเลือกที่ถูกต้อง'
                            : selectedGId === 13
                            ? 'คำตอบที่ถูกต้อง (จริง หรือ เท็จ)'
                            : 'คำตอบที่ถูกต้อง (เฉลย)'}
                        </label>
                        {selectedGId === 13 ? (
                          <div className="flex gap-2 h-10 items-center">
                            <Button
                              type="button"
                              variant={formAnswer === 'จริง' ? 'default' : 'outline'}
                              size="sm"
                              className="flex-1 h-9 font-semibold text-xs"
                              onClick={() => setFormAnswer('จริง')}
                            >
                              ✅ จริง
                            </Button>
                            <Button
                              type="button"
                              variant={formAnswer === 'เท็จ' ? 'destructive' : 'outline'}
                              size="sm"
                              className="flex-1 h-9 font-semibold text-xs"
                              onClick={() => setFormAnswer('เท็จ')}
                            >
                              ❌ เท็จ
                            </Button>
                          </div>
                        ) : (
                          <Input
                            className="h-10 text-sm text-emerald-600 dark:text-emerald-400 font-medium"
                            placeholder={
                              selectedGId === 9 || selectedGId === 10
                                ? 'เช่น แอปเปิ้ล, กล้วย, แมว'
                                : selectedGId === 11
                                ? 'เช่น แข็ง, ฟ้า'
                                : selectedGId === 12
                                ? 'เช่น 🐶'
                                : 'คำตอบที่ต้องพิมพ์ตอบ'
                            }
                            value={formAnswer}
                            onChange={(e) => setFormAnswer(e.target.value)}
                          />
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                          หมวดหมู่ (Category)
                        </label>
                        <Input
                          className="h-10 text-sm text-purple-600 dark:text-purple-400"
                          placeholder={selectedGId === 12 ? 'เช่น ผลไม้, สัตว์, ยานพาหนะ' : 'เช่น คำทั่วไป, ผลไม้, สัตว์'}
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Hints inputs ONLY for Game 4 */}
                    {selectedGId === 4 && (
                      <div className="space-y-2 pt-2 border-t border-dashed">
                        <label className="text-xs font-semibold text-purple-500 block">คำใบ้ 3 ข้อความ (สำหรับเกมที่ 4)</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                          <Input className="h-9 text-xs" placeholder="คำใบ้ที่ 1 (เช่น เป็นสัตว์สี่ขา)" value={formHint1} onChange={(e) => setFormHint1(e.target.value)} />
                          <Input className="h-9 text-xs" placeholder="คำใบ้ที่ 2 (เช่น ส่งเสียงร้องโฮ่งๆ)" value={formHint2} onChange={(e) => setFormHint2(e.target.value)} />
                          <Input className="h-9 text-xs" placeholder="คำใบ้ที่ 3 (เช่น ซื่อสัตย์ต่อเจ้าของ)" value={formHint3} onChange={(e) => setFormHint3(e.target.value)} />
                        </div>
                      </div>
                    )}

                    <Button type="submit" className="w-full h-10 font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                      <Plus className="w-4 h-4 mr-1.5" /> บันทึกเข้าคลังคำศัพท์
                    </Button>
                  </>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Section 2: Full Questions Table */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <ListFilter className="w-4 h-4 text-indigo-500" />
                    คลังคำศัพท์ทั้งหมด ({isFiltered ? `${filteredQuestions.length} จาก ${questions.length}` : `${questions.length}`} รายการ)
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {isFiltered ? `กำลังแสดงผลการกรอง/ค้นหา (${filteredQuestions.length} รายการ)` : `แสดงคำศัพท์ทั้งหมดในระบบ สามารถค้นหาและแก้ไขได้ทันที`}
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Search Bar + Mode Toggle */}
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-52">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-muted-foreground" />
                      <Input
                        placeholder="พิมพ์ค้นหาคำศัพท์..."
                        className="pl-8 h-9 text-xs"
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                      />
                    </div>

                    {/* Search Match Mode Selector */}
                    <Select value={searchMatchMode} onValueChange={(val: any) => setSearchMatchMode(val)}>
                      <SelectTrigger className="w-32 h-9 text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="starts_with">ขึ้นต้นด้วย</SelectItem>
                        <SelectItem value="contains">มีคำนี้</SelectItem>
                        <SelectItem value="exact">ตรงตัว</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category Filter */}
                  <Select value={selectedCategoryFilter} onValueChange={(val) => setSelectedCategoryFilter(val)}>
                    <SelectTrigger className="w-full sm:w-36 h-9 text-xs font-medium">
                      <SelectValue placeholder="หมวดหมู่ทั้งหมด" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                      {categoriesList.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Game Filter */}
                  <Select value={selectedGameFilter} onValueChange={(val) => setSelectedGameFilter(val)}>
                    <SelectTrigger className="w-full sm:w-44 h-9 text-xs font-medium">
                      <SelectValue placeholder="เลือกมินิเกม" />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      <SelectItem value="all">🎮 ทุกมินิเกม</SelectItem>
                      {Object.values(MINIGAME_CONFIGS).map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.icon} เกม {g.id}: {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={fetchQuestions} title="รีเฟรช">
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingQuestions ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-border overflow-hidden max-h-[580px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/90 backdrop-blur sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-14 text-xs">ID</TableHead>
                      <TableHead className="w-28 text-xs">มินิเกม</TableHead>
                      <TableHead className="w-28 text-xs">หมวดหมู่</TableHead>
                      <TableHead className="text-xs">คำศัพท์ / โจทย์</TableHead>
                      <TableHead className="text-xs">คำตอบ / คำแปล</TableHead>
                      <TableHead className="text-xs">รายละเอียด</TableHead>
                      <TableHead className="w-24 text-xs">ระดับความยาก</TableHead>
                      <TableHead className="text-right w-20 text-xs">การจัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuestions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-10 text-xs">
                          {searchKeyword ? `ไม่พบคำศัพท์ที่ ${searchMatchMode === 'starts_with' ? 'ขึ้นต้นด้วย' : searchMatchMode === 'exact' ? 'ตรงกับ' : 'มีคำว่า'} "${searchKeyword}"` : 'ไม่พบรายการคำศัพท์ในคลัง'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredQuestions.slice((qPage - 1) * qItemsPerPage, qPage * qItemsPerPage).map((q) => {
                        const gConfig = MINIGAME_CONFIGS[q.game_id];
                        return (
                          <TableRow key={q.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="font-mono text-xs font-bold text-muted-foreground">#{q.id}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-semibold flex items-center gap-1 w-fit">
                                <span>{gConfig?.icon || '🎮'}</span>
                                <span>เกม {q.game_id}</span>
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[10px] bg-purple-500/10 text-purple-600 border-purple-500/20 font-medium">
                                {q.category || 'คำทั่วไป'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-sm">{q.word_or_question}</TableCell>
                            <TableCell className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">
                              {q.answer}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {q.game_id === 4 && q.hints?.length ? (
                                <span className="text-purple-500 font-medium">💡 คำใบ้ {q.hints.length} ข้อ</span>
                              ) : (q.game_id === 9 || q.game_id === 10) ? (
                                <span className="text-cyan-500 font-medium">⚡ สุ่มช้อยส์ให้อัตโนมัติ</span>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell>
                              {q.difficulty ? (
                                <Badge
                                  variant="secondary"
                                  className={
                                    q.difficulty === 'easy'
                                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]'
                                      : q.difficulty === 'medium'
                                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]'
                                      : 'bg-rose-500/10 text-rose-500 border-rose-500/20 text-[10px]'
                                  }
                                >
                                  {q.difficulty === 'easy' ? 'ง่าย' : q.difficulty === 'medium' ? 'ปานกลาง' : 'ยาก'}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                                  title="แก้ไขคำศัพท์"
                                  onClick={() => openEditModal(q)}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                  title="ลบคำศัพท์"
                                  onClick={() => handleDeleteQuestion(q.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Question Pagination Controls */}
              {filteredQuestions.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 text-xs">
                  <div className="flex items-center gap-3 text-muted-foreground flex-wrap">
                    <span>
                      แสดง <strong className="text-foreground">{((qPage - 1) * qItemsPerPage) + 1}</strong> - <strong className="text-foreground">{Math.min(qPage * qItemsPerPage, filteredQuestions.length)}</strong> จาก <strong className="text-foreground">{filteredQuestions.length}</strong> รายการ
                    </span>
                    <div className="flex items-center gap-1.5 ml-2">
                      <span className="text-[11px]">ต่อหน้า:</span>
                      <Select value={String(qItemsPerPage)} onValueChange={(val) => { setQItemsPerPage(Number(val)); setQPage(1); }}>
                        <SelectTrigger className="h-7 text-xs w-16">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="15">15</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {Math.ceil(filteredQuestions.length / qItemsPerPage) > 1 && (
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => setQPage(1)} disabled={qPage <= 1} className="h-8 px-2 text-xs rounded-lg">«</Button>
                      <Button variant="outline" size="sm" onClick={() => setQPage(p => Math.max(1, p - 1))} disabled={qPage <= 1} className="h-8 px-2.5 text-xs rounded-lg">ก่อนหน้า</Button>
                      <span className="px-2 text-xs font-semibold">หน้า {qPage} / {Math.ceil(filteredQuestions.length / qItemsPerPage)}</span>
                      <Button variant="outline" size="sm" onClick={() => setQPage(p => Math.min(Math.ceil(filteredQuestions.length / qItemsPerPage), p + 1))} disabled={qPage >= Math.ceil(filteredQuestions.length / qItemsPerPage)} className="h-8 px-2.5 text-xs rounded-lg">ถัดไป</Button>
                      <Button variant="outline" size="sm" onClick={() => setQPage(Math.ceil(filteredQuestions.length / qItemsPerPage))} disabled={qPage >= Math.ceil(filteredQuestions.length / qItemsPerPage)} className="h-8 px-2 text-xs rounded-lg">»</Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: GAME SETTINGS */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                การตั้งค่าและ Channel ID ประจำมินิเกม (13 มินิเกม)
              </CardTitle>
              <CardDescription>ปรับเปลี่ยน Channel ID และสถานะการเปิดใช้งานผ่านระบบเว็บได้ทันที</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">ID</TableHead>
                    <TableHead>ชื่อมินิเกม</TableHead>
                    <TableHead>Channel ID</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">การจัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Render from MINIGAME_CONFIGS or settings */}
                  {Object.values(MINIGAME_CONFIGS).map((conf) => {
                    const gameSetting = settings.find((s) => s.game_id === conf.id) || {
                      game_id: conf.id,
                      game_name: conf.name,
                      channel_id: '',
                      is_enabled: true,
                      min_points: 3,
                      max_points: 6,
                    };
                    return (
                      <TableRow key={conf.id}>
                        <TableCell className="font-bold">
                          <Badge variant="outline" className="text-xs">#{conf.id}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{conf.icon}</span>
                            <span>{conf.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            className="w-52 text-xs h-8 font-mono"
                            placeholder="กรอก Channel ID..."
                            value={gameSetting.channel_id}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSettings((prev) => {
                                const exists = prev.some((item) => item.game_id === conf.id);
                                if (exists) {
                                  return prev.map((item) => (item.game_id === conf.id ? { ...item, channel_id: val } : item));
                                } else {
                                  return [...prev, { ...gameSetting, channel_id: val }];
                                }
                              });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={gameSetting.is_enabled}
                              onCheckedChange={(val) => {
                                setSettings((prev) => {
                                  const exists = prev.some((item) => item.game_id === conf.id);
                                  if (exists) {
                                    return prev.map((item) => (item.game_id === conf.id ? { ...item, is_enabled: val } : item));
                                  } else {
                                    return [...prev, { ...gameSetting, is_enabled: val }];
                                  }
                                });
                              }}
                            />
                            <span className="text-xs text-muted-foreground">
                              {gameSetting.is_enabled ? 'เปิดใช้งาน' : 'ปิด'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => handleSettingUpdate(gameSetting)}>
                            <Save className="w-3.5 h-3.5 mr-1" /> บันทึก
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: LEADERBOARD */}
        <TabsContent value="leaderboard" className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/30 p-3 rounded-2xl border">
            <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-xl">
              <Button
                size="sm"
                variant={lbTimeFilter === '30d' ? 'default' : 'ghost'}
                className="rounded-lg text-xs font-semibold"
                onClick={() => setLbTimeFilter('30d')}
              >
                <Calendar className="w-3.5 h-3.5 mr-1.5" /> 30 วันล่าสุด (30d)
              </Button>
              <Button
                size="sm"
                variant={lbTimeFilter === 'all' ? 'default' : 'ghost'}
                className="rounded-lg text-xs font-semibold"
                onClick={() => setLbTimeFilter('all')}
              >
                <InfinityIcon className="w-3.5 h-3.5 mr-1.5" /> จัดอันดับทั้งหมด (All-Time)
              </Button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={lbGameFilter} onValueChange={(val) => setLbGameFilter(val)}>
                <SelectTrigger className="w-full sm:w-64 h-9 text-xs">
                  <SelectValue placeholder="เลือกมินิเกม" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="all">🎮 มินิเกมทั้งหมดรวมกัน</SelectItem>
                  {Object.values(MINIGAME_CONFIGS).map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.icon} เกม {g.id}: {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={fetchLeaderboard} title="รีเฟรช">
                <RefreshCw className={`w-4 h-4 ${loadingLb ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Podium Top 3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-2">
            <Card className="order-2 md:order-1 border-slate-300 dark:border-slate-700 bg-card hover:scale-[1.02] transition-transform">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 mb-2">
                  <Medal className="w-6 h-6" />
                </div>
                <Badge variant="outline" className="w-fit mx-auto border-slate-400 text-slate-500 font-bold">
                  อันดับ 2 (Silver)
                </Badge>
                {top2 ? (
                  userProfilesMap[top2.discord_id] ? (
                    <div className="flex flex-col items-center gap-1.5 mt-2">
                      {userProfilesMap[top2.discord_id].avatar_url ? (
                        <img src={userProfilesMap[top2.discord_id].avatar_url!} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-slate-400 shadow-sm" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-300 dark:bg-slate-700 text-foreground flex items-center justify-center font-bold text-base">
                          {userProfilesMap[top2.discord_id].username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="text-center min-w-0 max-w-full">
                        <p className="font-bold text-sm text-foreground truncate px-1">{userProfilesMap[top2.discord_id].username}</p>
                        {userProfilesMap[top2.discord_id].discord_username && <p className="text-xs text-muted-foreground truncate">@{userProfilesMap[top2.discord_id].discord_username}</p>}
                        <p className="font-mono text-[10px] text-muted-foreground mt-0.5">ID: {top2.discord_id}</p>
                      </div>
                    </div>
                  ) : (
                    <CardTitle className="text-base font-bold font-mono mt-2">{top2.discord_id}</CardTitle>
                  )
                ) : (
                  <CardTitle className="text-base font-bold font-mono mt-2">-</CardTitle>
                )}
              </CardHeader>
              <CardContent className="text-center text-sm font-semibold text-muted-foreground">
                {top2 ? `ชนะ ${top2.total_wins} ครั้ง (${top2.total_points} แต้ม)` : 'ไม่มีข้อมูล'}
              </CardContent>
            </Card>

            <Card className="order-1 md:order-2 border-amber-400 dark:border-amber-500 bg-amber-500/5 shadow-xl shadow-amber-500/10 hover:scale-[1.04] transition-transform">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 mb-2 shadow-lg shadow-amber-500/30">
                  <Crown className="w-8 h-8" />
                </div>
                <Badge className="w-fit mx-auto bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-extrabold px-3 py-1">
                  🏆 อันดับ 1 (Gold Champion)
                </Badge>
                {top1 ? (
                  userProfilesMap[top1.discord_id] ? (
                    <div className="flex flex-col items-center gap-1.5 mt-2">
                      {userProfilesMap[top1.discord_id].avatar_url ? (
                        <img src={userProfilesMap[top1.discord_id].avatar_url!} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-amber-400 shadow-md" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg border border-amber-400">
                          {userProfilesMap[top1.discord_id].username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="text-center min-w-0 max-w-full">
                        <p className="font-extrabold text-base text-amber-600 dark:text-amber-400 truncate px-1">{userProfilesMap[top1.discord_id].username}</p>
                        {userProfilesMap[top1.discord_id].discord_username && <p className="text-xs text-muted-foreground truncate">@{userProfilesMap[top1.discord_id].discord_username}</p>}
                        <p className="font-mono text-[10px] text-muted-foreground mt-0.5">ID: {top1.discord_id}</p>
                      </div>
                    </div>
                  ) : (
                    <CardTitle className="text-lg font-extrabold font-mono mt-2 text-amber-500">{top1.discord_id}</CardTitle>
                  )
                ) : (
                  <CardTitle className="text-lg font-extrabold font-mono mt-2 text-amber-500">-</CardTitle>
                )}
              </CardHeader>
              <CardContent className="text-center text-base font-bold text-amber-600 dark:text-amber-400">
                {top1 ? `ชนะ ${top1.total_wins} ครั้ง (${top1.total_points} แต้ม)` : 'ไม่มีข้อมูล'}
              </CardContent>
            </Card>

            <Card className="order-3 border-amber-800/40 bg-card hover:scale-[1.02] transition-transform">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-amber-900/20 flex items-center justify-center text-amber-700 mb-2">
                  <Award className="w-6 h-6" />
                </div>
                <Badge variant="outline" className="w-fit mx-auto border-amber-700 text-amber-700 font-bold">
                  อันดับ 3 (Bronze)
                </Badge>
                {top3 ? (
                  userProfilesMap[top3.discord_id] ? (
                    <div className="flex flex-col items-center gap-1.5 mt-2">
                      {userProfilesMap[top3.discord_id].avatar_url ? (
                        <img src={userProfilesMap[top3.discord_id].avatar_url!} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-amber-700 shadow-sm" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-amber-900/20 text-amber-700 flex items-center justify-center font-bold text-base">
                          {userProfilesMap[top3.discord_id].username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="text-center min-w-0 max-w-full">
                        <p className="font-bold text-sm text-foreground truncate px-1">{userProfilesMap[top3.discord_id].username}</p>
                        {userProfilesMap[top3.discord_id].discord_username && <p className="text-xs text-muted-foreground truncate">@{userProfilesMap[top3.discord_id].discord_username}</p>}
                        <p className="font-mono text-[10px] text-muted-foreground mt-0.5">ID: {top3.discord_id}</p>
                      </div>
                    </div>
                  ) : (
                    <CardTitle className="text-base font-bold font-mono mt-2">{top3.discord_id}</CardTitle>
                  )
                ) : (
                  <CardTitle className="text-base font-bold font-mono mt-2">-</CardTitle>
                )}
              </CardHeader>
              <CardContent className="text-center text-sm font-semibold text-muted-foreground">
                {top3 ? `ชนะ ${top3.total_wins} ครั้ง (${top3.total_points} แต้ม)` : 'ไม่มีข้อมูล'}
              </CardContent>
            </Card>
          </div>

          {/* Ranking Table with Pagination */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    ตารางสรุปอันดับผู้ชนะ ({leaderboard.length} อันดับ)
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    จัดอันดับตามจำนวนครั้งที่ชนะ และแต้มสะสม
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>ต่อหน้า:</span>
                  <Select value={String(lbItemsPerPage)} onValueChange={(val) => { setLbItemsPerPage(Number(val)); setLbPage(1); }}>
                    <SelectTrigger className="h-7 text-xs w-16">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="15">15</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-16">อันดับ</TableHead>
                      <TableHead>สมาชิก / Discord Profile</TableHead>
                      <TableHead>จำนวนครั้งที่ชนะ</TableHead>
                      <TableHead>แต้มสะสมรวม</TableHead>
                      <TableHead className="text-right">ชนะล่าสุด</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-10 text-xs">
                          ไม่พบข้อมูลผู้ชนะในขณะนี้
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedLeaderboard.map((item, index) => {
                        const rankIndex = (lbPage - 1) * lbItemsPerPage + index;
                        const userProf = userProfilesMap[item.discord_id];
                        return (
                          <TableRow key={item.discord_id} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="font-extrabold text-sm">
                              {rankIndex === 0 ? '🥇 #1' : rankIndex === 1 ? '🥈 #2' : rankIndex === 2 ? '🥉 #3' : `#${rankIndex + 1}`}
                            </TableCell>
                            <TableCell>
                              {userProf ? (
                                <div className="flex items-center gap-3">
                                  {userProf.avatar_url ? (
                                    <img src={userProf.avatar_url} alt={userProf.username} className="w-8 h-8 rounded-full object-cover shrink-0 border border-border shadow-sm" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-xs shrink-0 text-muted-foreground border border-border">
                                      {userProf.username.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-xs text-foreground truncate">{userProf.username}</span>
                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                      {userProf.discord_username && <span>@{userProf.discord_username}</span>}
                                      <span className="font-mono text-[10px] bg-muted/60 px-1.5 py-0.2 rounded text-muted-foreground font-semibold">ID: {item.discord_id}</span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <span className="font-mono text-xs font-semibold">{item.discord_id}</span>
                              )}
                            </TableCell>
                            <TableCell className="font-bold text-sky-500">{item.total_wins} ครั้ง</TableCell>
                            <TableCell className="font-bold text-amber-500">{item.total_points} แต้ม</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {new Date(item.last_win).toLocaleString('th-TH')}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Leaderboard Pagination Controls */}
              {leaderboard.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 text-xs">
                  <span className="text-muted-foreground">
                    แสดงอันดับ <strong className="text-foreground">{((lbPage - 1) * lbItemsPerPage) + 1}</strong> - <strong className="text-foreground">{Math.min(lbPage * lbItemsPerPage, leaderboard.length)}</strong> จากทั้งหมด <strong className="text-foreground">{leaderboard.length}</strong> อันดับ
                  </span>

                  {totalLbPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => setLbPage(1)} disabled={lbPage <= 1} className="h-8 px-2 text-xs rounded-lg">«</Button>
                      <Button variant="outline" size="sm" onClick={() => setLbPage(p => Math.max(1, p - 1))} disabled={lbPage <= 1} className="h-8 px-2.5 text-xs rounded-lg">ก่อนหน้า</Button>
                      <span className="px-2 text-xs font-semibold">หน้า {lbPage} / {totalLbPages}</span>
                      <Button variant="outline" size="sm" onClick={() => setLbPage(p => Math.min(totalLbPages, p + 1))} disabled={lbPage >= totalLbPages} className="h-8 px-2.5 text-xs rounded-lg">ถัดไป</Button>
                      <Button variant="outline" size="sm" onClick={() => setLbPage(totalLbPages)} disabled={lbPage >= totalLbPages} className="h-8 px-2 text-xs rounded-lg">»</Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* EDIT QUESTION DIALOG MODAL */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-blue-500" />
              แก้ไขคำศัพท์ #{editingQuestion?.id} (เกมที่ {editingQuestion?.game_id})
            </DialogTitle>
            <DialogDescription className="text-xs">
              แก้ไขคำศัพท์ คำแปล หรือข้อมูลโจทย์ของข้อนี้
            </DialogDescription>
          </DialogHeader>

          {editingQuestion && (
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  {editingQuestion.game_id === 9 || editingQuestion.game_id === 10
                    ? 'คำศัพท์ภาษาอังกฤษ (English Word)'
                    : editingQuestion.game_id === 11
                    ? 'คำขึ้นต้น (เช่น น้ำ, รถ)'
                    : editingQuestion.game_id === 12
                    ? 'คำศัพท์ / อีโมจิ'
                    : editingQuestion.game_id === 13
                    ? 'ข้อความ / คำถาม'
                    : 'โจทย์ / คำศัพท์'}
                </label>
                <Input value={editQuestion} onChange={(e) => setEditQuestion(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  {editingQuestion.game_id === 9 || editingQuestion.game_id === 10
                    ? 'คำแปลภาษาไทย (Thai Translation)'
                    : editingQuestion.game_id === 11
                    ? 'คำต่อท้าย'
                    : editingQuestion.game_id === 13
                    ? 'คำตอบที่ถูกต้อง (จริง หรือ เท็จ)'
                    : 'คำตอบที่ถูกต้อง (เฉลย)'}
                </label>
                {editingQuestion.game_id === 13 ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={editAnswer === 'จริง' ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setEditAnswer('จริง')}
                    >
                      ✅ จริง
                    </Button>
                    <Button
                      type="button"
                      variant={editAnswer === 'เท็จ' ? 'destructive' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setEditAnswer('เท็จ')}
                    >
                      ❌ เท็จ
                    </Button>
                  </div>
                ) : (
                  <Input value={editAnswer} onChange={(e) => setEditAnswer(e.target.value)} />
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">หมวดหมู่ (Category)</label>
                <Input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} placeholder="เช่น ผลไม้, สัตว์, คำทั่วไป" />
              </div>

              {/* Difficulty ONLY for Game 4 */}
              {editingQuestion.game_id === 4 && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">ระดับความยาก</label>
                  <Select value={editDifficulty} onValueChange={(val) => setEditDifficulty(val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">🟢 ง่าย (Easy: 2-3 แต้ม)</SelectItem>
                      <SelectItem value="medium">🟡 ปานกลาง (Medium: 4-6 แต้ม)</SelectItem>
                      <SelectItem value="hard">🔴 ยาก (Hard: 7-10 แต้ม)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Hints ONLY for Game 4 */}
              {editingQuestion.game_id === 4 && (
                <div className="space-y-2 pt-2 border-t">
                  <label className="text-xs font-semibold text-purple-500 block">คำใบ้ 3 ข้อความ</label>
                  <Input className="h-9 text-xs" placeholder="คำใบ้ที่ 1" value={editHint1} onChange={(e) => setEditHint1(e.target.value)} />
                  <Input className="h-9 text-xs" placeholder="คำใบ้ที่ 2" value={editHint2} onChange={(e) => setEditHint2(e.target.value)} />
                  <Input className="h-9 text-xs" placeholder="คำใบ้ที่ 3" value={editHint3} onChange={(e) => setEditHint3(e.target.value)} />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleUpdateQuestion}>บันทึกการแก้ไข</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
