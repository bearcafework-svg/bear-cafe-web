import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Resolve env vars from `.env` (Vite exposes `VITE_*` via `import.meta.env`)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
if (keyRole === "service_role") {
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
