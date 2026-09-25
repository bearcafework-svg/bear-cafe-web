import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CheckCircle2, XCircle, AlertTriangle, Sparkles, Layers, ShieldCheck, HelpCircle } from 'lucide-react';
import { validateAndEvaluateGame1Word, type Game1ValidationResult } from '@/lib/minigames/game1Masking';

interface Game1LivePreviewProps {
  word: string;
}

export const Game1LivePreview: React.FC<Game1LivePreviewProps> = ({ word }) => {
  const result: Game1ValidationResult = useMemo(() => {
    return validateAndEvaluateGame1Word(word);
  }, [word]);

  if (!word || !word.trim()) {
    return (
      <div className="p-3.5 rounded-2xl bg-[#FAF6F0]/80 dark:bg-[#25201C]/80 border border-dashed border-[#EAD8C8] dark:border-[#2D2520] text-xs text-muted-foreground flex items-center gap-2">
        <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>พิมพ์คำศัพท์ภาษาไทยด้านบนเพื่อดูตัวอย่างโจทย์และผลการประเมินคุณภาพอัตโนมัติ</span>
      </div>
    );
  }

  if (!result.isValid) {
    return (
      <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs space-y-2.5 animate-in fade-in-50 duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>ไม่สามารถใช้คำนี้เป็นโจทย์ Game 1 ได้</span>
          </div>
          <Badge variant="destructive" className="text-[10px] px-2 py-0.5 rounded-md font-bold">
            REJECTED
          </Badge>
        </div>

        <div className="p-3 rounded-xl bg-white/70 dark:bg-[#1E1B18]/70 border border-rose-500/20 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>คำศัพท์: <strong className="text-foreground">{result.answer || word}</strong></span>
            {result.units.length > 0 && (
              <span>หน่วยคำ: <code className="font-mono text-foreground font-bold">{result.units.join(' + ')}</code></span>
            )}
          </div>
          <p className="text-rose-700 dark:text-rose-300 font-medium text-xs leading-relaxed">
            ⚠️ <strong>เหตุผล:</strong> {result.reason}
          </p>
        </div>

        <p className="text-[11px] text-muted-foreground">
          💡 <em>ระบบ Game 1 คัดกรองคำศัพท์อย่างเข้มงวดเพื่อป้องกันสระลอย เศษตัวการันต์ และโจทย์ที่กำกวมต่อผู้เล่น</em>
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-3 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>โจทย์ผ่านเกณฑ์คุณภาพ Game 1 พร้อมใช้งาน</span>
        </div>
        <div className="flex items-center gap-1.5">
          {result.grade === 'LOW' && (
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] px-2 py-0.5 rounded-md font-bold">
              ✓ LOW Ambiguity (แนะนำสูงสุด)
            </Badge>
          )}
          {result.grade === 'MEDIUM' && (
            <Badge className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] px-2 py-0.5 rounded-md font-bold">
              ✓ MEDIUM Ambiguity (คุณภาพดี)
            </Badge>
          )}
        </div>
      </div>

      {/* Main Mask Preview Box */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-[#1E1B18] border border-emerald-500/20 shadow-xs space-y-2">
        <div className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
          <span>โจทย์ที่จะแสดงให้ผู้เล่นเห็น (Best Candidate):</span>
          <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
            Safe Units: {result.units.join(' + ')}
          </span>
        </div>
        
        <div className="p-3 rounded-lg bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 flex items-center justify-center gap-3">
          <span className="text-sm font-semibold text-muted-foreground">โจทย์บน Discord:</span>
          <code className="text-base sm:text-lg font-black text-[#8C6239] dark:text-[#EAD8C8] bg-white dark:bg-[#25201C] px-3.5 py-1 rounded-md border border-[#EAD8C8] dark:border-[#3D322A] tracking-wider">
            {result.bestMask}
          </code>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
          <div className="p-2 rounded-lg bg-[#FAF6F0] dark:bg-[#25201C] border border-[#EAD8C8]/60 dark:border-[#2D2520]">
            <span className="text-muted-foreground block text-[10px]">ส่วนที่เปิดเผย (บริบท):</span>
            <strong className="text-emerald-700 dark:text-emerald-300 text-xs">{result.revealedPart || '-'}</strong>
          </div>
          <div className="p-2 rounded-lg bg-[#FAF6F0] dark:bg-[#25201C] border border-[#EAD8C8]/60 dark:border-[#2D2520]">
            <span className="text-muted-foreground block text-[10px]">ส่วนที่ซ่อน (ต้องเติม):</span>
            <strong className="text-amber-700 dark:text-amber-300 text-xs">{result.hiddenPart || '-'}</strong>
          </div>
        </div>
      </div>

      {/* Candidate comparison if multiple candidates */}
      {result.candidates.length > 1 && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-muted-foreground block">
            Candidate ทั้งหมดที่ระบบวิเคราะห์ ({result.candidates.length} ตัวเลือก):
          </span>
          <div className="space-y-1">
            {result.candidates.map((c, idx) => {
              const isBest = c.maskStr === result.bestMask;
              return (
                <div
                  key={idx}
                  className={`p-2 rounded-lg text-[11px] flex items-center justify-between border ${
                    isBest
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200 font-bold'
                      : 'bg-muted/40 border-border/50 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{isBest ? '⭐ ตัวเลือกที่ดีที่สุด:' : `ตัวเลือกที่ ${idx + 1}:`}</span>
                    <code className="font-mono bg-background px-1.5 py-0.5 rounded border">{c.maskStr}</code>
                  </div>
                  <Badge
                    variant={c.ambiguity === 'LOW' ? 'default' : c.ambiguity === 'MEDIUM' ? 'secondary' : 'destructive'}
                    className="text-[9px] px-1.5 py-0.2"
                  >
                    {c.ambiguity}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
