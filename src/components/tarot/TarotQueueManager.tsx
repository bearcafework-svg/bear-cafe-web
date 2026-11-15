import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Clock, 
  Check, 
  Trash2, 
  Edit3, 
  Shuffle, 
  Plus, 
  Zap, 
  Flame, 
  AlertCircle, 
  CheckCircle2, 
  RotateCcw,
  Sparkles,
  Calendar,
  X,
  Search,
  ArrowUpDown,
  RefreshCw,
  ScrollText,
  Copy,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export type QueueType = 'คิว (ธ)' | 'คิวเร่ง' | 'คิว V';
export type GroupType = 'กลุ่ม 1' | 'กลุ่ม 2❤️' | 'กลุ่ม 3 🧡';

export interface TarotQueueItem {
  id: string;
  type: QueueType;
  number: string;
  customerName: string;
  prediction?: string;
  group: GroupType;
  createdAt: number;
  deadlineAt: number;
  status: 'pending' | 'completed';
  completedAt?: number;
}

const GROUPS: GroupType[] = ['กลุ่ม 1', 'กลุ่ม 2❤️', 'กลุ่ม 3 🧡'];

function getRandomGroup(): GroupType {
  const idx = Math.floor(Math.random() * GROUPS.length);
  return GROUPS[idx];
}

function formatThaiDateTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDurationMs(type: QueueType): number {
  if (type === 'คิว (ธ)') return 24 * 60 * 60 * 1000; // 24 hours
  if (type === 'คิวเร่ง') return 2 * 60 * 60 * 1000;  // 2 hours
  return 0; // คิว V = ตอบทันที
}

const STORAGE_KEY = 'bear_tarot_queues_v1';

