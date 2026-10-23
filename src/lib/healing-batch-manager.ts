import { supabase } from '@/integrations/supabase/client';

export type HealingBatchAction = 'approved' | 'rejected';
export type HealingBatchStatus = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error';

export interface HealingBatchJob {
  id: string;
  action: HealingBatchAction;
  totalItems: number;
  allIds: string[];
  pendingIds: string[];
  completedIds: string[];
  failedItems: { id: string; error: string }[];
  status: HealingBatchStatus;
  startedAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'bear_cafe_healing_batch_job_v1';
const STEP_DELAY_MS = 150;

type Listener = (job: HealingBatchJob | null) => void;
const listeners = new Set<Listener>();

let activeLoop = false;

function notify(job: HealingBatchJob | null) {
  listeners.forEach((l) => {
    try {
      l(job);
    } catch (e) {
      console.error('[HealingBatchManager] listener error', e);
    }
  });
}

export function getHealingBatchJob(): HealingBatchJob | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as HealingBatchJob;
  } catch {
    return null;
  }
}

function saveJob(job: HealingBatchJob | null) {
  try {
    if (!job) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(job));
    }
    notify(job);
  } catch (e) {
    console.error('[HealingBatchManager] save error', e);
  }
}

async function runJobLoop() {
  if (activeLoop) return;
  activeLoop = true;

  try {
    while (true) {
      const job = getHealingBatchJob();
      if (!job || job.status !== 'running') {
        break;
      }

      if (job.pendingIds.length === 0) {
        job.status = 'completed';
        job.updatedAt = Date.now();
        saveJob(job);
        break;
      }

      const nextId = job.pendingIds[0];
      const targetStatus = job.action;

      try {
        const { error } = await supabase
          .from('healing_messages')
          .update({ status: targetStatus })
          .eq('id', nextId);

        // Re-read job in case it was cancelled/paused while waiting
        const currentJob = getHealingBatchJob();
        if (!currentJob || currentJob.status !== 'running') {
          break;
        }

        // Remove from pending
        currentJob.pendingIds = currentJob.pendingIds.filter((id) => id !== nextId);

        if (error) {
          currentJob.failedItems.push({ id: nextId, error: error.message || 'Update failed' });
        } else {
          currentJob.completedIds.push(nextId);
        }

        currentJob.updatedAt = Date.now();

        if (currentJob.pendingIds.length === 0) {
          currentJob.status = 'completed';
        }

        saveJob(currentJob);
      } catch (err: any) {
        const currentJob = getHealingBatchJob();
        if (currentJob && currentJob.status === 'running') {
          currentJob.pendingIds = currentJob.pendingIds.filter((id) => id !== nextId);
          currentJob.failedItems.push({ id: nextId, error: err?.message || 'Unexpected error' });
          currentJob.updatedAt = Date.now();
          if (currentJob.pendingIds.length === 0) {
            currentJob.status = 'completed';
          }
          saveJob(currentJob);
        }
      }

      // Small delay for UI smoothness and rate limit friendliness
      await new Promise((r) => setTimeout(r, STEP_DELAY_MS));
    }
  } finally {
    activeLoop = false;
  }
}

export function startHealingBatchJob(action: HealingBatchAction, ids: string[]): HealingBatchJob {
  if (!ids.length) {
    throw new Error('No IDs provided');
  }

  const uniqueIds = Array.from(new Set(ids));
  const newJob: HealingBatchJob = {
    id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    action,
    totalItems: uniqueIds.length,
    allIds: uniqueIds,
    pendingIds: [...uniqueIds],
    completedIds: [],
    failedItems: [],
    status: 'running',
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };

  saveJob(newJob);
  runJobLoop();
  return newJob;
}

export function pauseHealingBatchJob() {
  const job = getHealingBatchJob();
  if (job && job.status === 'running') {
    job.status = 'paused';
    job.updatedAt = Date.now();
    saveJob(job);
  }
}

export function resumeHealingBatchJob() {
  const job = getHealingBatchJob();
  if (job && job.status === 'paused' && job.pendingIds.length > 0) {
    job.status = 'running';
    job.updatedAt = Date.now();
    saveJob(job);
    runJobLoop();
  }
}

export function cancelHealingBatchJob() {
  const job = getHealingBatchJob();
  if (job && (job.status === 'running' || job.status === 'paused')) {
    job.status = 'cancelled';
    job.updatedAt = Date.now();
    saveJob(job);
  }
}

export function dismissHealingBatchJob() {
  saveJob(null);
}

export function subscribeHealingBatchJob(listener: Listener): () => void {
  listeners.add(listener);
  // Initial fire
  listener(getHealingBatchJob());
  return () => {
    listeners.delete(listener);
  };
}

// Automatically resume pending job on module load (page refresh or new tab)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      notify(getHealingBatchJob());
      const job = getHealingBatchJob();
      if (job && job.status === 'running' && !activeLoop) {
        runJobLoop();
      }
    }
  });

  // Check if job needs resumption right now
  const existingJob = getHealingBatchJob();
  if (existingJob && existingJob.status === 'running' && existingJob.pendingIds.length > 0) {
    setTimeout(() => {
      runJobLoop();
    }, 500);
  }
}
