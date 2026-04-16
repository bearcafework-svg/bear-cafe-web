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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Expect multipart form data with: row_id, file, and optional field (slip_url or slip_url_2)
    const formData = await req.formData();
    const rowId = formData.get("row_id") as string;
    const file = formData.get("file") as File;
    const field = (formData.get("field") as string) || "slip_url";

    if (!rowId || !file) {
      return new Response(
        JSON.stringify({ error: "Missing row_id or file" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate field name
    const validFields = ["slip_url", "slip_url_2"];
    if (!validFields.includes(field)) {
      return new Response(
        JSON.stringify({ error: "Invalid field, must be slip_url or slip_url_2" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = file.type || "image/jpeg";
    const ext = getExtension(contentType);
    const suffix = field === "slip_url_2" ? "_2" : "";
    const fileName = `${rowId}${suffix}${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    // Upload to slip-images bucket
    const { error: uploadErr } = await supabase.storage
      .from("slip-images")
      .upload(fileName, arrayBuffer, { contentType, upsert: true });

    if (uploadErr) {
      return new Response(
        JSON.stringify({ error: "Upload failed", detail: uploadErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("slip-images")
      .getPublicUrl(fileName);

    const newUrl = publicUrlData.publicUrl;

    // Update trading_history
    const { error: updateErr } = await supabase
      .from("trading_history")
      .update({ [field]: newUrl })
      .eq("id", rowId);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: "DB update failed", detail: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ status: "success", id: rowId, field, url: newUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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
