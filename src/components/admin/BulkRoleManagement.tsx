import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Users, Plus, Minus, Loader2, CheckCircle, AlertTriangle } from "lucide-react";

interface DiscordMember {
  id: string;
  username: string;
  avatar: string | null;
  roles: string[];
}

interface GuildRole {
  id: string;
  name: string;
  color: string | null;
  managed: boolean;
}

export function BulkRoleManagement() {
  const { toast } = useToast();

  // Step 1: Search
  const [searchRoleId, setSearchRoleId] = useState("");
  const [searching, setSearching] = useState(false);
  const [members, setMembers] = useState<DiscordMember[]>([]);
  const [guildRoles, setGuildRoles] = useState<GuildRole[]>([]);
  const [searchRoleName, setSearchRoleName] = useState<string | null>(null);

  // Step 2: Select members
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  // Step 3: Choose action
  const [targetRoleId, setTargetRoleId] = useState("");
  const [mode, setMode] = useState<'add' | 'remove'>('remove');
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{ successCount: number; failCount: number; message: string } | null>(null);

  const handleSearch = async () => {
    if (!searchRoleId.trim()) {
      toast({ title: "กรุณากรอก Role ID", variant: "destructive" });
      return;
    }

    setSearching(true);
    setMembers([]);
    setSelectedMemberIds(new Set());
    setResult(null);
    setSearchRoleName(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('bulk-role-manage', {
        body: { action: 'search', searchRoleId: searchRoleId.trim() },
      });

      if (res.error) throw new Error(res.error.message);

      const data = res.data;
      setMembers(data.members || []);
      setGuildRoles(data.guildRoles || []);

      // Find the role name
      const foundRole = (data.guildRoles || []).find((r: GuildRole) => r.id === searchRoleId.trim());
      setSearchRoleName(foundRole?.name || null);

      // Select all by default
      setSelectedMemberIds(new Set((data.members || []).map((m: DiscordMember) => m.id)));

      if ((data.members || []).length === 0) {
        toast({ title: "ไม่พบสมาชิก", description: "ไม่มีสมาชิกที่มียศนี้", variant: "destructive" });
      } else {
        toast({ title: `พบสมาชิก ${data.members.length} คน` });
      }
    } catch (error: any) {
      toast({ title: "ค้นหาล้มเหลว", description: error.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const toggleMember = (id: string) => {
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedMemberIds.size === members.length) {
      setSelectedMemberIds(new Set());
    } else {
      setSelectedMemberIds(new Set(members.map(m => m.id)));
    }
  };

  const handleExecute = async () => {
    if (!targetRoleId.trim()) {
      toast({ title: "กรุณากรอก Role ID ที่ต้องการจัดการ", variant: "destructive" });
      return;
    }
    if (selectedMemberIds.size === 0) {
      toast({ title: "กรุณาเลือกสมาชิกอย่างน้อย 1 คน", variant: "destructive" });
      return;
    }

    setExecuting(true);
    setResult(null);

    try {
      const res = await supabase.functions.invoke('bulk-role-manage', {
        body: {
          action: 'execute',
          targetRoleId: targetRoleId.trim(),
          memberIds: Array.from(selectedMemberIds),
          mode,
        },
      });

      if (res.error) throw new Error(res.error.message);

      setResult(res.data);
      toast({ title: res.data.message });
    } catch (error: any) {
      toast({ title: "ดำเนินการล้มเหลว", description: error.message, variant: "destructive" });
    } finally {
      setExecuting(false);
    }
  };

  const targetRoleName = guildRoles.find(r => r.id === targetRoleId.trim())?.name;

  return (
    <div className="space-y-6">
      {/* Step 1: Search by Role ID */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="w-5 h-5 text-primary" />
            ขั้นตอนที่ 1: ค้นหาสมาชิกที่มียศ
          </CardTitle>
          <CardDescription>กรอก Role ID เพื่อค้นหาสมาชิกทั้งหมดในเซิร์ฟเวอร์ที่มียศดังกล่าว</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="searchRoleId">Role ID ที่ต้องการค้นหา</Label>
              <Input
                id="searchRoleId"
                placeholder="เช่น 1234567890"
                value={searchRoleId}
                onChange={(e) => setSearchRoleId(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={searching} className="gap-2">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                ค้นหา
              </Button>
            </div>
          </div>

          {searchRoleName && (
            <div className="text-sm text-muted-foreground">
              ยศที่ค้นหา: <Badge variant="outline">{searchRoleName}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Member list */}
      {members.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-primary" />
              ขั้นตอนที่ 2: เลือกสมาชิก ({selectedMemberIds.size}/{members.length})
            </CardTitle>
            <CardDescription>เลือกสมาชิกที่ต้องการดำเนินการ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={toggleAll}>
                {selectedMemberIds.size === members.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
              </Button>
              <span className="text-sm text-muted-foreground">
                เลือกแล้ว {selectedMemberIds.size} จาก {members.length} คน
              </span>
            </div>

            <ScrollArea className="h-[300px] rounded-xl border p-2">
              <div className="space-y-1">
                {members.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedMemberIds.has(m.id)}
                      onCheckedChange={() => toggleMember(m.id)}
                    />
                    {m.avatar ? (
                      <img src={m.avatar} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                        {m.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium">{m.username}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{m.id}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Choose action */}
      {members.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {mode === 'add' ? <Plus className="w-5 h-5 text-primary" /> : <Minus className="w-5 h-5 text-destructive" />}
              ขั้นตอนที่ 3: เลือกการดำเนินการ
            </CardTitle>
            <CardDescription>เลือกว่าต้องการเพิ่มหรือถอดยศ และกรอก Role ID ที่ต้องการจัดการ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={mode === 'remove' ? 'destructive' : 'outline'}
                onClick={() => setMode('remove')}
                className="gap-2"
              >
                <Minus className="w-4 h-4" />
                ถอดยศ
              </Button>
              <Button
                variant={mode === 'add' ? 'default' : 'outline'}
                onClick={() => setMode('add')}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                เพิ่มยศ
              </Button>
            </div>

            <div>
              <Label htmlFor="targetRoleId">
                Role ID ที่ต้องการ{mode === 'add' ? 'เพิ่ม' : 'ถอด'}
              </Label>
              <Input
                id="targetRoleId"
                placeholder="เช่น 0987654321"
                value={targetRoleId}
                onChange={(e) => setTargetRoleId(e.target.value)}
                className="mt-1"
              />
              {targetRoleName && (
                <p className="text-sm text-muted-foreground mt-1">
                  ยศ: <Badge variant="outline">{targetRoleName}</Badge>
                </p>
              )}
            </div>

            <div className="p-4 rounded-xl border bg-muted/30 space-y-1">
              <p className="text-sm font-medium">สรุปการดำเนินการ:</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                {mode === 'add' ? 'เพิ่ม' : 'ถอด'}ยศ {targetRoleName || targetRoleId || '...'} จากสมาชิก {selectedMemberIds.size} คน
              </p>
            </div>

            <Button
              onClick={handleExecute}
              disabled={executing || selectedMemberIds.size === 0 || !targetRoleId.trim()}
              variant={mode === 'remove' ? 'destructive' : 'default'}
              className="gap-2 w-full sm:w-auto"
              size="lg"
            >
              {executing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'add' ? (
                <Plus className="w-4 h-4" />
              ) : (
                <Minus className="w-4 h-4" />
              )}
              {executing ? 'กำลังดำเนินการ...' : `${mode === 'add' ? 'เพิ่ม' : 'ถอด'}ยศ ${selectedMemberIds.size} คน`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card className={result.failCount > 0 ? 'border-destructive/50' : 'border-primary/50'}>
          <CardContent className="p-4 flex items-center gap-3">
            {result.failCount > 0 ? (
              <AlertTriangle className="w-6 h-6 text-destructive shrink-0" />
            ) : (
              <CheckCircle className="w-6 h-6 text-primary shrink-0" />
            )}
            <div>
              <p className="font-medium">{result.message}</p>
              {result.failCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  สำเร็จ {result.successCount} คน, ล้มเหลว {result.failCount} คน
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
