import { useEffect, useMemo, useState } from "react";
import { BookOpen, Plus, Search } from "lucide-react";
import HexaLayout from "@/components/HexaLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const emptyForm = { manufacturer: "", model: "", modality: "", dimensions: "", weight_kg: "", electrical_requirements: "", installation_requirements: "", accessories: "", coils: "", technical_notes: "", infrastructure: "", image_urls: "", commercial_material_urls: "" };

export default function EquipmentLibrary() {
  const { user, role } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const { data, error } = await (supabase as any).from("equipment_library").select("*").order("manufacturer");
    if (error) toast.error("Não foi possível carregar a biblioteca", { description: error.message });
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => items.filter(item => [item.manufacturer, item.model, item.modality, item.technical_notes].some(value => String(value || "").toLowerCase().includes(query.toLowerCase()))), [items, query]);

  const save = async () => {
    if (!form.manufacturer.trim() || !form.model.trim() || !user) return toast.error("Fabricante e modelo são obrigatórios.");
    const { error } = await (supabase as any).from("equipment_library").insert({
      ...form,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      accessories: form.accessories.split(",").map(v => v.trim()).filter(Boolean),
      coils: form.coils.split(",").map(v => v.trim()).filter(Boolean),
      infrastructure: { summary: form.infrastructure },
      image_urls: form.image_urls.split(",").map(v => v.trim()).filter(Boolean),
      commercial_material_urls: form.commercial_material_urls.split(",").map(v => v.trim()).filter(Boolean),
      created_by: user.id,
    });
    if (error) return toast.error(error.message);
    setForm(emptyForm); setOpen(false); load(); toast.success("Equipamento adicionado à biblioteca.");
  };

  return <HexaLayout><div className="space-y-4 pb-8">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="w-6 h-6 text-primary" /> Biblioteca de Equipamentos</h1><p className="text-sm text-muted-foreground">Ficha única para consulta comercial, técnica e de implantação.</p></div>
      {(role === "admin" || role === "gestor") && <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Novo equipamento</Button></DialogTrigger><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Ficha do equipamento</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2">
        <Field label="Fabricante *"><Input value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} /></Field><Field label="Modelo *"><Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} /></Field>
        <Field label="Modalidade"><Input value={form.modality} onChange={e => setForm({ ...form, modality: e.target.value })} /></Field><Field label="Dimensões"><Input value={form.dimensions} onChange={e => setForm({ ...form, dimensions: e.target.value })} /></Field>
        <Field label="Peso (kg)"><Input type="number" value={form.weight_kg} onChange={e => setForm({ ...form, weight_kg: e.target.value })} /></Field><Field label="Bobinas, separadas por vírgula"><Input value={form.coils} onChange={e => setForm({ ...form, coils: e.target.value })} /></Field>
        <Field label="Requisitos elétricos"><Textarea value={form.electrical_requirements} onChange={e => setForm({ ...form, electrical_requirements: e.target.value })} /></Field><Field label="Requisitos de instalação"><Textarea value={form.installation_requirements} onChange={e => setForm({ ...form, installation_requirements: e.target.value })} /></Field>
        <Field label="Acessórios, separados por vírgula"><Textarea value={form.accessories} onChange={e => setForm({ ...form, accessories: e.target.value })} /></Field><Field label="Observações técnicas"><Textarea value={form.technical_notes} onChange={e => setForm({ ...form, technical_notes: e.target.value })} /></Field>
        <Field label="Infraestrutura"><Textarea value={form.infrastructure} onChange={e => setForm({ ...form, infrastructure: e.target.value })} /></Field><Field label="URLs de imagens, separadas por vírgula"><Textarea value={form.image_urls} onChange={e => setForm({ ...form, image_urls: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label="URLs de materiais comerciais, separadas por vírgula"><Textarea value={form.commercial_material_urls} onChange={e => setForm({ ...form, commercial_material_urls: e.target.value })} /></Field></div>
      </div><Button onClick={save}>Salvar ficha</Button></DialogContent></Dialog>}
    </header>
    <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar fabricante, modelo ou modalidade" value={query} onChange={e => setQuery(e.target.value)} /></div>
    {filtered.length === 0 ? <div className="border border-dashed p-10 text-center text-sm text-muted-foreground">Nenhum equipamento encontrado.</div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map(item => <Card key={item.id}><CardContent className="p-4 space-y-3"><div><div className="flex items-start justify-between gap-2"><h2 className="font-semibold">{item.manufacturer} {item.model}</h2>{item.modality && <Badge variant="secondary">{item.modality}</Badge>}</div><p className="text-xs text-muted-foreground mt-1">{item.dimensions || "Dimensões não informadas"}{item.weight_kg ? ` · ${item.weight_kg} kg` : ""}</p></div>
      <Info label="Infraestrutura" value={item.infrastructure?.summary || item.installation_requirements} /><Info label="Elétrica" value={item.electrical_requirements} /><Info label="Bobinas" value={item.coils?.join(", ")} /><Info label="Acessórios" value={item.accessories?.join(", ")} />{item.commercial_material_urls?.length > 0 && <div className="flex flex-wrap gap-2">{item.commercial_material_urls.map((url: string) => <a key={url} href={url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Material comercial</a>)}</div>}
    </CardContent></Card>)}</div>}
  </div></HexaLayout>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1"><Label>{label}</Label>{children}</div>; }
function Info({ label, value }: { label: string; value?: string }) { return value ? <div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="text-sm mt-0.5">{value}</p></div> : null; }
