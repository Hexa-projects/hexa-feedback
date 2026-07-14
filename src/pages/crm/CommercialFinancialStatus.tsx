import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import HexaLayout from "@/components/HexaLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";

export default function CommercialFinancialStatus() {
  const [rows, setRows] = useState<any[]>([]);
  const [allowed, setAllowed] = useState(true);
  useEffect(() => { (async () => {
    const { data, error } = await (supabase as any).from("financial_records").select("id, descricao, referencia, valor, status, data_vencimento, data_pagamento").eq("tipo", "receita").order("data_vencimento", { ascending: false });
    if (error) { setAllowed(false); toast.error("Acesso financeiro não concedido", { description: "Solicite ao administrador a permissão de acompanhamento comercial." }); }
    else setRows(data || []);
  })(); }, []);
  return <HexaLayout><div className="space-y-4"><header><h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="w-6 h-6 text-primary" /> Situação Financeira Comercial</h1><p className="text-sm text-muted-foreground">Consulta restrita ao pagamento de propostas e contratos. Dados contábeis e custos não são exibidos.</p></header>
    {!allowed ? <div className="border border-dashed p-10 text-center text-sm text-muted-foreground">Seu usuário ainda não possui permissão para esta consulta.</div> : <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Referência</TableHead><TableHead>Descrição</TableHead><TableHead>Vencimento</TableHead><TableHead>Valor</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader><TableBody>{rows.map(row => <TableRow key={row.id}><TableCell className="font-mono text-xs">{row.referencia || "—"}</TableCell><TableCell>{row.descricao}</TableCell><TableCell>{row.data_vencimento ? format(new Date(row.data_vencimento), "dd/MM/yyyy") : "—"}</TableCell><TableCell>{Number(row.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell><TableCell><Badge variant={row.status === "pago" ? "default" : "secondary"}>{row.status}</Badge></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}
  </div></HexaLayout>;
}
