import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { GreenTeaWarningPopup } from '@/components/bear-cafe/GreenTeaWarningPopup';
import { CooldownBox } from '@/components/bear-cafe/CooldownBox';
import { CozyAppShell } from '@/components/bear-cafe/CozyAppShell';
import { CozyPageFooter } from '@/components/bear-cafe/CozyPageFooter';
import { CozyFeatureCards } from '@/components/bear-cafe/CozyFeatureCards';
import { CommunityCarousel } from '@/components/bear-cafe/CommunityCarousel';
import { useCooldown } from '@/hooks/useCooldown';
import { motion } from 'framer-motion';

type WelcomeMessage = { line1: string; line2?: string };

const WELCOME_MESSAGES: WelcomeMessage[] = [
  {
    line1: 'เหงาอยู่รึเปล่า? แวะมาใช้เวลาที่ Bear Cafe สิ!',
    line2:
      'ทั้งหาเพื่อนใหม่ พูดคุยแบบสบายๆ มีสุ่มแชทให้ลองเล่น และกิจกรรมสนุกๆ รอให้คุณเข้ามาจอยอีกเพียบ',
  },
  {
    line1: 'ยินดีต้อนรับสู่ Bear Cafe 🐻',
    line2:
      'ที่ที่คุณสามารถหาเพื่อนใหม่ พูดคุยแบบสบายๆ และเข้าร่วมกิจกรรมสนุกๆ ได้ทุกวัน!',
  },
  {
    line1: 'สวัสดี! พร้อมจะสนุกกับ Bear Cafe ไหม?',
    line2: 'ที่นี่มีทั้งสุ่มแชท กิจกรรมสนุกๆ และโอกาสเจอเพื่อนใหม่ๆ รอคุณอยู่!',
  },
  {
    line1: 'เข้ามานั่งเล่นกันก่อนสิ ☕',
    line2: 'อาจมีเพื่อนใหม่ที่คุยถูกคอรอคุณอยู่ก็ได้นะ',
  },
  {
    line1: 'วันนี้เป็นยังไงบ้าง?',
    line2: 'ลองเข้ามาแชร์เรื่องราว หรือพูดคุยกับคนใหม่ๆ ใน Bear Cafe ดูสิ',
  },
  {
    line1: 'Bear Cafe พร้อมต้อนรับเสมอ 🐻',
    line2: 'ไม่ว่าจะอยากหาเพื่อน คุยเล่น หรือหาอะไรทำแก้เบื่อ',
  },
  {
    line1: 'กำลังมองหาคนคุยอยู่หรือเปล่า?',
    line2: 'สุ่มแชทและคอมมูนิตี้ของเราพร้อมให้คุณเข้ามาสนุกได้ทุกเวลา',
  },
  {
    line1: 'เริ่มบทสนทนาใหม่ได้ที่นี่ ✨',
    line2: 'พบผู้คนใหม่ๆ และสร้างมิตรภาพดีๆ ไปด้วยกัน',
  },
  {
    line1: 'เบื่อๆ อยู่ใช่ไหม?',
    line2: 'ลองเข้าร่วมกิจกรรมและพูดคุยกับสมาชิกคนอื่นๆ ดูสิ',
  },
  {
    line1: 'ทุกวันคือโอกาสในการเจอเพื่อนใหม่ 🤝',
    line2: 'เข้ามาพูดคุย แลกเปลี่ยนความสนใจ และสนุกไปด้วยกัน',
  },
  {
    line1: 'แวะมาพักใจที่ Bear Cafe 🐻',
    line2: 'พื้นที่สบายๆ สำหรับการพูดคุยและทำความรู้จักผู้คนใหม่',
  },
  {
    line1: 'มีเรื่องอยากเล่าไหม?',
    line2: 'ที่นี่มีคนพร้อมรับฟังและร่วมพูดคุยกับคุณเสมอ',
  },
  {
    line1: 'เพื่อนใหม่อาจอยู่ห่างแค่ข้อความเดียว 💬',
    line2: 'ลองเริ่มต้นบทสนทนาแล้วดูว่าจะพาคุณไปเจอใครบ้าง',
  },
];

function DisplayWelcomeMessage() {
  // Pick once per mount so message stays stable across re-renders
  const [message] = useState(
    () => WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)],
  );

  return (
    <div>
      <p className="md:bear-body-regular-semibold bear-body-small-medium text-[#D6C3B5]">
        {message.line1}
      </p>
      {message.line2 && (
        <p className="bear-body-regular-semibold bear-body-small-medium line-clamp-3 text-[#D6C3B5] sm:line-clamp-none">
          {message.line2}
        </p>
      )}
    </div>
  );
}

export default function Index() {
  const { user, isLoading } = useAuth();
  const { isOnCooldown, formattedTime, remainingMinutes } = useCooldown(user?.id ?? null);
  const displayName = user?.discord_username ?? user?.username ?? 'เพื่อน';

  return (
    <CozyAppShell
      isLoading={isLoading}
      contentClassName="min-h-screen"
      overlays={
        <>
          <GreenTeaWarningPopup userId={user?.id} />
          <CooldownBox
            isOnCooldown={isOnCooldown}
            formattedTime={formattedTime}
            remainingMinutes={remainingMinutes}
          />
        </>
      }
    >
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 py-6 pt-16 sm:gap-8 sm:px-6 sm:py-8 lg:pt-8 lg:gap-10 min-h-svh">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative h-[180px] overflow-hidden rounded-2xl bg-cover bg-center bg-no-repeat sm:h-[220px] sm:rounded-[20px] lg:h-[264px]"
          style={{
            backgroundImage:
              "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.4) 100%), url('/banner/welcome_banner.jpg')",
          }}
        >
          <div className="flex h-full flex-col justify-end gap-1.5 px-4 pb-4 sm:justify-center sm:gap-2 sm:px-6 sm:pb-0 lg:px-10">
            <p className="md:bear-h1-bold bear-h2-bold text-white">
              ยินดีต้อนรับ: {displayName}
            </p>
            <DisplayWelcomeMessage />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="space-y-2"
        >
          <CozyFeatureCards isOnCooldown={isOnCooldown} formattedTime={formattedTime} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.45 }}
        >
          <CommunityCarousel />
        </motion.div>
      </main>

      <CozyPageFooter />
    </CozyAppShell>
  );
}
