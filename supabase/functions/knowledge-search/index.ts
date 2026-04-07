import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { action } = body;

    console.log("[knowledge-search] action:", action);

    // ─── search_by_equipment: Find manuals/docs by model/brand ───
    if (action === "search_by_equipment") {
      const { model, brand, doc_type, limit: lim } = body;

      let query = db.from("knowledge_chunks").select("id, title, content, source_file, source_url, equipment_model, equipment_brand, doc_type, tags, metadata, created_at");

      if (model) {
        query = query.ilike("equipment_model", `%${model}%`);
      }
      if (brand) {
        query = query.ilike("equipment_brand", `%${brand}%`);
      }
      if (doc_type) {
        query = query.eq("doc_type", doc_type);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(Math.min(lim || 20, 50));

      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        query: { model, brand, doc_type },
        results: data || [],
        count: (data || []).length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── search_text: Full-text search across knowledge base ───
    if (action === "search_text") {
      const { query: searchQuery, limit: lim } = body;

      if (!searchQuery) {
        return new Response(JSON.stringify({ success: false, error: "query is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await db
        .from("knowledge_chunks")
        .select("id, title, content, source_file, equipment_model, equipment_brand, doc_type, tags")
        .or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%,equipment_model.ilike.%${searchQuery}%`)
        .limit(Math.min(lim || 10, 50));

      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        query: searchQuery,
        results: data || [],
        count: (data || []).length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── list_doc_types: Get available document types ───
    if (action === "list_doc_types") {
      const { data } = await db.from("knowledge_chunks").select("doc_type, equipment_brand, equipment_model");

      const types = new Set<string>();
      const brands = new Set<string>();
      const models = new Set<string>();

      (data || []).forEach((d: any) => {
        if (d.doc_type) types.add(d.doc_type);
        if (d.equipment_brand) brands.add(d.equipment_brand);
        if (d.equipment_model) models.add(d.equipment_model);
      });

      return new Response(JSON.stringify({
        success: true,
        doc_types: Array.from(types),
        brands: Array.from(brands),
        models: Array.from(models),
        total_chunks: (data || []).length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      service: "knowledge-search",
      actions: {
        search_by_equipment: "Search by model/brand (params: model, brand, doc_type, limit)",
        search_text: "Full-text search (params: query, limit)",
        list_doc_types: "List available doc types, brands, models",
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[knowledge-search] Error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
