import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, Hash } from 'lucide-react';
import prizeShadowLight from '@/assets/prize-shadow-light.png';
import prizeShadowDark from '@/assets/prize-shadow-dark.png';

export type VipPrize = {
  imageUrl?: string | null;
  title: string;
  description?: string | null;
};

export type SecondaryPrize = {
  imageUrl?: string | null;
  title: string;
  description?: string | null;
  count: number;
};

type PrizePoolDisplayProps = {
  vipPrizes?: [VipPrize, VipPrize, VipPrize];
  secondaryPrizes?: SecondaryPrize[];
  className?: string;
};

const DEFAULT_VIP: [VipPrize, VipPrize, VipPrize] = [
  { title: 'รางวัลที่ 1', description: 'ของรางวัลสุดพรีเมียมสำหรับหมีผู้โชคดี' },
  { title: 'รางวัลที่ 2', description: 'ของรางวัลสุดคิวท์รองอันดับ' },
  { title: 'รางวัลที่ 3', description: 'ของรางวัลน่ารักๆ ให้ใจฟู' },
];

const DEFAULT_SECONDARY: SecondaryPrize[] = [
  { title: 'ใกล้เคียงรางวัลที่ 1', description: 'เลขใกล้เคียงแบบใจเต้น', count: 2 },
  { title: 'เลขท้าย 2 ตัว', description: 'ลุ้นไว ลุ้นสนุก', count: 3 },
  { title: 'เลขท้าย 3 ตัว', description: 'โอกาสเพิ่มขึ้นอีกนิด', count: 2 },
];

function PrizeImage({ src, alt }: { src?: string | null; alt: string }) {
  if (!src) return null;
  return (
    <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
  );
}

function FloatingPrizeArt({
  src,
  alt,
  rank,
}: {
  src?: string | null;
  alt: string;
  rank: 1 | 2 | 3;
}) {
  const reduce = useReducedMotion();
  const size = rank === 1 ? 'w-28 sm:w-36' : 'w-24 sm:w-32';
  const shadowSize = rank === 1 ? 'w-20 sm:w-28' : 'w-16 sm:w-24';

  return (
    <div className="relative flex flex-col items-center">
      {/* Floating image */}
      <motion.div
        className={cn(
          'relative z-10 mx-auto aspect-square overflow-hidden rounded-[1.25rem]',
          size
        )}
        animate={reduce ? undefined : { y: [0, -6, 0] }}
        transition={
          reduce
            ? undefined
            : {
                duration: 2,
                ease: 'easeInOut',
                repeat: Infinity,
              }
        }
      >
        <PrizeImage src={src} alt={alt} />
      </motion.div>

      {/* Static shadow — stays fixed while image floats */}
      <img
        src={prizeShadowLight}
        alt=""
        aria-hidden
        className={cn('pointer-events-none mx-auto -mt-1 dark:hidden', shadowSize)}
      />
      <img
        src={prizeShadowDark}
        alt=""
        aria-hidden
        className={cn('pointer-events-none mx-auto -mt-1 hidden dark:block', shadowSize)}
      />
    </div>
  );
}

function VipPodiumCard({
  prize,
  rank,
  emphasis,
  className,
}: {
  prize: VipPrize;
  rank: 1 | 2 | 3;
  emphasis?: boolean;
  className?: string;
}) {
  const badgeText = rank === 1 ? 'อันดับ 1' : rank === 2 ? 'อันดับ 2' : 'อันดับ 3';
  const badgeClass =
    rank === 1
      ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white border-transparent'
      : rank === 2
        ? 'bg-gradient-to-r from-slate-300 to-slate-200 text-slate-900 border-transparent'
        : 'bg-gradient-to-r from-orange-300 to-rose-300 text-slate-900 border-transparent';

  return (
    <div
      className={cn(
        'bear-card overflow-hidden p-4 sm:p-5',
        emphasis && 'ring-2 ring-primary/40 shadow-cream',
        className
      )}
    >
      <div className="flex flex-col items-center text-center">
        <p className={cn('font-display font-semibold leading-tight', emphasis ? 'text-lg' : 'text-base')}>
          {prize.title}
        </p>
        {prize.description ? (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{prize.description}</p>
        ) : null}
      </div>
      <div className={cn('mt-4 sm:mt-5', emphasis ? 'sm:mt-6' : '')}>
        <div className="flex flex-col items-center">
          <FloatingPrizeArt src={prize.imageUrl} alt={prize.title} rank={rank} />
        </div>
      </div>
    </div>
  );
}

function SecondaryPrizeCard({
  title,
  subtitle,
  count,
  imageUrl,
  icon,
}: {
  title: string;
  subtitle: string;
  count: number;
  imageUrl?: string | null;
  icon: ReactNode;
}) {
  return (
    <div className="bear-card p-4 sm:p-5 bg-gradient-to-br from-white/70 via-cream/40 to-blush/30 dark:from-card/80 dark:via-card/60 dark:to-card/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display font-semibold leading-tight">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br from-violet-400 to-pink-500 text-white flex items-center justify-center shadow-lg overflow-hidden">
          {imageUrl ? <PrizeImage src={imageUrl} alt={title} /> : icon}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <Badge variant="secondary" className="rounded-full">
          {count} รางวัล
        </Badge>
      </div>
    </div>
  );
}

export function PrizePoolDisplay({ vipPrizes, secondaryPrizes, className }: PrizePoolDisplayProps) {
  const vip = vipPrizes ?? DEFAULT_VIP;
  const secondary = secondaryPrizes && secondaryPrizes.length > 0 ? secondaryPrizes : DEFAULT_SECONDARY;

  return (
    <Card className={cn('border-rose-200/50 dark:border-coffee/40 overflow-hidden', className)}>
      <CardHeader className="pb-3 bg-gradient-to-br from-white/90 via-rose-50/50 to-pink-50/50 dark:from-card/80 dark:to-card/60">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          รางวัลหลัก
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 sm:pt-5 space-y-5 sm:space-y-6">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-end">
            <VipPodiumCard prize={vip[1]} rank={2} className="sm:order-1" />
            <VipPodiumCard prize={vip[0]} rank={1} emphasis className="sm:order-2" />
            <VipPodiumCard prize={vip[2]} rank={3} className="sm:order-3" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display font-semibold">รางวัลรอง</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {secondary.slice(0, 3).map((p, idx) => (
              <SecondaryPrizeCard
                key={idx}
                title={p.title}
                subtitle={p.description ?? ''}
                count={p.count}
                imageUrl={p.imageUrl}
                icon={idx === 0 ? <Sparkles className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
