import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Briefcase, Calendar, ArrowRight } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  Planejamento: "bg-muted text-muted-foreground",
  "Em Andamento": "bg-primary/10 text-primary",
  Pausado: "bg-hexa-amber/10 text-hexa-amber",
  Concluído: "bg-hexa-green/10 text-hexa-green",
  Cancelado: "bg-destructive/10 text-destructive",
};

export default function ProjectsList() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setProjects(data || []);
        setLoading(false);
      });
  }, [user]);

  const filtered = projects.filter(
    (p) =>
      p.titulo.toLowerCase().includes(search.toLowerCase()) ||
      p.cliente?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <HexaLayout>
      <div className="space-y-6 animate-slide-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-primary" /> Projetos & Implantação
            </h1>
            <p className="text-muted-foreground text-sm">
              Gerencie projetos, checklists e cronogramas.
            </p>
          </div>
          <Link to="/projects/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Novo Projeto
            </Button>
          </Link>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar projetos..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="text-muted-foreground py-8 text-center">Carregando...</p>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum projeto encontrado.</p>
              <Link to="/projects/new">
                <Button className="mt-4 gap-2">
                  <Plus className="w-4 h-4" /> Criar primeiro projeto
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base line-clamp-1">{p.titulo}</CardTitle>
                      <Badge className={STATUS_COLORS[p.status] || "bg-muted text-muted-foreground"}>
                        {p.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {p.cliente && (
                      <p className="text-sm text-muted-foreground">Cliente: {p.cliente}</p>
                    )}
                    {p.descricao && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{p.descricao}</p>
                    )}
                    <div className="flex items-center justify-between pt-2">
                      {p.data_prevista && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(p.data_prevista).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                      {p.valor_contrato > 0 && (
                        <span className="text-xs font-medium text-primary">
                          R$ {Number(p.valor_contrato).toLocaleString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </HexaLayout>
  );
}
