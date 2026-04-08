import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Search, FolderOpen, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function KnowledgeBase() {
  const { user } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load knowledge chunks that are "manual" docs
  useState(() => {
    if (!user) return;
    supabase
      .from("knowledge_chunks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setFiles(data || []);
        setLoading(false);
      });
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "jpg", "jpeg", "png", "webp"].includes(ext || "")) {
      toast.error("Formato não suportado. Use PDF ou imagem.");
      setUploading(false);
      return;
    }

    const filePath = `knowledge/${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("attachments").upload(filePath, file);
    if (uploadErr) {
      toast.error("Erro no upload: " + uploadErr.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(filePath);

    const { error: insertErr } = await supabase.from("knowledge_chunks").insert({
      title: file.name,
      content: `Arquivo: ${file.name}`,
      source_file: file.name,
      source_url: urlData.publicUrl,
      doc_type: ext === "pdf" ? "manual" : "diagram",
      uploaded_by: user.id,
      tags: [ext || "file"],
    } as any);

    if (insertErr) {
      toast.error("Erro ao registrar: " + insertErr.message);
    } else {
      toast.success("Arquivo enviado com sucesso!");
      const { data: newData } = await supabase
        .from("knowledge_chunks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setFiles(newData || []);
    }
    setUploading(false);
    e.target.value = "";
  };

  const filtered = files.filter(
    f =>
      f.title?.toLowerCase().includes(search.toLowerCase()) ||
      f.equipment_model?.toLowerCase().includes(search.toLowerCase()) ||
      f.equipment_brand?.toLowerCase().includes(search.toLowerCase())
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
            <label htmlFor="kb-upload">
              <Button size="sm" className="gap-1 cursor-pointer" asChild>
                <span>
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? "Enviando..." : "Upload"}
                </span>
              </Button>
            </label>
            <input id="kb-upload" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleUpload} disabled={uploading} />
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar documento..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
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
                      <div className="flex items-center gap-2 mt-1">
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
        )}
      </div>
    </HexaLayout>
  );
}
