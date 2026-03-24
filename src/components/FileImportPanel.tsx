import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileSpreadsheet, Loader2, CheckCircle, XCircle, ArrowRight, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface FileImport {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  status: string;
  analise_proposito: string | null;
  analise_estrutura: any;
  analise_recomendacoes: string | null;
  analise_pode_substituir: boolean | null;
  analise_modulos_hexaos: string[] | null;
  created_at: string;
}

function parseCSV(text: string): string {
  const lines = text.split("\n").slice(0, 50);
  return lines.join("\n");
}

async function readFileContent(file: File): Promise<string> {
  if (file.name.endsWith(".csv") || file.name.endsWith(".txt") || file.name.endsWith(".tsv")) {
    return parseCSV(await file.text());
  }
  // For xlsx, read as base64 and send first rows description
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // Simple xlsx header detection + send raw text extraction attempt
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 20000));
  // Filter printable characters
  const printable = text.replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, " ").replace(/\s{3,}/g, " | ");
  return printable.slice(0, 15000);
}

export default function FileImportPanel() {
  const { user, profile } = useAuth();
  const [imports, setImports] = useState<FileImport[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedImport, setSelectedImport] = useState<FileImport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchImports = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("file_imports")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setImports((data || []) as FileImport[]);
  };

  useEffect(() => { fetchImports(); }, [user]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const validTypes = [
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/plain",
      "text/tab-separated-values",
    ];
    const validExts = [".csv", ".xlsx", ".xls", ".txt", ".tsv"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();

    if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
      toast.error("Formato não suportado. Envie CSV, XLSX ou XLS.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 10MB).");
      return;
    }

    setUploading(true);
    try {
      // Upload to storage
      const path = `imports/${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("attachments").upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(path);

      // Create record
      const { data: record, error: insertErr } = await supabase.from("file_imports").insert({
        user_id: user.id,
        file_name: file.name,
        file_type: ext,
        file_url: urlData.publicUrl,
        file_size_bytes: file.size,
        setor: profile?.setor || null,
        status: "analyzing",
      }).select("id").single();

      if (insertErr) throw insertErr;

      // Read content and send for analysis
      const content = await readFileContent(file);
      const session = (await supabase.auth.getSession()).data.session;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-file`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            fileImportId: record!.id,
            fileContent: content,
            fileName: file.name,
            fileType: ext,
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Erro na análise");
      }

      toast.success("Arquivo analisado com sucesso!");
      await fetchImports();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao processar arquivo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteImport = async (id: string) => {
    await supabase.from("file_imports").delete().eq("id", id);
    setImports(prev => prev.filter(i => i.id !== id));
    if (selectedImport?.id === id) setSelectedImport(null);
    toast.success("Registro removido");
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <Card className="border-dashed border-2 border-muted-foreground/20 hover:border-primary/40 transition-colors">
        <label className="flex flex-col items-center justify-center gap-3 p-6 cursor-pointer">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,.txt,.tsv"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
          {uploading ? (
            <>
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Analisando arquivo com IA...</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Importar planilha ou arquivo</p>
                <p className="text-xs text-muted-foreground mt-1">
                  CSV, XLSX, XLS — até 10MB
                </p>
              </div>
            </>
          )}
        </label>
      </Card>

      {/* List of imports */}
      {imports.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Arquivos importados</h4>
          {imports.map(imp => (
            <Card key={imp.id} className="p-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{imp.file_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">
                      {imp.file_type.replace(".", "").toUpperCase()}
                    </Badge>
                    {imp.status === "analyzed" ? (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <CheckCircle className="w-3 h-3" /> Analisado
                      </Badge>
                    ) : imp.status === "analyzing" ? (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Analisando
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <XCircle className="w-3 h-3" /> Erro
                      </Badge>
                    )}
                    {imp.analise_pode_substituir && (
                      <Badge className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20">
                        Substituível pelo HexaOS
                      </Badge>
                    )}
                  </div>
                  {imp.analise_proposito && (
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                      {imp.analise_proposito}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {imp.status === "analyzed" && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedImport(imp)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg max-h-[80vh]">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="w-5 h-5" />
                            Análise: {imp.file_name}
                          </DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="max-h-[60vh] pr-4">
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-semibold mb-1">Propósito</h4>
                              <p className="text-sm text-muted-foreground">{imp.analise_proposito}</p>
                            </div>

                            {imp.analise_estrutura && (
                              <div>
                                <h4 className="text-sm font-semibold mb-1">Estrutura</h4>
                                {imp.analise_estrutura.colunas && (
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {imp.analise_estrutura.colunas.map((c: string, i: number) => (
                                      <Badge key={i} variant="outline" className="text-[10px]">{c}</Badge>
                                    ))}
                                  </div>
                                )}
                                {imp.analise_estrutura.metricas && (
                                  <div className="flex flex-wrap gap-1">
                                    {imp.analise_estrutura.metricas.map((m: string, i: number) => (
                                      <Badge key={i} variant="secondary" className="text-[10px]">{m}</Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {imp.analise_modulos_hexaos && imp.analise_modulos_hexaos.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold mb-1">Módulos HexaOS equivalentes</h4>
                                <div className="flex flex-wrap gap-1">
                                  {imp.analise_modulos_hexaos.map((m, i) => (
                                    <Badge key={i} className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/20">
                                      <ArrowRight className="w-3 h-3" /> {m}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {imp.analise_recomendacoes && (
                              <div>
                                <h4 className="text-sm font-semibold mb-1">Recomendações</h4>
                                <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                                  <ReactMarkdown>{imp.analise_recomendacoes}</ReactMarkdown>
                                </div>
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteImport(imp.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
