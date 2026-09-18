import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  MousePointerClick,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Code2,
  Check,
  Plus,
  BookOpen,
  Split,
  Layers,
  HelpCircle,
  Undo2,
} from 'lucide-react';

export interface Game13Preset {
  id: string;
  title: string;
  badge: string;
  badgeColor?: string;
  question: string;
  template: string;
  answers: string;
  fullSentence: string;
  category?: string;
}

export const GAME_13_PRESETS: Game13Preset[] = [
  {
    id: 'p1',
    title: 'ความพยายามอยู่ที่ไหนฯ',
    badge: 'สุภาษิตยอดฮิต (2 ช่อง)',
    badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    question: 'ความพยายามอยู่ที่ไหน ความสำเร็จอยู่ที่นั่น',
    template: 'Where there is a {1}, there is a {2}.',
    answers: 'will, way',
    fullSentence: 'Where there is a will, there is a way.',
    category: 'สำนวนและสุภาษิต',
  },
  {
    id: 'p2',
    title: 'กาแฟยามเช้า',
    badge: 'บทสนทนา (2 ช่อง)',
    badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    question: 'ฉันชอบดื่มกาแฟในตอนเช้า',
    template: 'I like to drink {1} in the {2}.',
    answers: 'coffee, morning',
    fullSentence: 'I like to drink coffee in the morning.',
    category: 'บทสนทนาทั่วไป',
  },
  {
    id: 'p3',
    title: 'ฝนตกหนักมาก',
    badge: 'สำนวนเปรียบเทียบ (2 ช่อง)',
    badgeColor: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    question: 'ฝนตกหนักมาก (ตกอย่างกับฟ้ารั่ว)',
    template: 'It is raining {1} and {2}.',
    answers: 'cats, dogs',
    fullSentence: 'It is raining cats and dogs.',
    category: 'สำนวนและสุภาษิต',
  },
  {
    id: 'p4',
    title: 'เวลาและวารีไม่คอยใคร',
    badge: 'สุภาษิต (2 ช่อง)',
    badgeColor: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
    question: 'เวลาและวารีไม่คอยใคร',
    template: 'Time and {1} wait for no {2}.',
    answers: 'tide, man',
    fullSentence: 'Time and tide wait for no man.',
    category: 'สำนวนและสุภาษิต',
  },
  {
    id: 'p5',
    title: 'สุดสัปดาห์นี้ทำอะไร?',
    badge: 'คำถามบทสนทนา (3 ช่อง)',
    badgeColor: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    question: 'สุดสัปดาห์นี้คุณจะทำอะไร?',
    template: 'What {1} you {2} this {3}?',
    answers: 'are, doing, weekend',
    fullSentence: 'What are you doing this weekend?',
    category: 'บทสนทนาทั่วไป',
  },
  {
    id: 'p6',
    title: 'กรุงโรมไม่ได้สร้างในวันเดียว',
    badge: 'สำนวนประวัติศาสตร์ (2 ช่อง)',
    badgeColor: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
    question: 'ความสำเร็จต้องใช้เวลา (กรุงโรมไม่ได้สร้างในวันเดียว)',
    template: 'Rome was not {1} in a {2}.',
    answers: 'built, day',
    fullSentence: 'Rome was not built in a day.',
    category: 'สำนวนและสุภาษิต',
  },
];

/**
 * Validates Game 13 Sentence Template and Answers
 * Ensures {1}..{N} starts at 1, is sequentially contiguous, matches answer count,
 * and complies with bot limits (max 4 blanks, sentence at least 3 words, cannot blank all words).
 */
