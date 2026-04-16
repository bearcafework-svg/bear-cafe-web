import React from 'react';
import { motion } from 'framer-motion';
import { BearLogoText } from '@/components/bear-cafe/BearLogo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Ban, MessageCircle, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface BannedPageProps {
  reason?: string | null;
  isBannedRole?: boolean;
}

export default function BannedPage({ reason, isBannedRole = false }: BannedPageProps) {
  const { logout } = useAuth();

  const handleContactClick = () => {
    window.open(
      'https://discord.com/channels/1144251788493602848/1148595919785300070',
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div className="min-h-screen bg-background bg-pattern-dots flex items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm sm:max-w-md"
      >
        <Card className="border-destructive/30 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-destructive/10 to-destructive/5 p-4 sm:p-6 text-center border-b border-destructive/20">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }}
              className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-4 rounded-full bg-destructive/10 flex items-center justify-center"
            >
              <Ban className="w-8 h-8 sm:w-10 sm:h-10 text-destructive" />
            </motion.div>
            <BearLogoText />
          </div>

          <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Title */}
            <div className="text-center space-y-1.5 sm:space-y-2">
              <h1 className="text-lg sm:text-xl font-bold text-foreground">
                {isBannedRole ? 'บัญชีถูกจำกัดการเข้าถึง' : 'บัญชีถูกระงับ'}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {isBannedRole
                  ? 'Role ของคุณในเซิร์ฟเวอร์ถูกจำกัดไม่ให้ใช้งานระบบนี้'
                  : 'บัญชีของคุณถูกระงับการใช้งานชั่วคราว'}
              </p>
            </div>

            {/* Reason */}
            {reason && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-muted/50 rounded-xl p-3 sm:p-4 border border-border"
              >
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 font-medium">เหตุผล</p>
                <p className="text-xs sm:text-sm text-foreground">{reason}</p>
              </motion.div>
            )}

            {/* Info */}
            <div className="text-center text-xs sm:text-sm text-muted-foreground space-y-0.5 sm:space-y-1">
              <p>หากคุณเชื่อว่านี่เป็นข้อผิดพลาด</p>
              <p>กรุณาติดต่อทีมงานเพื่อขอความช่วยเหลือ</p>
            </div>

            {/* Actions */}
            <div className="space-y-2 sm:space-y-3">
              <Button
                onClick={handleContactClick}
                className="w-full gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm sm:text-base h-10 sm:h-11"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="truncate">#💌︰สอบถาม-แจ้งปัญหา</span>
                <ExternalLink className="w-3 h-3 ml-auto opacity-70 shrink-0" />
              </Button>

              <Button
                variant="outline"
                onClick={logout}
                className="w-full text-sm sm:text-base h-10 sm:h-11"
              >
                ออกจากระบบ
              </Button>
            </div>

            {/* Footer Bear */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-center text-2xl sm:text-3xl pt-1 sm:pt-2"
            >
              🐻💔
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
