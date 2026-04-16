import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconDisplay } from '@/components/bear-cafe/IconDisplay';

import ruleIcon from '@/assets/rule-icon.png';

interface RulesSectionProps {
  categoryRulesText?: string | null;
  agreeToRules: boolean;
  onAgreeChange: (checked: boolean) => void;
  specificRoleEmoji?: string | null; 
}

export function RulesSection({
  categoryRulesText,
  agreeToRules,
  onAgreeChange,
  specificRoleEmoji,
}: RulesSectionProps) {
  const categoryRules = categoryRulesText
    ? categoryRulesText.split('\n').filter((r) => r.trim())
    : [];

  return (
    <Card className="border-warning/30 bg-gradient-to-br from-warning/5 via-background to-primary/5 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <img 
            src={ruleIcon} 
            alt="Rule Icon" 
            className="w-6 h-6 object-contain drop-shadow-sm" 
          />
          กติกาและข้อตกลง
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {categoryRules.length > 0 && (
          <div className="rounded-xl bg-secondary/50 border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              {specificRoleEmoji ? (
                <IconDisplay icon={specificRoleEmoji} fallback="⚠️" size="sm" />
              ) : (
                <img 
                  src={ruleIcon} 
                  alt="Specific Rule Icon" 
                  className="w-5 h-5 object-contain drop-shadow-sm" 
                />
              )}
              <span className="font-semibold text-sm text-foreground">กฎเฉพาะหมวดหมู่นี้</span>
            </div>
            <ul className="space-y-1.5">
              {categoryRules.map((rule, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{rule.trim()}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          className={cn(
            'flex items-center gap-3 p-4 rounded-xl border transition-all duration-300',
            agreeToRules
              ? 'bg-success/10 border-success/40'
              : 'bg-secondary/50 border-border'
          )}
        >
          <Checkbox
            id="agree-rules"
            checked={agreeToRules}
            onCheckedChange={(checked) => onAgreeChange(checked as boolean)}
            className="w-5 h-5"
          />
          <Label
            htmlFor="agree-rules"
            className={cn(
              'cursor-pointer text-sm font-medium transition-colors',
              agreeToRules ? 'text-success' : 'text-foreground'
            )}
          >
            {agreeToRules ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                ฉันอ่านและยอมรับกติกาข้างต้นแล้ว
              </span>
            ) : (
              'ฉันอ่านและยอมรับกติกาข้างต้นแล้ว'
            )}
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}