export function TarotQueueManager() {
  const { toast } = useToast();

  // 1. Instant Cache Initialization (0ms from LocalStorage)
  const [queues, setQueues] = useState<TarotQueueItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [isSyncing, setIsSyncing] = useState(false);

  // Current time for countdown calculation (ticks every second)
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync state to LocalStorage cache
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queues));
    } catch (e) {
      console.error('Failed to save to local cache:', e);
    }
  }, [queues]);

  // Map Supabase DB row to local TarotQueueItem
  const mapDbRow = (row: any): TarotQueueItem => ({
    id: row.id,
    type: row.queue_type as QueueType,
    number: row.queue_number,
    customerName: row.customer_name || '',
    prediction: row.prediction || '',
    group: row.queue_group as GroupType,
    createdAt: new Date(row.created_at).getTime(),
    deadlineAt: new Date(row.deadline_at).getTime(),
    status: row.status as 'pending' | 'completed',
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
  });

  // Fetch queues from Supabase in background
  const fetchFromDatabase = useCallback(async () => {
    try {
      setIsSyncing(true);
      const { data, error } = await supabase
        .from('tarot_queues' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[TarotQueue] Supabase fetch fallback to local:', error.message);
        return;
      }

      if (data && Array.isArray(data)) {
        const mapped = data.map(mapDbRow);
        setQueues(mapped);
      }
    } catch (err) {
      console.warn('[TarotQueue] Network error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // On mount: fetch DB and subscribe to Realtime
  useEffect(() => {
    fetchFromDatabase();

    const channel = supabase
      .channel('public:tarot_queues')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tarot_queues' },
        () => {
          fetchFromDatabase();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFromDatabase]);

  // Form Inputs for Quick Add
  const [selectedType, setSelectedType] = useState<QueueType>('คิวเร่ง');
  const [queueNumber, setQueueNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [initialPrediction, setInitialPrediction] = useState('');
  const [showPredictionInput, setShowPredictionInput] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<GroupType>(() => getRandomGroup());

  // Search & Filter
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editCustomer, setEditCustomer] = useState('');
  const [editPrediction, setEditPrediction] = useState('');
  const [editType, setEditType] = useState<QueueType>('คิวเร่ง');
  const [editGroup, setEditGroup] = useState<GroupType>('กลุ่ม 1');

  // Dedicated Prediction Modal state
  const [predictionModalItem, setPredictionModalItem] = useState<TarotQueueItem | null>(null);
  const [predictionDraft, setPredictionDraft] = useState('');
  const [predictionCopied, setPredictionCopied] = useState(false);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);

  // Input references for auto-focus
  const numInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Quick Randomize Group
  const handleRandomGroup = () => {
    const next = getRandomGroup();
    setCurrentGroup(next);
  };

  // Open Prediction Modal
  const openPredictionModal = (item: TarotQueueItem) => {
    setPredictionModalItem(item);
    setPredictionDraft(item.prediction || '');
    setPredictionCopied(false);
  };

  // Save Prediction from Modal
  const handleSavePrediction = async () => {
    if (!predictionModalItem) return;
    const targetId = predictionModalItem.id;
    const newPrediction = predictionDraft.trim();

    // ⚡ STEP 1: Update UI instantly in 0ms
    setQueues((prev) =>
      prev.map((item) => (item.id === targetId ? { ...item, prediction: newPrediction } : item))
    );

    setPredictionModalItem(null);
    toast({
      title: 'บันทึกคำทำนายแล้ว',
      description: `บันทึกคำทำนายของ ${predictionModalItem.type} ${predictionModalItem.number} เรียบร้อย`,
    });

    // 🛡️ STEP 2: Background Supabase Update
    if (targetId && !targetId.startsWith('temp_')) {
      try {
        await supabase
          .from('tarot_queues' as any)
          .update({ prediction: newPrediction })
          .eq('id', targetId);
      } catch (err) {
        console.warn('[TarotQueue] Async DB prediction update deferred:', err);
      }
    }
  };

  // Direct 1-click copy by clicking anywhere on the prediction text
  const handleCopyPredictionDirect = async (text: string, itemId?: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast({ title: 'ยังไม่มีคำทำนายให้คัดลอก', variant: 'destructive' });
      return;
    }

    let success = false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(trimmed);
        success = true;
      }
    } catch {
      success = false;
    }

    if (!success) {
      try {
        const ta = document.createElement('textarea');
        ta.value = trimmed;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        success = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) {
        success = false;
      }
    }

    if (itemId) {
      setCopiedItemId(itemId);
      setTimeout(() => setCopiedItemId(null), 2500);
    }
    setPredictionCopied(true);
    setTimeout(() => setPredictionCopied(false), 2500);

    toast({
      title: '📋 คัดลอกคำทำนายแล้ว!',
      description: 'นำข้อความไปส่งใน Discord ได้ทันที',
    });
  };

  // Copy Prediction from Modal
  const handleCopyPrediction = async () => {
    await handleCopyPredictionDirect(predictionDraft, predictionModalItem?.id);
  };

  // Add new queue (0ms Optimistic UI + Background DB Sync)
  const handleAddQueue = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const numTrimmed = queueNumber.trim();
    if (!numTrimmed) {
      toast({
        title: 'กรุณากรอกเลขคิว',
        description: 'กรอกเลขคิว เช่น 1, 5, 12',
        variant: 'destructive',
      });
      numInputRef.current?.focus();
      return;
    }

    const createdAt = Date.now();
    const duration = getDurationMs(selectedType);
    const deadlineAt = selectedType === 'คิว V' ? createdAt : createdAt + duration;
    const optimisticId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const finalPrediction = initialPrediction.trim();

    const newItem: TarotQueueItem = {
      id: optimisticId,
      type: selectedType,
      number: numTrimmed,
      customerName: customerName.trim(),
      prediction: finalPrediction,
      group: currentGroup,
      createdAt,
      deadlineAt,
      status: 'pending',
    };

    // ⚡ STEP 1: Update UI instantly in 0ms
    setQueues((prev) => [newItem, ...prev]);

    // Reset inputs immediately for next queue
    setCustomerName('');
    setQueueNumber('');
    setInitialPrediction('');
    setCurrentGroup(getRandomGroup());

    setTimeout(() => {
      numInputRef.current?.focus();
    }, 50);

    toast({
      title: `เพิ่ม ${selectedType} ${numTrimmed} สำเร็จ!`,
      description: `กลุ่ม: ${newItem.group} • ${formatThaiDateTime(createdAt)}`,
    });

    // 🛡️ STEP 2: Background Supabase Insert
    try {
      const { data, error } = await supabase
        .from('tarot_queues' as any)
        .insert({
          queue_type: selectedType,
          queue_number: numTrimmed,
          customer_name: newItem.customerName,
          prediction: newItem.prediction,
          queue_group: newItem.group,
          deadline_at: new Date(deadlineAt).toISOString(),
          status: 'pending',
        })
        .select()
        .single();

      if (data && !error) {
        setQueues((prev) =>
          prev.map((item) => (item.id === optimisticId ? mapDbRow(data) : item))
        );
      }
    } catch (err) {
      console.warn('[TarotQueue] Async DB insert deferred:', err);
    }
  };

  // Toggle Complete / Pending (0ms Optimistic + Background DB Sync)
  const toggleComplete = async (id: string) => {
    let nextStatus: 'pending' | 'completed' = 'completed';

    // ⚡ STEP 1: Update UI instantly in 0ms
    setQueues((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const isDone = item.status === 'completed';
          nextStatus = isDone ? 'pending' : 'completed';
          return {
            ...item,
            status: nextStatus,
            completedAt: isDone ? undefined : Date.now(),
          };
        }
        return item;
      })
    );

    // 🛡️ STEP 2: Background DB Sync
    if (id && !id.startsWith('temp_')) {
      try {
        await supabase
          .from('tarot_queues' as any)
          .update({
            status: nextStatus,
            completed_at: nextStatus === 'completed' ? new Date().toISOString() : null,
          })
          .eq('id', id);
      } catch (err) {
        console.warn('[TarotQueue] Async DB update deferred:', err);
      }
    }
  };

  // Delete Queue directly (0ms Optimistic + Background DB Sync)
  const handleDelete = async (id: string, label: string) => {
    // ⚡ STEP 1: Update UI instantly in 0ms
    setQueues((prev) => prev.filter((item) => item.id !== id));
    toast({
      title: 'ลบคิวเรียบร้อย',
      description: `ลบ ${label} แล้ว`,
    });

    // 🛡️ STEP 2: Background DB Sync
    if (id && !id.startsWith('temp_')) {
      try {
        await supabase
          .from('tarot_queues' as any)
          .delete()
          .eq('id', id);
      } catch (err) {
        console.warn('[TarotQueue] Async DB delete deferred:', err);
      }
    }
  };

  // Start Editing
  const startEditing = (item: TarotQueueItem) => {
    setEditingId(item.id);
    setEditNumber(item.number);
    setEditCustomer(item.customerName);
    setEditPrediction(item.prediction || '');
    setEditType(item.type);
    setEditGroup(item.group);
  };

  // Save Edit (0ms Optimistic + Background DB Sync)
  const saveEdit = async (id: string) => {
    if (!editNumber.trim()) {
      toast({ title: 'เลขคิวต้องไม่ว่างเปล่า', variant: 'destructive' });
      return;
    }

    const duration = getDurationMs(editType);
    const newPred = editPrediction.trim();

    // ⚡ STEP 1: Update UI instantly in 0ms
    setQueues((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            type: editType,
            number: editNumber.trim(),
            customerName: editCustomer.trim(),
            prediction: newPred,
            group: editGroup,
            deadlineAt: editType === 'คิว V' ? item.createdAt : item.createdAt + duration,
          };
        }
        return item;
      })
    );
    setEditingId(null);
    toast({ title: 'บันทึกการแก้ไขแล้ว' });

    // 🛡️ STEP 2: Background DB Sync
    if (id && !id.startsWith('temp_')) {
      try {
        await supabase
          .from('tarot_queues' as any)
          .update({
            queue_type: editType,
            queue_number: editNumber.trim(),
            customer_name: editCustomer.trim(),
            prediction: newPred,
            queue_group: editGroup,
          })
          .eq('id', id);
      } catch (err) {
        console.warn('[TarotQueue] Async DB edit deferred:', err);
      }
    }
  };

  // Sorted Queues (Chronological: Newest to Oldest)
  const chronologicalQueues = useMemo(() => {
    return [...queues].sort((a, b) => b.createdAt - a.createdAt);
  }, [queues]);

  // Filtered Queues for Cards/View
  const filteredQueues = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    return chronologicalQueues.filter((item) => {
      if (statusFilter === 'pending' && item.status !== 'pending') return false;
      if (statusFilter === 'completed' && item.status !== 'completed') return false;

      if (!q) return true;
      const fullTitle = `${item.type} ${item.number}`.toLowerCase();
      return (
        fullTitle.includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        (item.prediction && item.prediction.toLowerCase().includes(q)) ||
        item.group.toLowerCase().includes(q)
      );
    });
  }, [chronologicalQueues, searchFilter, statusFilter]);

  // Statistics
  const pendingCount = useMemo(() => queues.filter((q) => q.status === 'pending').length, [queues]);
  const completedCount = useMemo(() => queues.filter((q) => q.status === 'completed').length, [queues]);

  // Helper for countdown formatting
  const renderCountdown = (item: TarotQueueItem) => {
    if (item.status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-xs">
          <CheckCircle2 className="w-3.5 h-3.5" />
          เสร็จสิ้นแล้ว
        </span>
      );
    }

    if (item.type === 'คิว V') {
      return (
        <span className="inline-flex items-center gap-1 text-amber-400 font-bold text-xs bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full animate-pulse">
          <Zap className="w-3.5 h-3.5 fill-amber-400" />
          ตอบทันที ⚡
        </span>
      );
    }

    const remainingMs = item.deadlineAt - now;

    if (remainingMs <= 0) {
      const overdueMs = Math.abs(remainingMs);
      const overdueMins = Math.floor(overdueMs / 60000);
      const overdueHours = Math.floor(overdueMins / 60);
      return (
        <span className="inline-flex items-center gap-1 text-rose-400 font-bold text-xs bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full animate-pulse">
          <AlertCircle className="w-3.5 h-3.5" />
          เกินเวลา {overdueHours > 0 ? `${overdueHours}ชม. ` : ''}{overdueMins % 60}น.
        </span>
      );
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => String(n).padStart(2, '0');
    const timeFormatted = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

    const isUrgent = remainingMs < 30 * 60 * 1000; // less than 30 mins

    return (
      <span
        className={`inline-flex items-center gap-1.5 font-mono text-xs font-semibold px-2 py-0.5 rounded-md ${
          isUrgent
            ? 'text-orange-400 bg-orange-500/10 border border-orange-500/30 animate-pulse'
            : 'text-amber-300 bg-amber-500/10 border border-amber-500/20'
        }`}
      >
        <Clock className="w-3 h-3 text-muted-foreground" />
        {timeFormatted}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 🚀 QUICK ENTRY FORM (ออกแบบเพื่อการกรอกไว ปั๊มคิวเร็ว ไม่ติดยืนยันเยอะ) */}
      <div className="bg-card/70 border-2 border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                เพิ่มคิวใหม่ (พิมพ์แล้ว Enter ทันที)
              </h2>
              <p className="text-xs text-muted-foreground">
                แสดงผลแบบ <strong>{selectedType} {queueNumber || '{เลข}'}</strong> • วันนี้: {formatThaiDateTime(now)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            {isSyncing && (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 mr-1 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                ซิงค์คลาวด์...
              </span>
            )}
            <Badge variant="outline" className="text-xs bg-amber-500/5 text-amber-400 border-amber-500/30">
              รออยู่: <strong>{pendingCount}</strong> คิว
            </Badge>
            <Badge variant="outline" className="text-xs bg-emerald-500/5 text-emerald-400 border-emerald-500/30">
              เสร็จแล้ว: <strong>{completedCount}</strong> คิว
            </Badge>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleAddQueue} className="space-y-3">
          {/* Row 1: Queue Type Selector & Group Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Queue Types Pills */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                เลือกประเภทคิว:
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedType('คิว (ธ)')}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-xs font-semibold transition-all ${
                    selectedType === 'คิว (ธ)'
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300 ring-1 ring-blue-500/40 shadow-sm'
                      : 'bg-card/50 border-border text-muted-foreground hover:bg-card hover:text-foreground'
                  }`}
                >
                  <span className="text-sm">คิว (ธ)</span>
                  <span className="text-[10px] font-normal text-blue-400/80">ตอบใน 24 ชม.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedType('คิวเร่ง')}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-xs font-semibold transition-all ${
                    selectedType === 'คิวเร่ง'
                      ? 'bg-orange-600/20 border-orange-500 text-orange-300 ring-1 ring-orange-500/40 shadow-sm'
                      : 'bg-card/50 border-border text-muted-foreground hover:bg-card hover:text-foreground'
                  }`}
                >
                  <span className="text-sm flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    คิวเร่ง
                  </span>
                  <span className="text-[10px] font-normal text-orange-400/80">ตอบใน 2 ชม.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedType('คิว V')}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-xs font-semibold transition-all ${
                    selectedType === 'คิว V'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500/40 shadow-sm'
                      : 'bg-card/50 border-border text-muted-foreground hover:bg-card hover:text-foreground'
                  }`}
                >
                  <span className="text-sm flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    คิว V
                  </span>
                  <span className="text-[10px] font-normal text-amber-400/80">ตอบทันที ⚡</span>
                </button>
              </div>
            </div>

            {/* Random Group Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  กลุ่มคิว:
                </label>
                <button
                  type="button"
                  onClick={handleRandomGroup}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                  title="สุ่มกลุ่มใหม่"
                >
                  <Shuffle className="w-3 h-3" />
                  กดสุ่มกลุ่ม
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {GROUPS.map((grp) => (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => setCurrentGroup(grp)}
                    className={`py-2 px-1 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                      currentGroup === grp
                        ? 'bg-amber-600/20 border-amber-500 text-amber-300 ring-1 ring-amber-500/40 shadow-sm'
                        : 'bg-card/50 border-border text-muted-foreground hover:bg-card hover:text-foreground'
                    }`}
                  >
                    {grp}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Queue Number, Customer Name, and Action */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
            <div className="sm:col-span-4">
              <label className="text-[11px] text-muted-foreground mb-1 block">
                เลขคิว <span className="text-rose-400">*</span> (กรอกเอง เช่น 1, 5, 23)
              </label>
              <Input
                ref={numInputRef}
                type="text"
                value={queueNumber}
                onChange={(e) => setQueueNumber(e.target.value)}
                placeholder="เช่น 1, 5, 12..."
                className="h-11 bg-background/80 border-border font-semibold text-base focus-visible:ring-amber-500"
              />
            </div>

            <div className="sm:col-span-6">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-muted-foreground">
                  ชื่อลูกค้า / หมายเหตุ (กด Enter เพิ่มทันที)
                </label>
                <button
                  type="button"
                  onClick={() => setShowPredictionInput(!showPredictionInput)}
                  className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                >
                  <ScrollText className="w-3 h-3" />
                  {showPredictionInput ? 'ซ่อนช่องคำทำนาย' : '+ ใส่คำทำนายตอนสร้าง'}
                </button>
              </div>
              <Input
                ref={nameInputRef}
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="ชื่อลูกค้า หรือเรื่องที่ดู..."
                className="h-11 bg-background/80 border-border text-sm focus-visible:ring-amber-500"
              />
            </div>

            <div className="sm:col-span-2 flex items-end">
              <Button
                type="submit"
                className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl gap-1.5 shadow-md"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                เพิ่มคิว (Enter)
              </Button>
            </div>
          </div>

          {/* Optional Initial Prediction Input */}
          {showPredictionInput && (
            <div className="pt-1">
              <label className="text-[11px] text-muted-foreground mb-1 block">
                คำทำนาย (ไม่บังคับ - สามารถเขียนหรือแก้ทีหลังได้):
              </label>
              <Textarea
                value={initialPrediction}
                onChange={(e) => setInitialPrediction(e.target.value)}
                placeholder="พิมพ์คำทำนายของคิวนี้ที่นี่..."
                rows={2}
                className="bg-background/80 text-xs border-border resize-none"
              />
            </div>
          )}
        </form>
      </div>

      {/* 📜 ตารางรวมคิวทั้งหมด (เรียงตามลำดับการกรอก ใหม่-เก่า) - เลื่อนดูใน Card ได้ทันที ไม่ต้องเลื่อนลงสุดเว็บ */}
      <div className="bg-card/75 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
        {/* Card Header */}
        <div className="p-3.5 sm:p-4 border-b border-border/60 bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <ArrowUpDown className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  ตารางรวมคิวทั้งหมด
                </h3>
                <Badge variant="outline" className="text-[10px] font-normal bg-amber-500/10 text-amber-400 border-amber-500/30 px-1.5 py-0">
                  เรียง: ใหม่ ➔ เก่า
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                เลื่อนดูข้อมูลได้ใน Card นี้เลย ไม่ต้องเลื่อนลงสุดหน้าเว็บ (ทั้งหมด {queues.length} รายการ)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchFromDatabase}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              title="รีเฟรชจากคลาวด์"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              รีเฟรช
            </Button>
            <Badge variant="secondary" className="text-xs">
              รอ {pendingCount} / เสร็จ {completedCount}
            </Badge>
          </div>
        </div>

        {/* Scrollable Table Content (Max-Height Card with internal scrolling) */}
        <div className="max-h-[380px] sm:max-h-[440px] overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent">
          {chronologicalQueues.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              ยังไม่มีคิวในตาราง เพิ่มคิวจากฟอร์มด้านบนได้เลยครับ
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-md text-[11px] font-semibold text-muted-foreground border-b border-border/60 select-none shadow-sm">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 min-w-[110px]">ชื่อคิว</th>
                  <th className="py-2.5 px-3 min-w-[90px]">กลุ่ม</th>
                  <th className="py-2.5 px-3 min-w-[130px]">ลูกค้า / รายละเอียด</th>
                  <th className="py-2.5 px-3 min-w-[140px]">คำทำนาย</th>
                  <th className="py-2.5 px-3 min-w-[130px]">เวลาที่บันทึก (ไทย)</th>
                  <th className="py-2.5 px-3 min-w-[130px]">นับเวลาถอยหลัง / สถานะ</th>
                  <th className="py-2.5 px-3 min-w-[110px] text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {chronologicalQueues.map((item, index) => {
                  const fullTitle = `${item.type} ${item.number}`;
                  const isDone = item.status === 'completed';
                  const hasPred = !!item.prediction && item.prediction.trim().length > 0;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-muted/40 transition-colors ${
                        isDone ? 'bg-muted/10 opacity-70' : 'bg-transparent'
                      }`}
                    >
                      {/* Row Index */}
                      <td className="py-2.5 px-3 text-center text-muted-foreground/70 font-mono text-[11px]">
                        {index + 1}
                      </td>

                      {/* Queue Title */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className={isDone ? 'line-through text-muted-foreground' : 'text-foreground'}>
                            {fullTitle}
                          </span>
                        </div>
                      </td>

                      {/* Group */}
                      <td className="py-2.5 px-3">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-medium py-0 px-1.5 bg-amber-500/10 text-amber-300 border-amber-500/30 whitespace-nowrap"
                        >
                          {item.group}
                        </Badge>
                      </td>

                      {/* Customer / Note */}
                      <td className="py-2.5 px-3 max-w-[160px] truncate" title={item.customerName}>
                        {item.customerName ? (
                          <span className={isDone ? 'line-through text-muted-foreground' : 'text-foreground'}>
                            {item.customerName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50 italic text-[11px]">ไม่มีหมายเหตุ</span>
                        )}
                      </td>

                      {/* Prediction Column */}
                      <td className="py-2.5 px-3 min-w-[150px] max-w-[240px]">
                        {hasPred ? (
                          <div className="flex items-center gap-1.5 w-full">
                            <button
                              type="button"
                              onClick={() => handleCopyPredictionDirect(item.prediction || '', item.id)}
                              className={`flex-1 flex items-center gap-1.5 py-1 px-2 rounded-lg text-left transition-all text-xs truncate border cursor-pointer ${
                                copiedItemId === item.id
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-medium'
                                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30 hover:border-amber-500/60 font-medium'
                              }`}
                              title="กดตรงไหนก็ได้ของข้อความเพื่อคัดลอก"
                            >
                              {copiedItemId === item.id ? (
                                <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                              ) : (
                                <ScrollText className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                              )}
                              <span className="truncate flex-1">
                                {copiedItemId === item.id ? 'คัดลอกแล้ว!' : item.prediction}
                              </span>
                            </button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openPredictionModal(item)}
                              className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10"
                              title="ดูหรือแก้ไขคำทำนายเต็ม"
                            >
                              <Edit3 className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openPredictionModal(item)}
                            className="flex items-center gap-1.5 py-1 px-2 rounded-lg text-left transition-all text-xs w-full text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/60 border border-dashed border-border/60"
                            title="คลิกเพื่อใส่คำทำนาย"
                          >
                            <ScrollText className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">+ เพิ่มคำทำนาย</span>
                          </button>
                        )}
                      </td>

                      {/* Thai Timestamp */}
                      <td className="py-2.5 px-3 text-muted-foreground text-[11px] whitespace-nowrap">
                        {formatThaiDateTime(item.createdAt)}
                      </td>

                      {/* Realtime Countdown */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {renderCountdown(item)}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => toggleComplete(item.id)}
                            className={`p-1.5 rounded-lg border transition-all ${
                              isDone
                                ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
                                : 'border-border hover:border-emerald-500 text-muted-foreground hover:text-emerald-400'
                            }`}
                            title={isDone ? 'ย้อนกลับ' : 'เสร็จแล้ว'}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>

                          <button
                            type="button"
                            onClick={() => startEditing(item)}
                            className="p-1.5 rounded-lg border border-border hover:border-amber-500 text-muted-foreground hover:text-amber-400 transition-all"
                            title="แก้ไข"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, fullTitle)}
                            className="p-1.5 rounded-lg border border-border hover:border-rose-500 text-muted-foreground hover:text-rose-400 transition-all"
                            title="ลบ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 📊 FILTER & SEARCH BAR (สำหรับมุมมองการ์ดด้านล่าง) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/40 border border-border/60 rounded-xl p-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="ค้นหาตามคิว, ชื่อลูกค้า, คำทำนาย, กลุ่ม..."
            className="pl-9 h-9 text-xs bg-background/70 border-border"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
            className={`h-8 text-xs rounded-lg ${
              statusFilter === 'all' ? 'bg-amber-600 text-white' : ''
            }`}
          >
            ทั้งหมด ({queues.length})
          </Button>
          <Button
            variant={statusFilter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('pending')}
            className={`h-8 text-xs rounded-lg ${
              statusFilter === 'pending' ? 'bg-amber-600 text-white' : ''
            }`}
          >
            กำลังรอ ({pendingCount})
          </Button>
          <Button
            variant={statusFilter === 'completed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('completed')}
            className={`h-8 text-xs rounded-lg ${
              statusFilter === 'completed' ? 'bg-amber-600 text-white' : ''
            }`}
          >
            เสร็จแล้ว ({completedCount})
          </Button>
        </div>
      </div>

      {/* 📋 QUEUE CARDS LIST */}
      {filteredQueues.length === 0 ? (
        <div className="text-center py-12 bg-card/20 rounded-2xl border border-dashed border-border/60">
          <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-muted-foreground text-xs">ไม่พบคิวที่ตรงกับเงื่อนไขการค้นหา</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQueues.map((item) => {
            const isEditing = editingId === item.id;
            const fullTitle = `${item.type} ${item.number}`;
            const hasPred = !!item.prediction && item.prediction.trim().length > 0;

            if (isEditing) {
              return (
                <div
                  key={item.id}
                  className="bg-card border-2 border-amber-500 rounded-xl p-3.5 shadow-md space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-400">✏️ แก้ไขคิว</span>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-muted-foreground hover:text-foreground p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as QueueType)}
                      className="h-9 px-2 text-xs bg-background border border-border rounded-lg text-foreground"
                    >
                      <option value="คิว (ธ)">คิว (ธ) [24 ชม.]</option>
                      <option value="คิวเร่ง">คิวเร่ง [2 ชม.]</option>
                      <option value="คิว V">คิว V [ตอบทันที]</option>
                    </select>

                    <Input
                      value={editNumber}
                      onChange={(e) => setEditNumber(e.target.value)}
                      placeholder="เลขคิว"
                      className="h-9 text-xs"
                    />

                    <select
                      value={editGroup}
                      onChange={(e) => setEditGroup(e.target.value as GroupType)}
                      className="h-9 px-2 text-xs bg-background border border-border rounded-lg text-foreground"
                    >
                      {GROUPS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>

                    <Input
                      value={editCustomer}
                      onChange={(e) => setEditCustomer(e.target.value)}
                      placeholder="ชื่อลูกค้า"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block">คำทำนาย:</label>
                    <Textarea
                      value={editPrediction}
                      onChange={(e) => setEditPrediction(e.target.value)}
                      placeholder="บันทึกคำทำนาย..."
                      rows={2}
                      className="text-xs resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(null)}
                      className="h-8 text-xs"
                    >
                      ยกเลิก
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => saveEdit(item.id)}
                      className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-black font-medium"
                    >
                      บันทึกการแก้ไข
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                className={`flex flex-col gap-2 p-3.5 rounded-xl border transition-all ${
                  item.status === 'completed'
                    ? 'bg-card/30 border-border/40 opacity-70'
                    : 'bg-card/80 border-border/80 hover:border-amber-500/40 shadow-sm'
                }`}
              >
                {/* Top Row: Info & Countdown */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleComplete(item.id)}
                      className={`mt-0.5 sm:mt-0 w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                        item.status === 'completed'
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'border-border/80 hover:border-amber-500 text-transparent hover:text-muted-foreground'
                      }`}
                      title={item.status === 'completed' ? 'กดเพื่อกลับเป็นกำลังรอ' : 'กดเพื่อทำเครื่องหมายว่าเสร็จแล้ว'}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </button>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-bold text-sm sm:text-base ${
                            item.status === 'completed'
                              ? 'line-through text-muted-foreground'
                              : 'text-foreground'
                          }`}
                        >
                          {fullTitle}
                        </span>

                        <Badge
                          variant="outline"
                          className="text-[11px] py-0 px-2 font-medium bg-amber-500/10 text-amber-300 border-amber-500/30"
                        >
                          {item.group}
                        </Badge>

                        <Badge
                          variant="secondary"
                          className={`text-[10px] py-0 px-1.5 font-normal ${
                            item.type === 'คิว V'
                              ? 'bg-amber-500/20 text-amber-300'
                              : item.type === 'คิวเร่ง'
                              ? 'bg-orange-500/20 text-orange-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          {item.type}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        {item.customerName ? (
                          <span className="text-foreground/90 font-medium truncate max-w-[200px] sm:max-w-[300px]">
                            {item.customerName}
                          </span>
                        ) : (
                          <span className="italic opacity-50">ไม่มีหมายเหตุ</span>
                        )}
                        <span>•</span>
                        <span className="flex items-center gap-1 text-[11px]">
                          <Calendar className="w-3 h-3 text-muted-foreground/70" />
                          {formatThaiDateTime(item.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0">
                    <div>{renderCountdown(item)}</div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleComplete(item.id)}
                        className={`h-8 px-2 text-xs gap-1 ${
                          item.status === 'completed'
                            ? 'text-muted-foreground hover:text-foreground'
                            : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                        }`}
                        title={item.status === 'completed' ? 'ยกเลิกสถานะเสร็จ' : 'สำเร็จ'}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">
                          {item.status === 'completed' ? 'ย้อนกลับ' : 'สำเร็จ'}
                        </span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditing(item)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        title="แก้ไข"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id, fullTitle)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                        title="ลบ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Prediction Expand Box (Click anywhere to copy) */}
                <div className="pt-2 border-t border-border/40 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {hasPred ? (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleCopyPredictionDirect(item.prediction || '', item.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleCopyPredictionDirect(item.prediction || '', item.id);
                          }
                        }}
                        className={`group relative rounded-lg p-2.5 text-xs whitespace-pre-wrap cursor-pointer transition-all border ${
                          copiedItemId === item.id
                            ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 shadow-sm'
                            : 'bg-amber-500/5 hover:bg-amber-500/15 border-amber-500/30 hover:border-amber-500/60 text-foreground/90 active:scale-[0.99]'
                        }`}
                        title="กดตรงไหนก็ได้ของข้อความเพื่อคัดลอก"
                      >
                        <div className="flex items-center justify-between font-semibold text-[11px] mb-1.5 select-none">
                          <div className={`flex items-center gap-1.5 ${copiedItemId === item.id ? 'text-emerald-400' : 'text-amber-400'}`}>
                            <ScrollText className="w-3.5 h-3.5" />
                            <span>คำทำนาย:</span>
                          </div>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-normal transition-colors ${
                              copiedItemId === item.id
                                ? 'bg-emerald-500/25 text-emerald-300 font-semibold'
                                : 'bg-amber-500/15 text-amber-300 group-hover:bg-amber-500/25'
                            }`}
                          >
                            {copiedItemId === item.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                คัดลอกแล้ว!
                              </>
                            ) : (
                              <>
                                <Copy className="w-2.5 h-2.5" />
                                กดตรงไหนก็ได้เพื่อคัดลอก
                              </>
                            )}
                          </span>
                        </div>
                        <p className="line-clamp-3 select-all leading-relaxed">{item.prediction}</p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openPredictionModal(item)}
                        className="text-xs text-muted-foreground hover:text-amber-400 flex items-center gap-1.5 py-1 px-2 rounded border border-dashed border-border/60 hover:border-amber-500/40"
                      >
                        <ScrollText className="w-3 h-3" />
                        <span>+ เพิ่มคำทำนาย</span>
                      </button>
                    )}
                  </div>

                  {hasPred && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPredictionModal(item)}
                      className="h-7 text-xs px-2 shrink-0 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                    >
                      <Edit3 className="w-3 h-3 mr-1" />
                      แก้ไข
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 📜 DIALOG: ดูและแก้ไขคำทำนาย (Prediction Modal with Quick Copy) */}
      <Dialog open={!!predictionModalItem} onOpenChange={(open) => !open && setPredictionModalItem(null)}>
        <DialogContent className="max-w-lg bg-card/95 backdrop-blur-xl border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ScrollText className="w-4 h-4 text-amber-400" />
              <span>
                คำทำนาย: {predictionModalItem?.type} {predictionModalItem?.number}
              </span>
              {predictionModalItem?.customerName && (
                <span className="text-muted-foreground font-normal text-xs">
                  ({predictionModalItem.customerName})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>เนื้อหาคำทำนาย:</span>
              <span className="font-mono text-[11px]">{predictionDraft.length} ตัวอักษร</span>
            </div>

            {/* Quick Click Anywhere To Copy Banner */}
            {predictionDraft.trim() && (
              <div
                role="button"
                tabIndex={0}
                onClick={handleCopyPrediction}
                className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between text-xs group select-none ${
                  predictionCopied
                    ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200'
                    : 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 active:scale-[0.99]'
                }`}
                title="กดแถบนี้ตรงไหนก็ได้เพื่อคัดลอกคำทำนายทั้งหมด"
              >
                <div className="flex items-center gap-2 truncate">
                  {predictionCopied ? (
                    <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 shrink-0 text-amber-400 group-hover:scale-110 transition-transform" />
                  )}
                  <span className="truncate font-medium">
                    {predictionCopied ? 'คัดลอกคำทำนายแล้ว!' : 'กดแถบนี้ตรงไหนก็ได้เพื่อคัดลอกคำทำนายทั้งหมด'}
                  </span>
                </div>
                {predictionCopied && (
                  <span className="text-emerald-400 font-semibold text-[11px] shrink-0">
                    พร้อมส่งใน Discord
                  </span>
                )}
              </div>
            )}

            <Textarea
              value={predictionDraft}
              onChange={(e) => setPredictionDraft(e.target.value)}
              placeholder="พิมพ์คำทำนาย ข้อความเปิดไพ่ หรือรายละเอียดสำหรับส่งให้ลูกค้าที่นี่..."
              rows={7}
              className="bg-background/80 text-sm border-border focus-visible:ring-amber-500 resize-y"
            />
          </div>

          <DialogFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyPrediction}
              disabled={!predictionDraft.trim()}
              className="gap-1.5 text-xs h-9 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
            >
              {predictionCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  คัดลอกแล้ว!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  คัดลอกคำทำนาย (สำหรับส่ง Discord)
                </>
              )}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPredictionModalItem(null)}
                className="text-xs h-9"
              >
                ยกเลิก
              </Button>
              <Button
                type="button"
                onClick={handleSavePrediction}
                className="text-xs h-9 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              >
                บันทึกคำทำนาย
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