export function validateGame13Sentence(
  template: string,
  answers: string,
  fullSentence?: string
): string | null {
  const cleanTemplate = (template || '').trim();
  const cleanAnswers = (answers || '').trim();

  if (!cleanTemplate) {
    return 'กรุณาระบุประโยคภาษาอังกฤษที่มีช่องว่าง {1}';
  }
  if (!cleanAnswers) {
    return 'กรุณาระบุคำเฉลยสำหรับเติมในช่องว่าง';
  }

  // Check invalid bracket styles
  if (/\(\d+\)/.test(cleanTemplate)) {
    return 'ตรวจพบการใส่วงเล็บกลม เช่น (1) บอทรองรับเฉพาะวงเล็บปีกกา {1} เท่านั้นค่ะ';
  }
  if (/\[\d+\]/.test(cleanTemplate)) {
    return 'ตรวจพบการใส่วงเล็บเหลี่ยม เช่น [1] บอทรองรับเฉพาะวงเล็บปีกกา {1} เท่านั้นค่ะ';
  }
  if (/\{\s+\d+\s*\}/.test(cleanTemplate) || /\{\s*\d+\s+\}/.test(cleanTemplate)) {
    return 'ห้ามเว้นวรรคภายในวงเล็บปีกกา เช่น ให้ใช้ {1} แทน { 1 }';
  }

  const matches = Array.from(cleanTemplate.matchAll(/\{(\d+)\}/g));
  if (matches.length === 0) {
    return 'ยังไม่มีช่องว่าง {1} ในประโยค กรุณาคลิกเลือกคำที่ต้องการซ่อนอย่างน้อย 1 คำ';
  }

  const blankIndices = matches.map((m) => parseInt(m[1], 10));

  if (blankIndices[0] !== 1) {
    return `ช่องว่างแรกต้องเริ่มต้นด้วย {1} เสมอ (ปัจจุบันพบ {${blankIndices[0]}})`;
  }

  for (let i = 0; i < blankIndices.length; i++) {
    const expected = i + 1;
    if (blankIndices[i] !== expected) {
      return `หมายเลขช่องว่างต้องเรียงลำดับต่อเนื่อง 1, 2, 3... (พบ {${blankIndices[i]}} แทนที่จะเป็น {${expected}})`;
    }
  }

  const answerList = cleanAnswers.split(/[,|]/).map((s) => s.trim()).filter(Boolean);
  if (answerList.length !== blankIndices.length) {
    return `จำนวนช่องว่างในประโยค (${blankIndices.length} ช่อง) ไม่ตรงกับจำนวนคำเฉลย (${answerList.length} คำ)`;
  }

  // Bot Constraint 1: Maximum blanks limit (Discord buttons limit & Bot distractor pool)
  // In bearcafe-bot, target button count is Math.min(10, Math.max(5, correctWords.length + 2))
  // All seed questions in bot have 1 to 3 blanks; maximum allowed is 4 blanks.
  if (blankIndices.length > 4) {
    return `ประโยคมีช่องว่างมากเกินไป (${blankIndices.length} ช่อง) ฝั่งบอทจำกัดไม่เกิน 4 ช่องต่อประโยค เพื่อป้องกันปุ่มคำศัพท์ล้นหน้าจอ Discord และกดเล่นยากค่ะ (แนะนำ 1–3 ช่อง)`;
  }

  // Bot Constraint 2: Sentence word count check
  const reconstructed = (fullSentence || reconstructFullSentence(cleanTemplate, cleanAnswers)).trim();
  const totalWords = reconstructed.split(/\s+/).filter(Boolean).length;
  if (totalWords < 3) {
    return `ประโยคภาษาอังกฤษต้องมีความยาวอย่างน้อย 3 คำขึ้นไป (ปัจจุบันมี ${totalWords} คำ) เพื่อให้มีบริบทในการเล่น`;
  }

  // Bot Constraint 3: Cannot hide all words (must leave at least 1-2 words as context)
  if (blankIndices.length >= totalWords) {
    return `ไม่สามารถซ่อนคำจนหมดทั้งประโยคได้ (${blankIndices.length}/${totalWords} คำ) ต้องมีคำในประโยคเหลืออย่างน้อย 1 คำ เพื่อเป็นบริบทใบ้ให้ผู้เล่นทายค่ะ`;
  }

  return null;
}

/**
 * Reconstructs a full sentence from template + comma-separated answers
 * e.g. "Where there is a {1}, there is a {2}." + "will, way" -> "Where there is a will, there is a way."
 */
