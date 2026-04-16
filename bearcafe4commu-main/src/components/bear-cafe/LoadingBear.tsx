import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';

interface LoadingBearProps {
  message?: string;
}

function MobileLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 w-full max-w-md mx-auto p-4">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-3 w-16 rounded-full" />
        </div>
      </div>

      {/* Search bar skeleton */}
      <Skeleton className="h-12 w-full rounded-full" />

      {/* Short bar */}
      <Skeleton className="h-8 w-2/3 rounded-full" />

      {/* Long bars */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full rounded-full" />
        <Skeleton className="h-10 w-full rounded-full" />
      </div>

      {/* Wide bar */}
      <Skeleton className="h-12 w-full rounded-xl" />

      {/* Large card */}
      <Skeleton className="h-32 w-full rounded-2xl" />

      {/* Bottom row */}
      <div className="flex gap-3">
        <Skeleton className="h-6 w-1/3 rounded-full" />
        <div className="flex-1" />
        <Skeleton className="h-6 w-1/4 rounded-full" />
      </div>

      {/* Two cards */}
      <div className="flex gap-4">
        <Skeleton className="h-24 flex-1 rounded-2xl" />
        <Skeleton className="h-24 flex-1 rounded-2xl" />
      </div>
    </div>
  );
}

function DesktopLoadingSkeleton() {
  return (
    <div className="w-full max-w-6xl mx-auto p-8">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-64 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>

      {/* Hero section */}
      <Skeleton className="h-64 w-full rounded-3xl mb-8" />

      {/* Section title */}
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-48 rounded-full" />
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>

      {/* Grid cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-2 gap-8">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-40 rounded-full" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
        {/* Right column */}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-40 rounded-full" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function LoadingBear({ message }: LoadingBearProps) {
  const isMobile = useIsMobile();

  return (
    <div className="w-full">
      {isMobile ? <MobileLoadingSkeleton /> : <DesktopLoadingSkeleton />}
      {message && (
        <p className="text-center text-sm text-muted-foreground mt-4">{message}</p>
      )}
    </div>
  );
}

interface LoadingPageProps {
  message?: string;
}

export function LoadingPage({ message = "กำลังโหลด..." }: LoadingPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-pattern-dots p-4">
      <LoadingBear message={message} />
    </div>
  );
}
