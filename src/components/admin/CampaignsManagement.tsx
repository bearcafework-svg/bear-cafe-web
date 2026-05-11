import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit,
  Upload,
  RefreshCw,
  Eye,
  Send,
  Loader2,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { compressImage } from '@/lib/image-compress';
import type { Tables } from '@/integrations/supabase/types';

// Type for campaign_messages table (will be auto-generated after migration)
type CampaignMessage = {
  id: string;
  internal_name: string;
  content_text: string;
  image_url: string | null;
  has_button: boolean;
  button_label: string | null;
  button_url: string | null;
  button_emoji_id: string | null;
  button_emoji_name: string | null;
  target_channels: string[];
  sort_order: number;
  is_active: boolean;
  last_sent_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

interface DiscordChannel {
  id: string;
  name: string;
  parent_id: string | null;
  position: number;
  topic: string | null;
  nsfw: boolean;
}

interface FormData {
  internal_name: string;
  content_text: string;
  image_url: string;
  has_button: boolean;
  button_label: string;
  button_url: string;
  button_emoji_id: string;
  button_emoji_name: string;
  target_channels: string[];
  sort_order: number;
  is_active: boolean;
}

const INITIAL_FORM: FormData = {
  internal_name: '',
  content_text: '',
  image_url: '',
  has_button: false,
  button_label: '',
  button_url: '',
  button_emoji_id: '',
  button_emoji_name: '',
  target_channels: [],
  sort_order: 0,
  is_active: true,
};

export function CampaignsManagement() {
  const [campaigns, setCampaigns] = useState<CampaignMessage[]>([]);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignMessage | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [uploading, setUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // ─── Fetch campaigns ─────────────────────────────────────────────────────
  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('campaign_messages')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error: any) {
      console.error('Error fetching campaigns:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดข้อมูลแคมเปญได้',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // ─── Sync Discord channels ───────────────────────────────────────────────
  const syncChannels = async () => {
    try {
      setLoadingChannels(true);
      const { data, error } = await supabase.functions.invoke('sync-discord-channels');

      if (error) throw error;
      if (data?.channels) {
        setChannels(data.channels);
        toast({
          title: 'สำเร็จ',
          description: `ดึงข้อมูล ${data.channels.length} ช่องแล้ว`,
        });
      }
    } catch (error: any) {
      console.error('Error syncing channels:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถดึงข้อมูลช่อง Discord ได้',
        variant: 'destructive',
      });
    } finally {
      setLoadingChannels(false);
    }
  };

  // ─── Image upload ────────────────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'ไฟล์ไม่ถูกต้อง',
        description: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'ไฟล์ใหญ่เกินไป',
        description: 'ขนาดไฟล์ต้องไม่เกิน 5MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploading(true);

      // Compress image
      const compressed = await compressImage(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
      });

      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('campaign-images')
        .upload(fileName, compressed);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('campaign-images')
        .getPublicUrl(data.path);

      setFormData((prev) => ({ ...prev, image_url: publicUrl }));
      toast({
        title: 'สำเร็จ',
        description: 'อัปโหลดรูปภาพเรียบร้อยแล้ว',
      });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถอัปโหลดรูปภาพได้',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ─── Form validation ─────────────────────────────────────────────────────
  const validateForm = (): string | null => {
    if (!formData.internal_name.trim()) return 'กรุณาระบุชื่อภายใน';
    if (formData.internal_name.length > 100) return 'ชื่อภายในต้องไม่เกิน 100 ตัวอักษร';
    if (!formData.content_text.trim()) return 'กรุณาระบุข้อความ';
    if (formData.content_text.length > 2000) return 'ข้อความต้องไม่เกิน 2000 ตัวอักษร';
    if (formData.image_url && !formData.image_url.match(/^https?:\/\//)) return 'URL รูปภาพไม่ถูกต้อง';
    
    if (formData.has_button) {
      if (!formData.button_label.trim()) return 'กรุณาระบุข้อความปุ่ม';
      if (formData.button_label.length > 80) return 'ข้อความปุ่มต้องไม่เกิน 80 ตัวอักษร';
      if (!formData.button_url.trim()) return 'กรุณาระบุ URL ปุ่ม';
      if (!formData.button_url.match(/^https?:\/\//)) return 'URL ปุ่มไม่ถูกต้อง';
    }

    if (formData.target_channels.length === 0) return 'กรุณาเลือกช่องเป้าหมายอย่างน้อย 1 ช่อง';

    return null;
  };

  // ─── Save campaign ───────────────────────────────────────────────────────
  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast({
        title: 'ข้อมูลไม่ครบถ้วน',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    try {
      const payload = {
        ...formData,
        button_label: formData.has_button ? formData.button_label : null,
        button_url: formData.has_button ? formData.button_url : null,
        button_emoji_id: formData.has_button && formData.button_emoji_id ? formData.button_emoji_id : null,
        button_emoji_name: formData.has_button && formData.button_emoji_name ? formData.button_emoji_name : null,
      };

      if (editingCampaign) {
        const { error } = await supabase
          .from('campaign_messages')
          .update(payload)
          .eq('id', editingCampaign.id);

        if (error) throw error;
        toast({ title: 'สำเร็จ', description: 'แก้ไขแคมเปญเรียบร้อยแล้ว' });
      } else {
        const { error } = await supabase
          .from('campaign_messages')
          .insert([payload]);

        if (error) throw error;
        toast({ title: 'สำเร็จ', description: 'สร้างแคมเปญเรียบร้อยแล้ว' });
      }

      setDialogOpen(false);
      setEditingCampaign(null);
      setFormData(INITIAL_FORM);
      fetchCampaigns();
    } catch (error: any) {
      console.error('Error saving campaign:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถบันทึกแคมเปญได้',
        variant: 'destructive',
      });
    }
  };

  // ─── Delete campaign ─────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบแคมเปญนี้?')) return;

    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('campaign_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'สำเร็จ', description: 'ลบแคมเปญเรียบร้อยแล้ว' });
      fetchCampaigns();
    } catch (error: any) {
      console.error('Error deleting campaign:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถลบแคมเปญได้',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Open edit dialog ────────────────────────────────────────────────────
  const handleEdit = (campaign: CampaignMessage) => {
    setEditingCampaign(campaign);
    setFormData({
      internal_name: campaign.internal_name,
      content_text: campaign.content_text,
      image_url: campaign.image_url || '',
      has_button: campaign.has_button,
      button_label: campaign.button_label || '',
      button_url: campaign.button_url || '',
      button_emoji_id: campaign.button_emoji_id || '',
      button_emoji_name: campaign.button_emoji_name || '',
      target_channels: campaign.target_channels || [],
      sort_order: campaign.sort_order,
      is_active: campaign.is_active,
    });
    setDialogOpen(true);
  };

  // ─── Open create dialog ──────────────────────────────────────────────────
  const handleCreate = () => {
    setEditingCampaign(null);
    setFormData(INITIAL_FORM);
    setDialogOpen(true);
  };

  // ─── Toggle channel selection ────────────────────────────────────────────
  const toggleChannel = (channelId: string) => {
    setFormData((prev) => ({
      ...prev,
      target_channels: prev.target_channels.includes(channelId)
        ? prev.target_channels.filter((id) => id !== channelId)
        : [...prev.target_channels, channelId],
    }));
  };

  // ─── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchCampaigns();
  }, []);

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              จัดการแคมเปญโฆษณา
            </CardTitle>
            <Button onClick={handleCreate} size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              สร้างแคมเปญ
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* ─── Campaigns table ─── */}
      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Send className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>ยังไม่มีแคมเปญ</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อภายใน</TableHead>
                  <TableHead>ข้อความ</TableHead>
                  <TableHead>ช่องเป้าหมาย</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>ส่งล่าสุด</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.internal_name}</TableCell>
                    <TableCell className="max-w-xs truncate">{campaign.content_text}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{campaign.target_channels?.length || 0} ช่อง</Badge>
                    </TableCell>
                    <TableCell>
                      {campaign.is_active ? (
                        <Badge className="bg-green-500">เปิดใช้งาน</Badge>
                      ) : (
                        <Badge variant="secondary">ปิดใช้งาน</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {campaign.last_sent_at
                        ? new Date(campaign.last_sent_at).toLocaleDateString('th-TH')
                        : 'ยังไม่เคยส่ง'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(campaign)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(campaign.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ─── Create/Edit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCampaign ? 'แก้ไขแคมเปญ' : 'สร้างแคมเปญใหม่'}
            </DialogTitle>
            <DialogDescription>
              กรอกข้อมูลแคมเปญและดูตัวอย่างแบบเรียลไทม์
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ─── Left Column: Form ─── */}
            <div className="space-y-4">
              {/* Internal name */}
              <div>
                <Label htmlFor="internal_name">ชื่อภายใน *</Label>
                <Input
                  id="internal_name"
                  value={formData.internal_name}
                  onChange={(e) => setFormData({ ...formData, internal_name: e.target.value })}
                  placeholder="เช่น: Summer Sale 2024"
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.internal_name.length}/100
                </p>
              </div>

              {/* Content text */}
              <div>
                <Label htmlFor="content_text">ข้อความ *</Label>
                <Textarea
                  id="content_text"
                  value={formData.content_text}
                  onChange={(e) => setFormData({ ...formData, content_text: e.target.value })}
                  placeholder="ข้อความที่จะแสดงในแคมเปญ"
                  rows={4}
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.content_text.length}/2000
                </p>
              </div>

              {/* Image upload */}
              <div>
                <Label>รูปภาพ</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="gap-2"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    อัปโหลดรูปภาพ
                  </Button>
                  {formData.image_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, image_url: '' })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {formData.image_url && (
                  <img
                    src={formData.image_url}
                    alt="Preview"
                    className="mt-2 w-full h-32 object-cover rounded-lg"
                  />
                )}
              </div>

              {/* Button toggle */}
              <div className="flex items-center justify-between">
                <Label htmlFor="has_button">เพิ่มปุ่ม</Label>
                <Switch
                  id="has_button"
                  checked={formData.has_button}
                  onCheckedChange={(checked) => setFormData({ ...formData, has_button: checked })}
                />
              </div>

              {/* Button fields */}
              {formData.has_button && (
                <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                  <div>
                    <Label htmlFor="button_label">ข้อความปุ่ม *</Label>
                    <Input
                      id="button_label"
                      value={formData.button_label}
                      onChange={(e) => setFormData({ ...formData, button_label: e.target.value })}
                      placeholder="เช่น: ดูรายละเอียด"
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <Label htmlFor="button_url">URL ปุ่ม *</Label>
                    <Input
                      id="button_url"
                      value={formData.button_url}
                      onChange={(e) => setFormData({ ...formData, button_url: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="button_emoji_id">Emoji ID</Label>
                      <Input
                        id="button_emoji_id"
                        value={formData.button_emoji_id}
                        onChange={(e) => setFormData({ ...formData, button_emoji_id: e.target.value })}
                        placeholder="1234567890"
                      />
                    </div>
                    <div>
                      <Label htmlFor="button_emoji_name">Emoji Name</Label>
                      <Input
                        id="button_emoji_name"
                        value={formData.button_emoji_name}
                        onChange={(e) => setFormData({ ...formData, button_emoji_name: e.target.value })}
                        placeholder="emoji_name"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Target channels */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>ช่องเป้าหมาย *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={syncChannels}
                    disabled={loadingChannels}
                    className="gap-2"
                  >
                    {loadingChannels ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    ซิงค์ช่อง
                  </Button>
                </div>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {channels.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      คลิก "ซิงค์ช่อง" เพื่อดึงข้อมูลช่อง Discord
                    </p>
                  ) : (
                    channels.map((channel) => (
                      <div key={channel.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`channel-${channel.id}`}
                          checked={formData.target_channels.includes(channel.id)}
                          onCheckedChange={() => toggleChannel(channel.id)}
                        />
                        <Label
                          htmlFor={`channel-${channel.id}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          # {channel.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  เลือกแล้ว {formData.target_channels.length} ช่อง
                </p>
              </div>

              {/* Sort order */}
              <div>
                <Label htmlFor="sort_order">ลำดับการแสดง</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">เปิดใช้งาน</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>

            {/* ─── Right Column: Live Preview ─── */}
            <div>
              <Label className="mb-2 block">ตัวอย่างแบบเรียลไทม์</Label>
              <Card className="bg-[#313338] text-white p-4">
                <div className="space-y-3">
                  {/* Image preview */}
                  {formData.image_url && (
                    <img
                      src={formData.image_url}
                      alt="Campaign preview"
                      className="w-full rounded-lg"
                    />
                  )}

                  {/* Text content */}
                  {formData.content_text && (
                    <div className="text-sm whitespace-pre-wrap">
                      {formData.content_text}
                    </div>
                  )}

                  {/* Divider */}
                  {formData.content_text && (
                    <div className="border-t border-gray-600" />
                  )}

                  {/* Button preview */}
                  {formData.has_button && formData.button_label && (
                    <Button
                      variant="outline"
                      className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white border-0 gap-2"
                      disabled
                    >
                      {formData.button_emoji_name && (
                        <span>{formData.button_emoji_name}</span>
                      )}
                      {formData.button_label}
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  )}

                  {/* Empty state */}
                  {!formData.content_text && !formData.image_url && (
                    <div className="text-center py-8 text-gray-400">
                      <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">กรอกข้อมูลเพื่อดูตัวอย่าง</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Validation warnings */}
              {formData.content_text && formData.content_text.length > 1800 && (
                <div className="mt-2 flex items-start gap-2 text-xs text-yellow-600">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>ข้อความใกล้ถึงขีดจำกัด 2000 ตัวอักษร</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave}>
              {editingCampaign ? 'บันทึกการแก้ไข' : 'สร้างแคมเปญ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
