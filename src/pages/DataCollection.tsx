import { useState } from "react";
import HexaLayout from "@/components/HexaLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ClipboardList, Calendar, Loader2, CheckCircle2, Mic } from "lucide-react";
import AudioRecorder from "@/components/AudioRecorder";

const SETORES = [
  "Administrativo", "Comercial", "Técnico", "Laboratório",
  "Financeiro", "Logística", "Diretoria",
];

export default function DataCollection() {
  const { user, profile } = useAuth();

  // --- Daily Form State ---
  const [dailySaving, setDailySaving] = useState(false);
  const [dailySent, setDailySent] = useState(false);
  const [daily, setDaily] = useState({
    atividades: "",
    impedimentos: "",
    setor: profile?.setor || "Administrativo",
    funcao: profile?.funcao || "",
  });

  const handleDailySubmit = async () => {
    if (!user) return;
    if (!daily.atividades.trim()) {
      toast.error("Descreva suas atividades do dia");
      return;
    }
    setDailySaving(true);
    try {
      const { error } = await supabase.from("daily_forms").insert({
        user_id: user.id,
        setor: daily.setor as any,
        funcao: daily.funcao || "Colaborador",
        atividades_principais: daily.atividades,
        impedimentos: daily.impedimentos || "",
        ferramentas: [],
      });
      if (error) throw error;
      setDailySent(true);
      toast.success("Registro diário salvo!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setDailySaving(false);
    }
  };

  // --- Onboarding State ---
  const [onbSaving, setOnbSaving] = useState(false);
  const [onbSent, setOnbSent] = useState(false);
  const [onb, setOnb] = useState({
    setor: profile?.setor || "Administrativo",
    funcao: profile?.funcao || "",
    tarefas_repetitivas: "",
    principal_gargalo: "",
    sugestao_melhoria: "",
  });

  const handleOnbSubmit = async () => {
    if (!user) return;
    if (!onb.tarefas_repetitivas.trim() || !onb.principal_gargalo.trim()) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    setOnbSaving(true);
    try {
      const { error } = await supabase.from("bottlenecks").insert({
        user_id: user.id,
        descricao: onb.principal_gargalo,
        impactos: [onb.setor],
        tags: [onb.funcao || "geral"],
      });
      if (error) throw error;
      setOnbSent(true);
      toast.success("Raio-X salvo com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setOnbSaving(false);
    }
  };

  return (
    <HexaLayout>
      <div className="space-y-6 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold">Coleta de Dados</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Mapeie seus processos e registre seu dia a dia para que a IA identifique melhorias.
          </p>
        </div>

        <Tabs defaultValue="daily">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="daily" className="gap-2">
              <Calendar className="w-4 h-4" /> Meu Dia
            </TabsTrigger>
            <TabsTrigger value="raioxe" className="gap-2">
              <ClipboardList className="w-4 h-4" /> Raio-X
            </TabsTrigger>
          </TabsList>

          {/* --- MEU DIA (DAILY) --- */}
          <TabsContent value="daily" className="mt-6">
            {dailySent ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-bold">Registro salvo!</h3>
                  <p className="text-sm text-muted-foreground mt-1">Obrigado pelo feedback de hoje.</p>
                  <Button className="mt-6" onClick={() => { setDailySent(false); setDaily(prev => ({ ...prev, atividades: "", impedimentos: "" })); }}>
                    Novo Registro
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Meu Dia a Dia</CardTitle>
                  <CardDescription>Formulário rápido para técnicos e equipe de campo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Setor</Label>
                      <Select value={daily.setor} onValueChange={(v) => setDaily(p => ({ ...p, setor: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Função</Label>
                      <input
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Ex: Técnico de Campo"
                        value={daily.funcao}
                        onChange={(e) => setDaily(p => ({ ...p, funcao: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>O que fiz hoje *</Label>
                    <Textarea
                      placeholder="Descreva suas principais atividades do dia..."
                      rows={4}
                      className="text-base"
                      value={daily.atividades}
                      onChange={(e) => setDaily(p => ({ ...p, atividades: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Impedimentos / Falta de peça</Label>
                    <Textarea
                      placeholder="O que te impediu de trabalhar ou te atrasou?"
                      rows={3}
                      className="text-base"
                      value={daily.impedimentos}
                      onChange={(e) => setDaily(p => ({ ...p, impedimentos: e.target.value }))}
                    />
                  </div>

                  <Button
                    onClick={handleDailySubmit}
                    disabled={dailySaving}
                    className="w-full h-12 text-base font-semibold"
                    size="lg"
                  >
                    {dailySaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                    Enviar Registro do Dia
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* --- RAIO-X (NOVO ONBOARDING CONVERSACIONAL) --- */}
          <TabsContent value="raioxe" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mic className="w-5 h-5 text-primary" /> Raio-X Conversacional com a Maya
                </CardTitle>
                <CardDescription>
                  O mapeamento de processos agora é uma conversa natural com a IA da Hexamedical.
                  A Maya conduz uma entrevista guiada, identifica gargalos e estrutura tudo automaticamente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                  <p className="text-sm font-medium">O que você vai conseguir:</p>
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    <li>• Mapear seus processos críticos sem preencher formulários</li>
                    <li>• Identificar oportunidades de automação automaticamente</li>
                    <li>• Gerar um relatório executivo do seu setor</li>
                  </ul>
                </div>
                <Button
                  onClick={() => (window.location.href = "/onboarding")}
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                >
                  Iniciar conversa com a Maya →
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </HexaLayout>
  );
}
