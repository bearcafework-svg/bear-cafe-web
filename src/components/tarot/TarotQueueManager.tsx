import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export type QueueType = 'คิว (ธ)' | 'คิวเร่ง' | 'คิว V';
export type GroupType = 'กลุ่ม 1' | 'กลุ่ม 2❤️' | 'กลุ่ม 3 🧡';

export interface TarotQueueItem {
  id: string;
  type: QueueType;
  number: string;
  customerName: string;
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

  // Load from localStorage
  const [queues, setQueues] = useState<TarotQueueItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load queues from localStorage:', e);
      return [];
    }
  });

  // Current time for countdown calculation (ticks every second)
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Save to localStorage whenever queues change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queues));
    } catch (e) {
      console.error('Failed to save queues to localStorage:', e);
    }
  }, [queues]);

  // Form Inputs for Quick Add
  const [selectedType, setSelectedType] = useState<QueueType>('คิวเร่ง');
  const [queueNumber, setQueueNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [currentGroup, setCurrentGroup] = useState<GroupType>(() => getRandomGroup());

  // Search & Filter
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editCustomer, setEditCustomer] = useState('');
  const [editType, setEditType] = useState<QueueType>('คิวเร่ง');
  const [editGroup, setEditGroup] = useState<GroupType>('กลุ่ม 1');

  // Input references for auto-focus
  const numInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Quick Randomize Group
  const handleRandomGroup = () => {
    const next = getRandomGroup();
    setCurrentGroup(next);
  };

  // Add new queue (Fast entry on Enter)
  const handleAddQueue = (e?: React.FormEvent) => {
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

    const newItem: TarotQueueItem = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: selectedType,
      number: numTrimmed,
      customerName: customerName.trim(),
      group: currentGroup,
      createdAt,
      deadlineAt,
      status: 'pending',
    };

    setQueues((prev) => [newItem, ...prev]);

    // Reset fields for the next quick entry
    setCustomerName('');
    setQueueNumber('');
    setCurrentGroup(getRandomGroup()); // Randomize for next queue

    // Re-focus number input for speedy continuous entry
    setTimeout(() => {
      numInputRef.current?.focus();
    }, 50);

    toast({
      title: `เพิ่ม ${selectedType} ${numTrimmed} สำเร็จ!`,
      description: `กลุ่ม: ${newItem.group} • สร้างเวลา ${formatThaiDateTime(createdAt)}`,
    });
  };

  // Toggle Complete / Pending
  const toggleComplete = (id: string) => {
    setQueues((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const isDone = item.status === 'completed';
          return {
            ...item,
            status: isDone ? 'pending' : 'completed',
            completedAt: isDone ? undefined : Date.now(),
          };
        }
        return item;
      })
    );
  };

  // Delete Queue directly
  const handleDelete = (id: string, label: string) => {
    setQueues((prev) => prev.filter((item) => item.id !== id));
    toast({
      title: 'ลบคิวเรียบร้อย',
      description: `ลบ ${label} แล้ว`,
    });
  };

  // Start Editing
  const startEditing = (item: TarotQueueItem) => {
    setEditingId(item.id);
    setEditNumber(item.number);
    setEditCustomer(item.customerName);
    setEditType(item.type);
    setEditGroup(item.group);
  };

  // Save Edit
  const saveEdit = (id: string) => {
    if (!editNumber.trim()) {
      toast({ title: 'เลขคิวต้องไม่ว่างเปล่า', variant: 'destructive' });
      return;
    }
    setQueues((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const duration = getDurationMs(editType);
          return {
            ...item,
            type: editType,
            number: editNumber.trim(),
            customerName: editCustomer.trim(),
            group: editGroup,
            deadlineAt: editType === 'คิว V' ? item.createdAt : item.createdAt + duration,
          };
        }
        return item;
      })
    );
    setEditingId(null);
    toast({ title: 'บันทึกการแก้ไขแล้ว' });
  };

  // Filtered Queues
  const filteredQueues = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    return queues.filter((item) => {
      if (statusFilter === 'pending' && item.status !== 'pending') return false;
      if (statusFilter === 'completed' && item.status !== 'completed') return false;

      if (!q) return true;
      const fullTitle = `${item.type} ${item.number}`.toLowerCase();
      return (
        fullTitle.includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q)
      );
    });
  }, [queues, searchFilter, statusFilter]);

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

          {/* Row 2: Queue Number & Customer Name (Enter to Submit) */}
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
              <label className="text-[11px] text-muted-foreground mb-1 block">
                ชื่อลูกค้า / รายละเอียด (กด Enter เพื่อเพิ่มทันที)
              </label>
              <Input
                ref={nameInputRef}
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="ชื่อลูกค้า, เรื่องที่ดู หรือหมายเหตุ..."
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
        </form>
      </div>

      {/* 📊 FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/40 border border-border/60 rounded-xl p-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="ค้นหาตามคิว, ชื่อลูกค้า, กลุ่ม..."
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

      {/* 📋 QUEUE TABLE / LIST */}
      {filteredQueues.length === 0 ? (
        <div className="text-center py-16 bg-card/20 rounded-2xl border border-dashed border-border/60">
          <Clock className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">ยังไม่มีรายการคิว</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            พิมพ์เลขคิวที่ช่องด้านบนแล้วกด Enter เพื่อเพิ่มคิวได้เลยครับ
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredQueues.map((item) => {
            const isEditing = editingId === item.id;
            const fullTitle = `${item.type} ${item.number}`;

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
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                  item.status === 'completed'
                    ? 'bg-card/30 border-border/40 opacity-70'
                    : 'bg-card/80 border-border/80 hover:border-amber-500/40 shadow-sm'
                }`}
              >
                {/* Left: Queue Title + Customer + Group */}
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  {/* Mark complete checkbox button */}
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

                      {/* Group Badge */}
                      <Badge
                        variant="outline"
                        className="text-[11px] py-0 px-2 font-medium bg-amber-500/10 text-amber-300 border-amber-500/30"
                      >
                        {item.group}
                      </Badge>

                      {/* Type Badge */}
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

                    {/* Customer & Timestamp */}
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

                {/* Right: Countdown & Quick Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40 w-full sm:w-auto">
                  {/* Countdown Timer */}
                  <div className="shrink-0">
                    {renderCountdown(item)}
                  </div>

                  {/* Actions */}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
