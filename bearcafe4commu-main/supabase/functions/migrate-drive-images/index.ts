import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1) ค้นหาแถวที่เป็นลิงก์ Google Drive (เพิ่ม .limit(5) เพื่อทำทีละ 5 รูป ป้องกันการ Timeout)
    const { data: rows, error: fetchErr } = await supabase
      .from("tag_warn_logs")
      .select("id, image_url")
      .not("image_url", "is", null)
      .or(
        "image_url.ilike.*drive.google.com*,image_url.ilike.*googleusercontent*"
      )
      .order("sequence", { ascending: true })
      .limit(5); // 🚀 เพิ่มตรงนี้! จำกัดแค่ 5 รูปต่อการรัน 1 ครั้ง

    if (fetchErr) {
      return new Response(
        JSON.stringify({ error: "Fetch failed", detail: fetchErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ message: "ไม่พบแถวที่ต้องย้ายรูป (หรือย้ายเสร็จหมดแล้ว!)", migrated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { id: string; status: string; url?: string; error?: string }[] = [];

    for (const row of rows) {
      try {
        const fileId = extractFileId(row.image_url);
        if (!fileId) {
          results.push({ id: row.id, status: "skipped", error: "ไม่พบ file ID" });
          continue;
        }

        // 2) Download from Google Drive (public link)
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        const imgRes = await fetch(downloadUrl, { redirect: "follow" });
        if (!imgRes.ok) {
          results.push({ id: row.id, status: "failed", error: `Download HTTP ${imgRes.status}` });
          continue;
        }

        const blob = await imgRes.arrayBuffer();
        const contentType = imgRes.headers.get("content-type") || "image/jpeg";
        const ext = getExtension(contentType);
        const fileName = `${row.id}${ext}`;

        // 3) Upload to Supabase Storage (warn-images bucket)
        const { error: uploadErr } = await supabase.storage
          .from("warn-images")
          .upload(fileName, blob, {
            contentType,
            upsert: true,
          });

        if (uploadErr) {
          results.push({ id: row.id, status: "failed", error: uploadErr.message });
          continue;
        }

        // 4) Get public URL
        const { data: publicUrlData } = supabase.storage
          .from("warn-images")
          .getPublicUrl(fileName);

        const newUrl = publicUrlData.publicUrl;

        // 5) Update image_url in DB
        const { error: updateErr } = await supabase
          .from("tag_warn_logs")
          .update({ image_url: newUrl })
          .eq("id", row.id);

        if (updateErr) {
          results.push({ id: row.id, status: "failed", error: `DB update: ${updateErr.message}` });
          continue;
        }

        results.push({ id: row.id, status: "success", url: newUrl });
      } catch (err) {
        results.push({ id: row.id, status: "failed", error: String(err) });
      }
    }

    const success = results.filter((r) => r.status === "success").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    return new Response(
      JSON.stringify({
        message: `เสร็จสิ้น: สำเร็จ ${success} / ล้มเหลว ${failed} / ข้าม ${skipped} (จากทั้งหมด ${rows.length} รูปในรอบนี้)`,
        total: rows.length,
        success,
        failed,
        skipped,
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
