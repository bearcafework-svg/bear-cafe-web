import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { 
  Users, UserPlus, Shield, Settings, Activity, Clock, Trash2, Edit2, 
  ArrowUpDown, Plus, Calendar, Save, History, Search, CheckCircle, Loader2, GripVertical,
  Pencil, Copy, ChevronsUpDown, Check
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { DatePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';

interface Position {
  id: string;
  name: string;
  discord_role_id: string;
  display_order: number;
  color: string | null;
  icon: string | null;
  is_active: boolean;
}

interface Level {
  id: string;
  name: string;
  discord_role_id: string | null;
  next_level_id: string | null;
  prev_level_id: string | null;
  is_active: boolean;
}

interface StaffMember {
  id: string;
  discord_id: string;
  nickname: string | null;
  position_id: string | null;
  level_id: string | null;
  joined_at: string;
  intern_start_at: string | null;
  intern_end_at: string | null;
  notes: string | null;
  status: 'Active' | 'Vacation' | 'Suspended' | 'Resigned';
  created_at: string;
  staff_positions?: Position | null;
  staff_levels?: Level | null;
  discord_user?: {
    username: string;
    display_name: string;
    avatar_url: string;
  } | null;
  points?: number;
}

interface DiscordUserSearch {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
}

interface TimelineEvent {
  id: string;
  event_type: string;
  details: string;
  created_at: string;
  profiles?: {
    username: string | null;
  } | null;
}

interface AuditLog {
  id: string;
  action: string;
  operator_name: string | null;
  created_at: string;
  before_data: any;
  after_data: any;
}

export function StaffManagement({ currentUser, isOwner }: { currentUser: any; isOwner: boolean }) {
  const { toast } = useToast();
  
  // Data States
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog States
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  const [auditLogDialogOpen, setAuditLogDialogOpen] = useState(false);
  const [posDialogOpen, setPosDialogOpen] = useState(false);
  const [levelDialogOpen, setLevelDialogOpen] = useState(false);

  // Editing items
  const [selectedMember, setSelectedMember] = useState<StaffMember | null>(null);
  const [selectedTimeline, setSelectedTimeline] = useState<TimelineEvent[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);

  // Forms
  const [memberForm, setMemberForm] = useState({
    discord_id: '',
    nickname: '',
    position_id: '',
    level_id: '',
    joined_at: new Date().toISOString().split('T')[0],
    intern_start_at: '',
    intern_end_at: '',
    notes: '',
    status: 'Active' as StaffMember['status'],
    level_change_reason: ''
  });

  const [memberPoints, setMemberPoints] = useState<number>(0);

  const [posForm, setPosForm] = useState({
    id: '',
    name: '',
    discord_role_id: '',
    display_order: 1,
    color: '#8C6239',
    icon: '',
    is_active: true
  });

  const [levelForm, setLevelForm] = useState({
    id: '',
    name: '',
    discord_role_id: '',
    next_level_id: null as string | null,
    prev_level_id: null as string | null,
    is_active: true
  });

  // Discord Members Search State (Combobox matching /role-transfer behavior)
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [profileSearchQuery, setProfileSearchQuery] = useState('');
  const [profileComboboxOpen, setProfileComboboxOpen] = useState(false);
  const [selectedDiscordUser, setSelectedDiscordUser] = useState<DiscordUserSearch | null>(null);

  // Table filtering
  const [filterQuery, setFilterQuery] = useState('');

  const [submittingMember, setSubmittingMember] = useState(false);
  const [submittingPos, setSubmittingPos] = useState(false);
  const [submittingLevel, setSubmittingLevel] = useState(false);

  // Load profiles on mount
  useEffect(() => {
    async function loadProfiles() {
      setLoadingProfiles(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, discord_id, username, discord_username, avatar_url')
          .order('username');
        if (error) throw error;
        setProfiles(data || []);
      } catch (e) {
        console.error('Error loading profiles:', e);
      } finally {
        setLoadingProfiles(false);
      }
    }
    loadProfiles();
    fetchInitialData();
  }, []);

  const fetchInitialData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [posRes, lvlRes, memRes, ptsRes] = await Promise.all([
        supabase.from('staff_positions').select('*').order('display_order', { ascending: true }),
        supabase.from('staff_levels').select('*').order('name', { ascending: true }),
        supabase.from('staff_members').select(`
          *,
          staff_positions(*),
          staff_levels(*)
        `),
        supabase.from('user_points').select('discord_id, points')
      ]);

      if (posRes.error) throw posRes.error;
      if (lvlRes.error) throw lvlRes.error;
      if (memRes.error) throw memRes.error;

      setPositions(posRes.data || []);
      setLevels(lvlRes.data || []);

      const pointsMap = new Map((ptsRes.data || []).map(p => [p.discord_id, p.points]));

      // Fetch Discord User Details (Avatar / Username) for each member
      const memberList: StaffMember[] = memRes.data || [];
      const discordIds = memberList.map(m => m.discord_id);
      
      if (discordIds.length > 0) {
        // Query profiles first for local cache to avoid slow edge function call
        const { data: dbProfiles, error: dbProfError } = await supabase
          .from('profiles')
          .select('discord_id, username, discord_username, avatar_url')
          .in('discord_id', discordIds);
          
        const localProfileMap = new Map();
        if (!dbProfError && dbProfiles) {
          dbProfiles.forEach(p => {
            localProfileMap.set(p.discord_id, {
              username: p.discord_username || p.username,
              display_name: p.username,
              avatar_url: p.avatar_url || "https://cdn.discordapp.com/embed/avatars/0.png"
            });
          });
        }

        const missingDiscordIds = discordIds.filter(id => !localProfileMap.has(id));

        let apiProfilesMap: Record<string, any> = {};
        if (missingDiscordIds.length > 0) {
          const { data: profiles, error: pError } = await supabase
            .functions.invoke('discord-users', { body: { ids: missingDiscordIds } });
          
          if (!pError && profiles?.profiles) {
            apiProfilesMap = profiles.profiles;
          }
        }

        const mappedMembers = memberList.map(m => {
          const prof = localProfileMap.get(m.discord_id) || (apiProfilesMap[m.discord_id] ? {
            username: apiProfilesMap[m.discord_id].username,
            display_name: apiProfilesMap[m.discord_id].display_name,
            avatar_url: apiProfilesMap[m.discord_id].avatar_url
          } : null);

          return {
            ...m,
            points: pointsMap.get(m.discord_id) || 0,
            discord_user: prof
          };
        });
        setMembers(mappedMembers);
      } else {
        setMembers(memberList.map(m => ({ ...m, points: pointsMap.get(m.discord_id) || 0 })));
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: 'เกิดข้อผิดพลาดในการดึงข้อมูล', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Reordering handler for Positions
  const onDragEndPositions = async (result: DropResult) => {
    if (!result.destination || !isOwner) return;
    const reordered = Array.from(positions);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    
    // Recalculate orders
    const updated = reordered.map((pos, idx) => ({
      ...pos,
      display_order: idx + 1
    }));
    
    setPositions(updated);

    try {
      // Save changes to database in parallel updates
      const promises = updated.map(pos => 
        supabase
          .from('staff_positions')
          .update({ display_order: pos.display_order })
          .eq('id', pos.id)
      );
      await Promise.all(promises);
      toast({ title: 'เปลี่ยนลำดับตำแหน่งสำเร็จ' });
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการย้ายลำดับ', description: e.message, variant: 'destructive' });
      fetchInitialData();
    }
  };

  // Helper calculation functions
  const calculateInternship = (start: string | null, end: string | null) => {
    if (!start) return '-';
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const today = new Date();

    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const formatDaysToYearMonthDay = (totalDays: number) => {
      if (totalDays < 30) {
        return `${totalDays} วัน`;
      } else if (totalDays < 365) {
        const months = Math.floor(totalDays / 30);
        const remainingDays = totalDays % 30;
        return `${months} เดือน${remainingDays > 0 ? ` ${remainingDays} วัน` : ''}`;
      } else {
        const years = Math.floor(totalDays / 365);
        const remainingMonths = Math.floor((totalDays % 365) / 30);
        const remainingDays = (totalDays % 365) % 30;
        let res = `${years} ปี`;
        if (remainingMonths > 0) res += ` ${remainingMonths} เดือน`;
        if (remainingDays > 0) res += ` ${remainingDays} วัน`;
        return res;
      }
    };

    if (end) {
      const endParsed = new Date(end);
      if (today < endParsed) {
        const remaining = Math.ceil((endParsed.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return `เหลืออีก ${remaining} วัน`;
      } else {
        const passed = Math.ceil((today.getTime() - endParsed.getTime()) / (1000 * 60 * 60 * 24));
        return `ผ่านฝึกงานแล้ว ${formatDaysToYearMonthDay(passed)}`;
      }
    } else {
      const passed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return `ผ่านฝึกงานแล้ว ${formatDaysToYearMonthDay(passed)}`;
    }
  };

  const calculateDuration = (member: StaffMember) => {
    const today = new Date();
    let startDate = new Date(member.joined_at);
    
    if (member.intern_start_at) {
      const isPassed = member.intern_end_at ? new Date(member.intern_end_at) <= today : false;
      if (isPassed) {
        startDate = new Date(member.intern_start_at);
      }
    }
    
    const diffTime = today.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `${diffDays} วัน`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      const remainingDays = diffDays % 30;
      return `${months} เดือน ${remainingDays} วัน`;
    } else {
      const years = Math.floor(diffDays / 365);
      const remainingMonths = Math.floor((diffDays % 365) / 30);
      const remainingDays = (diffDays % 365) % 30;
      
      let result = `${years} ปี`;
      if (remainingMonths > 0) result += ` ${remainingMonths} เดือน`;
      if (remainingDays > 0) result += ` ${remainingDays} วัน`;
      return result;
    }
  };

  // Open timeline logs for a staff member
  const handleOpenTimeline = async (member: StaffMember) => {
    setSelectedMember(member);
    setLoadingTimeline(true);
    setTimelineDialogOpen(true);
    try {
      const { data, error } = await supabase
        .from('staff_timeline')
        .select('*, profiles(username)')
        .eq('staff_member_id', member.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSelectedTimeline(data || []);
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการโหลด timeline', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingTimeline(false);
    }
  };

  // Open Audit logs
  const handleOpenAuditLogs = async () => {
    setLoadingAuditLogs(true);
    setAuditLogDialogOpen(true);
    try {
      const { data, error } = await supabase
        .from('staff_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setAuditLogs(data || []);
    } catch (e: any) {
      toast({ title: 'โหลดประวัติระบบล้มเหลว', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  // CRUD member handlers
  const handleOpenAddMember = () => {
    setSelectedMember(null);
    setSelectedDiscordUser(null);
    setProfileSearchQuery('');
    setProfileComboboxOpen(false);
    setMemberPoints(0);
    setMemberForm({
      discord_id: '',
      nickname: '',
      position_id: positions[0]?.id || '',
      level_id: levels[0]?.id || '',
      joined_at: new Date().toISOString().split('T')[0],
      intern_start_at: '',
      intern_end_at: '',
      notes: '',
      status: 'Active',
      level_change_reason: ''
    });
    setMemberDialogOpen(true);
  };

  const handleOpenEditMember = (member: StaffMember) => {
    setSelectedMember(member);
    setSelectedDiscordUser(member.discord_user ? {
      id: member.discord_id,
      username: member.discord_user.username,
      display_name: member.discord_user.display_name,
      avatar_url: member.discord_user.avatar_url
    } : null);
    setMemberPoints(member.points || 0);
    
    setMemberForm({
      discord_id: member.discord_id,
      nickname: member.nickname || '',
      position_id: member.position_id || '',
      level_id: member.level_id || '',
      joined_at: member.joined_at.split('T')[0],
      intern_start_at: member.intern_start_at ? member.intern_start_at.split('T')[0] : '',
      intern_end_at: member.intern_end_at ? member.intern_end_at.split('T')[0] : '',
      notes: member.notes || '',
      status: member.status,
      level_change_reason: ''
    });
    setMemberDialogOpen(true);
  };

  const handleSubmitMember = async () => {
    if (!selectedMember && !selectedDiscordUser) {
      toast({ title: 'กรุณาเลือกสมาชิก Discord', variant: 'destructive' });
      return;
    }

    setSubmittingMember(true);

    const payload = {
      action: selectedMember ? 'update' : 'add',
      discord_id: selectedMember ? undefined : selectedDiscordUser?.id,
      member_id: selectedMember ? selectedMember.id : undefined,
      nickname: memberForm.nickname.trim() || null,
      position_id: memberForm.position_id,
      level_id: memberForm.level_id,
      joined_at: new Date(memberForm.joined_at).toISOString(),
      intern_start_at: memberForm.intern_start_at ? new Date(memberForm.intern_start_at).toISOString() : null,
      intern_end_at: memberForm.intern_end_at ? new Date(memberForm.intern_end_at).toISOString() : null,
      notes: memberForm.notes.trim() || null,
      status: memberForm.status,
      level_change_reason: memberForm.level_change_reason.trim()
    };

    // If level changed on edit, require reason
    if (selectedMember && selectedMember.level_id !== memberForm.level_id && !payload.level_change_reason) {
      toast({ title: 'กรุณาระบุเหตุผลการเปลี่ยนระดับ', variant: 'destructive' });
      setSubmittingMember(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', { body: payload });
      if (error) throw error;

      toast({ title: selectedMember ? 'อัปเดตข้อมูลทีมงานสำเร็จ' : 'เพิ่มทีมงานสำเร็จ' });
      setMemberDialogOpen(false);
      fetchInitialData(true);
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message || e, variant: 'destructive' });
    } finally {
      setSubmittingMember(false);
    }
  };

  // CRUD positions handlers
  const handleOpenAddPos = () => {
    setPosForm({
      id: '',
      name: '',
      discord_role_id: '',
      display_order: positions.length + 1,
      color: '#8C6239',
      icon: '',
      is_active: true
    });
    setPosDialogOpen(true);
  };

  const handleOpenEditPos = (pos: Position) => {
    setPosForm({
      id: pos.id,
      name: pos.name,
      discord_role_id: pos.discord_role_id,
      display_order: pos.display_order,
      color: pos.color || '#8C6239',
      icon: pos.icon || '',
      is_active: pos.is_active
    });
    setPosDialogOpen(true);
  };

  const handleSubmitPos = async () => {
    if (!posForm.name.trim() || !posForm.discord_role_id.trim()) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบถ้วน', variant: 'destructive' });
      return;
    }
    setSubmittingPos(true);
    try {
      const { error } = await supabase
        .from('staff_positions')
        .upsert({
          id: posForm.id || undefined,
          name: posForm.name.trim(),
          discord_role_id: posForm.discord_role_id.trim(),
          display_order: posForm.display_order,
          color: posForm.color,
          icon: posForm.icon.trim() || null,
          is_active: posForm.is_active
        });

      if (error) throw error;
      toast({ title: 'บันทึกตำแหน่งสำเร็จ' });
      setPosDialogOpen(false);
      fetchInitialData();
    } catch (e: any) {
      toast({ title: 'ไม่สามารถบันทึกตำแหน่งได้', description: e.message, variant: 'destructive' });
    } finally {
      setSubmittingPos(false);
    }
  };

  const handleDeletePos = async (id: string) => {
    if (!confirm('ยืนยันที่จะลบตำแหน่งนี้หรือไม่?')) return;
    try {
      const { error } = await supabase.from('staff_positions').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'ลบตำแหน่งสำเร็จ' });
      fetchInitialData();
    } catch (e: any) {
      toast({ title: 'ไม่สามารถลบตำแหน่งได้', description: e.message, variant: 'destructive' });
    }
  };

  // CRUD levels handlers
  const handleOpenAddLevel = () => {
    setLevelForm({
      id: '',
      name: '',
      discord_role_id: '',
      next_level_id: null,
      prev_level_id: null,
      is_active: true
    });
    setLevelDialogOpen(true);
  };

  const handleOpenEditLevel = (lvl: Level) => {
    setLevelForm({
      id: lvl.id,
      name: lvl.name,
      discord_role_id: lvl.discord_role_id || '',
      next_level_id: lvl.next_level_id || null,
      prev_level_id: lvl.prev_level_id || null,
      is_active: lvl.is_active
    });
    setLevelDialogOpen(true);
  };

  const handleSubmitLevel = async () => {
    if (!levelForm.name.trim()) {
      toast({ title: 'กรุณากรอกชื่อระดับ', variant: 'destructive' });
      return;
    }
    setSubmittingLevel(true);
    try {
      const { error } = await supabase
        .from('staff_levels')
        .upsert({
          id: levelForm.id || undefined,
          name: levelForm.name.trim(),
          discord_role_id: levelForm.discord_role_id.trim() || null,
          next_level_id: levelForm.next_level_id || null,
          prev_level_id: levelForm.prev_level_id || null,
          is_active: levelForm.is_active
        });

      if (error) throw error;
      toast({ title: 'บันทึกระดับสำเร็จ' });
      setLevelDialogOpen(false);
      fetchInitialData();
    } catch (e: any) {
      toast({ title: 'ไม่สามารถบันทึกระดับได้', description: e.message, variant: 'destructive' });
    } finally {
      setSubmittingLevel(false);
    }
  };

  const handleDeleteLevel = async (id: string) => {
    if (!confirm('ยืนยันที่จะลบระดับนี้หรือไม่?')) return;
    try {
      const { error } = await supabase.from('staff_levels').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'ลบระดับสำเร็จ' });
      fetchInitialData();
    } catch (e: any) {
      toast({ title: 'ไม่สามารถลบระดับได้', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteMember = async (member: StaffMember) => {
    if (!confirm(`ยืนยันที่จะลบข้อมูลทีมงาน "${member.nickname || member.discord_user?.display_name || member.discord_id}" หรือไม่?\nการลบนี้จะลบข้อมูลประวัติการทำงาน และการเลื่อนระดับทั้งหมดที่เกี่ยวข้องกับสตาฟคนนี้ออกจากระบบอย่างถาวร!`)) return;
    
    setLoading(true);
    try {
      const { error: memberErr } = await supabase
        .from('staff_members')
        .delete()
        .eq('id', member.id);
      
      if (memberErr) throw memberErr;

      toast({ title: 'ลบข้อมูลทีมงานสำเร็จ' });
      fetchInitialData();
    } catch (e: any) {
      toast({ title: 'ไม่สามารถลบข้อมูลทีมงานได้', description: e.message, variant: 'destructive' });
      setLoading(false);
    }
  };

  // Filtered members list
  const sortedAndFilteredMembers = useMemo(() => {
    let list = [...members];

    // Query Filter (Nickname, Username)
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase().trim();
      list = list.filter(m => 
        (m.nickname || '').toLowerCase().includes(q) ||
        (m.discord_user?.username || '').toLowerCase().includes(q) ||
        (m.discord_user?.display_name || '').toLowerCase().includes(q)
      );
    }

    // Sort by: 1. Position Display Order, 2. Level Name, 3. Date
    return list.sort((a, b) => {
      const posA = a.staff_positions?.display_order ?? 999;
      const posB = b.staff_positions?.display_order ?? 999;
      if (posA !== posB) return posA - posB;

      const lvlA = a.staff_levels?.name || '';
      const lvlB = b.staff_levels?.name || '';
      if (lvlA !== lvlB) return lvlA.localeCompare(lvlB, 'th');

      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
    });
  }, [members, filterQuery]);

  // Filter and map profiles for selection in "Add Staff" Combobox
  const filteredProfiles = useMemo(() => {
    const q = profileSearchQuery.toLowerCase().trim();
    // Exclude existing staff members to avoid duplicates
    const existingStaffDiscordIds = new Set(members.map(m => m.discord_id));
    return profiles.filter(p => {
      if (existingStaffDiscordIds.has(p.discord_id)) return false;
      if (!q) return true;
      return (
        p.username.toLowerCase().includes(q) ||
        p.discord_id.includes(q) ||
        (p.discord_username ?? '').toLowerCase().includes(q)
      );
    });
  }, [profiles, profileSearchQuery, members]);

  const handleSelectProfile = (discordId: string) => {
    const selected = profiles.find(p => p.discord_id === discordId);
    if (selected) {
      setSelectedDiscordUser({
        id: selected.discord_id,
        username: selected.discord_username || selected.username,
        display_name: selected.username,
        avatar_url: selected.avatar_url || "https://cdn.discordapp.com/embed/avatars/0.png"
      });
      setMemberForm(prev => ({
        ...prev,
        discord_id: selected.discord_id,
        nickname: prev.nickname || selected.username
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#8C6239] dark:text-[#EAD8C8]">จัดการทีมงาน</h1>
          <p className="text-base text-muted-foreground">ระบบจัดการข้อมูลทีมงาน ลำดับตำแหน่ง/ระดับ และประวัติการเลื่อนยศ (เชื่อมต่อ Discord + Supabase)</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleOpenAuditLogs} variant="outline" className="gap-2 border-latte/40 dark:border-coffee/40 text-sm h-10 px-4 rounded-xl">
            <History className="w-4.5 h-4.5" />
            ประวัติระบบ
          </Button>
          <Button onClick={handleOpenAddMember} className="gap-2 bg-gradient-to-r from-primary to-bear-brown text-primary-foreground text-sm h-10 px-4 rounded-xl">
            <UserPlus className="w-4.5 h-4.5" />
            เพิ่มทีมงาน
          </Button>
        </div>
      </div>

      <Tabs defaultValue="staff" className="w-full">
        <TabsList className="bg-cream/40 dark:bg-card/40 border border-latte/40 dark:border-coffee/40 rounded-2xl p-1 mb-4">
          <TabsTrigger value="staff" className="rounded-xl px-5 py-2.5 text-sm font-semibold">รายชื่อทีมงาน ({sortedAndFilteredMembers.length})</TabsTrigger>
          <TabsTrigger value="positions" className="rounded-xl px-5 py-2.5 text-sm font-semibold">ระบบตำแหน่ง ({positions.length})</TabsTrigger>
          <TabsTrigger value="levels" className="rounded-xl px-5 py-2.5 text-sm font-semibold">ระบบระดับ ({levels.length})</TabsTrigger>
        </TabsList>

        {/* TAB 1: STAFF LIST */}
        <TabsContent value="staff" className="space-y-4">
          <Card className="border-latte/40 dark:border-coffee/40 bg-card/85 backdrop-blur-sm shadow-md rounded-3xl overflow-hidden">
            <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold text-[#8C6239] dark:text-[#EAD8C8]">รายชื่อทีมงานทั้งหมด</CardTitle>
                <CardDescription className="text-sm">จัดเรียงตาม: ลำดับตำแหน่ง → ลำดับระดับ → วันเข้าทีมงาน</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <div className="relative w-full sm:w-60">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                  <Input
                    value={filterQuery}
                    onChange={e => setFilterQuery(e.target.value)}
                    placeholder="ค้นหาชื่อเล่น / Discord..."
                    className="pl-9 bg-background/50 border-latte/40 rounded-xl h-10 text-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-cream/20 dark:bg-card/60">
                    <TableRow className="text-sm font-bold">
                      <TableHead className="pl-6 w-[220px] text-sm font-bold">สมาชิก</TableHead>
                      <TableHead className="text-sm font-bold">ชื่อเล่น</TableHead>
                      <TableHead className="text-sm font-bold">ตำแหน่ง</TableHead>
                      <TableHead className="text-sm font-bold">ระดับ</TableHead>
                      <TableHead className="text-sm font-bold">แต้มสะสม</TableHead>
                      <TableHead className="text-sm font-bold">วันเดือนปีเปิด / อายุงาน</TableHead>
                      <TableHead className="text-sm font-bold">การฝึกงาน</TableHead>
                      <TableHead className="text-right pr-6 text-sm font-bold">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />กำลังโหลดทีมงาน...</TableCell></TableRow>
                    ) : sortedAndFilteredMembers.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">ไม่พบข้อมูลทีมงาน</TableCell></TableRow>
                    ) : sortedAndFilteredMembers.map(m => {
                      const isIntern = m.intern_start_at !== null;
                      const hasColor = m.staff_positions?.color;
                      return (
                        <TableRow key={m.id} className="hover:bg-cream/5 dark:hover:bg-card/40 transition-colors text-sm">
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-3">
                              <img
                                src={m.discord_user?.avatar_url || "https://cdn.discordapp.com/embed/avatars/0.png"}
                                alt="Discord Avatar"
                                className="w-9 h-9 rounded-full border border-latte/30 dark:border-coffee/30 shrink-0"
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-base truncate">{m.discord_user?.display_name || 'Loading...'}</span>
                                <span className="text-xs text-muted-foreground truncate">@{m.discord_user?.username || m.discord_id}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-base">{m.nickname || '-'}</TableCell>
                          <TableCell>
                            <Badge 
                              className="text-sm font-semibold py-1 px-2.5"
                              style={{ 
                                backgroundColor: hasColor ? `${hasColor}15` : 'rgba(var(--primary), 0.1)',
                                color: hasColor || 'var(--primary)',
                                border: `1px solid ${hasColor}30`
                              }}
                            >
                              {m.staff_positions?.name || 'ไม่มี'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-sm font-medium border-latte/60 py-1 px-2.5">
                              {m.staff_levels?.name || 'ไม่มี'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold text-base text-amber-600 dark:text-amber-400">
                            {(m.points || 0).toLocaleString()} แต้ม
                          </TableCell>
                          <TableCell className="text-sm">
                            <div>
                              {(() => {
                                const today = new Date();
                                let dateToUse = new Date(m.joined_at);
                                if (m.intern_start_at) {
                                  const isPassed = m.intern_end_at ? new Date(m.intern_end_at) <= today : false;
                                  if (isPassed) {
                                    dateToUse = new Date(m.intern_start_at);
                                  }
                                }
                                return dateToUse.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
                              })()}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 font-medium">
                              อายุงาน: {calculateDuration(m)}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {isIntern ? (
                              <div className="flex flex-col">
                                <span className="font-medium text-[#8C6239] dark:text-[#EAD8C8]">{calculateInternship(m.intern_start_at, m.intern_end_at)}</span>
                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <span>
                                      {new Date(m.intern_start_at!).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-4.5 w-4.5 p-0 hover:bg-cream/20 text-muted-foreground hover:text-foreground shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const unix = Math.floor(new Date(m.intern_start_at!).getTime() / 1000);
                                        navigator.clipboard.writeText(String(unix));
                                        toast({ title: 'คัดลอก Unix Timestamp วันเริ่มฝึกงานสำเร็จ', description: `ค่าที่คัดลอก: ${unix}` });
                                      }}
                                      title="คัดลอก Unix Timestamp ของวันเริ่มฝึกงาน"
                                    >
                                      <Copy className="w-2.5 h-2.5" />
                                    </Button>
                                  </div>
                                  <span>-</span>
                                  <div className="flex items-center gap-1">
                                    <span>
                                      {m.intern_end_at ? new Date(m.intern_end_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'ปัจจุบัน'}
                                    </span>
                                    {m.intern_end_at && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-4.5 w-4.5 p-0 hover:bg-cream/20 text-muted-foreground hover:text-foreground shrink-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const unix = Math.floor(new Date(m.intern_end_at!).getTime() / 1000);
                                          navigator.clipboard.writeText(String(unix));
                                          toast({ title: 'คัดลอก Unix Timestamp วันสิ้นสุดฝึกงานสำเร็จ', description: `ค่าที่คัดลอก: ${unix}` });
                                        }}
                                        title="คัดลอก Unix Timestamp ของวันสิ้นสุดฝึกงาน"
                                      >
                                        <Copy className="w-2.5 h-2.5" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-cream/20 rounded-lg text-muted-foreground hover:text-foreground" onClick={() => handleOpenTimeline(m)}>
                                <Activity className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-cream/20 rounded-lg text-indigo-500 hover:text-indigo-600" onClick={() => handleOpenEditMember(m)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              {isOwner && (
                                <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-cream/20 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50/10" onClick={() => handleDeleteMember(m)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: POSITIONS CRUD */}
        <TabsContent value="positions" className="space-y-4">
          <Card className="border-latte/40 dark:border-coffee/40 bg-card/85 backdrop-blur-sm shadow-md rounded-3xl overflow-hidden">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">ระบบตำแหน่ง (Positions)</CardTitle>
                <CardDescription className="text-xs">ลากและวาง (Drag & Drop) เพื่อเปลี่ยนลำดับตำแหน่งในระบบ (มีผลกับการเรียงข้อมูลและสิทธิ์)</CardDescription>
              </div>
              <Button onClick={handleOpenAddPos} size="sm" className="gap-1">
                <Plus className="w-4 h-4" /> Adding
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <DragDropContext onDragEnd={onDragEndPositions}>
                <Droppable droppableId="positions-list">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="divide-y divide-latte/20 dark:divide-coffee/20">
                      {positions.length === 0 ? (
                        <div className="p-6 text-center text-sm text-muted-foreground">ไม่มีตำแหน่งในระบบ</div>
                      ) : positions.map((pos, idx) => (
                        <Draggable key={pos.id} draggableId={pos.id} index={idx} isDragDisabled={!isOwner}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center justify-between p-4 ${snapshot.isDragging ? 'bg-cream/10 dark:bg-card/80 shadow-lg' : 'hover:bg-cream/5 dark:hover:bg-card/40'} transition-all`}
                            >
                              <div className="flex items-center gap-3">
                                {isOwner && (
                                  <div {...provided.dragHandleProps} className="text-muted-foreground hover:text-foreground shrink-0 cursor-grab active:cursor-grabbing p-1 rounded">
                                    <GripVertical className="w-4 h-4" />
                                  </div>
                                )}
                                <span className="text-xs text-muted-foreground w-6 font-mono">#{pos.display_order}</span>
                                <Badge 
                                  className="text-xs font-semibold px-2.5 py-1"
                                  style={{ 
                                    backgroundColor: pos.color ? `${pos.color}15` : 'rgba(var(--primary), 0.1)',
                                    color: pos.color || 'var(--primary)',
                                    border: `1px solid ${pos.color}30`
                                  }}
                                >
                                  {pos.name}
                                </Badge>
                                <span className="text-xs text-muted-foreground">Role ID: {pos.discord_role_id}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Badge variant={pos.is_active ? 'success' : 'secondary'} className="text-[9px] scale-90">
                                  {pos.is_active ? 'ใช้งาน' : 'ปิด'}
                                </Badge>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-cream/20 rounded-lg text-indigo-500 hover:text-indigo-600" onClick={() => handleOpenEditPos(pos)}>
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-cream/20 rounded-lg text-destructive" onClick={() => handleDeletePos(pos.id)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: LEVELS CRUD */}
        <TabsContent value="levels" className="space-y-4">
          <Card className="border-latte/40 dark:border-coffee/40 bg-card/85 backdrop-blur-sm shadow-md rounded-3xl overflow-hidden">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">ระบบระดับ (Levels)</CardTitle>
                <CardDescription className="text-xs">ระดับงานของสตาฟที่ผูกกับยศตกแต่งของ Discord Role โดยตรง</CardDescription>
              </div>
              <Button onClick={handleOpenAddLevel} size="sm" className="gap-1">
                <Plus className="w-4 h-4" /> Adding
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-latte/20 dark:divide-coffee/20">
                {levels.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">ไม่มีระดับงานในระบบ</div>
                ) : levels.map((lvl) => {
                  const nextLvl = levels.find(l => l.id === lvl.next_level_id);
                  const prevLvl = levels.find(l => l.id === lvl.prev_level_id);
                  return (
                    <div key={lvl.id} className="flex items-center justify-between p-4 hover:bg-cream/5 dark:hover:bg-card/40 transition-colors">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-sm">{lvl.name}</span>
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">Role ID: {lvl.discord_role_id || 'ไม่ผูกยศ'}</Badge>
                        </div>
                        <div className="flex gap-2 items-center text-[10px] text-muted-foreground">
                          <span>เลื่อนขึ้น: <strong className="text-green-600 dark:text-green-400">{nextLvl ? nextLvl.name : 'ไม่มี'}</strong></span>
                          <span>•</span>
                          <span>ลดลง: <strong className="text-red-600 dark:text-red-400">{prevLvl ? prevLvl.name : 'ไม่มี'}</strong></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={lvl.is_active ? 'success' : 'secondary'} className="text-[9px] scale-90">
                          {lvl.is_active ? 'ใช้งาน' : 'ปิด'}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-cream/20 rounded-lg text-indigo-500 hover:text-indigo-600" onClick={() => handleOpenEditLevel(lvl)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-cream/20 rounded-lg text-destructive" onClick={() => handleDeleteLevel(lvl.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG 1: ADD/EDIT STAFF */}
      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="max-w-md bg-[#FDFBF7] dark:bg-[hsl(var(--card))] border-[#EAD8C8] dark:border-[#2D2520] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#8C6239] dark:text-[#EAD8C8]">
              {selectedMember ? 'แก้ไขข้อมูลทีมงาน' : 'เพิ่มทีมงานเข้าระบบ'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              กรอกข้อมูลเพื่อเชื่อมต่อบัญชีกับ Discord Server และเพิ่มบทบาท/สิทธิ์
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            {/* Search Discord user */}
            {!selectedMember ? (
              <div className="space-y-2">
                <Label className="text-xs">ค้นหาบัญชี Discord สมาชิก</Label>
                <Popover open={profileComboboxOpen} onOpenChange={setProfileComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={profileComboboxOpen}
                      className="w-full justify-between h-9 border-latte/40 rounded-xl font-normal">
                      {selectedDiscordUser ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <img src={selectedDiscordUser.avatar_url} alt="" className="w-5 h-5 rounded-full shrink-0" />
                          <span className="truncate">{selectedDiscordUser.display_name}</span>
                          <span className="text-xs text-muted-foreground font-mono shrink-0">@{selectedDiscordUser.username}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">เลือกผู้ใช้ Discord...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[380px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                          className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                          placeholder="ค้นหาชื่อหรือ Discord ID..."
                          value={profileSearchQuery}
                          onChange={(e) => setProfileSearchQuery(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <CommandList>
                        <CommandEmpty>
                          {loadingProfiles ? 'กำลังโหลด...' : 'ไม่พบผู้ใช้'}
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredProfiles.slice(0, 50).map(profile => (
                            <CommandItem
                              key={profile.id}
                              value={profile.discord_id}
                              onSelect={() => {
                                handleSelectProfile(profile.discord_id);
                                setProfileComboboxOpen(false);
                                setProfileSearchQuery('');
                              }}
                              className="flex items-center gap-2"
                            >
                              <Check className={cn("mr-1 h-4 w-4", selectedDiscordUser?.id === profile.discord_id ? "opacity-100" : "opacity-0")} />
                              {profile.avatar_url ? (
                                <img src={profile.avatar_url} alt="" className="w-6 h-6 rounded-full shrink-0" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs shrink-0">👤</div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate">{profile.username}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{profile.discord_id}</p>
                                {profile.discord_username && (
                                  <p className="text-[10px] text-muted-foreground">@{profile.discord_username}</p>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-2 bg-cream/10 border border-latte/20 rounded-xl">
                <img
                  src={selectedMember.discord_user?.avatar_url || "https://cdn.discordapp.com/embed/avatars/0.png"}
                  alt="Discord Avatar"
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-sm">{selectedMember.discord_user?.display_name}</span>
                  <span className="text-xs text-muted-foreground">@{selectedMember.discord_user?.username}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">ชื่อเล่น</Label>
                <Input
                  value={memberForm.nickname}
                  onChange={e => setMemberForm(prev => ({ ...prev, nickname: e.target.value }))}
                  placeholder="เช่น พี่หมี"
                  className="h-9 border-latte/40 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">แต้มสะสม (Points)</Label>
                <div className="h-9 px-3 flex items-center bg-muted/40 border border-latte/40 rounded-xl text-sm font-bold text-amber-700 dark:text-amber-400 w-full">
                  {memberPoints.toLocaleString()} แต้ม
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">ตำแหน่งงาน</Label>
                <Select
                  value={memberForm.position_id}
                  onValueChange={v => setMemberForm(prev => ({ ...prev, position_id: v }))}
                >
                  <SelectTrigger className="h-9 border-latte/40 rounded-xl">
                    <SelectValue placeholder="เลือกตำแหน่ง" />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ระดับทีมงาน</Label>
                <Select
                  value={memberForm.level_id}
                  onValueChange={v => setMemberForm(prev => ({ ...prev, level_id: v }))}
                >
                  <SelectTrigger className="h-9 border-latte/40 rounded-xl">
                    <SelectValue placeholder="เลือกระดับ" />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">วันเดือนปีเปิด</Label>
              <DatePicker
                value={memberForm.joined_at}
                onChange={date => setMemberForm(prev => ({ ...prev, joined_at: date }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">วันเริ่มฝึกงาน (ถ้ามี)</Label>
                <DatePicker
                  value={memberForm.intern_start_at}
                  onChange={date => setMemberForm(prev => ({ ...prev, intern_start_at: date }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">วันสิ้นสุดฝึกงาน (ถ้ามี)</Label>
                <DatePicker
                  value={memberForm.intern_end_at}
                  onChange={date => setMemberForm(prev => ({ ...prev, intern_end_at: date }))}
                />
              </div>
            </div>

            {selectedMember && selectedMember.level_id !== memberForm.level_id && (
              <div className="space-y-1 p-2 bg-yellow-50/5 border border-yellow-300/30 rounded-xl animate-pulse">
                <Label className="text-xs text-yellow-600 font-bold">ระบุเหตุผลในการเปลี่ยนระดับ</Label>
                <Input
                  value={memberForm.level_change_reason}
                  onChange={e => setMemberForm(prev => ({ ...prev, level_change_reason: e.target.value }))}
                  placeholder="เช่น ผลงานโดดเด่นประจำเดือน / ผ่านฝึกงาน"
                  className="h-9 border-yellow-300/30 rounded-xl focus:ring-yellow-300"
                />
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">หมายเหตุ</Label>
              <Textarea
                value={memberForm.notes}
                onChange={e => setMemberForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="ข้อมูลเพิ่มเติมสำหรับผู้ใช้คนนี้..."
                className="border-latte/40 rounded-xl h-16"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setMemberDialogOpen(false)} className="rounded-xl">ยกเลิก</Button>
            <Button onClick={handleSubmitMember} disabled={submittingMember} className="gap-2 rounded-xl">
              {submittingMember && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" />
              บันทึกข้อมูล
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: TIMELINE VIEW */}
      <Dialog open={timelineDialogOpen} onOpenChange={setTimelineDialogOpen}>
        <DialogContent className="max-w-md bg-[#FDFBF7] dark:bg-[hsl(var(--card))] border-[#EAD8C8] dark:border-[#2D2520] rounded-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-500" />
              Timeline การทำงาน
            </DialogTitle>
            <DialogDescription className="text-xs">
              บันทึกประวัติการเปลี่ยนตำแหน่ง เลื่อนระดับ พักงาน และลาออกของ {selectedMember?.nickname || selectedMember?.discord_user?.display_name}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {loadingTimeline ? (
              <div className="text-center py-6 text-sm text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />กำลังโหลดประวัติ...</div>
            ) : selectedTimeline.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">ไม่มีประวัติกิจกรรมของสมาชิกรายนี้</div>
            ) : (
              <div className="relative pl-6 border-l border-latte/40 dark:border-coffee/40 space-y-6">
                {selectedTimeline.map(ev => (
                  <div key={ev.id} className="relative">
                    {/* Timeline dot */}
                    <div className="absolute -left-[30px] top-1.5 w-2 h-2 rounded-full bg-primary ring-4 ring-cream dark:ring-card shrink-0" />
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[9px] uppercase tracking-wider">
                          {ev.event_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(ev.created_at).toLocaleString('th-TH', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-foreground leading-relaxed">{ev.details}</p>
                      <span className="text-[9px] text-muted-foreground block">
                        ดำเนินการโดย: {ev.profiles?.username || 'ระบบอัตโนมัติ'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: AUDIT LOGS */}
      <Dialog open={auditLogDialogOpen} onOpenChange={setAuditLogDialogOpen}>
        <DialogContent className="max-w-2xl bg-[#FDFBF7] dark:bg-[hsl(var(--card))] border-[#EAD8C8] dark:border-[#2D2520] rounded-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2">
              <History className="w-5 h-5 text-amber-500" />
              ประวัติระบบบสตาฟ (Audit Logs)
            </DialogTitle>
            <DialogDescription className="text-xs">
              การเปลี่ยนแปลงข้อมูลสตาฟ ตำแหน่ง และระดับทุกจุดจะถูกบันทึกที่นี่
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {loadingAuditLogs ? (
              <div className="text-center py-6 text-sm text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />กำลังโหลดประวัติระบบ...</div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">ไม่มีประวัติกิจกรรมบันทึกไว้</div>
            ) : (
              <div className="border border-latte/30 dark:border-coffee/30 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-cream/10 dark:bg-card/50">
                    <TableRow>
                      <TableHead>วัน/เวลา</TableHead>
                      <TableHead>การทำงาน</TableHead>
                      <TableHead>ผู้ดำเนินการ</TableHead>
                      <TableHead className="text-right">ข้อมูล</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map(log => (
                      <TableRow key={log.id} className="text-xs">
                        <TableCell className="font-mono text-xs">{new Date(log.created_at).toLocaleString('th-TH', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="scale-90">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>{log.operator_name || 'System'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-7 text-[10px] text-primary" onClick={() => setSelectedAuditLog(log)}>
                            เปิดดู JSON
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* JSON Viewer Dialog */}
      <Dialog open={selectedAuditLog !== null} onOpenChange={() => setSelectedAuditLog(null)}>
        <DialogContent className="max-w-md bg-[#FDFBF7] dark:bg-[hsl(var(--card))] border-[#EAD8C8] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">ข้อมูลการเปลี่ยนแปลง (JSON)</DialogTitle>
            <DialogDescription className="sr-only">แสดงข้อมูลเปรียบเทียบก่อนและหลังแก้ไขในรูปแบบ JSON</DialogDescription>
          </DialogHeader>
          <div className="p-3 bg-zinc-900 rounded-xl text-[10px] font-mono text-zinc-300 max-h-80 overflow-y-auto space-y-3">
            <div>
              <p className="text-amber-400 font-bold mb-1">// ข้อมูลก่อน</p>
              <pre className="whitespace-pre-wrap">{JSON.stringify(selectedAuditLog?.before_data || null, null, 2)}</pre>
            </div>
            <div className="border-t border-zinc-800 pt-3">
              <p className="text-green-400 font-bold mb-1">// ข้อมูลหลัง</p>
              <pre className="whitespace-pre-wrap">{JSON.stringify(selectedAuditLog?.after_data || null, null, 2)}</pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: POSITION ADD/EDIT */}
      <Dialog open={posDialogOpen} onOpenChange={setPosDialogOpen}>
        <DialogContent className="max-w-sm bg-[#FDFBF7] dark:bg-[hsl(var(--card))] border-[#EAD8C8] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8]">
              {posForm.id ? 'แก้ไขตำแหน่ง' : 'เพิ่มตำแหน่งใหม่'}
            </DialogTitle>
            <DialogDescription className="sr-only">ตั้งค่าข้อมูลตำแหน่งสตาฟในระบบ</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 my-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">ชื่อตำแหน่ง</Label>
              <Input
                value={posForm.name}
                onChange={e => setPosForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="เช่น Barista / Manager"
                className="h-9 border-latte/40 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Discord Role ID</Label>
              <Input
                value={posForm.discord_role_id}
                onChange={e => setPosForm(prev => ({ ...prev, discord_role_id: e.target.value }))}
                placeholder="พิมพ์ยศ ID จากดิสคอร์ด..."
                className="h-9 border-latte/40 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">สียศ (HEX)</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="color"
                    value={posForm.color.startsWith('#') && posForm.color.length === 7 ? posForm.color : '#ffffff'}
                    onChange={e => setPosForm(prev => ({ ...prev, color: e.target.value }))}
                    className="w-10 h-9 p-0 border border-latte/40 rounded-xl cursor-pointer"
                  />
                  <Input
                    value={posForm.color}
                    onChange={e => setPosForm(prev => ({ ...prev, color: e.target.value }))}
                    placeholder="#ffffff"
                    className="h-9 border-latte/40 rounded-xl font-mono text-center"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">การเปิดใช้งาน</Label>
                <Select
                  value={posForm.is_active ? 'yes' : 'no'}
                  onValueChange={v => setPosForm(prev => ({ ...prev, is_active: v === 'yes' }))}
                >
                  <SelectTrigger className="h-9 border-latte/40 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">เปิดใช้งาน</SelectItem>
                    <SelectItem value="no">ปิดใช้งาน</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPosDialogOpen(false)} className="rounded-xl">ยกเลิก</Button>
            <Button onClick={handleSubmitPos} disabled={submittingPos} className="gap-2 rounded-xl">
              {submittingPos && <Loader2 className="w-4 h-4 animate-spin" />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 5: LEVEL ADD/EDIT */}
      <Dialog open={levelDialogOpen} onOpenChange={setLevelDialogOpen}>
        <DialogContent className="max-w-sm bg-[#FDFBF7] dark:bg-[hsl(var(--card))] border-[#EAD8C8] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8]">
              {levelForm.id ? 'แก้ไขระดับ' : 'เพิ่มระดับใหม่'}
            </DialogTitle>
            <DialogDescription className="sr-only">ตั้งค่าข้อมูลระดับของสตาฟและการสลับยศ</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 my-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">ชื่อระดับ</Label>
              <Input
                value={levelForm.name}
                onChange={e => setLevelForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="เช่น Trainee / Lead"
                className="h-9 border-latte/40 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">ระดับเมื่อเลื่อนขั้น</Label>
                <Select
                  value={levelForm.next_level_id || 'none'}
                  onValueChange={v => setLevelForm(prev => ({ ...prev, next_level_id: v === 'none' ? null : v }))}
                >
                  <SelectTrigger className="h-9 border-latte/40 rounded-xl">
                    <SelectValue placeholder="ไม่มี" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ไม่มี</SelectItem>
                    {levels.filter(l => l.id !== levelForm.id).map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ระดับเมื่อลดขั้น</Label>
                <Select
                  value={levelForm.prev_level_id || 'none'}
                  onValueChange={v => setLevelForm(prev => ({ ...prev, prev_level_id: v === 'none' ? null : v }))}
                >
                  <SelectTrigger className="h-9 border-latte/40 rounded-xl">
                    <SelectValue placeholder="ไม่มี" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ไม่มี</SelectItem>
                    {levels.filter(l => l.id !== levelForm.id).map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Discord Role ID (ผูกยศเพื่อ Sync)</Label>
              <Input
                value={levelForm.discord_role_id}
                onChange={e => setLevelForm(prev => ({ ...prev, discord_role_id: e.target.value }))}
                placeholder="พิมพ์ยศ ID จากดิสคอร์ด (เลือกเติมได้)..."
                className="h-9 border-latte/40 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">การเปิดใช้งาน</Label>
              <Select
                value={levelForm.is_active ? 'yes' : 'no'}
                onValueChange={v => setLevelForm(prev => ({ ...prev, is_active: v === 'yes' }))}
              >
                <SelectTrigger className="h-9 border-latte/40 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">เปิดใช้งาน</SelectItem>
                  <SelectItem value="no">ปิดใช้งาน</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLevelDialogOpen(false)} className="rounded-xl">ยกเลิก</Button>
            <Button onClick={handleSubmitLevel} disabled={submittingLevel} className="gap-2 rounded-xl">
              {submittingLevel && <Loader2 className="w-4 h-4 animate-spin" />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
