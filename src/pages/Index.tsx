import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { GreenTeaWarningPopup } from "@/components/bear-cafe/GreenTeaWarningPopup";
import { CooldownBox } from "@/components/bear-cafe/CooldownBox";
import { LoadingBear } from "@/components/bear-cafe/LoadingBear";
import { CozySidebar } from "@/components/bear-cafe/CozySidebar";
import { CozyFeatureCards } from "@/components/bear-cafe/CozyFeatureCards";
import { CommunityCarousel } from "@/components/bear-cafe/CommunityCarousel";
import { useCooldown } from "@/hooks/useCooldown";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

const DisplayWelcomeMessage = () => {
  type WelcomeMessageDescription = {
    line1: string;
    line2?: string;
  };

  const randomWelcomeMessageDescription: WelcomeMessageDescription[] = [
    {
      line1: "เหงาอยู่รึเปล่า? แวะมาใช้เวลาที่ Bear Cafe สิ!",
      line2:
        "ทั้งหาเพื่อนใหม่ พูดคุยแบบสบายๆ มีสุ่มแชทให้ลองเล่น และกิจกรรมสนุกๆ รอให้คุณเข้ามาจอยอีกเพียบ",
    },
    {
      line1: "ยินดีต้อนรับสู่ Bear Cafe 🐻",
      line2:
        "ที่ที่คุณสามารถหาเพื่อนใหม่ พูดคุยแบบสบายๆ และเข้าร่วมกิจกรรมสนุกๆ ได้ทุกวัน!",
    },
    {
      line1: "สวัสดี! พร้อมจะสนุกกับ Bear Cafe ไหม?",
      line2:
        "ที่นี่มีทั้งสุ่มแชท กิจกรรมสนุกๆ และโอกาสเจอเพื่อนใหม่ๆ รอคุณอยู่!",
    },
    {
      line1: "เข้ามานั่งเล่นกันก่อนสิ ☕",
      line2: "อาจมีเพื่อนใหม่ที่คุยถูกคอรอคุณอยู่ก็ได้นะ",
    },
    {
      line1: "วันนี้เป็นยังไงบ้าง?",
      line2: "ลองเข้ามาแชร์เรื่องราว หรือพูดคุยกับคนใหม่ๆ ใน Bear Cafe ดูสิ",
    },
    {
      line1: "Bear Cafe พร้อมต้อนรับเสมอ 🐻",
      line2: "ไม่ว่าจะอยากหาเพื่อน คุยเล่น หรือหาอะไรทำแก้เบื่อ",
    },
    {
      line1: "กำลังมองหาคนคุยอยู่หรือเปล่า?",
      line2: "สุ่มแชทและคอมมูนิตี้ของเราพร้อมให้คุณเข้ามาสนุกได้ทุกเวลา",
    },
    {
      line1: "เริ่มบทสนทนาใหม่ได้ที่นี่ ✨",
      line2: "พบผู้คนใหม่ๆ และสร้างมิตรภาพดีๆ ไปด้วยกัน",
    },
    {
      line1: "เบื่อๆ อยู่ใช่ไหม?",
      line2: "ลองเข้าร่วมกิจกรรมและพูดคุยกับสมาชิกคนอื่นๆ ดูสิ",
    },
    {
      line1: "ทุกวันคือโอกาสในการเจอเพื่อนใหม่ 🤝",
      line2: "เข้ามาพูดคุย แลกเปลี่ยนความสนใจ และสนุกไปด้วยกัน",
    },
    {
      line1: "แวะมาพักใจที่ Bear Cafe 🐻",
      line2: "พื้นที่สบายๆ สำหรับการพูดคุยและทำความรู้จักผู้คนใหม่",
    },
    {
      line1: "มีเรื่องอยากเล่าไหม?",
      line2: "ที่นี่มีคนพร้อมรับฟังและร่วมพูดคุยกับคุณเสมอ",
    },
    {
      line1: "เพื่อนใหม่อาจอยู่ห่างแค่ข้อความเดียว 💬",
      line2: "ลองเริ่มต้นบทสนทนาแล้วดูว่าจะพาคุณไปเจอใครบ้าง",
    },
  ];

  const randomIndex = Math.floor(
    Math.random() * randomWelcomeMessageDescription.length,
  );
  const { line1, line2 } = randomWelcomeMessageDescription[randomIndex];
  return (
    <div>
      <p className="md:bear-body-regular-semibold bear-body-small-semibold text-[#D6C3B5]">{line1}</p>
      {line2 && (
        <p className="bear-body-regular-semibold bear-body-small-semibold line-clamp-3 text-[#D6C3B5] sm:line-clamp-none">
          {line2}
        </p>
      )}
    </div>
  );
};

