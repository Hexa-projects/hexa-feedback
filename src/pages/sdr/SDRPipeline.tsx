import { useEffect, useState, useRef } from 'react';
import { Plus, Search, MoreHorizontal, DollarSign, Loader2, Tag, Bot, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sdrApi } from '@/services/sdr-api';
import { Deal, KanbanColumn } from '@/types/sdr';
import { supabase } from '@/integrations/supabase/client';
import HexaLayout from '@/components/HexaLayout';
import { toast } from 'sonner';

export default function SDRPipeline() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const dragItem = useRef<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, d] = await Promise.all([sdrApi.fetchPipelineStages(), sdrApi.fetchDeals()]);
        setStages(s);
        setDeals(d);
      } finally {
        setLoading(false);
      }
    };
    load();

    const ch = supabase
      .channel('deals-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, async () => {
        const d = await sdrApi.fetchDeals();
        setDeals(d);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const onDragStart = (e: React.DragEvent, dealId: string) => {
    dragItem.current = dealId;
    e.dataTransfer.effectAllowed = 'move';
    (e.target as HTMLElement).style.opacity = '0.5';
  };
  const onDragEnd = (e: React.DragEvent) => {
    dragItem.current = null;
    (e.target as HTMLElement).style.opacity = '1';
  };
  const onDrop = async (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    const dealId = dragItem.current;
    if (!dealId) return;
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stageId: targetStageId } : d));
    try {
      await sdrApi.moveDealStage(dealId, targetStageId);
    } catch {
      const d = await sdrApi.fetchDeals();
      setDeals(d);
    }
  };

  const filteredDeals = deals.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'high': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'medium': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      default: return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    }
  };

  if (loading) {
    return (
      <HexaLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </HexaLayout>
    );
  }

  return (
    <HexaLayout>
      <div className="h-full flex flex-col p-6 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Pipeline de Vendas</h2>
            <p className="text-sm text-muted-foreground mt-1">Gerencie oportunidades e acompanhe o fluxo de receita.</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar deal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <Button onClick={async () => {
              const firstStage = stages[0];
              if (!firstStage) return;
              try {
                await sdrApi.createDeal({ title: 'Novo Deal', stageId: firstStage.id });
                toast.success('Deal criado');
                const d = await sdrApi.fetchDeals();
                setDeals(d);
              } catch {
                toast.error('Erro ao criar deal');
              }
            }}>
              <Plus className="w-4 h-4 mr-2" /> Novo Deal
            </Button>
          </div>
        </div>

        {/* Board */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
          <div className="flex h-full gap-4 min-w-max">
            {stages.map(col => {
              const columnDeals = filteredDeals.filter(d => d.stageId === col.id);
              const totalValue = columnDeals.reduce((a, c) => a + c.value, 0);
              const isWon = col.title === 'Ganho';
              const isLost = col.title === 'Perdido';

              return (
                <div
                  key={col.id}
                  className={`w-72 flex flex-col h-full rounded-xl border backdrop-blur-sm ${
                    isWon ? 'bg-emerald-50/50 border-emerald-200' :
                    isLost ? 'bg-destructive/5 border-destructive/20' :
                    'bg-muted/30 border-border'
                  }`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDrop(e, col.id)}
                >
                  {/* Column Header */}
                  <div className={`p-3 border-b rounded-t-xl ${
                    isWon ? 'bg-emerald-100/50 border-emerald-200 border-t-4 border-t-emerald-500' :
                    isLost ? 'bg-destructive/10 border-destructive/20 border-t-4 border-t-destructive' :
                    `border-border border-t-2 ${col.color}`
                  }`}>
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 text-foreground">
                        {col.isAiManaged && <Bot className="w-3 h-3 text-primary" />}
                        {col.title}
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-muted text-muted-foreground">
                        {columnDeals.length}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-medium mt-1">
                      Total: <span className="text-foreground">{formatCurrency(totalValue)}</span>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {columnDeals.map(deal => (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, deal.id)}
                        onDragEnd={onDragEnd}
                        className="bg-card border border-border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/50 transition-all group"
                      >
                        <div className="flex justify-between items-start mb-1.5">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${getPriorityColor(deal.priority)}`}>
                            {deal.priority === 'high' ? 'Alta' : deal.priority === 'medium' ? 'Média' : 'Baixa'}
                          </span>
                          {(deal.qualificationScore ?? 0) > 0 && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold border ${
                              (deal.qualificationScore ?? 0) >= 70 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                              (deal.qualificationScore ?? 0) >= 40 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                              'bg-muted text-muted-foreground border-border'
                            }`}>
                              {deal.qualificationScore}%
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-foreground text-sm mb-0.5">{deal.title}</h4>
                        <p className="text-[10px] text-muted-foreground mb-2">{deal.company}</p>
                        {deal.tags.length > 0 && (
                          <div className="flex items-center gap-1 mb-2 flex-wrap">
                            {deal.tags.map(tag => (
                              <span key={tag} className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Tag className="w-2.5 h-2.5" /> {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1">
                            <DollarSign className="w-3 h-3" /> {formatCurrency(deal.value)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </HexaLayout>
  );
}
