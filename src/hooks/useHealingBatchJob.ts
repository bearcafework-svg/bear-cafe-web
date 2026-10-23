import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  HealingBatchJob,
  HealingBatchAction,
  getHealingBatchJob,
  subscribeHealingBatchJob,
  startHealingBatchJob,
  pauseHealingBatchJob,
  resumeHealingBatchJob,
  cancelHealingBatchJob,
  dismissHealingBatchJob,
} from '@/lib/healing-batch-manager';

export function useHealingBatchJob() {
  const [job, setJob] = useState<HealingBatchJob | null>(() => getHealingBatchJob());

  useEffect(() => {
    const unsubscribe = subscribeHealingBatchJob((updated) => {
      setJob(updated ? { ...updated } : null);
    });
    return unsubscribe;
  }, []);

  const total = job?.totalItems || 0;
  const completed = job?.completedIds.length || 0;
  const failed = job?.failedItems.length || 0;
  const processed = completed + failed;

  const progressPercent = useMemo(() => {
    if (total === 0) return 0;
    return Math.min(100, Math.round((processed / total) * 100));
  }, [processed, total]);

  const isRunning = job?.status === 'running';
  const isPaused = job?.status === 'paused';
  const isCompleted = job?.status === 'completed';

  const start = useCallback((action: HealingBatchAction, ids: string[]) => {
    return startHealingBatchJob(action, ids);
  }, []);

  const pause = useCallback(() => {
    pauseHealingBatchJob();
  }, []);

  const resume = useCallback(() => {
    resumeHealingBatchJob();
  }, []);

  const cancel = useCallback(() => {
    cancelHealingBatchJob();
  }, []);

  const dismiss = useCallback(() => {
    dismissHealingBatchJob();
  }, []);

  return {
    job,
    isRunning,
    isPaused,
    isCompleted,
    total,
    completed,
    failed,
    processed,
    progressPercent,
    startJob: start,
    pauseJob: pause,
    resumeJob: resume,
    cancelJob: cancel,
    dismissJob: dismiss,
  };
}
