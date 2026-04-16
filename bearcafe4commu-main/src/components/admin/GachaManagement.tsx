import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Plus, Trash2, Edit, Gift, Coins, Shield, Box, HelpCircle
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type GachaReward = Database['public']['Tables']['gacha_rewards']['Row'];
type RewardType = Database['public']['Enums']['gacha_reward_type'];

const REWARD_TYPES: { value: RewardType; label: string; icon: React.ElementType }[] = [
  { value: 'point', label: 'แต้มสะสม', icon: Coins },
  { value: 'role', label: 'ยศ Discord', icon: Shield },
  { value: 'money', label: 'เงินรางวัล', icon: Gift },
  { value: 'item', label: 'ไอเทม', icon: Box },
  { value: 'other', label: 'อื่นๆ', icon: HelpCircle },
];

export function GachaManagement() {
  const { toast } = useToast();
  const [rewards, setRewards] = useState<GachaReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [editingReward, setEditingReward] = useState<GachaReward | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    type: RewardType;
    value: string;
    drop_rate: string;
    max_limit: string;
  }>({
    name: '',
    type: 'point',
    value: '',
    drop_rate: '10',
    max_limit: '',
  });
  
  // Coin Management State
  const [targetDiscordId, setTargetDiscordId] = useState('');
  const [coinAmount, setCoinAmount] = useState('');
  const [isCoinSubmitting, setIsCoinSubmitting] = useState(false);

  useEffect(() => {
    fetchRewards();
  }, []);

  const fetchRewards = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('gacha_rewards')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setRewards(data || []);
    } catch (error: any) {
      console.error('Error fetching rewards:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCoins = async () => {
    if (!targetDiscordId || !coinAmount) {
      toast({ title: 'กรุณากรอกข้อมูล', description: 'Discord ID และจำนวนเหรียญเป็นสิ่งจำเป็น', variant: 'destructive' });
      return;
    }

    setIsCoinSubmitting(true);
    try {
      // Check if user exists first
      const { data: userData, error: userError } = await supabase
        .from('user_gacha_stats')
        .select('*')
        .eq('discord_id', targetDiscordId)
        .maybeSingle();

      if (userError) throw userError;

      if (!userData) {
        // Create new record
        const { error: insertError } = await supabase
          .from('user_gacha_stats')
          .insert({
            discord_id: targetDiscordId,
            match_count: 0,
            gacha_coins: parseInt(coinAmount)
          });
        if (insertError) throw insertError;
      } else {
        // Update existing
        const { error: updateError } = await supabase
          .from('user_gacha_stats')
          .update({
            gacha_coins: (userData.gacha_coins || 0) + parseInt(coinAmount)
          })
          .eq('discord_id', targetDiscordId);
        if (updateError) throw updateError;
      }

      toast({ title: 'เพิ่มเหรียญเรียบร้อย', description: `เพิ่ม ${coinAmount} เหรียญให้ ${targetDiscordId}` });
      setTargetDiscordId('');
      setCoinAmount('');
    } catch (error: any) {
      console.error('Error adding coins:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setIsCoinSubmitting(false);
    }
  };

  const handleOpenDialog = (reward?: GachaReward) => {
    if (reward) {
      setEditingReward(reward);
      setFormData({
        name: reward.name,
        type: reward.type,
        value: reward.value || '',
        drop_rate: reward.drop_rate.toString(),
        max_limit: reward.max_limit?.toString() || '',
      });
    } else {
      setEditingReward(null);
      setFormData({
        name: '',
        type: 'point',
        value: '',
        drop_rate: '10',
        max_limit: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.drop_rate) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบ', description: 'ชื่อรางวัลและโอกาสออกเป็นสิ่งจำเป็น', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        value: formData.value || null,
        drop_rate: parseFloat(formData.drop_rate),
        max_limit: formData.max_limit ? parseInt(formData.max_limit) : null,
      };

      if (editingReward) {
        const { error } = await supabase
          .from('gacha_rewards')
          .update(payload)
          .eq('id', editingReward.id);
        if (error) throw error;
        toast({ title: 'อัปเดตรางวัลเรียบร้อย' });
      } else {
        const { error } = await supabase
          .from('gacha_rewards')
          .insert(payload);
        if (error) throw error;
        toast({ title: 'เพิ่มรางวัลเรียบร้อย' });
      }

      setIsDialogOpen(false);
      fetchRewards();
    } catch (error: any) {
      console.error('Error saving reward:', error);
      toast({ title: 'บันทึกไม่สำเร็จ', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('gacha_rewards')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      
      if (error) throw error;
      
      setRewards(rewards.map(r => r.id === id ? { ...r, is_active: !currentStatus } : r));
      toast({ title: !currentStatus ? 'เปิดใช้งานรางวัลแล้ว' : 'ปิดใช้งานรางวัลแล้ว' });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบรางวัลนี้?')) return;
    
    try {
      const { error } = await supabase.from('gacha_rewards').delete().eq('id', id);
      if (error) throw error;
      
      setRewards(rewards.filter(r => r.id !== id));
      toast({ title: 'ลบรางวัลเรียบร้อย' });
    } catch (error: any) {
      toast({ title: 'ลบไม่สำเร็จ', description: error.message, variant: 'destructive' });
    }
  };

  const getTypeIcon = (type: RewardType) => {
    const item = REWARD_TYPES.find(t => t.value === type);
    return item ? item.icon : HelpCircle;
  };

  const getTypeLabel = (type: RewardType) => {
    const item = REWARD_TYPES.find(t => t.value === type);
    return item ? item.label : type;
  };

  return (
    <div className="space-y-6">
      {/* Coin Management Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-500" />
            จัดการเหรียญกาชาปอง (แจกเหรียญ)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="grid w-full gap-2">
              <label className="text-sm font-medium">Discord ID</label>
              <Input 
                placeholder="กรอก Discord ID ของผู้รับ" 
                value={targetDiscordId}
                onChange={(e) => setTargetDiscordId(e.target.value)}
              />
            </div>
            <div className="grid w-full sm:w-48 gap-2">
              <label className="text-sm font-medium">จำนวนเหรียญ</label>
              <Input 
                type="number" 
                placeholder="จำนวน" 
                value={coinAmount}
                onChange={(e) => setCoinAmount(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleAddCoins} 
              disabled={isCoinSubmitting}
              className="w-full sm:w-auto bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              {isCoinSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4 mr-2" />}
              แจกเหรียญ
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            จัดการของรางวัลกาชาปอง
          </CardTitle>
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="w-4 h-4" /> เพิ่มของรางวัล
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> กำลังโหลด...
            </div>
          ) : rewards.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
              <Gift className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>ยังไม่มีของรางวัลในระบบ</p>
              <Button variant="link" onClick={() => handleOpenDialog()}>เพิ่มรางวัลแรกเลย</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>ชื่อรางวัล</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>มูลค่า/Value</TableHead>
                    <TableHead>โอกาสออก (%)</TableHead>
                    <TableHead>จำกัด (ออกแล้ว/ทั้งหมด)</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewards.map((reward) => {
                    const TypeIcon = getTypeIcon(reward.type);
                    const isLimitReached = reward.max_limit !== null && (reward.claimed_count || 0) >= reward.max_limit;
                    
                    return (
                      <TableRow key={reward.id} className={!reward.is_active ? 'opacity-60 bg-muted/50' : ''}>
                        <TableCell>
                          <Switch 
                            checked={reward.is_active ?? false} 
                            onCheckedChange={() => handleToggleActive(reward.id, reward.is_active ?? false)} 
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {reward.name}
                            {isLimitReached && <Badge variant="destructive" className="text-[10px]">หมดแล้ว</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <TypeIcon className="w-3.5 h-3.5" />
                            {getTypeLabel(reward.type)}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{reward.value || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary">
                            {reward.drop_rate}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={isLimitReached ? 'text-destructive font-bold' : ''}>
                            {reward.claimed_count || 0}
                          </span>
                          <span className="text-muted-foreground"> / {reward.max_limit === null ? '∞' : reward.max_limit}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(reward)}>
                              <Edit className="w-4 h-4 text-muted-foreground hover:text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(reward.id)}>
                              <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingReward ? 'แก้ไขของรางวัล' : 'เพิ่มของรางวัลใหม่'}</DialogTitle>
            <DialogDescription>
              กำหนดรายละเอียดของรางวัลที่จะให้ผู้เล่นสุ่มได้จากกาชาปอง
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">ชื่อรางวัล <span className="text-destructive">*</span></label>
              <Input 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                placeholder="เช่น 100 แต้ม, ยศ VIP"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">ประเภท</label>
                <Select 
                  value={formData.type} 
                  onValueChange={(val: RewardType) => setFormData({...formData, type: val})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REWARD_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <div className="flex items-center gap-2">
                          <t.icon className="w-4 h-4" /> {t.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <label className="text-sm font-medium">มูลค่า (Value)</label>
                <Input 
                  value={formData.value} 
                  onChange={(e) => setFormData({...formData, value: e.target.value})} 
                  placeholder={formData.type === 'role' ? 'Role ID' : 'จำนวน/โค้ด'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">โอกาสออก (%) <span className="text-destructive">*</span></label>
                <div className="relative">
                  <Input 
                    type="number" 
                    min="0" 
                    max="100" 
                    step="0.01"
                    value={formData.drop_rate} 
                    onChange={(e) => setFormData({...formData, drop_rate: e.target.value})} 
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">%</span>
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">จำนวนจำกัด (Max Limit)</label>
                <Input 
                  type="number" 
                  min="0" 
                  placeholder="ว่าง = ไม่จำกัด"
                  value={formData.max_limit} 
                  onChange={(e) => setFormData({...formData, max_limit: e.target.value})} 
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingReward ? 'บันทึกการแก้ไข' : 'เพิ่มรางวัล'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
