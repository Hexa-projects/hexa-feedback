import { useState } from "react";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Search, FileText, FolderOpen, Upload } from "lucide-react";

export default function KnowledgeBase() {
  const [search, setSearch] = useState("");

  const { data: docs = [] } = useQuery({
    queryKey: ["knowledge-chunks"],
    queryFn: async () => {
      const { data } = await supabase.from("knowledge_chunks").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const filtered = docs.filter((d: any) =>
    !search ||
    d.title?.toLowerCase().includes(search.toLowerCase()) ||
    d.equipment_model?.toLowerCase().includes(search.toLowerCase()) ||
    d.equipment_brand?.toLowerCase().includes(search.toLowerCase())
  );

  // Group by equipment model
  const grouped = filtered.reduce((acc: Record<string, any[]>, doc: any) => {
    const key = doc.equipment_model || "Geral";
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  return (
    <HexaLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Base de Conhecimento</h1>
            <p className="text-sm text-muted-foreground">Manuais & Diagramas Técnicos</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar por modelo, marca..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 bg-muted/30 border-border/40" />
        </div>

        <div className="space-y-4">
          {Object.entries(grouped).map(([model, docs]) => (
            <Card key={model} className="cyber-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-primary" />
                  {model}
                  <span className="text-xs text-muted-foreground font-normal">({(docs as any[]).length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {(docs as any[]).map((doc: any) => (
                    <div key={doc.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/20 transition-colors cursor-pointer">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.doc_type} {doc.equipment_brand && `• ${doc.equipment_brand}`}
                        </p>
                      </div>
                      {doc.tags?.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">{doc.tags.join(", ")}</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          {Object.keys(grouped).length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Nenhum documento encontrado
            </div>
          )}
        </div>
      </div>
    </HexaLayout>
  );
}
