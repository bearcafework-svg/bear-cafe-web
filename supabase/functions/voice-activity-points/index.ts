/**
 * voice-activity-points — Production-ready Voice Activity Point System
 *
 * POST body: { eventId, userId, duration, userCount }
 *
 * Features:
 *  - Idempotent (eventId dedup via processed_events table)
 *  - Persistent notification buffer (user_notify_buffer table)
 *  - Weighted random reward (single multiplier per session)
 *  - Diminishing returns near cap
 *  - Hard limit 150 pts/request
 *  - Anti-AFK (< 10 min or alone)
 *  - Fire-and-forget notification (never blocks main flow)
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Constants ────────────────────────────────────────────────────────────────
const CYCLE_SECONDS      = 600;   // 10 min
const BASE_PER_CYCLE     = 8;
const MAX_EARNED         = 150;   // hard cap per request
const NOTIFY_CHANNEL_ID  = "1264915852214538280";
const NOTIFY_COOLDOWN_MS = 15 * 60 * 1000;

const MULTIPLIER_TABLE = [
  { weight: 50, value: 1.0 },
  { weight: 30, value: 1.2 },
  { weight: 15, value: 1.5 },
  { weight: 4,  value: 2.0 },
  { weight: 1,  value: 3.0 },
] as const;

// ─── Weighted random multiplier (ONE per session) ─────────────────────────────
function pickMultiplier(): number {
  const roll = Math.random() * 100;
  let cum = 0;
  for (const entry of MULTIPLIER_TABLE) {
    cum += entry.weight;
    if (roll < cum) return entry.value;
  }
  return 1.0;
}

// ─── calculateReward ─────────────────────────────────────────────────────────
function calculateReward(duration: number, userCount: number): number {
  const cycles = Math.floor(duration / CYCLE_SECONDS);
  if (cycles === 0) return 0;

  const base = cycles * BASE_PER_CYCLE;
  const multiplier = pickMultiplier();           // ONE multiplier for whole session
  let earned = Math.round(base * multiplier);

  // Bonus: multi-user
  if (userCount >= 3) earned = Math.round(earned * 1.1);

  // Bonus: long session (≥ 60 min) — once per request
  if (duration >= 3600) earned += 20;

  // Hard limit
  return Math.min(earned, MAX_EARNED);
}

// ─── applyDiminishing ────────────────────────────────────────────────────────
function applyDiminishing(currentPoints: number, maxCap: number, earned: number): number {
  const ratio = currentPoints / maxCap;
  if (ratio >= 0.8) return Math.round(earned * 0.5);
  if (ratio >= 0.7) return Math.round(earned * 0.7);
  return earned;
}

// ─── updatePoints ────────────────────────────────────────────────────────────
async function updatePoints(
  db: SupabaseClient,
  discordId: string,
  rawEarned: number
): Promise<{ actualEarned: number; newPoints: number; maxCap: number } | null> {
  const { data: row, error } = await db
    .from("user_points")
    .select("points, max_cap")
    .eq("discord_id", discordId)
    .maybeSingle();

  if (error) {
    console.error("[vap] fetch user_points:", error.message);
    return null;
  }

  const current: number = row?.points ?? 0;
  const maxCap: number  = row?.max_cap ?? 500;

  // Hard cap check
  if (current >= maxCap) {
    console.log(`[vap] ${discordId} at cap (${current}/${maxCap})`);
    return null;
  }

  const adjusted     = applyDiminishing(current, maxCap, rawEarned);
  const newPoints    = Math.min(current + adjusted, maxCap);
  const actualEarned = newPoints - current;

  if (actualEarned <= 0) return null;

  if (row) {
    const { error: upErr } = await db
      .from("user_points")
      .update({ points: newPoints })
      .eq("discord_id", discordId);
    if (upErr) { console.error("[vap] update:", upErr.message); return null; }
  } else {
    const { error: inErr } = await db
      .from("user_points")
      .insert({ discord_id: discordId, points: actualEarned, max_cap: 500 });
    if (inErr) { console.error("[vap] insert:", inErr.message); return null; }
  }

  return { actualEarned, newPoints, maxCap };
}

// ─── handleNotification (fire-and-forget, DB-backed buffer) ──────────────────
async function handleNotification(
  db: SupabaseClient,
  discordId: string,
  earned: number,
  botToken: string
): Promise<void> {
  try {
    // Fetch or create buffer row
    const { data: buf, error: fetchErr } = await db
      .from("user_notify_buffer")
      .select("pending_points, last_sent_at")
      .eq("user_id", discordId)
      .maybeSingle();

    if (fetchErr) {
      console.error("[vap] notify buffer fetch:", fetchErr.message);
      return;
    }

    const now          = new Date();
    const pending      = (buf?.pending_points ?? 0) + earned;
    const lastSentAt   = buf?.last_sent_at ? new Date(buf.last_sent_at) : new Date(0);
    const msSinceLast  = now.getTime() - lastSentAt.getTime();

    if (msSinceLast < NOTIFY_COOLDOWN_MS) {
      // Still in cooldown — just accumulate
      await db.from("user_notify_buffer").upsert(
        { user_id: discordId, pending_points: pending, last_sent_at: lastSentAt.toISOString() },
        { onConflict: "user_id" }
      );
      console.log(`[vap] ${discordId} buffered +${earned} (${Math.round((NOTIFY_COOLDOWN_MS - msSinceLast) / 1000)}s left)`);
      return;
    }

    // Ready to send — reset buffer first (optimistic)
    await db.from("user_notify_buffer").upsert(
      { user_id: discordId, pending_points: 0, last_sent_at: now.toISOString() },
      { onConflict: "user_id" }
    );

    // Fetch avatar
    let avatarUrl = "https://cdn.discordapp.com/embed/avatars/0.png";
    try {
      const { data: profile } = await db
        .from("profiles")
        .select("avatar_url")
        .eq("discord_id", discordId)
        .maybeSingle();
      if (profile?.avatar_url) avatarUrl = profile.avatar_url;
    } catch { /* silent */ }

    const embedPayload = {
      content: `<@${discordId}>`,
      embeds: [{
        description: `<:line:1144701793989840997>\n- <:bearcafe_star:1212856675053346897>︲__\` Activity Points \`__\n  - ยินดีด้วยนะคะ : <@${discordId}> *!*\n  - คุณได้รับ <:strawbear:1280194407014076447> **+${pending}** จากการ **\`"ลงห้องบนคาเฟ่หมี"\`** <:cuteplant:1152834055528783872>\n<:line:1144701793989840997>`,
        color: 16768911,
        thumbnail: { url: avatarUrl },
      }],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 5,
          label: "︲เช็คแต้มของคุณ",
          emoji: { id: "1212856675053346897", name: "bearcafe_star", animated: false },
          url: "https://discord.com/channels/1144251788493602848/1145305334806741122",
        }],
      }],
    };

    const res = await fetch(
      `https://discord.com/api/v10/channels/${NOTIFY_CHANNEL_ID}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(embedPayload),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[vap] Discord notify ${res.status}:`, errText);
      // Restore pending on failure so points aren't lost
      await db.from("user_notify_buffer").upsert(
        { user_id: discordId, pending_points: pending, last_sent_at: lastSentAt.toISOString() },
        { onConflict: "user_id" }
      );
    } else {
      console.log(`[vap] Notified ${discordId} +${pending} pts`);
    }
  } catch (err) {
    console.error("[vap] handleNotification error (non-fatal):", err);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl     = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const botToken        = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase env vars" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const db = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body      = await req.json();
    const eventId   = String(body.eventId ?? "");
    const userId    = String(body.userId ?? "");
    const duration  = Number(body.duration ?? 0);
    const userCount = Number(body.userCount ?? 1);

    // ── Validate input ────────────────────────────────────────────────────────
    if (!eventId || !userId) {
      return new Response(
        JSON.stringify({ error: "eventId and userId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Anti-AFK ──────────────────────────────────────────────────────────────
    if (duration < CYCLE_SECONDS) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "duration_too_short", duration }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (userCount < 2) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "alone_in_voice" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Idempotency: check processed_events ───────────────────────────────────
    const { data: existing, error: checkErr } = await db
      .from("processed_events")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (checkErr) {
      console.error("[vap] processed_events check:", checkErr.message);
      // Fail open — continue (better than blocking all rewards)
    }

    if (existing) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "duplicate_event", eventId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert event BEFORE processing (prevents race condition)
    const { error: insertEvtErr } = await db
      .from("processed_events")
      .insert({ event_id: eventId, user_id: userId });

    if (insertEvtErr) {
      // Likely a race — another request already inserted this eventId
      console.warn("[vap] processed_events insert conflict:", insertEvtErr.message);
      return new Response(
        JSON.stringify({ skipped: true, reason: "duplicate_event_race", eventId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Calculate reward ──────────────────────────────────────────────────────
    const rawEarned = calculateReward(duration, userCount);
    if (rawEarned <= 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no_reward" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Update points ─────────────────────────────────────────────────────────
    const result = await updatePoints(db, userId, rawEarned);
    if (!result) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "at_cap_or_db_error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { actualEarned, newPoints, maxCap } = result;

    // ── Notification (fire-and-forget) ────────────────────────────────────────
    if (botToken && actualEarned > 0) {
      handleNotification(db, userId, actualEarned, botToken).catch((err) => {
        console.error("[vap] notification unhandled:", err);
      });
    }

    console.log(`[vap] OK ${userId} eventId=${eventId} +${actualEarned} → ${newPoints}/${maxCap}`);

    return new Response(
      JSON.stringify({
        success: true,
        eventId,
        userId,
        earned: actualEarned,
        newPoints,
        maxCap,
        cycles: Math.floor(duration / CYCLE_SECONDS),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[vap] Unhandled:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
