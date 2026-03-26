import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, Clock,
  MapPin, Users, AlertTriangle, Check, Trash2, Edit2
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CalendarEvent {
  id: string;
  calendar_id: string;
  titulo: string;
  descricao: string;
  local: string;
  tipo: string;
  data_inicio: string;
  data_fim: string;
  dia_inteiro: boolean;
  status: string;
  prioridade: string;
  criado_por: string;
  created_at: string;
}

const EVENT_TYPES = [
  { value: "reuniao", label: "Reunião" },
  { value: "manutencao", label: "Manutenção" },
  { value: "visita", label: "Visita Técnica" },
  { value: "entrega", label: "Entrega" },
  { value: "lembrete", label: "Lembrete" },
  { value: "outro", label: "Outro" },
];

const TYPE_COLORS: Record<string, string> = {
  reuniao: "bg-blue-500",
  manutencao: "bg-amber-500",
  visita: "bg-green-500",
  entrega: "bg-purple-500",
  lembrete: "bg-pink-500",
  outro: "bg-muted-foreground",
};

export default function CalendarPage() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calendarId, setCalendarId] = useState<string | null>(null);

  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    local: "",
    tipo: "reuniao",
    data_inicio: "",
    hora_inicio: "09:00",
    data_fim: "",
    hora_fim: "10:00",
    dia_inteiro: false,
    prioridade: "media",
  });

  useEffect(() => {
    if (user) initCalendar();
  }, [user]);

  useEffect(() => {
    if (calendarId) loadEvents();
  }, [calendarId, currentMonth]);

  const initCalendar = async () => {
    // Get or create default calendar
    const { data: cals } = await supabase
      .from("hex_calendars")
      .select("id")
      .eq("owner_id", user!.id)
      .eq("tipo", "pessoal")
      .limit(1);

    if (cals && cals.length > 0) {
      setCalendarId(cals[0].id);
    } else {
      const { data: newCal } = await supabase
        .from("hex_calendars")
        .insert({ nome: "Meu Calendário", owner_id: user!.id, tipo: "pessoal" })
        .select("id")
        .single();
      if (newCal) setCalendarId(newCal.id);
    }
  };

  const loadEvents = async () => {
    setLoading(true);
    const start = startOfMonth(currentMonth).toISOString();
    const end = endOfMonth(currentMonth).toISOString();

    const { data } = await supabase
      .from("hex_calendar_events")
      .select("*")
      .gte("data_inicio", start)
      .lte("data_inicio", end)
      .order("data_inicio");

    setEvents((data as CalendarEvent[]) || []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!form.titulo || !form.data_inicio) {
      toast.error("Título e data de início são obrigatórios");
      return;
    }

    const dataInicio = form.dia_inteiro
      ? `${form.data_inicio}T00:00:00`
      : `${form.data_inicio}T${form.hora_inicio}:00`;
    const dataFim = form.dia_inteiro
      ? `${form.data_fim || form.data_inicio}T23:59:59`
      : `${form.data_fim || form.data_inicio}T${form.hora_fim}:00`;

    const { error } = await supabase.from("hex_calendar_events").insert({
      calendar_id: calendarId!,
      titulo: form.titulo,
      descricao: form.descricao,
      local: form.local,
      tipo: form.tipo,
      data_inicio: dataInicio,
      data_fim: dataFim,
      dia_inteiro: form.dia_inteiro,
      prioridade: form.prioridade,
      criado_por: user!.id,
    });

    if (error) {
      toast.error("Erro ao criar evento");
      return;
    }

    toast.success("Evento criado!");
    setShowForm(false);
    setForm({ titulo: "", descricao: "", local: "", tipo: "reuniao", data_inicio: "", hora_inicio: "09:00", data_fim: "", hora_fim: "10:00", dia_inteiro: false, prioridade: "media" });
    loadEvents();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("hex_calendar_events").delete().eq("id", id);
    toast.success("Evento removido");
    loadEvents();
  };

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const getEventsForDay = (day: Date) =>
    events.filter(e => isSameDay(parseISO(e.data_inicio), day));

  const daySelected = selectedDate ? getEventsForDay(selectedDate) : [];

  return (
    <HexaLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-primary" /> Calendário
            </h1>
            <p className="text-muted-foreground text-sm">Gerencie agendas, manutenções e visitas técnicas.</p>
          </div>

          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Novo Evento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Criar Evento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Título *</Label>
                  <Input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Manutenção preventiva" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Prioridade</Label>
                    <Select value={form.prioridade} onValueChange={v => setForm(p => ({ ...p, prioridade: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="critica">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.dia_inteiro} onCheckedChange={v => setForm(p => ({ ...p, dia_inteiro: v }))} />
                  <Label>Dia inteiro</Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Data Início *</Label>
                    <Input type="date" value={form.data_inicio} onChange={e => setForm(p => ({ ...p, data_inicio: e.target.value, data_fim: p.data_fim || e.target.value }))} />
                  </div>
                  {!form.dia_inteiro && (
                    <div className="space-y-1">
                      <Label>Hora Início</Label>
                      <Input type="time" value={form.hora_inicio} onChange={e => setForm(p => ({ ...p, hora_inicio: e.target.value }))} />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label>Data Fim</Label>
                    <Input type="date" value={form.data_fim} onChange={e => setForm(p => ({ ...p, data_fim: e.target.value }))} />
                  </div>
                  {!form.dia_inteiro && (
                    <div className="space-y-1">
                      <Label>Hora Fim</Label>
                      <Input type="time" value={form.hora_fim} onChange={e => setForm(p => ({ ...p, hora_fim: e.target.value }))} />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Local</Label>
                  <Input value={form.local} onChange={e => setForm(p => ({ ...p, local: e.target.value }))} placeholder="Ex: Sala 3, Cliente ABC" />
                </div>
                <div className="space-y-1">
                  <Label>Descrição</Label>
                  <Textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} rows={3} />
                </div>
                <Button onClick={handleSubmit} className="w-full gap-2"><Check className="w-4 h-4" /> Criar Evento</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <CardTitle className="text-lg capitalize">
                  {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-px mb-1">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                ))}
              </div>
              {/* Days */}
              <div className="grid grid-cols-7 gap-px">
                {days.map(day => {
                  const dayEvents = getEventsForDay(day);
                  const isToday = isSameDay(day, new Date());
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={`
                        min-h-[72px] p-1 border rounded-md text-left transition-colors
                        ${isCurrentMonth ? "bg-background" : "bg-muted/30 text-muted-foreground"}
                        ${isToday ? "border-primary" : "border-border/50"}
                        ${isSelected ? "ring-2 ring-primary/50" : ""}
                        hover:bg-accent/50
                      `}
                    >
                      <span className={`text-xs font-medium ${isToday ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center" : ""}`}>
                        {format(day, "d")}
                      </span>
                      <div className="space-y-0.5 mt-0.5">
                        {dayEvents.slice(0, 3).map(ev => (
                          <div key={ev.id} className={`text-[10px] truncate rounded px-1 text-white ${TYPE_COLORS[ev.tipo] || TYPE_COLORS.outro}`}>
                            {ev.titulo}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} mais</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Sidebar - selected day events */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {selectedDate
                  ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR })
                  : "Selecione um dia"}
              </CardTitle>
              <CardDescription>
                {selectedDate ? `${daySelected.length} evento(s)` : "Clique em um dia no calendário"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!selectedDate && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum dia selecionado</p>
              )}
              {selectedDate && daySelected.length === 0 && (
                <div className="text-center py-8">
                  <CalendarIcon className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum evento neste dia</p>
                  <Button size="sm" variant="outline" className="mt-3 gap-1" onClick={() => {
                    setForm(p => ({ ...p, data_inicio: format(selectedDate, "yyyy-MM-dd"), data_fim: format(selectedDate, "yyyy-MM-dd") }));
                    setShowForm(true);
                  }}>
                    <Plus className="w-3 h-3" /> Criar
                  </Button>
                </div>
              )}
              {daySelected.map(ev => (
                <Card key={ev.id} className="border">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${TYPE_COLORS[ev.tipo] || TYPE_COLORS.outro}`} />
                        <span className="font-medium text-sm">{ev.titulo}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(ev.id)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {ev.dia_inteiro ? "Dia inteiro" : `${format(parseISO(ev.data_inicio), "HH:mm")} - ${format(parseISO(ev.data_fim), "HH:mm")}`}
                      </span>
                      {ev.local && (
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.local}</span>
                      )}
                    </div>
                    {ev.descricao && <p className="text-xs text-muted-foreground">{ev.descricao}</p>}
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        {EVENT_TYPES.find(t => t.value === ev.tipo)?.label || ev.tipo}
                      </Badge>
                      {ev.prioridade === "alta" || ev.prioridade === "critica" ? (
                        <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive">
                          {ev.prioridade === "critica" ? "⚠ Crítica" : "Alta"}
                        </Badge>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </HexaLayout>
  );
}