export function reconstructFullSentence(template: string, answers: string): string {
  if (!template) return '';
  const answerList = (answers || '').split(/[,|]/).map((s) => s.trim()).filter(Boolean);
  let result = template;
  answerList.forEach((word, idx) => {
    const num = idx + 1;
    result = result.replace(new RegExp(`\\{${num}\\}`, 'g'), word);
  });
  return result;
}

interface ParsedWordToken {
  id: string;
  raw: string;
  clean: string;
  leadPunct: string;
  trailPunct: string;
  isBlank: boolean;
  blankIndex?: number;
}

/**
 * Splits sentence into tokens while preserving punctuation
 */
function parseSentenceIntoTokens(
  sentence: string,
  template: string,
  answers: string
): ParsedWordToken[] {
  if (!sentence || !sentence.trim()) return [];

  const rawWords = sentence.trim().split(/\s+/);
  const answerList = (answers || '').split(/[,|]/).map((s) => s.trim().toLowerCase()).filter(Boolean);

  // Check if template contains {1}, {2} to align blanks
  const templateWords = (template || '').trim().split(/\s+/);

  return rawWords.map((raw, idx) => {
    // Separate punctuation: leading / core word / trailing
    const match = raw.match(/^([^a-zA-Z0-9]*)(.*?)([^a-zA-Z0-9]*)$/);
    const leadPunct = match ? match[1] : '';
    const clean = match ? match[2] : raw;
    const trailPunct = match ? match[3] : '';

    // Check if corresponding template position has {N}
    const tWord = templateWords[idx] || '';
    const blankMatch = tWord.match(/\{(\d+)\}/);
    let isBlank = false;
    let blankIndex: number | undefined;

    if (blankMatch) {
      isBlank = true;
      blankIndex = parseInt(blankMatch[1], 10);
    } else if (answerList.length > 0 && answerList.includes(clean.toLowerCase())) {
      // Fallback: match by answer word
      const pos = answerList.indexOf(clean.toLowerCase());
      if (pos !== -1) {
        isBlank = true;
        blankIndex = pos + 1;
      }
    }

    return {
      id: `${idx}-${raw}`,
      raw,
      clean,
      leadPunct,
      trailPunct,
      isBlank,
      blankIndex,
    };
  });
}

interface Game13SentenceBuilderProps {
  template: string;
  answers: string;
  onChange: (newTemplate: string, newAnswers: string) => void;
  onPresetSelect?: (preset: Game13Preset) => void;
  className?: string;
}

