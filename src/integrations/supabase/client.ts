import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const TARGET_SUPABASE_URL = "https://fqzhcpzxdlnvhvlqspgc.supabase.co";
const TARGET_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxemhjcHp4ZGxudmh2bHFzcGdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDQ4MjMsImV4cCI6MjEwMjk4MDgyM30._CJYD8aH-KWAlohbPRWj6yDw-YV43Ev3hSAmTY_UFa0";

// Resolve env vars from `.env` (Vite exposes `VITE_*` via `import.meta.env`)
let SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
let SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// 🛡️ Automatic Legacy Supabase 1 Interceptor & Fallback Guard
if (!SUPABASE_URL || SUPABASE_URL.includes("orbxyyjpvpbqwfssnyeq") || SUPABASE_URL.includes("itulsrbsluwdqwakldjs") || SUPABASE_URL.includes("mock-supabase-url")) {
  console.warn(`[Supabase] Legacy or missing VITE_SUPABASE_URL detected. Automatically locked to Supabase 2 (${TARGET_SUPABASE_URL}).`);
  SUPABASE_URL = TARGET_SUPABASE_URL;
}

if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.trim().length < 50 || SUPABASE_ANON_KEY.includes("mock-signature")) {
  console.warn(`[Supabase] Missing or mock VITE_SUPABASE_ANON_KEY detected. Using Supabase 2 public anon key.`);
  SUPABASE_ANON_KEY = TARGET_ANON_KEY;
}

const missingUrl = !SUPABASE_URL || SUPABASE_URL.trim().length === 0;
const missingKey = !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.trim().length === 0;

function getJwtRole(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(normalized));
    return typeof decoded?.role === "string" ? decoded.role : null;
  } catch {
    return null;
  }
}

if (missingKey) {
  // Shout when Key is missing so it's obvious in the Console.
  console.error(
    [
      "",
      "============================================================",
      "[SUPABASE] KEY MISSING (SHOUT):",
      "Missing: `VITE_SUPABASE_ANON_KEY`",
      "",
      "Fix:",
      "1) Open your .env",
      "2) Set `VITE_SUPABASE_URL`",
      "3) Set `VITE_SUPABASE_ANON_KEY` to the project's anon public key",
      "4) Restart dev server",
      "============================================================",
      "",
    ].join("\n"),
  );
}

if (missingUrl || missingKey) {
  const missing: string[] = [];
  if (missingUrl) missing.push("VITE_SUPABASE_URL");
  if (missingKey)
    missing.push("VITE_SUPABASE_ANON_KEY");

  // Stop immediately so we don't createClient with empty values.
  throw new Error(
    `[Supabase] Environment variables missing: ${missing.join(", ")}`,
  );
}

const keyRole = getJwtRole(SUPABASE_ANON_KEY.trim());
if (SUPABASE_SERVICE_ROLE_KEY && SUPABASE_SERVICE_ROLE_KEY.trim().length > 0) {
  console.error(
    "[Supabase] Frontend env must not include VITE_SUPABASE_SERVICE_ROLE_KEY. Remove it and keep service_role keys server-side only.",
  );
  throw new Error(
    "[Supabase] Refusing to initialize frontend client because VITE_SUPABASE_SERVICE_ROLE_KEY is exposed in frontend env.",
  );
}

if (keyRole === "service_role") {
  console.error(
    "[Supabase] VITE_SUPABASE_ANON_KEY appears to be a service_role key. Replace it with the anon public key.",
  );
  throw new Error(
    "[Supabase] Refusing to initialize frontend client with a service_role key. Set VITE_SUPABASE_ANON_KEY to the project's anon public key only. Move service_role usage to backend/server-side code.",
  );
}

export const supabaseConfig = {
  url: SUPABASE_URL.trim(),
  hasAnonKey: SUPABASE_ANON_KEY.trim().length > 0,
  keyRole,
  keySource: "VITE_SUPABASE_ANON_KEY",
};

const storage =
  typeof window !== "undefined" && "localStorage" in window
    ? window.localStorage
    : undefined;

// Client
export const supabase = createClient<Database>(
  supabaseConfig.url,
  SUPABASE_ANON_KEY.trim(),
  {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
