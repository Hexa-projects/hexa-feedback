import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Data cleaning helpers ───

function cleanPhone(raw: string): { valid: boolean; cleaned: string; original: string } {
  const original = raw;
  let digits = raw.replace(/\D/g, "");
  // Remove country code 55 if present
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  // Validate DDD (11-99)
  if (digits.length < 10 || digits.length > 11) {
    return { valid: false, cleaned: raw, original };
  }
  const ddd = parseInt(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) {
    return { valid: false, cleaned: raw, original };
  }
  // Format
  const cleaned = digits.length === 11
    ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
    : `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return { valid: true, cleaned, original };
}

function cleanName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function cleanEmail(raw: string): { valid: boolean; cleaned: string } {
  const cleaned = raw.trim().toLowerCase();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);
  return { valid, cleaned };
}

function cleanNumeric(raw: string): { valid: boolean; value: number } {
  const cleaned = raw.replace(/[^\d.,\-]/g, "").replace(",", ".");
  const value = parseFloat(cleaned);
  return { valid: !isNaN(value), value };
}

// ─── Dedup check fields per table ───
const DEDUP_FIELDS: Record<string, string[]> = {
  leads: ["email", "telefone"],
  inventory: ["sku", "name"],
  installed_equipment: ["serial_number"],
  work_orders: [],
  financial_records: [],
};

// Phone fields per table
const PHONE_FIELDS: Record<string, string[]> = {
  leads: ["telefone"],
  installed_equipment: [],
  work_orders: [],
  inventory: [],
  financial_records: [],
};

// Email fields
const EMAIL_FIELDS: Record<string, string[]> = {
  leads: ["email"],
  installed_equipment: [],
  work_orders: [],
  inventory: [],
  financial_records: [],
};

// Numeric fields
const NUMERIC_FIELDS: Record<string, string[]> = {
  leads: ["valor_estimado"],
  inventory: ["current_quantity", "min_quantity", "cost_per_unit"],
  installed_equipment: [],
  work_orders: [],
  financial_records: ["valor"],
};

// Name fields to title-case
const NAME_FIELDS: Record<string, string[]> = {
  leads: ["nome", "empresa"],
  inventory: ["name", "supplier"],
  installed_equipment: ["nome", "cliente"],
  work_orders: ["cliente", "tecnico_responsavel"],
  financial_records: ["descricao", "cliente"],
};

// Allowed tables
const ALLOWED_TABLES = ["leads", "inventory", "installed_equipment", "work_orders", "financial_records"];

interface ETLRequest {
  action: string;
  target_table: string;
  column_map: Record<string, string>;
  headers: string[];
  rows: string[][];
  user_id: string;
}

function processRows(req: ETLRequest) {
  const { target_table, column_map, headers, rows, user_id } = req;

  const errors: { row: number; field: string; message: string }[] = [];
  const cleaned: { row: number; field: string; original: string; cleaned: string }[] = [];
  const validRows: Record<string, any>[] = [];

  const phoneFields = PHONE_FIELDS[target_table] || [];
  const emailFields = EMAIL_FIELDS[target_table] || [];
  const numericFields = NUMERIC_FIELDS[target_table] || [];
  const nameFields = NAME_FIELDS[target_table] || [];

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const record: Record<string, any> = { user_id };
    let rowValid = true;

    for (const [fileCol, targetCol] of Object.entries(column_map)) {
      const colIdx = headers.indexOf(fileCol);
      if (colIdx < 0) continue;
      let val = (row[colIdx] || "").trim();
      if (!val) continue;

      // Phone cleaning
      if (phoneFields.includes(targetCol)) {
        const result = cleanPhone(val);
        if (!result.valid) {
          errors.push({ row: ri + 2, field: targetCol, message: `Telefone inválido: ${val}` });
          rowValid = false;
          continue;
        }
        if (result.cleaned !== result.original) {
          cleaned.push({ row: ri + 2, field: targetCol, original: result.original, cleaned: result.cleaned });
        }
        val = result.cleaned;
      }

      // Email cleaning
      if (emailFields.includes(targetCol)) {
        const result = cleanEmail(val);
        if (!result.valid) {
          errors.push({ row: ri + 2, field: targetCol, message: `E-mail inválido: ${val}` });
          rowValid = false;
          continue;
        }
        if (result.cleaned !== val) {
          cleaned.push({ row: ri + 2, field: targetCol, original: val, cleaned: result.cleaned });
        }
        val = result.cleaned;
      }

      // Numeric cleaning
      if (numericFields.includes(targetCol)) {
        const result = cleanNumeric(val);
        if (!result.valid) {
          errors.push({ row: ri + 2, field: targetCol, message: `Valor numérico inválido: ${val}` });
          rowValid = false;
          continue;
        }
        record[targetCol] = result.value;
        continue;
      }

      // Name title-casing
      if (nameFields.includes(targetCol)) {
        const cleanedName = cleanName(val);
        if (cleanedName !== val) {
          cleaned.push({ row: ri + 2, field: targetCol, original: val, cleaned: cleanedName });
        }
        val = cleanedName;
      }

      record[targetCol] = val;
    }

    if (rowValid && Object.keys(record).length > 1) {
      validRows.push({ ...record, _row: ri + 2 });
    }
  }

  return { errors, cleaned, validRows };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  try {
    const body: ETLRequest = await req.json();
    const { action, target_table } = body;

    // Validate table
    if (!ALLOWED_TABLES.includes(target_table)) {
      return jsonResp({ error: "Tabela não permitida." }, 400);
    }

    // ─── ETL DRY RUN ───
    if (action === "etl_dry_run") {
      const { errors, cleaned, validRows } = processRows(body);

      // Check duplicates
      const dedupFields = DEDUP_FIELDS[target_table] || [];
      const duplicates: { row: number; field: string; value: string }[] = [];
      const finalValid: Record<string, any>[] = [];

      for (const row of validRows) {
        let isDup = false;
        for (const field of dedupFields) {
          if (!row[field]) continue;
          const { count } = await db
            .from(target_table)
            .select("*", { count: "exact", head: true })
            .eq(field, row[field]);
          if ((count || 0) > 0) {
            duplicates.push({ row: row._row, field, value: row[field] });
            isDup = true;
            break;
          }
        }
        if (!isDup) {
          const { _row, ...clean } = row;
          finalValid.push(clean);
        }
      }

      return jsonResp({
        total: body.rows.length,
        valid: finalValid.length,
        errors,
        cleaned,
        duplicates,
        preview_rows: finalValid.slice(0, 5),
      });
    }

    // ─── ETL EXECUTE ───
    if (action === "etl_execute") {
      const { errors, cleaned, validRows } = processRows(body);

      // Dedup
      const dedupFields = DEDUP_FIELDS[target_table] || [];
      const toInsert: Record<string, any>[] = [];
      const duplicates: { row: number; field: string; value: string }[] = [];

      for (const row of validRows) {
        let isDup = false;
        for (const field of dedupFields) {
          if (!row[field]) continue;
          const { count } = await db
            .from(target_table)
            .select("*", { count: "exact", head: true })
            .eq(field, row[field]);
          if ((count || 0) > 0) {
            duplicates.push({ row: row._row, field, value: row[field] });
            isDup = true;
            break;
          }
        }
        if (!isDup) {
          const { _row, ...clean } = row;
          toInsert.push(clean);
        }
      }

      // Batch insert
      let inserted = 0;
      let insertErrors = 0;
      const BATCH_SIZE = 50;

      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const { error } = await db.from(target_table).insert(batch);
        if (error) {
          console.error(`[ETL] Batch insert error:`, error);
          insertErrors += batch.length;
        } else {
          inserted += batch.length;
        }
      }

      // Log to openclaw_event_queue
      await db.from("openclaw_event_queue").insert({
        event_id: crypto.randomUUID(),
        event_type: "etl.import_completed",
        priority: "medium",
        domain: "general",
        tags: ["etl", "import", target_table],
        data: {
          target_table,
          total_rows: body.rows.length,
          inserted,
          errors: errors.length + insertErrors,
          duplicates_skipped: duplicates.length,
          cleaned_fields: cleaned.length,
          user_id: body.user_id,
          completed_at: new Date().toISOString(),
        },
        meta: { schema_version: "1.0", source: "hexaos", type: "etl_import" },
        status: "pending",
      });

      return jsonResp({ inserted, errors: errors.length + insertErrors });
    }

    // ─── Legacy actions ───

    if (action === "discover_catalog") {
      const tables = [
        "leads", "lead_interactions", "proposals", "work_orders",
        "work_order_activities", "lab_parts", "daily_forms", "bottlenecks",
        "repetitive_processes", "suggestions", "tool_mappings", "profiles",
      ];
      const catalog: any[] = [];
      for (const table of tables) {
        const { count } = await db.from(table).select("*", { count: "exact", head: true });
        const { data: sample } = await db.from(table).select("*").limit(1);
        const columns = sample && sample.length > 0
          ? Object.keys(sample[0]).map(col => ({
              name: col, type: typeof sample[0][col], nullable: sample[0][col] === null,
              sample_value: typeof sample[0][col] === "string" && sample[0][col].length > 50
                ? sample[0][col].slice(0, 50) + "..." : sample[0][col],
            }))
          : [];
        catalog.push({ table_name: table, schema_name: "public", column_count: columns.length, row_count: count || 0, columns_info: columns, domain: "general" });
      }
      return jsonResp({ success: true, tables: catalog.length, catalog });
    }

    if (action === "business_snapshot" || action === "executive_summary" || action === "data_quality") {
      return jsonResp({ success: false, error: "Use dedicated endpoints for these actions." }, 400);
    }

    return jsonResp({ success: false, error: "unknown_action" }, 400);
  } catch (err) {
    console.error("[openclaw-data-sync] Error:", err);
    return jsonResp({ success: false, error: "internal", message: "Erro interno." }, 500);
  }
});
