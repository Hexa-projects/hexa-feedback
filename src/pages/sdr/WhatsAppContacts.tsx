import { useEffect, useState, useMemo } from 'react';
import { Search, Filter, MessageSquare, Loader2, Mail, Phone, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { sdrApi } from '@/services/sdr-api';
import { DBContact } from '@/types/sdr';
import HexaLayout from '@/components/HexaLayout';

export default function WhatsAppContacts() {
  const [contacts, setContacts] = useState<DBContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    sdrApi.fetchContacts().then(data => {
      setContacts(data as unknown as DBContact[]);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    let result = contacts.filter(c => {
      const q = searchTerm.toLowerCase();
      return (c.name?.toLowerCase() || '').includes(q) || c.phone_number.includes(q) || (c.email?.toLowerCase() || '').includes(q);
    });
    if (statusFilter !== 'all') {
      const stage = statusFilter;
      result = result.filter(c => {
        const mem = c.client_memory as any;
        return mem?.lead_profile?.lead_stage === stage;
      });
    }
    return result.sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime());
  }, [contacts, searchTerm, statusFilter]);

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    if (score >= 40) return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    return 'bg-muted text-muted-foreground border-border';
  };

  return (
    <HexaLayout>
      <div className="p-6 h-full overflow-y-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Contatos WhatsApp</h2>
            <p className="text-sm text-muted-foreground mt-1">Base de leads e clientes com inteligência de vendas.</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6 bg-card p-2 rounded-xl border border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-background border border-border text-sm focus:ring-2 focus:ring-primary/50 outline-none"
            />
          </div>
          <Button variant={showFilters ? 'default' : 'outline'} onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-2" /> Filtros
          </Button>
        </div>

        {showFilters && (
          <div className="bg-card border border-border rounded-xl p-4 mb-6 flex items-center gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Estágio</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm focus:ring-2 focus:ring-primary/50"
              >
                <option value="all">Todos</option>
                <option value="new">Novo</option>
                <option value="qualified">Qualificado</option>
                <option value="proposal">Proposta</option>
                <option value="negotiation">Negociação</option>
              </select>
            </div>
            <button onClick={() => setStatusFilter('all')} className="text-xs text-primary hover:underline flex items-center gap-1 mt-4">
              <X className="w-3 h-3" /> Limpar
            </button>
          </div>
        )}

        <p className="text-xs text-muted-foreground mb-4">{filtered.length} contato{filtered.length !== 1 ? 's' : ''}</p>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <span className="text-sm text-muted-foreground">Carregando contatos...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Users className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum contato encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 text-left">Nome / Telefone</th>
                    <th className="px-6 py-3 text-left">Score</th>
                    <th className="px-6 py-3 text-left">Empresa</th>
                    <th className="px-6 py-3 text-left">Tags</th>
                    <th className="px-6 py-3 text-left">Última Atividade</th>
                    <th className="px-6 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(contact => {
                    const mem = contact.client_memory as any;
                    const score = mem?.lead_profile?.qualification_score || 0;
                    return (
                      <tr key={contact.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                              {(contact.name || contact.phone_number).substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{contact.name || 'Sem nome'}</p>
                              <p className="text-xs text-muted-foreground">{contact.phone_number}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {score > 0 && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${getScoreColor(score)}`}>
                              {score}%
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{contact.empresa || '—'}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {(contact.tags || []).slice(0, 3).map(tag => (
                              <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {new Date(contact.last_activity).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => navigate('/sdr/chat')}
                          >
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </HexaLayout>
  );
}