export default function Index() {
  const { user, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { isOnCooldown, formattedTime, remainingMinutes } = useCooldown(
    user?.id ?? null,
  );

  const displayName = user?.discord_username ?? user?.username ?? "เพื่อน";
  const closeSidebar = () => setSidebarOpen(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingBear message="กำลังโหลด..." />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <GreenTeaWarningPopup userId={user?.id} />
      <CooldownBox
        isOnCooldown={isOnCooldown}
        formattedTime={formattedTime}
        remainingMinutes={remainingMinutes}
      />

      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-[60] w-10 h-10 rounded-full bg-card shadow-md border border-border flex items-center justify-center"
        aria-label="เปิดเมนู"
      >
        {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {/* Desktop sidebar */}
      <div className="hidden lg:block shrink-0">
        <CozySidebar />
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={closeSidebar}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-50 h-full w-[220px] max-w-[85vw]"
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest("a, button")) closeSidebar();
              }}
            >
              <CozySidebar />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <section className="min-h-screen flex-1 overflow-y-auto">
        <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 py-6 pt-16 sm:gap-8 sm:px-6 sm:py-8 lg:pt-8 lg:gap-10 min-h-svh">
          {/* NOTE - Greeting Banner + Welcome Message */}
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
            <CozyFeatureCards
              isOnCooldown={isOnCooldown}
              formattedTime={formattedTime}
            />
          </motion.div>

          {/* ── Community carousel ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.45 }}
          >
            <CommunityCarousel />
          </motion.div>
        </main>

        {/* Footer */}
        <footer className="flex flex-col gap-4 border-t border-border px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="bear-h3-medium">
              <span className="dark:text-[#F5F5F5]">Bear</span>{" "}
              <span className="dark:text-[#FAB97D]">Cafe</span>
            </p>
            <p className="bear-body-small-regular dark:text-[#A1A1A1]">
              2026 BEAR CAFE by Zeabiu. All rights reserved.
            </p>
          </div>
          <div>
            <p className="bear-body-small-regular dark:text-[#A1A1A1]">
              All illustrations, UI designs, layouts, concepts, visual styles,
              and creative elements on this website are protected by copyright
              law.
            </p>
            <p className="bear-body-small-regular dark:text-[#A1A1A1]">
              Unauthorized use, reproduction, imitation, or redistribution in
              any form is strictly prohibited.
            </p>
          </div>
        </footer>
      </section>
    </div>
  );
}

// <div className="min-h-screen flex bg-[hsl(var(--background))] overflow-hidden homepage-zoom">
//   {/* ── Popups ── */}
//   <GreenTeaWarningPopup userId={user?.id} />
//   <CooldownBox
//     isOnCooldown={isOnCooldown}
//     formattedTime={formattedTime}
//     remainingMinutes={remainingMinutes}
//   />

//   {/* ══════════════════════════════════════════════════════
//       LEFT SIDEBAR — desktop always visible, mobile overlay
//      ══════════════════════════════════════════════════════ */}

//   {/* Mobile sidebar toggle */}
//   <button
//     onClick={() => setSidebarOpen(!sidebarOpen)}
//     className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-full bg-[hsl(var(--card))] shadow-md border border-[hsl(var(--latte)/0.5)] flex items-center justify-center"
//     aria-label="เปิดเมนู"
//   >
//     {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
//   </button>

//   {/* Desktop sidebar */}
//   <div className="hidden lg:block shrink-0">
//     <CozySidebar />
//   </div>

//   {/* Mobile sidebar overlay */}
//   {sidebarOpen && (
//     <div className="lg:hidden fixed inset-0 z-40">
//       <div
//         className="absolute inset-0 bg-black/40 backdrop-blur-sm"
//         onClick={() => setSidebarOpen(false)}
//       />
//       <div className="relative z-50 w-[220px] h-full">
//         <CozySidebar />
//       </div>
//     </div>
//   )}

