import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CalendarCheck, Gift, Coins, Edit, Save, X, ChevronLeft, ChevronRight, Calendar, Sparkles, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DailyReward {
  id: string;
  day_number: number;
  reward_type: 'points' | 'ticket_point' | 'ticket_piece_point' | 'role';
  reward_amount: number | null;
  role_id: string | null;
  makeup_cost: number;
  is_active: boolean;
  updated_at: string;
  updated_by: string | null;
}

interface BigReward {
  id: string;
  reward_type: 'points' | 'ticket_point' | 'ticket_piece_point' | 'role';
  reward_amount: number | null;
  role_id: string | null;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

const REWARD_TYPE_LABELS: Record<string, string> = {
  points: 'แต้ม',
  ticket_point: 'แต้มตั๋ว',
  ticket_piece_point: 'แต้มชิ้นตั๋ว',
  role: 'Role',
};

const REWARD_TYPE_COLORS: Record<string, string> = {
  points: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  ticket_point: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  ticket_piece_point: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  role: 'bg-green-500/10 text-green-700 dark:text-green-400',
};

const MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

export function CheckinRewardsManagement() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dailyRewards, setDailyRewards] = useState<DailyReward[]>([]);
  const [bigReward, setBigReward] = useState<BigReward | null>(null);

  // Month/Year selection
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-12

  // Edit daily reward dialog
  const [editingDay, setEditingDay] = useState<DailyReward | null>(null);
  const [editForm, setEditForm] = useState({
    reward_type: 'points' as DailyReward['reward_type'],
    reward_amount: 10,
    role_id: '',
    makeup_cost: 50,
  });

  // Edit big reward dialog
  const [editingBigReward, setEditingBigReward] = useState(false);
  const [bigRewardForm, setBigRewardForm] = useState({
    reward_type: 'points' as BigReward['reward_type'],
    reward_amount: 100,
    role_id: '',
    description: '',
  });

  const [saving, setSaving] = useState(false);

  const fetchRewards = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch rewards for the selected month/year
      const { data, error } = await supabase.functions.invoke('get-checkin-rewards-by-month', {
        body: {
          year: selectedYear,
          month: selectedMonth,
        },
      });

      if (error) throw error;

      if (data?.ok) {
        setDailyRewards(data.daily_rewards || []);
        setBigReward(data.big_reward);
      } else {
        throw new Error(data?.error || 'Failed to fetch rewards');
      }
    } catch (error) {
      console.error('Error fetching rewards:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดข้อมูลรางวัลได้',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, toast]);

  useEffect(() => {
    fetchRewards();
  }, [fetchRewards]);

  const openEditDayDialog = (dayNum: number) => {
    const reward = dailyRewards.find(r => r.day_number === dayNum);
    if (reward) {
      setEditingDay(reward);
      setEditForm({
        reward_type: reward.reward_type,
        reward_amount: reward.reward_amount || 10,
        role_id: reward.role_id || '',
        makeup_cost: reward.makeup_cost,
      });
    }
  };

  const openEditBigRewardDialog = () => {
    setEditingBigReward(true);
    if (bigReward) {
      setBigRewardForm({
        reward_type: bigReward.reward_type,
        reward_amount: bigReward.reward_amount || 100,
        role_id: bigReward.role_id || '',
        description: bigReward.description || '',
      });
    }
  };

  const saveDailyReward = async () => {
    if (!editingDay) return;

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-checkin-daily-reward', {
        body: {
          year: selectedYear,
          month: selectedMonth,
          day_number: editingDay.day_number,
          reward_type: editForm.reward_type,
          reward_amount: editForm.reward_type !== 'role' ? editForm.reward_amount : null,
          role_id: editForm.reward_type === 'role' ? editForm.role_id : null,
          makeup_cost: editForm.makeup_cost,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Failed to save');

      toast({
        title: 'บันทึกสำเร็จ',
        description: `อัปเดตรางวัลวันที่ ${editingDay.day_number} (${MONTH_NAMES[selectedMonth - 1]} ${selectedYear + 543}) แล้ว`
      });
      setEditingDay(null);
      fetchRewards();
    } catch (error) {
      console.error('Error saving daily reward:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถบันทึกรางวัลได้',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const saveBigReward = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('update-checkin-big-reward', {
        body: {
          reward_type: bigRewardForm.reward_type,
          reward_amount: bigRewardForm.reward_type !== 'role' ? bigRewardForm.reward_amount : null,
          role_id: bigRewardForm.reward_type === 'role' ? bigRewardForm.role_id : null,
          description: bigRewardForm.description,
        },
      });

      if (error) throw error;

      toast({ title: 'บันทึกสำเร็จ', description: 'อัปเดตรางวัลใหญ่แล้ว' });
      setEditingBigReward(false);
      fetchRewards();
    } catch (error) {
      console.error('Error saving big reward:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถบันทึกรางวัลใหญ่ได้',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const goToPrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth() + 1);
  };

  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === (now.getMonth() + 1);
  const isPastMonth = selectedYear < now.getFullYear() ||
    (selectedYear === now.getFullYear() && selectedMonth < (now.getMonth() + 1));

  // Check if a specific day is in the past
  const isDayInPast = (dayNum: number) => {
    const selectedDate = new Date(selectedYear, selectedMonth - 1, dayNum);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate < today;
  };

  const getDayReward = (dayNum: number) => {
    return dailyRewards.find(r => r.day_number === dayNum);
  };

  return (
    <div className="space-y-6">
      {/* Month/Year Selector */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <CardTitle className="text-base font-semibold">เลือกเดือนที่ต้องการตั้งค่า</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  สามารถตั้งค่ารางวัลล่วงหน้าสำหรับเดือนถัดไป
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevMonth}
                className="h-9"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex flex-col items-center min-w-[160px]">
                <div className="text-lg font-bold">
                  {MONTH_NAMES[selectedMonth - 1]} {selectedYear + 543}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {isCurrentMonth && (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">เดือนนี้</Badge>
                  )}
                  {isPastMonth && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">อดีต</Badge>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextMonth}
                className="h-9"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              {!isCurrentMonth && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToCurrentMonth}
                  className="h-9"
                >
                  วันนี้
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Big Reward Card */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">รางวัลใหญ่ (28 วัน)</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">รางวัลเมื่อเช็คอินครบทั้งเดือน</p>
            </div>
          </div>
          <Button size="sm" onClick={openEditBigRewardDialog}>
            <Edit className="w-4 h-4 mr-1" />
            แก้ไข
          </Button>
        </CardHeader>
        <CardContent>
          {bigReward ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">ประเภทรางวัล</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={cn('text-xs', REWARD_TYPE_COLORS[bigReward.reward_type])}>
                    {REWARD_TYPE_LABELS[bigReward.reward_type]}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">จำนวน</Label>
                <p className="text-lg font-bold mt-1">
                  {bigReward.reward_type === 'role'
                    ? bigReward.role_id || '-'
                    : `${bigReward.reward_amount || 0} ${REWARD_TYPE_LABELS[bigReward.reward_type]}`}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">คำอธิบาย</Label>
                <p className="text-sm mt-1">{bigReward.description || '-'}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">ยังไม่มีการตั้งค่ารางวัลใหญ่</p>
          )}
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-primary" />
              <CardTitle className="text-base font-semibold">ปฏิทินรางวัลรายวัน</CardTitle>
            </div>
            <Badge variant="secondary" className="text-xs">28 วัน</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            คลิกที่วันเพื่อแก้ไขรางวัลและค่า Makeup • วันที่ผ่านไปแล้วไม่สามารถแก้ไขได้
          </p>
          {isPastMonth && (
            <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                เดือนนี้เป็นเดือนที่ผ่านมาแล้ว - ไม่สามารถแก้ไขรางวัลได้
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {Array.from({ length: 28 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {Array.from({ length: 28 }, (_, i) => i + 1).map((dayNum) => {
                const reward = getDayReward(dayNum);
                const isPast = isDayInPast(dayNum);
                return (
                  <button
                    key={dayNum}
                    onClick={() => !isPast && openEditDayDialog(dayNum)}
                    disabled={isPast}
                    className={cn(
                      'aspect-square rounded-lg border-2 transition-all duration-200',
                      'flex flex-col items-center justify-center gap-1 p-2',
                      isPast
                        ? 'border-border/50 bg-muted/30 opacity-50 cursor-not-allowed'
                        : 'hover:scale-105 hover:shadow-md active:scale-95 cursor-pointer',
                      !isPast && reward?.is_active
                        ? 'border-primary/30 bg-gradient-to-br from-primary/5 to-transparent'
                        : !isPast && 'border-border bg-muted/50'
                    )}
                  >
                    <div className={cn('text-lg font-bold', isPast && 'text-muted-foreground')}>
                      {dayNum}
                    </div>
                    {reward && (
                      <>
                        <Badge
                          variant="secondary"
                          className={cn('text-[10px] px-1 py-0', REWARD_TYPE_COLORS[reward.reward_type])}
                        >
                          {REWARD_TYPE_LABELS[reward.reward_type]}
                        </Badge>
                        <div className="text-xs font-bold">
                          {reward.reward_type === 'role'
                            ? 'Role'
                            : reward.reward_amount}
                        </div>
                        <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Coins className="w-2.5 h-2.5" />
                          {reward.makeup_cost}
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Daily Reward Dialog */}
      <Dialog open={!!editingDay} onOpenChange={(open) => !open && setEditingDay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขรางวัลวันที่ {editingDay?.day_number}</DialogTitle>
            <DialogDescription>
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear + 543}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>ประเภทรางวัล</Label>
              <Select
                value={editForm.reward_type}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, reward_type: value as DailyReward['reward_type'] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="points">แต้ม</SelectItem>
                  <SelectItem value="ticket_point">แต้มตั๋ว</SelectItem>
                  <SelectItem value="ticket_piece_point">แต้มชิ้นตั๋ว</SelectItem>
                  <SelectItem value="role">Discord Role</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editForm.reward_type === 'role' ? (
              <div>
                <Label>Discord Role ID</Label>
                <Input
                  placeholder="123456789012345678"
                  value={editForm.role_id}
                  onChange={(e) => setEditForm({ ...editForm, role_id: e.target.value })}
                />
              </div>
            ) : (
              <div>
                <Label>จำนวนรางวัล</Label>
                <Input
                  type="number"
                  min="0"
                  value={editForm.reward_amount}
                  onChange={(e) =>
                    setEditForm({ ...editForm, reward_amount: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            )}

            <div>
              <Label>ค่า Makeup (แต้ม)</Label>
              <Input
                type="number"
                min="0"
                value={editForm.makeup_cost}
                onChange={(e) =>
                  setEditForm({ ...editForm, makeup_cost: parseInt(e.target.value) || 0 })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                แต้มที่ใช้เติมวันที่พลาดไปหลังวันที่ 28
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDay(null)} disabled={saving}>
              <X className="w-4 h-4 mr-1" />
              ยกเลิก
            </Button>
            <Button onClick={saveDailyReward} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Big Reward Dialog */}
      <Dialog open={editingBigReward} onOpenChange={setEditingBigReward}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขรางวัลใหญ่ (28 วัน)</DialogTitle>
            <DialogDescription>
              รางวัลที่ได้รับเมื่อเช็คอินครบทั้ง 28 วัน
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>ประเภทรางวัล</Label>
              <Select
                value={bigRewardForm.reward_type}
                onValueChange={(value) =>
                  setBigRewardForm({ ...bigRewardForm, reward_type: value as BigReward['reward_type'] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="points">แต้ม</SelectItem>
                  <SelectItem value="ticket_point">แต้มตั๋ว</SelectItem>
                  <SelectItem value="ticket_piece_point">แต้มชิ้นตั๋ว</SelectItem>
                  <SelectItem value="role">Discord Role</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {bigRewardForm.reward_type === 'role' ? (
              <div>
                <Label>Discord Role ID</Label>
                <Input
                  placeholder="123456789012345678"
                  value={bigRewardForm.role_id}
                  onChange={(e) => setBigRewardForm({ ...bigRewardForm, role_id: e.target.value })}
                />
              </div>
            ) : (
              <div>
                <Label>จำนวนรางวัล</Label>
                <Input
                  type="number"
                  min="0"
                  value={bigRewardForm.reward_amount}
                  onChange={(e) =>
                    setBigRewardForm({ ...bigRewardForm, reward_amount: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            )}

            <div>
              <Label>คำอธิบาย</Label>
              <Input
                placeholder="รางวัลพิเศษสำหรับการเช็คอินครบ 28 วัน"
                value={bigRewardForm.description}
                onChange={(e) => setBigRewardForm({ ...bigRewardForm, description: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBigReward(false)} disabled={saving}>
              <X className="w-4 h-4 mr-1" />
              ยกเลิก
            </Button>
            <Button onClick={saveBigReward} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
