import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle, XCircle,
  ArrowRight, AlertTriangle, Play, Eye, RotateCcw
} from "lucide-react";

// ─── Target table schemas for column mapping ───
const TARGET_TABLES: Record<string, { label: string; columns: { key: string; label: string; required?: boolean }[] }> = {
  leads: {
    label: "Leads (CRM)",
    columns: [
      { key: "nome", label: "Nome", required: true },
      { key: "email", label: "E-mail" },
      { key: "telefone", label: "Telefone" },
      { key: "empresa", label: "Empresa" },
      { key: "origem", label: "Origem" },
      { key: "status", label: "Status" },
      { key: "valor_estimado", label: "Valor Estimado" },
      { key: "notas", label: "Notas" },
    ],
  },
  inventory: {
    label: "Estoque (Inventory)",
    columns: [
      { key: "name", label: "Nome do Produto", required: true },
      { key: "sku", label: "SKU" },
      { key: "category", label: "Categoria" },
      { key: "current_quantity", label: "Quantidade Atual" },
      { key: "min_quantity", label: "Quantidade Mínima" },
      { key: "cost_per_unit", label: "Custo Unitário" },
      { key: "supplier", label: "Fornecedor" },
      { key: "location", label: "Localização" },
      { key: "unit", label: "Unidade" },
      { key: "notes", label: "Observações" },
    ],
  },
  installed_equipment: {
    label: "Equipamentos Instalados",
    columns: [
      { key: "nome", label: "Nome", required: true },
      { key: "cliente", label: "Cliente", required: true },
      { key: "modelo", label: "Modelo" },
      { key: "serial_number", label: "Nº de Série" },
      { key: "localizacao", label: "Localização" },
      { key: "status", label: "Status" },
      { key: "notas", label: "Notas" },
    ],
  },
  work_orders: {
    label: "Ordens de Serviço",
    columns: [
      { key: "cliente", label: "Cliente", required: true },
      { key: "equipamento", label: "Equipamento", required: true },
      { key: "descricao", label: "Descrição" },
      { key: "tipo_servico", label: "Tipo de Serviço" },
      { key: "urgencia", label: "Urgência" },
      { key: "status", label: "Status" },
      { key: "tecnico_responsavel", label: "Técnico Responsável" },
    ],
  },
  financial_records: {
    label: "Registros Financeiros",
    columns: [
      { key: "descricao", label: "Descrição", required: true },
      { key: "valor", label: "Valor", required: true },
      { key: "tipo", label: "Tipo (receita/despesa)" },
      { key: "categoria", label: "Categoria" },
      { key: "cliente", label: "Cliente" },
      { key: "data_vencimento", label: "Data de Vencimento" },
      { key: "status", label: "Status" },
      { key: "referencia", label: "Referência" },
    ],
  },
};

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "done";

interface DryRunResult {
  total: number;
  valid: number;
  errors: { row: number; field: string; message: string }[];
  cleaned: { row: number; field: string; original: string; cleaned: string }[];
  duplicates: { row: number; field: string; value: string }[];
  preview_rows: Record<string, any>[];
}

function parseCSVContent(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ""));
  const rows = lines.slice(1).map(l => l.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, "")));
  return { headers, rows };
}

async function readUploadedFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const text = await file.text();
  return parseCSVContent(text);
}

