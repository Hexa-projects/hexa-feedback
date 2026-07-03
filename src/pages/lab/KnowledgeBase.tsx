import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, FileText, Search, FolderOpen, Loader2, Lock, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";

const BRANDS = ["AGFA", "Canon", "Esaote", "Fujifilm", "GE", "HexaMedical", "Philips", "Siemens"];
const DOC_TYPES = [
  "Manual do Usuário",
  "Guia de Instalação",
  "Manual de Serviço",
  "Nota Técnica",
  "Formulário de Calibração",
  "Site Planning Guide",
  "Outro",
];

export default function KnowledgeBase() {
  const { user, profile, role } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [docTypeFilter, setDocTypeFilter] = useState<string>("all");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("aprovados");

  // upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadBrand, setUploadBrand] = useState<string>("");
  const [uploadDocType, setUploadDocType] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // pending item edits
  const [titleEdits, setTitleEdits] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  // reject dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const setor = (profile as any)?.setor;
  const isApprover =
    role === "admin" || !!(profile as any)?.aprovador_base_conhecimento;
  const hasAccess =
    role === "admin" ||
    role === "gestor" ||
    setor === "Técnico" ||
    setor === "Laboratório";

  const loadAll = async () => {
    const approved = await (supabase as any)
      .from("knowledge_chunks")
      .select("*")
      .eq("status", "aprovado")
      .order("created_at", { ascending: false })
      .limit(100);
    setFiles(approved.data || []);
    if (isApprover) {
      const pend = await (supabase as any)
        .from("knowledge_chunks")
        .select("*")
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(100);
      setPending(pend.data || []);
    }
  };

  useEffect(() => {
    if (!user || !hasAccess) {
      setLoading(false);
      return;
    }
    (async () => {
      await loadAll();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, hasAccess, isApprover]);

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "jpg", "jpeg", "png", "webp"].includes(ext || "")) {
      toast.error("Formato não suportado. Use PDF ou imagem.");
      e.target.value = "";
      return;
    }
    setPendingFile(file);
    setUploadBrand("");
    setUploadDocType("");
    setUploadOpen(true);
    e.target.value = "";
  };

  const handleConfirmUpload = async () => {
    if (!pendingFile || !user) return;
    if (!uploadBrand || !uploadDocType) {
      toast.error("Selecione fabricante e tipo de documento.");
      return;
    }
    setUploading(true);
    const file = pendingFile;
    const ext = file.name.split(".").pop()?.toLowerCase();
    const filePath = `knowledge/${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("attachments").upload(filePath, file);
    if (uploadErr) {
      toast.error("Erro no upload: " + uploadErr.message);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(filePath);
    const { error: insertErr } = await (supabase as any).from("knowledge_chunks").insert({
      title: file.name,
      content: `Arquivo: ${file.name}`,
      source_file: file.name,
      source_url: urlData.publicUrl,
      doc_type: uploadDocType,
      equipment_brand: uploadBrand,
      uploaded_by: user.id,
      tags: [ext || "file"],
      status: "pendente",
    });
    if (insertErr) {
      toast.error("Erro ao registrar: " + insertErr.message);
    } else {
      toast.success("Arquivo enviado. Aguardando aprovação.");
      await loadAll();
      setUploadOpen(false);
      setPendingFile(null);
    }
    setUploading(false);
  };

  const handleApprove = async (item: any) => {
    if (!user) return;
    setBusyId(item.id);
    const newTitle = titleEdits[item.id] ?? item.title;
    const { error } = await (supabase as any)
      .from("knowledge_chunks")
      .update({
        title: newTitle,
        status: "aprovado",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq("id", item.id);
    setBusyId(null);
    if (error) {
      toast.error("Falha ao aprovar: " + error.message);
      return;
    }
    toast.success("Documento aprovado");
    await loadAll();
  };

  const openReject = (item: any) => {
    setRejectTarget(item);
    setRejectReason("");
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectTarget || !user) return;
    if (!rejectReason.trim()) {
      toast.error("Informe o motivo da reprovação.");
      return;
    }
    setBusyId(rejectTarget.id);
    const newTitle = titleEdits[rejectTarget.id] ?? rejectTarget.title;
    const { error } = await (supabase as any)
      .from("knowledge_chunks")
      .update({
        title: newTitle,
        status: "reprovado",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectReason.trim(),
      })
      .eq("id", rejectTarget.id);
    setBusyId(null);
    if (error) {
      toast.error("Falha ao reprovar: " + error.message);
      return;
    }
    toast.success("Documento reprovado");
    setRejectOpen(false);
    setRejectTarget(null);
    await loadAll();
  };

  const filtered = files.filter(f => {
    const s = search.toLowerCase();
    const matchesSearch =
      !s ||
      f.title?.toLowerCase().includes(s) ||
      f.equipment_model?.toLowerCase().includes(s) ||
      f.equipment_brand?.toLowerCase().includes(s);
    const matchesBrand = brandFilter === "all" || f.equipment_brand === brandFilter;
    const matchesDoc = docTypeFilter === "all" || f.doc_type === docTypeFilter;
    return matchesSearch && matchesBrand && matchesDoc;
  });

  if (!hasAccess) {
    return (
      <HexaLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Lock className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-lg font-medium">Você não tem permissão para acessar esta área</p>
            <p className="text-sm text-muted-foreground">
              Fale com um administrador se precisar de acesso.
            </p>
          </div>
        </div>
      </HexaLayout>
    );
  }

  const filtersBar = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative max-w-sm flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar documento..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <Select value={brandFilter} onValueChange={setBrandFilter}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Fabricante" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os fabricantes</SelectItem>
          {BRANDS.map(b => (
            <SelectItem key={b} value={b}>{b}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Tipo de documento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os tipos</SelectItem>
          {DOC_TYPES.map(t => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const approvedList = loading ? (
    <p className="text-sm text-muted-foreground p-6">Carregando...</p>
  ) : filtered.length === 0 ? (
    <Card>
      <CardContent className="text-center py-12">
        <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Nenhum documento encontrado</p>
        <p className="text-xs text-muted-foreground mt-1">Faça upload de PDFs e imagens de manuais técnicos.</p>
      </CardContent>
    </Card>
  ) : (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {filtered.map(f => (
        <Card key={f.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{f.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {f.doc_type && <Badge variant="outline" className="text-[10px]">{f.doc_type}</Badge>}
                  {f.equipment_brand && <span className="text-[10px] text-muted-foreground">{f.equipment_brand}</span>}
                  {f.equipment_model && <span className="text-[10px] text-muted-foreground">{f.equipment_model}</span>}
                </div>
                {f.tags && f.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {f.tags.map((t: string) => (
                      <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {f.source_url && (
              <a href={f.source_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="w-full text-xs gap-1">
                  <FileText className="w-3 h-3" /> Abrir Documento
                </Button>
              </a>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const pendingList = (
    <div className="space-y-3">
      {pending.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10">
            <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum documento pendente de aprovação.</p>
          </CardContent>
        </Card>
      ) : (
        pending.map(item => {
          const currentTitle = titleEdits[item.id] ?? item.title ?? "";
          return (
            <Card key={item.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div>
                      <Label className="text-xs">Título do documento</Label>
                      <Input
                        value={currentTitle}
                        onChange={e => setTitleEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {item.doc_type && <Badge variant="outline" className="text-[10px]">{item.doc_type}</Badge>}
                      {item.equipment_brand && <span className="text-[10px] text-muted-foreground">{item.equipment_brand}</span>}
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                        Pendente
                      </Badge>
                    </div>
                    {item.source_url && (
                      <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline inline-flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Abrir arquivo enviado
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => openReject(item)}
                    disabled={busyId === item.id}
                  >
                    <X className="w-4 h-4 mr-1" /> Reprovar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(item)}
                    disabled={busyId === item.id}
                  >
                    {busyId === item.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                    Aprovar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FolderOpen className="w-6 h-6 text-primary" /> Base de Conhecimento
            </h1>
            <p className="text-sm text-muted-foreground">Manuais, diagramas elétricos e documentos técnicos</p>
          </div>
          <div>
            <Button size="sm" className="gap-1" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Enviando..." : "Upload"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={onFilePicked}
              disabled={uploading}
            />
          </div>
        </div>

        {isApprover ? (
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="aprovados">Aprovados</TabsTrigger>
              <TabsTrigger value="pendentes" className="gap-2">
                Pendentes de Aprovação
                {pending.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {pending.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="aprovados" className="space-y-4">
              {filtersBar}
              {approvedList}
            </TabsContent>
            <TabsContent value="pendentes" className="space-y-4">
              {pendingList}
            </TabsContent>
          </Tabs>
        ) : (
          <>
            {filtersBar}
            {approvedList}
          </>
        )}
      </div>

      <Dialog open={uploadOpen} onOpenChange={(o) => { if (!uploading) setUploadOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Classificar documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {pendingFile && (
              <p className="text-sm text-muted-foreground truncate">Arquivo: {pendingFile.name}</p>
            )}
            <div className="space-y-2">
              <Label>Fabricante</Label>
              <Select value={uploadBrand} onValueChange={setUploadBrand}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o fabricante" />
                </SelectTrigger>
                <SelectContent>
                  {BRANDS.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de documento</Label>
              <Select value={uploadDocType} onValueChange={setUploadDocType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              O documento ficará pendente até que um administrador ou aprovador designado o aprove.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmUpload} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {rejectTarget && (
              <p className="text-sm text-muted-foreground truncate">
                Documento: {titleEdits[rejectTarget.id] ?? rejectTarget.title}
              </p>
            )}
            <div className="space-y-2">
              <Label>Motivo da reprovação</Label>
              <Textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Explique por que este documento está sendo reprovado..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={busyId !== null}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmReject} disabled={busyId !== null}>
              {busyId !== null ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <X className="w-4 h-4 mr-1" />}
              Confirmar reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HexaLayout>
  );
}
