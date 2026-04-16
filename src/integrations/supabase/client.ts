import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Resolve env vars from `.env` (Vite exposes `VITE_*` via `import.meta.env`)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Anon key: prefer `VITE_SUPABASE_ANON_KEY`, fall back to `VITE_SUPABASE_PUBLISHABLE_KEY`
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const missingUrl = !SUPABASE_URL || SUPABASE_URL.trim().length === 0;
const missingKey = !SUPABASE_KEY || SUPABASE_KEY.trim().length === 0;

if (missingKey) {
  // Shout when Key is missing so it's obvious in the Console.
  console.error(
    [
      "",
      "============================================================",
      "[SUPABASE] KEY MISSING (SHOUT):",
      "Missing: `VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`)",
      "",
      "Fix:",
      "1) Open your .env",
      "2) Set `VITE_SUPABASE_URL`",
      "3) Set `VITE_SUPABASE_ANON_KEY` (recommended) or `VITE_SUPABASE_PUBLISHABLE_KEY`",
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
    missing.push("VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)");

  // Stop immediately so we don't createClient with empty values.
  throw new Error(
    `[Supabase] Environment variables missing: ${missing.join(", ")}`,
  );
}

const storage =
  typeof window !== "undefined" && "localStorage" in window
    ? window.localStorage
    : undefined;

// Client
export const supabase = createClient<Database>(
  SUPABASE_URL.trim(),
  SUPABASE_KEY.trim(),
  {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
