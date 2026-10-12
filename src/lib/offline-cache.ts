// ============================================================================
// d:\bear-cafe-web\src\lib\offline-cache.ts
// ระบบแคชออฟไลน์และแผนสำรองสำหรับหน้า Dashboard
// เมื่อ Supabase ล่ม, ติดโควตา หรือดึงข้อมูลไม่ได้ จะดึงข้อมูลล่าสุดจาก LocalStorage ขึ้นมาแสดงแทน
// ============================================================================

export interface CacheResult<T> {
  data: T | null;
  isOffline: boolean;
  cachedAt?: number;
  error?: string | null;
}

const CACHE_PREFIX = "bear_dashboard_cache_";
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 นาที

/**
 * ดึงข้อมูลพร้อมระบบแคชออฟไลน์ Stale-While-Revalidate
 * @param key คีย์ระบุประเภทข้อมูล (เช่น 'admin_stats', 'discord_servers')
 * @param fetchFn ฟังก์ชันดึงข้อมูลจริงจาก Supabase
 * @param ttlMs อายุของแคช (มิลลิวินาที)
 */
export async function fetchWithOfflineCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<CacheResult<T>> {
  const storageKey = `${CACHE_PREFIX}${key}`;
  const now = Date.now();

  // อ่านแคชเดิมที่มีใน LocalStorage
  let localCache: { data: T; timestamp: number } | null = null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      localCache = JSON.parse(raw);
    }
  } catch (e) {
    console.warn(`[offlineCache] Error parsing local storage for key ${key}:`, e);
  }

  // 1. ถ้าแคชยังใหม่มาก (ภายใน TTL) ส่งคืนข้อมูลแคชก่อนได้เลย
  // แต่ถ้าต้องการดึงสด ให้ข้ามไป fetchFn()

  try {
    const freshData = await fetchFn();

    // บันทึกข้อมูลสดลงแคช
    if (freshData !== null && freshData !== undefined) {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ data: freshData, timestamp: now })
        );
      } catch (saveErr) {
        console.warn(`[offlineCache] Failed to save cache to localStorage:`, saveErr);
      }

      return {
        data: freshData,
        isOffline: false,
        cachedAt: now,
        error: null,
      };
    }
  } catch (err: any) {
    console.warn(
      `[offlineCache] ⚠️ Supabase fetch failed for '${key}': ${err?.message || err}. Falling back to offline cache.`
    );
  }

  // 2. หาก Fetch ล้มเหลว (เช่น Supabase เต็ม / 429 / 504 / Network error)
  // ให้นำแคชเก่าที่มีอยู่มาใช้ทันที
  if (localCache && localCache.data !== undefined) {
    return {
      data: localCache.data,
      isOffline: true,
      cachedAt: localCache.timestamp,
      error: "Supabase connection unavailable (showing cached snapshot)",
    };
  }

  // 3. หากไม่มีแคชเลย ส่งคืนค่าว่างแบบปลอดภัย ไม่ทำให้เว็บ Crash
  return {
    data: null,
    isOffline: true,
    cachedAt: undefined,
    error: "No cached data available offline",
  };
}

/**
 * ล้างแคชทั้งหมดของระบบแดชบอร์ด
 */
export function clearAllDashboardCache(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn("[offlineCache] Error clearing cache:", err);
  }
}
