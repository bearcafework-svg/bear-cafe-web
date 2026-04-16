import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, isAfter, endOfDay } from "date-fns";
import { th } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Briefcase, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Calendar as CalendarIcon, 
  Send, 
  FileText, 
  Menu, 
  X,
  History,
  AlertTriangle,
  Lock,
  ExternalLink,
  ChevronRight,
  LogOut
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HomeSidebar } from "@/components/bear-cafe/HomeSidebar";
import { Footer } from "@/components/bear-cafe/Footer";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type WorkSession = {
  id: string;
  check_in_time: string;
  check_out_time: string | null;
  status: 'active' | 'completed';
  position: string;
  work_detail: string | null;
  note: string | null;
};

type PromotionTask = {
  id: string;
  post_url: string;
  image_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
};

type LeaveRequest = {
  id: string;
  leave_type: string;
  leave_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

type DiscordRole = {
  id: string;
  name: string;
  color: number;
  position: number;
  icon: string | null;
};

// Staff roles we care about
const STAFF_ROLE_NAMES = ["Cozy Text", "Consultant", "Service", "Barista", "Bartender", "Admin", "Owner"];

export default function WorkspacePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Role Logic
  const [userRoles, setUserRoles] = useState<DiscordRole[]>([]);
  const [detectedPositions, setDetectedPositions] = useState<DiscordRole[]>([]);
  const [checkingRole, setCheckingRole] = useState(true);
  
  // Check-out State
  const [workDetails, setWorkDetails] = useState("");
  const [remark, setRemark] = useState("");
  const [isLateCheckout, setIsLateCheckout] = useState(false);
  
  // Promotion Task State
  const [promoUrl, setPromoUrl] = useState("");
  const [promoImageUrl, setPromoImageUrl] = useState("");
  const [promoHistory, setPromoHistory] = useState<PromotionTask[]>([]);
  
  // Leave Request State
  const [leaveType, setLeaveType] = useState("");
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([]);

  // History State
  const [history, setHistory] = useState<WorkSession[]>([]);

  useEffect(() => {
    if (user?.id) {
      const initData = async () => {
        setLoading(true);
        try {
          await Promise.all([
            checkUserRoles(),
            fetchActiveSession(),
            fetchHistory(),
            fetchPromoHistory(),
            fetchLeaveHistory()
          ]);
        } catch (error) {
          console.error("Error loading workspace data:", error);
          toast({ title: "เกิดข้อผิดพลาดในการโหลดข้อมูล", variant: "destructive" });
        } finally {
          setLoading(false);
        }
      };
      initData();
    }
  }, [user?.id]);

  useEffect(() => {
    if (activeSession) {
      const checkLate = () => {
        const checkInTime = new Date(activeSession.check_in_time);
        const endOfCheckInDay = endOfDay(checkInTime);
        const now = new Date();
        setIsLateCheckout(isAfter(now, endOfCheckInDay));
      };
      
      checkLate();
      const interval = setInterval(checkLate, 60000);
      return () => clearInterval(interval);
    }
  }, [activeSession]);

  const checkUserRoles = async () => {
    setCheckingRole(true);
    try {
      // 1. Check Owner/Admin from auth context first
      const positions: DiscordRole[] = [];
      
      if (user?.is_owner) positions.push({ id: 'owner', name: 'Owner', color: 0, position: 999, icon: null });
      if (user?.is_admin) positions.push({ id: 'admin', name: 'Admin', color: 0, position: 998, icon: null });

      // 2. Fetch roles from user_roles table
      const { data: userRolesData, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id);
      
      if (!error && userRolesData) {
        userRolesData.forEach((ur: any) => {
          // Map app roles to display roles
          const roleName = ur.role.charAt(0).toUpperCase() + ur.role.slice(1);
          // Avoid duplicates if already added by auth context
          if (!positions.some(p => p.name.toLowerCase() === roleName.toLowerCase())) {
             positions.push({ 
               id: ur.role, 
               name: roleName, 
               color: 0, 
               position: 50, 
               icon: null 
             });
          }
        });
      }

      // If no roles found, default to Staff
      if (positions.length === 0) {
        positions.push({
          id: 'staff',
          name: 'Staff',
          color: 0,
          position: 1,
          icon: null
        });
      }

      // Remove duplicates based on name
      const uniquePositions = positions.filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);
      
      // Sort by priority
      uniquePositions.sort((a, b) => {
         const getPriority = (name: string) => {
           if (name === 'Owner') return 100;
           if (name === 'Admin') return 90;
           if (name === 'Bartender') return 80;
           if (name === 'Barista') return 70;
           if (name === 'Service') return 60;
           if (name === 'Consultant') return 50;
           return 10;
         };
         return getPriority(b.name) - getPriority(a.name);
      });

      setDetectedPositions(uniquePositions);
      setUserRoles(uniquePositions); // Keep consistent
    } catch (error) {
      console.error("Error checking role:", error);
      // Fallback to Staff on error
      setDetectedPositions([{ id: 'staff', name: 'Staff', color: 0, position: 1, icon: null }]);
    } finally {
      setCheckingRole(false);
    }
  };

  const fetchActiveSession = async () => {
    try {
      const { data, error } = await supabase
        .from('work_sessions' as any)
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;
      setActiveSession(data as any);
    } catch (error) {
      console.error('Error fetching session:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('work_sessions' as any)
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'completed')
        .order('check_in_time', { ascending: false })
        .limit(20);

      if (error) throw error;
      setHistory((data || []) as any);
    } catch (error) { console.error(error); }
  };

  const fetchPromoHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('promotion_tasks' as any)
        .select('*')
        .eq('user_id', user?.id)
        .order('submitted_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setPromoHistory((data || []) as any);
    } catch (error) { console.error(error); }
  };

  const fetchLeaveHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_requests' as any)
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setLeaveHistory((data || []) as any);
    } catch (error) { console.error(error); }
  };

  const handleCheckIn = async () => {
    if (detectedPositions.length === 0) {
      toast({ title: "ไม่พบตำแหน่งงาน", variant: "destructive" });
      return;
    }

    // Use the highest priority role
    const primaryRole = detectedPositions[0].name;

    try {
      const { error } = await supabase.from('work_sessions' as any).insert({
        user_id: user?.id,
        status: 'active',
        check_in_time: new Date().toISOString(),
        position: primaryRole,
        nickname: user?.username || 'Staff'
      });

      if (error) throw error;
      
      toast({ title: "เช็คอินสำเร็จ", description: `เข้างานในตำแหน่ง: ${primaryRole}` });
      fetchActiveSession();
    } catch (error: any) {
      toast({ title: "เช็คอินล้มเหลว", description: error.message, variant: "destructive" });
    }
  };

  const handleCheckOut = async () => {
    if (!workDetails.trim()) {
      toast({ title: "กรุณาระบุรายละเอียดงาน", variant: "destructive" });
      return;
    }
    
    if (isLateCheckout && !remark.trim()) {
      toast({ title: "กรุณาระบุหมายเหตุ", description: "เนื่องจากเช็คเอาท์ข้ามวันหรือหลังเที่ยงคืน", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from('work_sessions' as any)
        .update({
          status: 'completed',
          check_out_time: new Date().toISOString(),
          work_detail: workDetails,
          note: remark
        })
        .eq('id', activeSession?.id);

      if (error) throw error;
      
      toast({ title: "เช็คเอาท์สำเร็จ", description: "ขอบคุณที่เหนื่อยมาทั้งวันครับ!" });
      setActiveSession(null);
      setWorkDetails("");
      setRemark("");
      fetchHistory();
    } catch (error: any) {
      toast({ title: "เช็คเอาท์ล้มเหลว", description: error.message, variant: "destructive" });
    }
  };

  const submitPromotion = async () => {
    if (!promoUrl.trim()) {
      toast({ title: "กรุณาระบุ URL โพสต์", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.from('promotion_tasks' as any).insert({
        user_id: user?.id,
        post_url: promoUrl,
        image_url: promoImageUrl,
        submitted_at: new Date().toISOString()
      });

      if (error) throw error;
      
      toast({ title: "ส่งงานโปรโมทสำเร็จ" });
      setPromoUrl("");
      setPromoImageUrl("");
      fetchPromoHistory();
    } catch (error: any) {
      toast({ title: "ส่งงานไม่สำเร็จ", description: error.message, variant: "destructive" });
    }
  };

  const submitLeaveRequest = async () => {
    if (!leaveType || !leaveDate || !leaveReason.trim()) {
      toast({ title: "กรุณากรอกข้อมูลให้ครบ", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.from('leave_requests' as any).insert({
        user_id: user?.id,
        leave_type: leaveType,
        leave_date: leaveDate,
        reason: leaveReason,
        created_at: new Date().toISOString()
      });

      if (error) throw error;
      
      toast({ title: "ส่งใบลาสำเร็จ" });
      setLeaveType("");
      setLeaveDate("");
      setLeaveReason("");
      fetchLeaveHistory();
    } catch (error: any) {
      toast({ title: "ส่งใบลาไม่สำเร็จ", description: error.message, variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'approved': return <Badge className="bg-green-500 hover:bg-green-600">อนุมัติแล้ว</Badge>;
      case 'rejected': return <Badge variant="destructive">ถูกปฏิเสธ</Badge>;
      default: return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">รอตรวจสอบ</Badge>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#FFF5EB] via-[#FFF0F5] to-[#E6E6FA] dark:from-[#1a1a1a] dark:via-[#2d2d2d] dark:to-[#1a1a1a]">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <HomeSidebar onlineCount={null} memberCount={null} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-white/80 dark:bg-black/50 backdrop-blur-md border-b border-white/20 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-display font-bold text-lg">Bear Cafe Workspace</span>
          <div className="w-10" /> {/* Spacer */}
        </div>

        <main className="flex-1 container max-w-6xl mx-auto px-4 py-8 lg:py-12 space-y-8">
          {/* Header Section */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-2xl">
                  <Briefcase className="w-8 h-8 text-primary" />
                </div>
                พื้นที่ทีมงาน
              </h1>
              <p className="text-muted-foreground ml-1">จัดการเวลาทำงานและส่งงานต่างๆ อย่างมืออาชีพ</p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium text-foreground">{user?.username}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(), "d MMMM yyyy", { locale: th })}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
            </div>
          </motion.div>

          {/* Time Attendance Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-white/40 dark:border-white/10 shadow-xl bg-white/60 dark:bg-black/40 backdrop-blur-xl rounded-3xl overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-purple-500 to-pink-500" />
              <CardContent className="p-6 md:p-8">
                {loading || checkingRole ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <p className="text-muted-foreground">กำลังโหลดข้อมูลและตรวจสอบสิทธิ์...</p>
                  </div>
                ) : detectedPositions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center animate-pulse">
                      <Lock className="w-10 h-10 text-red-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-red-600 dark:text-red-400">คุณไม่มีสิทธิ์เข้าทำงาน</h3>
                      <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                        ระบบไม่พบตำแหน่งงานของคุณ กรุณาติดต่อ Admin เพื่อขอรับ Role ที่ถูกต้องใน Discord (เช่น Barista, Bartender)
                      </p>
                    </div>
                  </div>
                ) : activeSession ? (
                  <div className="grid md:grid-cols-2 gap-8 items-start">
                    <div className="space-y-6">
                      <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/10 rounded-full group-hover:scale-110 transition-transform" />
                        <div className="relative z-10">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                            <span className="font-semibold text-green-700 dark:text-green-400">กำลังทำงาน</span>
                          </div>
                          <h3 className="text-2xl font-bold text-foreground mb-1">{activeSession.position}</h3>
                          <p className="text-muted-foreground flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4" />
                            เริ่มงาน: {format(new Date(activeSession.check_in_time), "HH:mm น.")}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-base font-medium">ตำแหน่งที่ได้รับมอบหมาย</Label>
                        <div className="flex flex-wrap gap-2">
                          {detectedPositions.map((role) => (
                            <Badge 
                              key={role.name} 
                              className="px-3 py-1 text-sm bg-white/80 dark:bg-black/50 border border-border/50 backdrop-blur-sm text-foreground hover:bg-white dark:hover:bg-black/70 transition-all"
                              style={{ borderLeft: `4px solid #${role.color.toString(16)}` }}
                            >
                              {role.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/50 dark:bg-black/20 rounded-2xl p-6 border border-white/20 dark:border-white/5 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="workDetails" className="text-base font-medium flex items-center gap-1">
                          รายละเอียดงาน <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                          id="workDetails"
                          placeholder="สรุปงานที่ทำในวันนี้..."
                          value={workDetails}
                          onChange={(e) => setWorkDetails(e.target.value)}
                          className="min-h-[120px] bg-white/80 dark:bg-black/50 border-white/20 focus:border-primary/50 transition-all resize-none rounded-xl"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="remark" className="text-base font-medium flex items-center gap-2">
                          หมายเหตุ
                          {isLateCheckout && (
                            <Badge variant="destructive" className="text-[10px] px-2 py-0.5 animate-pulse">
                              จำเป็นต้องระบุ (Late)
                            </Badge>
                          )}
                        </Label>
                        <Input
                          id="remark"
                          placeholder={isLateCheckout ? "ระบุเหตุผลที่เลิกงานดึก/ข้ามวัน..." : "เพิ่มเติม (ถ้ามี)"}
                          value={remark}
                          onChange={(e) => setRemark(e.target.value)}
                          className={`bg-white/80 dark:bg-black/50 border-white/20 rounded-xl ${isLateCheckout && !remark ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                        />
                      </div>

                      <Button 
                        onClick={handleCheckOut} 
                        className="w-full bg-red-500 hover:bg-red-600 text-white h-12 rounded-xl shadow-lg shadow-red-500/20 text-lg font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <LogOut className="w-5 h-5 mr-2" />
                        เช็คเอาท์เลิกงาน
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row items-center gap-8 py-8">
                     <div className="flex-1 space-y-6 w-full">
                       <div className="space-y-2">
                         <h3 className="text-xl font-semibold">ยินดีต้อนรับสู่พื้นที่ทำงาน</h3>
                         <p className="text-muted-foreground">พร้อมที่จะเริ่มงานหรือยัง? ตรวจสอบตำแหน่งของคุณแล้วกดเช็คอินได้เลย</p>
                       </div>
                       
                       <div className="space-y-3">
                         <Label className="text-base font-medium">ตำแหน่งของคุณ (Auto-detected)</Label>
                         <div className="flex flex-wrap gap-2">
                           {detectedPositions.map((role) => (
                             <motion.div
                               key={role.name}
                               initial={{ scale: 0.9, opacity: 0 }}
                               animate={{ scale: 1, opacity: 1 }}
                               whileHover={{ scale: 1.05 }}
                             >
                               <Badge 
                                 className="px-4 py-2 text-sm bg-white/80 dark:bg-black/50 border border-border/50 backdrop-blur-sm text-foreground shadow-sm"
                                 style={{ borderLeft: `4px solid #${role.color.toString(16)}` }}
                               >
                                 {role.name}
                               </Badge>
                             </motion.div>
                           ))}
                         </div>
                       </div>
                     </div>

                     <div className="w-full md:w-auto flex justify-center">
                       <Button 
                         onClick={handleCheckIn} 
                         className="w-full md:w-64 h-16 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-2xl shadow-xl shadow-emerald-500/20 text-xl font-bold transition-all hover:scale-105 active:scale-95"
                       >
                         <CheckCircle2 className="w-6 h-6 mr-2" />
                         เช็คอินเข้างาน
                       </Button>
                     </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Tools Tabs */}
          <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.2 }}
          >
            <Tabs defaultValue="history" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6 h-14 bg-white/50 dark:bg-black/40 backdrop-blur-md p-1 rounded-2xl border border-white/20 shadow-sm">
                <TabsTrigger value="history" className="rounded-xl h-full data-[state=active]:bg-white dark:data-[state=active]:bg-black/60 data-[state=active]:shadow-md transition-all gap-2">
                  <History className="w-4 h-4" />
                  ประวัติการทำงาน
                </TabsTrigger>
                <TabsTrigger value="promo" className="rounded-xl h-full data-[state=active]:bg-white dark:data-[state=active]:bg-black/60 data-[state=active]:shadow-md transition-all gap-2">
                  <Send className="w-4 h-4" />
                  ส่งงานโปรโมท
                </TabsTrigger>
                <TabsTrigger value="leave" className="rounded-xl h-full data-[state=active]:bg-white dark:data-[state=active]:bg-black/60 data-[state=active]:shadow-md transition-all gap-2">
                  <FileText className="w-4 h-4" />
                  แจ้งลางาน
                </TabsTrigger>
              </TabsList>

              {/* History Tab */}
              <TabsContent value="history">
                <Card className="border-white/40 dark:border-white/10 shadow-lg bg-white/60 dark:bg-black/40 backdrop-blur-xl rounded-3xl overflow-hidden">
                  <CardHeader>
                    <CardTitle>ประวัติการทำงานล่าสุด</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader className="bg-primary/5 sticky top-0 backdrop-blur-md">
                          <TableRow>
                            <TableHead className="w-[150px]">วันที่</TableHead>
                            <TableHead>ตำแหน่ง</TableHead>
                            <TableHead>เวลา</TableHead>
                            <TableHead className="text-right">สถานะ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {history.map((s) => (
                            <TableRow key={s.id} className="hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                              <TableCell className="font-medium">{format(new Date(s.check_in_time), "d MMM yy", { locale: th })}</TableCell>
                              <TableCell>{s.position}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {format(new Date(s.check_in_time), "HH:mm")} - {s.check_out_time ? format(new Date(s.check_out_time), "HH:mm") : "..."}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="secondary" className="bg-green-100 text-green-700">Completed</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Promo Tab */}
              <TabsContent value="promo" className="space-y-6">
                <Card className="border-white/40 dark:border-white/10 shadow-lg bg-white/60 dark:bg-black/40 backdrop-blur-xl rounded-3xl">
                  <CardHeader>
                    <CardTitle>แบบฟอร์มส่งงาน</CardTitle>
                    <CardDescription>ส่งลิงก์โพสต์ที่คุณได้ทำการโปรโมท</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>URL โพสต์ <span className="text-red-500">*</span></Label>
                        <Input 
                          value={promoUrl} 
                          onChange={(e) => setPromoUrl(e.target.value)} 
                          className="bg-white/80 dark:bg-black/50 rounded-xl"
                          placeholder="https://..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>URL รูปภาพ (ถ้ามี)</Label>
                        <Input 
                          value={promoImageUrl} 
                          onChange={(e) => setPromoImageUrl(e.target.value)} 
                          className="bg-white/80 dark:bg-black/50 rounded-xl"
                        />
                      </div>
                    </div>
                    <Button onClick={submitPromotion} className="w-full md:w-auto bg-primary hover:bg-primary/90 rounded-xl px-8">
                      ส่งงาน
                    </Button>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold ml-1">ประวัติการส่งงานของฉัน</h3>
                  <div className="grid gap-3">
                    {promoHistory.map((task) => (
                      <div key={task.id} className="bg-white/50 dark:bg-black/30 backdrop-blur-sm p-4 rounded-2xl border border-white/20 flex items-center justify-between">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg shrink-0">
                            <Send className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <a href={task.post_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline truncate block">
                              {task.post_url}
                            </a>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(task.submitted_at), "d MMM yyyy HH:mm", { locale: th })}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 pl-2">
                          {getStatusBadge(task.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Leave Tab */}
              <TabsContent value="leave" className="space-y-6">
                <Card className="border-white/40 dark:border-white/10 shadow-lg bg-white/60 dark:bg-black/40 backdrop-blur-xl rounded-3xl">
                  <CardHeader>
                    <CardTitle>แบบฟอร์มลางาน</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>ประเภท <span className="text-red-500">*</span></Label>
                        <Select value={leaveType} onValueChange={setLeaveType}>
                          <SelectTrigger className="bg-white/80 dark:bg-black/50 rounded-xl">
                            <SelectValue placeholder="เลือกประเภท..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sick">ลาป่วย</SelectItem>
                            <SelectItem value="personal">ลากิจ</SelectItem>
                            <SelectItem value="vacation">ลาพักร้อน</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>วันที่ <span className="text-red-500">*</span></Label>
                        <Input 
                          type="date" 
                          value={leaveDate} 
                          onChange={(e) => setLeaveDate(e.target.value)} 
                          className="bg-white/80 dark:bg-black/50 rounded-xl"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>เหตุผล <span className="text-red-500">*</span></Label>
                      <Textarea 
                        value={leaveReason} 
                        onChange={(e) => setLeaveReason(e.target.value)} 
                        className="bg-white/80 dark:bg-black/50 rounded-xl min-h-[100px]"
                      />
                    </div>
                    <Button onClick={submitLeaveRequest} className="w-full md:w-auto bg-primary hover:bg-primary/90 rounded-xl px-8">
                      ส่งใบลา
                    </Button>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold ml-1">ประวัติการลาของฉัน</h3>
                  <div className="grid gap-3">
                    {leaveHistory.map((req) => (
                      <div key={req.id} className="bg-white/50 dark:bg-black/30 backdrop-blur-sm p-4 rounded-2xl border border-white/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-lg shrink-0">
                            <CalendarIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {req.leave_type === 'sick' ? 'ลาป่วย' : req.leave_type === 'personal' ? 'ลากิจ' : req.leave_type} 
                              <span className="text-muted-foreground mx-2">•</span> 
                              {format(new Date(req.leave_date), "d MMM yyyy", { locale: th })}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px] md:max-w-md">
                              {req.reason}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 pl-2">
                          {getStatusBadge(req.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