export function Game13SentenceBuilder({
  template,
  answers,
  onChange,
  onPresetSelect,
  className,
}: Game13SentenceBuilderProps) {
  const [fullSentenceInput, setFullSentenceInput] = useState<string>(() => {
    return reconstructFullSentence(template, answers) || template || '';
  });
  const [isRawMode, setIsRawMode] = useState<boolean>(false);

  // Keep fullSentence synced when external template/answers change from presets or modal open
  useEffect(() => {
    const reconstructed = reconstructFullSentence(template, answers);
    if (reconstructed && (!fullSentenceInput || !fullSentenceInput.trim())) {
      setFullSentenceInput(reconstructed);
    }
  }, [template, answers, fullSentenceInput]);

  // Parse current tokens
  const tokens = useMemo(() => {
    return parseSentenceIntoTokens(fullSentenceInput, template, answers);
  }, [fullSentenceInput, template, answers]);

  // Handle clicking on a token to toggle blank status
  const handleToggleToken = (clickedIndex: number) => {
    if (!tokens || tokens.length === 0) return;

    // Build new blank states
    const currentBlankTokens: { index: number; token: ParsedWordToken }[] = [];
    tokens.forEach((tok, i) => {
      if (tok.isBlank && i !== clickedIndex) {
        currentBlankTokens.push({ index: i, token: tok });
      }
    });

    const isCurrentlyBlank = tokens[clickedIndex].isBlank;

    if (!isCurrentlyBlank) {
      // Bot limit: Max 4 blanks per sentence to prevent Discord button overflow
      if (currentBlankTokens.length >= 4) {
        return;
      }
      // Bot limit: Cannot blank out entire sentence, must leave at least 1 context word
      if (currentBlankTokens.length + 1 >= tokens.length) {
        return;
      }
      // Add as blank
      currentBlankTokens.push({ index: clickedIndex, token: tokens[clickedIndex] });
    }

    // Sort blanks left-to-right in the sentence
    currentBlankTokens.sort((a, b) => a.index - b.index);

    // Build mapped blank index map
    const blankOrderMap = new Map<number, number>();
    currentBlankTokens.forEach((item, idx) => {
      blankOrderMap.set(item.index, idx + 1);
    });

    // Reconstruct template
    const newTemplateWords = tokens.map((tok, i) => {
      if (blankOrderMap.has(i)) {
        const blankNum = blankOrderMap.get(i);
        return `${tok.leadPunct}{${blankNum}}${tok.trailPunct}`;
      }
      return tok.raw;
    });

    // Reconstruct answers list
    const newAnswersList = currentBlankTokens.map((item) => item.token.clean);

    const newTemplateStr = newTemplateWords.join(' ');
    const newAnswersStr = newAnswersList.join(', ');

    onChange(newTemplateStr, newAnswersStr);
  };

  // Reset all blanks
  const handleResetBlanks = () => {
    if (!tokens.length) return;
    const cleanFull = tokens.map((t) => t.raw).join(' ');
    onChange(cleanFull, '');
  };

  // Validation error check
  const validationError = useMemo(() => {
    return validateGame13Sentence(template, answers);
  }, [template, answers]);

  const activeBlanksCount = useMemo(() => {
    const matches = Array.from((template || '').matchAll(/\{(\d+)\}/g));
    return matches.length;
  }, [template]);

  const answerItems = useMemo(() => {
    return (answers || '').split(/[,|]/).map((s) => s.trim()).filter(Boolean);
  }, [answers]);

  return (
    <div className={cn("space-y-4 rounded-3xl p-4 bg-gradient-to-b from-[#FAF6F0] to-[#F5ECE1] dark:from-[#25201C] dark:to-[#1E1A17] border border-[#EAD8C8] dark:border-[#2D2520] shadow-xs", className)}>
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-[#EAD8C8]/60 dark:border-[#2D2520]/80">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold">
            <MousePointerClick className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-[#6B5A4B] dark:text-[#EAD8C8]">
                ตัวสร้างประโยค Smart Click-to-Blank
              </h4>
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25">
                เกม 13
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              พิมพ์ประโยคเต็มภาษาอังกฤษ แล้วคลิกที่คำเพื่อเปลี่ยนเป็นช่องว่าง &#123;1&#125;, &#123;2&#125;...
            </p>
          </div>
        </div>

        {/* Mode Toggle Switch */}
        <div className="flex items-center gap-2 self-end sm:self-auto bg-white/70 dark:bg-[#1A1815]/70 px-2.5 py-1 rounded-xl border border-[#EAD8C8]/60 dark:border-[#2D2520]">
          <Code2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground font-medium">โหมดพิมพ์แม่แบบเอง</span>
          <Switch
            checked={isRawMode}
            onCheckedChange={setIsRawMode}
            className="data-[state=checked]:bg-amber-600 scale-75"
          />
        </div>
      </div>

      {/* Visual Presets Selector */}
      {onPresetSelect && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-500" />
              ลองโหลดตัวอย่างสำเร็จรูป 1-คลิก (Presets):
            </label>
            <span className="text-[10px] text-muted-foreground">คลิกเพื่อโหลดเข้าฟอร์มทันที</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {GAME_13_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setFullSentenceInput(preset.fullSentence);
                  onPresetSelect(preset);
                }}
                className={cn(
                  "px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all flex items-center gap-1.5 border shadow-2xs cursor-pointer active:scale-95",
                  template === preset.template
                    ? "bg-amber-500 text-white border-amber-600 font-bold shadow-xs"
                    : "bg-white dark:bg-[#1E1B18] text-[#6B5A4B] dark:text-[#EAD8C8] border-[#EAD8C8] dark:border-[#2D2520] hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                )}
              >
                <span>{preset.title}</span>
                <span className={cn(
                  "text-[9px] px-1 py-0.2 rounded-md font-normal",
                  template === preset.template ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {preset.badge.split(' ')[1] || '2 ช่อง'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mode 1: Smart Click-to-Blank (Default) */}
      {!isRawMode ? (
        <div className="space-y-3">
          {/* Sentence Input Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#6B5A4B] dark:text-[#EAD8C8] flex items-center gap-1.5">
                <span>🔤 ประโยคภาษาอังกฤษแบบเต็ม:</span>
              </label>
              {activeBlanksCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetBlanks}
                  className="h-6 px-2 text-[10px] text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 gap-1 rounded-lg"
                >
                  <RotateCcw className="w-3 h-3" /> ล้างช่องว่าง ({activeBlanksCount})
                </Button>
              )}
            </div>
            <Input
              value={fullSentenceInput}
              onChange={(e) => {
                const val = e.target.value;
                setFullSentenceInput(val);
                // If template was empty, set template to the sentence
                if (!template || template === fullSentenceInput) {
                  onChange(val, answers);
                }
              }}
              placeholder="เช่น Where there is a will, there is a way."
              className="h-10 text-xs rounded-xl bg-white dark:bg-[#1E1B18] border-[#EAD8C8] dark:border-[#2D2520] focus-visible:ring-amber-500"
            />
          </div>

          {/* Interactive Word Pills */}
          {tokens.length > 0 ? (
            <div className="space-y-2 p-3.5 rounded-2xl bg-white/80 dark:bg-[#1A1715]/80 border border-[#EAD8C8] dark:border-[#2D2520]">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-1.5">
                  <MousePointerClick className="w-4 h-4 text-amber-600" />
                  คลิกที่คำเพื่อเปลี่ยนเป็นช่องว่าง:
                </span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[11px] font-mono",
                      activeBlanksCount >= 4
                        ? "bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/40 font-bold"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    ช่องว่าง: {activeBlanksCount} / 4 ช่อง
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    (ทั้งหมด {tokens.length} คำ)
                  </span>
                </div>
              </div>

              {/* Pills Wrap */}
              <div className="flex flex-wrap gap-1.5 pt-1 items-center">
                {tokens.map((tok, idx) => {
                  const isMaxReached = !tok.isBlank && activeBlanksCount >= 4;
                  const isLastWord = !tok.isBlank && activeBlanksCount + 1 >= tokens.length;
                  const isDisabled = isMaxReached || isLastWord;

                  return (
                    <button
                      key={tok.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleToggleToken(idx)}
                      title={
                        isMaxReached
                          ? 'ครบโควตาสูงสุด 4 ช่องว่างแล้ว (กดคำเดิมเพื่อยกเลิก)'
                          : isLastWord
                          ? 'ต้องมีคำเหลือในประโยคอย่างน้อย 1 คำ'
                          : undefined
                      }
                      className={cn(
                        "group relative px-2.5 py-1 rounded-xl text-xs font-mono transition-all duration-150 flex items-center gap-1.5 cursor-pointer border select-none active:scale-95",
                        tok.isBlank
                          ? "bg-amber-500 hover:bg-amber-600 text-white font-bold border-amber-600 shadow-xs ring-2 ring-amber-500/25"
                          : isDisabled
                          ? "opacity-45 cursor-not-allowed bg-muted/40 border-dashed border-muted-foreground/30 text-muted-foreground"
                          : "bg-[#FAF6F0] dark:bg-[#231F1C] hover:bg-amber-50 dark:hover:bg-[#2D2722] hover:border-amber-400 text-foreground border-[#EAD8C8] dark:border-[#2D2520]"
                      )}
                    >
                      {tok.leadPunct && <span className="opacity-60">{tok.leadPunct}</span>}

                      {tok.isBlank ? (
                        <span className="flex items-center gap-1">
                          <span className="w-4 h-4 rounded-full bg-black/20 text-white text-[10px] font-bold flex items-center justify-center">
                            {tok.blankIndex}
                          </span>
                          <span>{tok.clean}</span>
                        </span>
                      ) : (
                        <span>{tok.clean}</span>
                      )}

                      {tok.trailPunct && <span className="opacity-60">{tok.trailPunct}</span>}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  เครื่องหมายวรรคตอน (, . ! ?) จะถูกแยกเก็บไว้ในประโยค ไม่นำไปปนกับคำตอบ
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                  💡 บอทรองรับ 1–4 ช่องว่าง และประโยคต้องยาว 3 คำขึ้นไป
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-white/40 dark:bg-[#1A1715]/40 border border-dashed border-[#EAD8C8] dark:border-[#2D2520] text-center text-xs text-muted-foreground">
              👆 กรุณาพิมพ์ประโยคภาษาอังกฤษในช่องด้านบน เพื่อเริ่มเลือกคำที่จะเว้นเป็นช่องว่างค่ะ
            </div>
          )}

          {/* Real-time Generated Template & Answers Summary */}
          {template && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
              {/* Generated Template Preview */}
              <div className="p-3 rounded-2xl bg-white/60 dark:bg-[#1A1715]/60 border border-[#EAD8C8]/80 dark:border-[#2D2520] space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  แม่แบบประโยค (Template)
                </span>
                <div className="font-mono text-xs text-foreground font-medium break-words leading-relaxed">
                  {(() => {
                    const parts = template.split(/(\{\d+\})/g);
                    return parts.map((part, i) => {
                      const m = part.match(/^\{(\d+)\}$/);
                      if (m) {
                        return (
                          <span
                            key={i}
                            className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30 text-[11px]"
                          >
                            &#123;{m[1]}&#125;
                          </span>
                        );
                      }
                      return <span key={i}>{part}</span>;
                    });
                  })()}
                </div>
              </div>

              {/* Generated Answers Preview */}
              <div className="p-3 rounded-2xl bg-white/60 dark:bg-[#1A1715]/60 border border-[#EAD8C8]/80 dark:border-[#2D2520] space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  เฉลยคำตอบเรียงตามลำดับ (Answers)
                </span>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {answerItems.length > 0 ? (
                    answerItems.map((word, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-xs font-mono font-bold bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30 gap-1 rounded-lg"
                      >
                        <span className="text-[9px] opacity-70">ช่อง &#123;{i + 1}&#125;:</span>
                        <span>{word}</span>
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">ยังไม่มีคำเฉลย (กรุณาคลิกเลือกคำ)</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Mode 2: Raw / Manual Template Editor */
        <div className="space-y-3 p-3.5 rounded-2xl bg-white/80 dark:bg-[#1A1715]/80 border border-[#EAD8C8] dark:border-[#2D2520]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#6B5A4B] dark:text-[#EAD8C8] flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-amber-600" />
              แก้ไขแม่แบบประโยคโดยตรง (Manual Raw Mode)
            </label>
            <span className="text-[10px] text-muted-foreground">สำหรับผู้ใช้ที่ต้องการกำหนด &#123;1&#125;, &#123;2&#125; เอง</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">แม่แบบประโยค (ใส่ &#123;1&#125;, &#123;2&#125;):</span>
              <div className="flex gap-1">
                {[1, 2, 3].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const nextT = `${template.trim()} {${n}}`.trim();
                      onChange(nextT, answers);
                    }}
                    className="h-6 px-1.5 text-[10px] font-mono rounded-md border-amber-500/30 text-amber-700 dark:text-amber-300"
                  >
                    + &#123;{n}&#125;
                  </Button>
                ))}
              </div>
            </div>
            <Input
              value={template}
              onChange={(e) => onChange(e.target.value, answers)}
              placeholder="เช่น Where there is a {1}, there is a {2}."
              className="h-10 text-xs rounded-xl bg-white dark:bg-[#1E1B18] border-[#EAD8C8] dark:border-[#2D2520]"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              คำตอบเรียงตามลำดับ (คั่นด้วยจุลภาค เช่น will, way):
            </span>
            <Input
              value={answers}
              onChange={(e) => onChange(template, e.target.value)}
              placeholder="เช่น will, way"
              className="h-10 text-xs rounded-xl bg-white dark:bg-[#1E1B18] border-[#EAD8C8] dark:border-[#2D2520]"
            />
          </div>
        </div>
      )}

      {/* Real-time Syntax & Validation Status Banner */}
      {validationError ? (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5 min-w-0 flex-1">
            <p className="font-bold text-rose-700 dark:text-rose-300">รูปแบบประโยคยังไม่พร้อมใช้งาน</p>
            <p className="text-[11px] leading-relaxed">{validationError}</p>
          </div>
        </div>
      ) : activeBlanksCount > 0 ? (
        <div className="px-3.5 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2 text-xs text-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium text-[11px]">
              แม่แบบประโยคถูกต้อง ({activeBlanksCount} ช่องว่าง • คำตอบครบถ้วนตามลำดับ)
            </span>
          </div>
          <Badge variant="outline" className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40">
            พร้อมบันทึก
          </Badge>
        </div>
      ) : null}
    </div>
  );
}

/**
 * 3-Step Visual Flow Guide for Game 13
 */
export function Game13FlowGuide() {
  return (
    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-3 text-amber-950 dark:text-amber-100">
      <div className="flex items-center gap-2.5 font-bold text-sm sm:text-base text-amber-900 dark:text-amber-200">
        <div className="w-7 h-7 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
          <BookOpen className="w-4 h-4" />
        </div>
        <span>คำแนะนำวิธีเพิ่มโจทย์เกม 13 (เรียงประโยคภาษาอังกฤษ)</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-0.5">
        <div className="p-3.5 rounded-2xl bg-white/90 dark:bg-[#1E1B18]/90 border border-amber-500/20 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-amber-900 dark:text-amber-200">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-extrabold flex items-center justify-center shadow-xs shrink-0">
              1
            </span>
            <span>พิมพ์ความหมายไทย</span>
          </div>
          <p className="text-xs sm:text-[13px] text-[#5C4A3A] dark:text-[#D5C2B2] leading-relaxed">
            ระบุคำแปลไทยหรือสำนวน เช่น <strong className="font-semibold text-foreground">"ความพยายามอยู่ที่ไหน ความสำเร็จอยู่ที่นั่น"</strong>
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/90 dark:bg-[#1E1B18]/90 border border-amber-500/20 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-amber-900 dark:text-amber-200">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-extrabold flex items-center justify-center shadow-xs shrink-0">
              2
            </span>
            <span>จิ้มคำที่จะซ่อน</span>
          </div>
          <p className="text-xs sm:text-[13px] text-[#5C4A3A] dark:text-[#D5C2B2] leading-relaxed">
            พิมพ์ประโยคอังกฤษ แล้วคลิกที่คำเพื่อเปลี่ยนเป็นช่องว่าง <span className="font-mono font-bold text-amber-700 dark:text-amber-300">&#123;1&#125;, &#123;2&#125;</span> โดยอัตโนมัติ
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/90 dark:bg-[#1E1B18]/90 border border-amber-500/20 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-amber-900 dark:text-amber-200">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-extrabold flex items-center justify-center shadow-xs shrink-0">
              3
            </span>
            <span>บอทสุ่มปุ่มในดิสคอร์ด</span>
          </div>
          <p className="text-xs sm:text-[13px] text-[#5C4A3A] dark:text-[#D5C2B2] leading-relaxed">
            บอทจะสุ่มปุ่มคำหลอกให้อัตโนมัติ ผู้เล่นใน Discord ต้องกดเรียงคำศัพท์ตามลำดับ 1, 2...
          </p>
        </div>
      </div>
    </div>
  );
}
