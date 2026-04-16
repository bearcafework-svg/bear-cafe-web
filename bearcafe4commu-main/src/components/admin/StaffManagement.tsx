import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function StaffManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("sessions");
  const [loading, setLoading] = useState(true);
  
  const [workSessions, setWorkSessions] = useState<any[]>([]);
  const [promoTasks, setPromoTasks] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [selectedStaffId, setSelectedStaffId] = useState<string>("all");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // ✅ 1. ดึง Profile แยกต่างหาก (เพื่อป้องกัน Error Foreign Key)
      const { data: profiles } = await supabase.from('profiles').select('id, username, discord_username');
      const map: Record<string, string> = {};
      profiles?.forEach(p => { map[p.id] = p.username || 'ทีมงาน'; });
      setProfilesMap(map);

      // ✅ 2. ดึงข้อมูล 3 ตาราง โดยใช้ชื่อคอลัมน์เวลาที่ถูกต้องเป๊ะๆ
      const [sessions, promos, leaves] = await Promise.all([
        supabase.from('work_sessions' as any).select('*').order('check_in_time', { ascending: false }),
        supabase.from('promotion_tasks' as any).select('*').order('submitted_at', { ascending: false }),
        supabase.from('leave_requests' as any).select('*').order('created_at', { ascending: false })
      ]);

      if (sessions.error) throw sessions.error;
      if (promos.error) throw promos.error;
      if (leaves.error) throw leaves.error;

      setWorkSessions(sessions.data || []);
      setPromoTasks(promos.data || []);
      setLeaveRequests(leaves.data || []);
    } catch (error: any) {
      console.error(error);
      toast({ title: "ดึงข้อมูลล้มเหลว", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (table: string, id: string, newStatus: string) => {
    try {
      const { error } = await supabase.from(table as any).update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      toast({ title: "อัปเดตสำเร็จ" });
      fetchData();
    } catch (error: any) {
      toast({ title: "อัปเดตไม่สำเร็จ", description: error.message, variant: "destructive" });
    }
  };

  const uniqueStaff = Array.from(new Map(workSessions.map(s => [s.user_id, { id: s.user_id, name: s.nickname }])).values());
  const filteredSessions = selectedStaffId === "all" ? workSessions : workSessions.filter(s => s.user_id === selectedStaffId);

  if (loading) return <div className="p-8 text-center">กำลังโหลด...</div>;

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="print:hidden bg-secondary/50 p-1 rounded-xl">
          <TabsTrigger value="sessions">ตอกบัตร</TabsTrigger>
          <TabsTrigger value="promotions">งานโปรโมท</TabsTrigger>
          <TabsTrigger value="leaves">ใบลา</TabsTrigger>
          <TabsTrigger value="summary">สรุปรายบุคคล (PDF)</TabsTrigger>
        </TabsList>

        {/* Tab 1: ตอกบัตร */}
        <TabsContent value="sessions" className="print:hidden">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/30"><TableRow><TableHead>ชื่อ</TableHead><TableHead>ตำแหน่ง</TableHead><TableHead>เวลาเข้า</TableHead><TableHead>เวลาออก</TableHead><TableHead>รายละเอียด</TableHead></TableRow></TableHeader>
              <TableBody>
                {workSessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-bold">{s.nickname}</TableCell>
                    <TableCell><Badge variant="outline">{s.position}</Badge></TableCell>
                    <TableCell>{format(new Date(s.check_in_time), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>{s.check_out_time ? format(new Date(s.check_out_time), "dd/MM/yyyy HH:mm") : <span className="text-success">กำลังทำงาน</span>}</TableCell>
                    <TableCell>{s.work_detail || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* Tab 2: งานโปรโมท */}
        <TabsContent value="promotions" className="print:hidden">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/30"><TableRow><TableHead>ชื่อ</TableHead><TableHead>เวลาที่ส่ง</TableHead><TableHead>โพสต์</TableHead><TableHead>สถานะ</TableHead><TableHead className="text-right">จัดการ</TableHead></TableRow></TableHeader>
              <TableBody>
                {promoTasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-bold">{profilesMap[t.user_id]}</TableCell>
                    <TableCell>{format(new Date(t.submitted_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell><a href={t.post_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">ลิงก์ <ExternalLink className="w-3 h-3"/></a></TableCell>
                    <TableCell><Badge>{t.status}</Badge></TableCell>
                    <TableCell className="text-right space-x-2">
                      {t.status === 'pending' && (
                        <><Button size="sm" variant="outline" className="text-success" onClick={() => updateStatus('promotion_tasks', t.id, 'approved')}>ผ่าน</Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => updateStatus('promotion_tasks', t.id, 'rejected')}>ตีตก</Button></>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* Tab 3: ใบลา */}
        <TabsContent value="leaves" className="print:hidden">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/30"><TableRow><TableHead>ชื่อ</TableHead><TableHead>ประเภท</TableHead><TableHead>วันที่ลา</TableHead><TableHead>เหตุผล</TableHead><TableHead>สถานะ</TableHead><TableHead className="text-right">จัดการ</TableHead></TableRow></TableHeader>
              <TableBody>
                {leaveRequests.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-bold">{profilesMap[l.user_id]}</TableCell>
                    <TableCell>{l.leave_type}</TableCell>
                    <TableCell>{format(new Date(l.leave_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{l.reason}</TableCell>
                    <TableCell><Badge>{l.status}</Badge></TableCell>
                    <TableCell className="text-right space-x-2">
                      {l.status === 'pending' && (
                        <><Button size="sm" variant="outline" className="text-success" onClick={() => updateStatus('leave_requests', l.id, 'approved')}>อนุมัติ</Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => updateStatus('leave_requests', l.id, 'rejected')}>ปฏิเสธ</Button></>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* Tab 4: PDF */}
        <TabsContent value="summary">
          <div className="flex gap-4 mb-4 print:hidden items-center p-4 bg-secondary/30 rounded-xl border">
            <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="เลือกพนักงาน" /></SelectTrigger>
              <SelectContent><SelectItem value="all">แสดงทุกคน</SelectItem>{uniqueStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={() => window.print()} className="gap-2"><Download className="w-4 h-4"/> โหลด PDF</Button>
          </div>

          <Card className="print:shadow-none print:border-none">
            <CardHeader className="print:px-0">
              <CardTitle className="text-2xl print:text-black">รายงานการทำงาน: {selectedStaffId === "all" ? "ทั้งหมด" : uniqueStaff.find(s=>s.id === selectedStaffId)?.name}</CardTitle>
            </CardHeader>
            <CardContent className="print:px-0">
              <Table className="print:text-black print:border">
                <TableHeader className="print:bg-gray-100"><TableRow>{selectedStaffId === 'all' && <TableHead>ชื่อ</TableHead>}<TableHead>วันที่</TableHead><TableHead>เวลาเข้า-ออก</TableHead><TableHead>รายละเอียด</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredSessions.map((s) => (
                    <TableRow key={s.id} className="print:border-b">
                      {selectedStaffId === 'all' && <TableCell className="font-bold">{s.nickname}</TableCell>}
                      <TableCell>{format(new Date(s.check_in_time), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{format(new Date(s.check_in_time), "HH:mm")} - {s.check_out_time ? format(new Date(s.check_out_time), "HH:mm") : '...'}</TableCell>
                      <TableCell>{s.work_detail || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
