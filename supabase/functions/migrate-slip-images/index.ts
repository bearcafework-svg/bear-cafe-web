import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tag-secret",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify shared secret
    const secret = req.headers.get("x-tag-secret");
    const expectedSecret = Deno.env.get("TAG_WARN_APPS_SCRIPT_SECRET");
    if (!expectedSecret || secret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse optional body
    let limit = 10;
    try {
      const body = await req.json();
      if (body.limit) limit = Math.min(body.limit, 50);
    } catch { /* no body */ }

    // Find rows with external slip_url (including Google Drive), limit per run
    const { data: rows, error: fetchErr } = await supabase
      .from("trading_history")
      .select("id, slip_url, slip_url_2")
      .or(`slip_url.ilike.*drive.google.com*,slip_url.ilike.*googleusercontent*,slip_url_2.ilike.*drive.google.com*,slip_url_2.ilike.*googleusercontent*`)
      .order("log_timestamp", { ascending: true })
      .limit(limit);

    if (fetchErr) {
      return new Response(
        JSON.stringify({ error: "Fetch failed", detail: fetchErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ message: "ไม่พบแถวที่ต้องย้ายรูป (หรือย้ายเสร็จหมดแล้ว)", migrated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { id: string; status: string; field?: string; url?: string; error?: string }[] = [];

    for (const row of rows) {
      // Process slip_url
      if (row.slip_url && /drive\.google\.com|googleusercontent/.test(row.slip_url)) {
        const r = await migrateOneSlip(supabase, supabaseUrl, row.id, row.slip_url, "slip_url");
        results.push(r);
      }
      // Process slip_url_2
      if (row.slip_url_2 && /drive\.google\.com|googleusercontent/.test(row.slip_url_2)) {
        const r = await migrateOneSlip(supabase, supabaseUrl, row.id, row.slip_url_2, "slip_url_2");
        results.push(r);
      }
    }

    const success = results.filter((r) => r.status === "success").length;
    const failed = results.filter((r) => r.status === "failed").length;

    return new Response(
      JSON.stringify({
        message: `เสร็จสิ้น: สำเร็จ ${success} / ล้มเหลว ${failed}`,
        total: rows.length,
        success,
        failed,
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function migrateOneSlip(
  supabase: any,
  supabaseUrl: string,
  rowId: string,
  slipUrl: string,
  field: "slip_url" | "slip_url_2"
): Promise<{ id: string; status: string; field: string; url?: string; error?: string }> {
  try {
    const fileId = extractFileId(slipUrl);
    if (!fileId) {
      return { id: rowId, status: "failed", field, error: "ไม่พบ file ID" };
    }

    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const imgRes = await fetch(downloadUrl, { redirect: "follow" });
    if (!imgRes.ok) {
      return { id: rowId, status: "failed", field, error: `Download HTTP ${imgRes.status}` };
    }

    const blob = await imgRes.arrayBuffer();
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const ext = getExtension(contentType);
    const suffix = field === "slip_url_2" ? "_2" : "";
    const fileName = `${rowId}${suffix}${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("slip-images")
      .upload(fileName, blob, { contentType, upsert: true });

    if (uploadErr) {
      return { id: rowId, status: "failed", field, error: uploadErr.message };
    }

    const { data: publicUrlData } = supabase.storage
      .from("slip-images")
      .getPublicUrl(fileName);

    const newUrl = publicUrlData.publicUrl;

    const { error: updateErr } = await supabase
      .from("trading_history")
      .update({ [field]: newUrl })
      .eq("id", rowId);

    if (updateErr) {
      return { id: rowId, status: "failed", field, error: `DB update: ${updateErr.message}` };
    }

    return { id: rowId, status: "success", field, url: newUrl };
  } catch (err) {
    return { id: rowId, status: "failed", field, error: String(err) };
  }
}

function getExtension(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
  };
  return map[contentType] || ".jpg";
}

function extractFileId(url: string): string | null {
  if (!url) return null;
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  const m3 = url.match(/open\?id=([a-zA-Z0-9_-]+)/);
  if (m3) return m3[1];
  return null;
}
