import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, DollarSign } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const COLUMNS = ["Qualificação", "Contato Inicial", "Reunião", "Proposta Enviada", "Negociação", "Ganho", "Perdido"];

const COLUMN_COLORS: Record<string, string> = {
  "Qualificação": "border-t-blue-400",
  "Contato Inicial": "border-t-yellow-400",
  "Reunião": "border-t-purple-400",
  "Proposta Enviada": "border-t-orange-400",
  "Negociação": "border-t-teal-400",
  "Ganho": "border-t-green-400",
  "Perdido": "border-t-red-400",
};

export default function KanbanFunnel() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("leads").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setLeads(data || []);
    });
  }, [user]);

  const handleDrop = async (newStatus: string) => {
    if (!draggedId) return;
    const { error } = await supabase.from("leads").update({ status: newStatus }).eq("id", draggedId);
    if (!error) {
      setLeads(prev => prev.map(l => l.id === draggedId ? { ...l, status: newStatus } : l));
      toast({ title: `Lead movido para ${newStatus}` });
    }
    setDraggedId(null);
  };

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Funil Comercial</h1>
            <p className="text-sm text-muted-foreground">Arraste os cards para atualizar o status</p>
          </div>
          <Link to="/crm"><Button variant="outline" size="sm" className="gap-1"><ArrowLeft className="w-4 h-4" /> Lista</Button></Link>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMNS.map(col => {
            const colLeads = leads.filter(l => l.status === col);
            return (
              <div
                key={col}
                className={`min-w-[260px] flex-shrink-0 bg-muted/30 rounded-xl border-t-4 ${COLUMN_COLORS[col]} p-3`}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(col)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">{col}</h3>
                  <span className="text-xs bg-muted rounded-full px-2 py-0.5">{colLeads.length}</span>
                </div>
                <div className="space-y-2">
                  {colLeads.map(lead => (
                    <Link
                      key={lead.id}
                      to={`/crm/${lead.id}`}
                      draggable
                      onDragStart={() => setDraggedId(lead.id)}
                      className="block p-3 bg-card rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
                    >
                      <p className="text-sm font-medium truncate">{lead.nome}</p>
                      {lead.empresa && <p className="text-xs text-muted-foreground">{lead.empresa}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        {lead.valor_estimado > 0 && (
                          <span className="text-xs text-hexa-green flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            R$ {Number(lead.valor_estimado).toLocaleString("pt-BR")}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </HexaLayout>
  );
}
