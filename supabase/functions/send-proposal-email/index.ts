import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const { data: claims, error: authError } = await userClient.auth.getClaims(token);
    if (authError || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);

    const { proposal_id, recipient, message } = await req.json();
    if (!proposal_id || !recipient) return json({ error: "proposal_id and recipient are required" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: proposal, error } = await admin.from("proposals").select("*, leads(nome, empresa)").eq("id", proposal_id).single();
    if (error || !proposal) return json({ error: "Proposal not found" }, 404);

    const senderId = String(claims.claims.sub);
    const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", senderId);
    const privileged = (roleRows || []).some((row: any) => ["admin", "gestor"].includes(row.role));
    if (proposal.user_id !== senderId && !privileged) return json({ error: "Forbidden" }, 403);

    const tenantId = Deno.env.get("MS_GRAPH_TENANT_ID") || Deno.env.get("MS_TENANT_ID") || Deno.env.get("MICROSOFT_TENANT_ID");
    const clientId = Deno.env.get("MS_GRAPH_CLIENT_ID") || Deno.env.get("MS_CLIENT_ID") || Deno.env.get("MICROSOFT_CLIENT_ID");
    const clientSecret = Deno.env.get("MS_GRAPH_CLIENT_SECRET") || Deno.env.get("MS_CLIENT_SECRET") || Deno.env.get("MICROSOFT_CLIENT_SECRET");
    const sender = Deno.env.get("MS_GRAPH_SENDER") || Deno.env.get("MS_SENDER_EMAIL") || Deno.env.get("MICROSOFT_SENDER_EMAIL");
    if (!tenantId || !clientId || !clientSecret || !sender) return json({ error: "Microsoft Graph secrets are not configured" }, 503);

    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
    });
    const tokenPayload = await tokenRes.json();
    if (!tokenRes.ok) return json({ error: "Microsoft Graph authentication failed", details: tokenPayload?.error_description }, 502);

    const subject = `Proposta ${proposal.proposal_number || ""} - ${proposal.titulo}`.trim();
    const body = `<div style="font-family:Arial,sans-serif;color:#222;line-height:1.5"><p>Olá, ${escapeHtml(proposal.leads?.nome || proposal.leads?.empresa || "cliente")}.</p><p>${escapeHtml(message || "Encaminhamos a proposta comercial solicitada para sua análise.")}</p><p><strong>${escapeHtml(proposal.titulo)}</strong><br>Número: ${escapeHtml(proposal.proposal_number)}<br>Valor: ${Number(proposal.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}<br>Validade: ${proposal.expires_at ? new Date(proposal.expires_at).toLocaleDateString("pt-BR") : `${proposal.validade_dias || 30} dias`}</p><p>Atenciosamente,<br>Hexamedical</p></div>`;
    const sendRes = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
      method: "POST", headers: { Authorization: `Bearer ${tokenPayload.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { subject, body: { contentType: "HTML", content: body }, toRecipients: [{ emailAddress: { address: recipient } }] }, saveToSentItems: true }),
    });
    if (!sendRes.ok) {
      const details = await sendRes.text();
      await admin.from("proposal_email_events").insert({ proposal_id, recipient, subject, status: "failed", error_message: details.slice(0, 1000), sent_by: senderId });
      return json({ error: "Microsoft Graph send failed", details }, 502);
    }
    await Promise.all([
      admin.from("proposal_email_events").insert({ proposal_id, recipient, subject, status: "sent", sent_by: senderId, sent_at: new Date().toISOString() }),
      admin.from("proposals").update({ status: "Enviada", sent_at: new Date().toISOString(), last_email_to: recipient }).eq("id", proposal_id),
    ]);
    return json({ sent: true });
  } catch (error) {
    console.error("[send-proposal-email]", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
