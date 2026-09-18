import { useState, useEffect } from 'react';
import { Loader2, Sparkles, Check, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  CURATED_TRAITS,
  VIBE_GOALS,
  VIBE_ATMOSPHERES,
  type ServerVibeProfile,
} from '@/lib/discord-traits';

interface DiscordServerForVibe {
  id: string;
  name: string;
  traits?: string[] | null;
  server_profile?: ServerVibeProfile | null;
  [key: string]: unknown;
}

interface EditVibeDialogProps {
  server: DiscordServerForVibe | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (serverId: string, updatedData: { traits: string[]; server_profile: ServerVibeProfile }) => void;
}

export function EditVibeDialog({ server, open, onOpenChange, onSuccess }: EditVibeDialogProps) {
  const { toast } = useToast();

  const [primaryGoal, setPrimaryGoal] = useState<string>('');
  const [atmosphere, setAtmosphere] = useState<string>('');
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!open || !server) return;

    const profile = (server.server_profile || {}) as ServerVibeProfile;
    setPrimaryGoal(profile.primary_goal || '');
    setAtmosphere(profile.atmosphere || '');
    setSelectedTraits(Array.isArray(server.traits) ? [...server.traits] : []);
  }, [open, server]);

  const handleToggleTrait = (traitId: string) => {
    if (selectedTraits.includes(traitId)) {
      setSelectedTraits(selectedTraits.filter((t) => t !== traitId));
    } else {
      if (selectedTraits.length >= 7) {
        toast({
          title: 'เลือกได้สูงสุด 7 แท็ก',
          description: 'กรุณาเอาแท็กที่ไม่ต้องการออกก่อนเลือกแท็กใหม่',
          variant: 'destructive',
        });
        return;
      }
      setSelectedTraits([...selectedTraits, traitId]);
    }
  };

  const handleSave = async () => {
    if (!server) return;

    setIsSaving(true);
    try {
      const updatedProfile: ServerVibeProfile = {
        primary_goal: primaryGoal || undefined,
        atmosphere: atmosphere || undefined,
      };

      const { error } = await supabase
        .from('discord_servers')
        .update({
          traits: selectedTraits,
          server_profile: updatedProfile,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', server.id);

      if (error) throw error;

      toast({
        title: 'บันทึก Vibe สำเร็จ! ✨',
        description: 'ข้อมูล Vibe และแท็กของเซิร์ฟเวอร์ได้รับการอัปเดตสำหรับ Matching Engine แล้ว',
        className: 'bg-emerald-600 text-white',
      });

      onSuccess(server.id, {
        traits: selectedTraits,
        server_profile: updatedProfile,
      });

      onOpenChange(false);
    } catch (err: any) {
      console.error('Failed to update server vibe:', err);
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
            <span>ตั้งค่า Vibe & จุดเด่น: <strong className="text-primary">{server?.name}</strong></span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            ระบุเป้าหมายและบรรยากาศจริงของเซิร์ฟเวอร์ เพื่อให้ระบบ Find Your Vibe แนะนำผู้ใช้ที่ตรงสไตล์เข้ามามากที่สุด
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Section 1: Primary Goal */}
          <div className="space-y-2">
            <Label className="text-xs sm:text-sm font-semibold flex items-center justify-between">
              <span>1. เป้าหมาย / จุดเด่นหลักของเซิร์ฟเวอร์</span>
              <span className="text-[10px] font-normal text-muted-foreground">เลือก 1 ข้อ</span>
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VIBE_GOALS.map((goal) => {
                const isSelected = primaryGoal === goal.id;
                return (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => setPrimaryGoal(isSelected ? '' : goal.id)}
                    className={cn(
                      'p-2.5 rounded-2xl border text-left transition-all flex items-start gap-2.5 relative',
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40'
                        : 'border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-border'
                    )}
                  >
                    <span className="text-xl shrink-0 mt-0.5">{goal.icon}</span>
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-xs font-bold text-foreground leading-tight">{goal.label}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{goal.description}</p>
                    </div>
                    {isSelected && (
                      <div className="absolute right-2.5 top-2.5 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Atmosphere */}
          <div className="space-y-2">
            <Label className="text-xs sm:text-sm font-semibold flex items-center justify-between">
              <span>2. บรรยากาศ & มู้ดในเซิร์ฟเวอร์</span>
              <span className="text-[10px] font-normal text-muted-foreground">เลือก 1 ข้อ</span>
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VIBE_ATMOSPHERES.map((vibe) => {
                const isSelected = atmosphere === vibe.id;
                return (
                  <button
                    key={vibe.id}
                    type="button"
                    onClick={() => setAtmosphere(isSelected ? '' : vibe.id)}
                    className={cn(
                      'p-2.5 rounded-2xl border text-left transition-all flex items-start gap-2.5 relative',
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 shadow-xs ring-1 ring-amber-500/40'
                        : 'border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-border'
                    )}
                  >
                    <span className="text-xl shrink-0 mt-0.5">{vibe.icon}</span>
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-xs font-bold text-foreground leading-tight">{vibe.label}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{vibe.description}</p>
                    </div>
                    {isSelected && (
                      <div className="absolute right-2.5 top-2.5 w-4 h-4 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Trait Tags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs sm:text-sm font-semibold">
                3. แท็ก Vibe & กิจกรรมในเซิร์ฟเวอร์
              </Label>
              <span className="text-[11px] font-mono text-muted-foreground">
                {selectedTraits.length}/7 แท็ก
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              เลือกแท็กที่สอดคล้องกับกิจกรรม ความสนใจ และสไตล์การสื่อสารของสมาชิก
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {CURATED_TRAITS.map((trait) => {
                const isSelected = selectedTraits.includes(trait.id);
                return (
                  <button
                    key={trait.id}
                    type="button"
                    onClick={() => handleToggleTrait(trait.id)}
                    className={cn(
                      'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                      isSelected
                        ? 'border-primary/50 bg-primary/20 text-primary shadow-xs font-semibold'
                        : 'border-border/60 bg-background/50 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                  >
                    <span>{trait.icon}</span>
                    <span>{trait.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-muted/30 rounded-2xl p-3 border border-border/60 flex items-start gap-2.5 text-[11px] text-muted-foreground">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>
              ข้อมูลเหล่านี้จะถูกนำไปจับคู่ทันทีในระบบ <strong>Find Your Vibe Quiz</strong> ช่วยให้ผู้ใช้ที่กำลังมองหาเซิร์ฟเวอร์แนวนี้เจอเซิร์ฟของคุณเป็นอันดับแรกๆ
            </span>
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="rounded-full text-xs"
          >
            ยกเลิก
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-1.5 shadow-sm"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>บันทึก Vibe</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
