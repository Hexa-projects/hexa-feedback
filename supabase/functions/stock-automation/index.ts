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

    console.log("[stock-automation] action:", action, JSON.stringify(body));

    // ─── on_os_completed: Auto-deduct stock for parts used ───
    if (action === "on_os_completed") {
      const { work_order_id, pecas_utilizadas, user_id } = body;

      if (!work_order_id || !pecas_utilizadas || !Array.isArray(pecas_utilizadas)) {
        return new Response(JSON.stringify({ success: false, error: "Missing work_order_id or pecas_utilizadas" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results = [];

      for (const peca of pecas_utilizadas) {
        // Find inventory item by name (case-insensitive)
        const { data: invItem } = await db
          .from("inventory")
          .select("id, name, current_quantity, min_quantity")
          .ilike("name", peca.nome)
          .limit(1)
          .single();

        if (!invItem) {
          results.push({ peca: peca.nome, status: "not_found_in_inventory" });
          continue;
        }

        const newQty = Math.max(0, invItem.current_quantity - (peca.quantidade || 1));

        // Create stock movement
        const { error: mvError } = await db.from("stock_movements").insert({
          product_id: invItem.id,
          tipo: "saida",
          quantidade: peca.quantidade || 1,
          motivo: `Baixa automática - OS ${work_order_id}`,
          operador_id: user_id || null,
          referencia: work_order_id,
          notas: `Peça: ${peca.nome}${peca.serial ? ` S/N: ${peca.serial}` : ""}`,
          work_order_id,
        });

        if (mvError) {
          console.error("[stock-automation] movement error:", mvError);
          results.push({ peca: peca.nome, status: "movement_error", error: mvError.message });
          continue;
        }

        // Update inventory quantity
        await db.from("inventory").update({ current_quantity: newQty }).eq("id", invItem.id);

        results.push({
          peca: peca.nome,
          status: "deducted",
          previous_qty: invItem.current_quantity,
          new_qty: newQty,
        });

        // Check if below minimum → create alert
        if (newQty <= invItem.min_quantity) {
          await db.from("openclaw_event_queue").insert({
            event_type: "low_stock_alert",
            data: {
              inventory_id: invItem.id,
              item_name: invItem.name,
              current_quantity: newQty,
              min_quantity: invItem.min_quantity,
              work_order_id,
            },
            status: "pending",
            domain: "stock",
            priority: newQty === 0 ? "critical" : "high",
          });

          // Also create a notification
          await db.from("notifications").insert({
            titulo: `⚠️ Estoque baixo: ${invItem.name}`,
            mensagem: `Estoque de "${invItem.name}" em ${newQty} un. (mínimo: ${invItem.min_quantity}). Reposição necessária.`,
            tipo: "alerta",
            user_id: user_id || "00000000-0000-0000-0000-000000000000",
          });

          results.push({ peca: peca.nome, alert: "low_stock", qty: newQty, min: invItem.min_quantity });
        }
      }

      // Log automation
      await db.from("automation_executions").insert({
        automation_type: "stock_deduction_on_os_complete",
        trigger_entity: "work_orders",
        trigger_id: work_order_id,
        payload: { pecas_utilizadas },
        result: { deductions: results },
        status: "completed",
      });

      await db.from("ai_audit_trail").insert({
        event_type: "automation",
        action: "stock_deduction",
        actor_type: "system",
        entity_type: "work_order",
        entity_id: work_order_id,
        details: { results },
      });

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── check_low_stock: Scan all inventory for low stock ───
    if (action === "check_low_stock") {
      const { data: items } = await db
        .from("inventory")
        .select("id, name, current_quantity, min_quantity, supplier")
        .order("current_quantity", { ascending: true });

      const lowStock = (items || []).filter((i: any) => i.current_quantity <= i.min_quantity);

      for (const item of lowStock) {
        await db.from("openclaw_event_queue").insert({
          event_type: "low_stock_alert",
          data: {
            inventory_id: item.id,
            item_name: item.name,
            current_quantity: item.current_quantity,
            min_quantity: item.min_quantity,
            supplier: item.supplier,
          },
          status: "pending",
          domain: "stock",
          priority: item.current_quantity === 0 ? "critical" : "high",
        });
      }

      return new Response(JSON.stringify({
        success: true,
        total_items: (items || []).length,
        low_stock_count: lowStock.length,
        low_stock: lowStock,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      actions: {
        on_os_completed: "Auto-deduct stock (params: work_order_id, pecas_utilizadas, user_id)",
        check_low_stock: "Scan inventory for items below minimum",
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[stock-automation] Error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