export default function DataImporter() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<string[][]>([]);
  const [targetTable, setTargetTable] = useState<string>("");
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; errors: number } | null>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["csv", "txt", "tsv"].includes(ext || "")) {
      toast.error("Formato não suportado. Envie um arquivo CSV.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 10MB).");
      return;
    }

    try {
      const { headers, rows } = await readUploadedFile(f);
      if (headers.length === 0) {
        toast.error("Arquivo vazio ou sem cabeçalhos.");
        return;
      }
      setFile(f);
      setFileHeaders(headers);
      setFileRows(rows);
      setColumnMap({});
      setStep("mapping");
      toast.success(`${rows.length} registros detectados.`);
    } catch {
      toast.error("Erro ao ler o arquivo.");
    }
  }, []);

  const handleMapColumn = (fileCol: string, targetCol: string) => {
    setColumnMap(prev => {
      const next = { ...prev };
      if (targetCol === "__ignore__") {
        delete next[fileCol];
      } else {
        next[fileCol] = targetCol;
      }
      return next;
    });
  };

  const runDryRun = async () => {
    if (!user || !targetTable) return;
    setLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const resp = await supabase.functions.invoke("openclaw-data-sync", {
        body: {
          action: "etl_dry_run",
          target_table: targetTable,
          column_map: columnMap,
          headers: fileHeaders,
          rows: fileRows.slice(0, 500), // limit to 500 for dry run
          user_id: user.id,
        },
      });

      if (resp.error) throw new Error(resp.error.message);
      setDryRunResult(resp.data as DryRunResult);
      setStep("preview");
    } catch (err: any) {
      toast.error(err.message || "Erro na simulação.");
    } finally {
      setLoading(false);
    }
  };

  const executeImport = async () => {
    if (!user || !targetTable) return;
    setLoading(true);
    setStep("importing");
    try {
      const resp = await supabase.functions.invoke("openclaw-data-sync", {
        body: {
          action: "etl_execute",
          target_table: targetTable,
          column_map: columnMap,
          headers: fileHeaders,
          rows: fileRows,
          user_id: user.id,
        },
      });

      if (resp.error) throw new Error(resp.error.message);
      setImportResult(resp.data as { inserted: number; errors: number });
      setStep("done");
      toast.success("Importação concluída!");
    } catch (err: any) {
      toast.error(err.message || "Erro na importação.");
      setStep("preview");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setFile(null);
    setFileHeaders([]);
    setFileRows([]);
    setTargetTable("");
    setColumnMap({});
    setDryRunResult(null);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const targetSchema = TARGET_TABLES[targetTable];
  const mappedRequiredFields = targetSchema?.columns
    .filter(c => c.required)
    .every(c => Object.values(columnMap).includes(c.key));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importação Inteligente (ETL)</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Importe dados de planilhas externas com validação automática e limpeza por IA.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["upload", "mapping", "preview", "done"] as const).map((s, i) => {
          const labels = { upload: "Upload", mapping: "Mapeamento", preview: "Simulação", done: "Concluído" };
          const active = step === s || (step === "importing" && s === "preview");
          const completed = (["upload", "mapping", "preview", "done"] as const).indexOf(step === "importing" ? "preview" : step) > i;
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
              <Badge variant={active ? "default" : completed ? "secondary" : "outline"} className="text-xs">
                {completed && <CheckCircle className="w-3 h-3 mr-1" />}
                {labels[s]}
              </Badge>
            </div>
          );
        })}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card className="border-dashed border-2 border-muted-foreground/20 hover:border-primary/40 transition-colors">
          <label className="flex flex-col items-center justify-center gap-4 p-10 cursor-pointer">
            <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={handleFileSelect} />
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium">Arraste ou clique para enviar</p>
              <p className="text-xs text-muted-foreground mt-1">CSV, TXT, TSV — até 10MB</p>
            </div>
          </label>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === "mapping" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                {file?.name}
              </CardTitle>
              <CardDescription>
                {fileRows.length} registros · {fileHeaders.length} colunas detectadas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Target table selector */}
              <div>
                <label className="text-sm font-medium mb-2 block">Tabela de destino</label>
                <Select value={targetTable} onValueChange={v => { setTargetTable(v); setColumnMap({}); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione o módulo de destino" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TARGET_TABLES).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Column mapping */}
              {targetTable && targetSchema && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-3">Mapeamento de colunas</h4>
                    <div className="space-y-2">
                      {fileHeaders.map(header => (
                        <div key={header} className="flex items-center gap-3">
                          <div className="w-1/3">
                            <Badge variant="outline" className="text-xs font-mono truncate max-w-full">
                              {header}
                            </Badge>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="flex-1">
                            <Select
                              value={columnMap[header] || "__ignore__"}
                              onValueChange={v => handleMapColumn(header, v)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__ignore__">
                                  <span className="text-muted-foreground">— Ignorar —</span>
                                </SelectItem>
                                {targetSchema.columns.map(col => (
                                  <SelectItem key={col.key} value={col.key}>
                                    {col.label} {col.required && <span className="text-destructive">*</span>}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Preview of first 3 rows */}
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-2">Prévia dos dados (3 primeiros)</h4>
                    <ScrollArea className="max-h-40">
                      <div className="text-xs font-mono space-y-1">
                        {fileRows.slice(0, 3).map((row, ri) => (
                          <div key={ri} className="p-2 rounded bg-muted/50">
                            {Object.entries(columnMap).map(([fileCol, targetCol]) => {
                              const idx = fileHeaders.indexOf(fileCol);
                              return (
                                <span key={fileCol} className="mr-3">
                                  <span className="text-muted-foreground">{targetCol}:</span> {row[idx] || "—"}
                                </span>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={reset}>Cancelar</Button>
                    <Button
                      onClick={runDryRun}
                      disabled={loading || !mappedRequiredFields || Object.keys(columnMap).length === 0}
                    >
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                      Simular (Dry Run)
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Dry Run Preview */}
      {step === "preview" && dryRunResult && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold">{dryRunResult.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{dryRunResult.valid}</p>
              <p className="text-xs text-muted-foreground">Válidos</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-destructive">{dryRunResult.errors.length}</p>
              <p className="text-xs text-muted-foreground">Erros</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-500">{dryRunResult.duplicates.length}</p>
              <p className="text-xs text-muted-foreground">Duplicados</p>
            </Card>
          </div>

          {/* Cleaned fields */}
          {dryRunResult.cleaned.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Dados limpos pela IA ({dryRunResult.cleaned.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-40">
                  <div className="space-y-1 text-xs">
                    {dryRunResult.cleaned.slice(0, 20).map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">Linha {c.row}</Badge>
                        <span className="text-muted-foreground">{c.field}:</span>
                        <span className="line-through text-destructive">{c.original}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="text-green-600 font-medium">{c.cleaned}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Errors */}
          {dryRunResult.errors.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                  <XCircle className="w-4 h-4" />
                  Erros encontrados ({dryRunResult.errors.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-40">
                  <div className="space-y-1 text-xs">
                    {dryRunResult.errors.slice(0, 20).map((e, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-[10px]">Linha {e.row}</Badge>
                        <span className="text-muted-foreground">{e.field}:</span>
                        <span>{e.message}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Duplicates */}
          {dryRunResult.duplicates.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-500">
                  <AlertTriangle className="w-4 h-4" />
                  Duplicados ({dryRunResult.duplicates.length}) — serão ignorados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-32">
                  <div className="space-y-1 text-xs">
                    {dryRunResult.duplicates.slice(0, 10).map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">Linha {d.row}</Badge>
                        <span className="text-muted-foreground">{d.field}:</span>
                        <span>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setStep("mapping")}>
              <RotateCcw className="w-4 h-4 mr-2" /> Voltar
            </Button>
            <Button onClick={executeImport} disabled={loading || dryRunResult.valid === 0}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Importar {dryRunResult.valid} registros
            </Button>
          </div>
        </div>
      )}

      {/* Step: Importing */}
      {step === "importing" && (
        <Card className="p-10">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="font-medium">Importando dados com validação...</p>
            <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos.</p>
          </div>
        </Card>
      )}

      {/* Step: Done */}
      {step === "done" && importResult && (
        <Card className="p-10">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold">Importação Concluída</h3>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-medium text-green-600">{importResult.inserted}</span> registros inseridos
                {importResult.errors > 0 && (
                  <> · <span className="font-medium text-destructive">{importResult.errors}</span> erros</>
                )}
              </p>
            </div>
            <Button onClick={reset} variant="outline">
              <RotateCcw className="w-4 h-4 mr-2" /> Nova Importação
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