//   {/* ══════════════════════════════════════════════════════
//       CENTER CONTENT
//      ══════════════════════════════════════════════════════ */}
//   <main className="flex-1 min-w-0 overflow-y-auto h-[100dvh]">
//     {/* Subtle warm paper background */}
//     <div className="absolute inset-0 bg-pattern-dots opacity-[0.025] pointer-events-none" />

//     <div className="relative max-w-2xl mx-auto px-5 pt-16 lg:pt-8 pb-12 space-y-8">

//       {/* ── Welcome heading ── */}
//       <motion.div
//         initial={{ opacity: 0, y: 14 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.45 }}
//         className="space-y-2"
//       >
//         {/* Tiny greeting */}
//         <p className="text-sm text-[hsl(var(--bear-brown))] dark:text-[hsl(var(--honey)/0.8)] font-medium">
//           {greeting}
//         </p>

//         {/* Main heading */}
//         <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
//           {isAuthenticated
//             ? `ยินดีต้อนรับ ${displayName} 🐻`
//             : 'ยินดีต้อนรับสู่ Bear Cafe 🐻'}
//         </h1>

//         {/* Sub-heading */}
//         <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-lg">
//           เหงาอยู่รึเปล่า? แวะมาใช้เวลาที่ Bear Cafe สิ!
//           <br className="hidden sm:block" />
//           ทั้งหาเพื่อนใหม่ พูดคุยแบบสบายๆ มีสุ่มแชทให้ลองเล่น
//           และกิจกรรมสนุกๆ รอให้คุณเข้ามาจอยอีกเพียบ
//         </p>

//         {/* Tiny decorative stars */}
//         <div className="flex items-center gap-2 pt-1">
//           <span className="text-[hsl(var(--honey)/0.5)] text-xs select-none">✦ ✧ ✦</span>
//         </div>
//       </motion.div>

//       {/* ── Feature cards ── */}
//       <motion.div
//         initial={{ opacity: 0, y: 16 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ delay: 0.1, duration: 0.45 }}
//       >
//         <CozyFeatureCards
//           isOnCooldown={isOnCooldown}
//           formattedTime={formattedTime}
//         />
//       </motion.div>

//       {/* ── Community carousel ── */}
//       <motion.div
//         initial={{ opacity: 0, y: 16 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ delay: 0.2, duration: 0.45 }}
//       >
//         <CommunityCarousel />
//       </motion.div>
//     </div>

//     {/* ── Footer ── */}
//     <Footer />
//   </main>

//   {/* ══════════════════════════════════════════════════════
//       RIGHT PANEL — desktop always visible, mobile toggle
//      ══════════════════════════════════════════════════════ */}

//   {/* Desktop right panel */}
//   <div className="hidden xl:block shrink-0 border-l border-[hsl(var(--latte)/0.5)] dark:border-[hsl(var(--coffee)/0.4)] bg-[hsl(var(--cream))] dark:bg-[hsl(var(--mocha))]">
//     <CozyRightPanel />
//   </div>

//   {/* Mobile right panel toggle */}
//   <button
//     onClick={() => setRightOpen(!rightOpen)}
//     className="xl:hidden fixed top-4 right-4 z-50 w-10 h-10 rounded-full bg-[hsl(var(--card))] shadow-md border border-[hsl(var(--latte)/0.5)] flex items-center justify-center text-base"
//     aria-label="เปิดแผงขวา"
//   >
//     🍓
//   </button>

//   {rightOpen && (
//     <div className="xl:hidden fixed inset-0 z-40">
//       <div
//         className="absolute inset-0 bg-black/40 backdrop-blur-sm"
//         onClick={() => setRightOpen(false)}
//       />
//       <div className="absolute right-0 top-0 bottom-0 z-50 w-[280px] bg-[hsl(var(--cream))] dark:bg-[hsl(var(--mocha))] border-l border-[hsl(var(--latte)/0.5)] dark:border-[hsl(var(--coffee)/0.4)] overflow-y-auto">
//         <CozyRightPanel />
//       </div>
//     </div>
//   )}
// </div>
