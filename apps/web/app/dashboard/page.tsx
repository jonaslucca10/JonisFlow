'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface LeadItem {
  id: string;
  placeId: string;
  websitePresent: boolean;
  phonePresent: boolean;
  rating: number | null;
  aiScore: number | null;
  aiReason: string | null;
  suggestedPitch: string | null;
  snapshot: { name: string; address: string | null; phone: string | null } | null;
}

interface LeadsPage { items: LeadItem[]; total: number; page: number; pageSize: number; }
interface Usage { searchesUsed: number; searchesLimit: number; exportsUsed: number; exportsLimit: number; }

const PAGE_SIZE = 25;

function scoreClass(s: number | null) {
  if (s == null) return 'bg-slate-300 text-slate-600';
  if (s >= 70) return 'bg-emerald-100 text-emerald-700';
  if (s >= 40) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

export default function DashboardPage() {
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [semSite, setSemSite] = useState(true);
  const [temTelefone, setTemTelefone] = useState(true);
  const [limit, setLimit] = useState(20);

  const [searchId, setSearchId] = useState<string | null>(null);
  const [resultsCount, setResultsCount] = useState(0);
  const [leads, setLeads] = useState<LeadsPage | null>(null);
  const [page, setPage] = useState(1);
  const [minScore, setMinScore] = useState<number | ''>('');
  const [filterPhone, setFilterPhone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usage, setUsage] = useState<Usage | null>(null);

  const loadUsage = useCallback(async () => {
    try { setUsage(await api<Usage>('/usage')); } catch { /* ignore */ }
  }, []);

  const loadLeads = useCallback(async (sid: string | null, p: number) => {
    const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
    if (sid) params.set('searchId', sid);
    if (minScore !== '') params.set('minScore', String(minScore));
    if (filterPhone) params.set('temTelefone', 'true');
    setLeads(await api<LeadsPage>(`/leads?${params}`));
  }, [minScore, filterPhone]);

  useEffect(() => { loadUsage(); }, [loadUsage]);
  useEffect(() => { loadLeads(searchId, page); }, [loadLeads, searchId, page]);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api<{ searchId: string; resultsCount: number }>('/search', {
        method: 'POST',
        body: JSON.stringify({ query, city, category, filters: { semSite, temTelefone }, limit }),
      });
      setSearchId(res.searchId);
      setResultsCount(res.resultsCount);
      setPage(1);
    } catch (err: any) {
      setError(err.message || 'Busca falhou');
    } finally {
      setLoading(false);
    }
  }

  async function exportCsv() {
    if (!searchId) return;
    setError('');
    try {
      const res = await api<{ csv: string; rowsCount: number }>('/exports', {
        method: 'POST',
        body: JSON.stringify({ searchId, format: 'csv' }),
      });
      // Download transacional: o CSV não é persistido no servidor (minimização)
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jonisflow-${searchId.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      await loadUsage();
    } catch (err: any) {
      setError(err.message || 'Exportação falhou');
    }
  }

  const totalPages = leads ? Math.max(1, Math.ceil(leads.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Busque empresas locais sem site e exporte leads priorizados.</p>
        </div>
        {usage && (
          <div className="flex gap-3">
            <UsagePill label="Buscas" used={usage.searchesUsed} limit={usage.searchesLimit} />
            <UsagePill label="Exportações" used={usage.exportsUsed} limit={usage.exportsLimit} />
          </div>
        )}
      </div>

      {/* Busca */}
      <form onSubmit={runSearch} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Busca" hint="ex.: salões de beleza">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ex.: salões de beleza" className="input" />
          </Field>
          <Field label="Cidade / bairro" hint="ex.: Belo Horizonte">
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="ex.: Belo Horizonte" required className="input" />
          </Field>
          <Field label="Categoria" hint="ex.: restaurantes">
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="ex.: restaurantes" required className="input" />
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Toggle checked={semSite} onChange={setSemSite} label="Apenas sem site" />
          <Toggle checked={temTelefone} onChange={setTemTelefone} label="Tem telefone" />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span>Limite</span>
            <input type="number" min={5} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30" />
          </label>
          <button disabled={loading} className="ml-auto rounded-xl bg-brand-accent px-6 py-2.5 font-semibold text-white shadow-sm transition hover:bg-brand-accent-dark disabled:opacity-50">
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
        {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {resultsCount > 0 && (
          <p className="mt-4 text-sm text-slate-600">
            <span className="font-semibold text-brand">{resultsCount}</span> empresas encontradas · <span className="font-semibold text-brand">{leads?.total ?? 0}</span> salvas na sua lista
          </p>
        )}
      </form>

      {/* Tabela */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <h2 className="text-sm font-semibold text-brand">
            Leads · {leads?.total ?? 0} {searchId ? '(busca filtrada)' : ''}
          </h2>
          {searchId ? (
            <button onClick={exportCsv} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
              Exportar CSV
            </button>
          ) : (
            <span className="text-xs text-slate-400">Faça uma busca para filtrar e exportar</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Pontuação</th>
                <th className="px-4 py-3">Porquê / Abordagem</th>
              </tr>
            </thead>
            <tbody>
              {leads?.items.map((l) => (
                <tr key={l.id} className="border-b border-slate-50 transition hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-brand">{l.snapshot?.name ?? '—'}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{l.snapshot?.address ?? l.placeId}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{l.snapshot?.phone || (l.phonePresent ? '—' : '—')}</td>
                  <td className="px-4 py-3">
                    {l.websitePresent
                      ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Tem</span>
                      : <span className="rounded-full bg-brand-accent-soft px-2 py-0.5 text-xs font-semibold text-brand-accent-dark">Não tem</span>}
                  </td>
                  <td className="px-4 py-3">
                    {l.aiScore != null && (
                      <span className={`inline-flex h-7 w-14 items-center justify-center rounded-full text-xs font-bold ${scoreClass(l.aiScore)}`}>
                        {l.aiScore}
                      </span>
                    )}
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <div className="text-xs leading-relaxed text-slate-600">{l.aiReason}</div>
                    {l.suggestedPitch && <div className="mt-1 text-xs italic text-brand-accent">{l.suggestedPitch}</div>}
                  </td>
                </tr>
              ))}
              {leads && leads.items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  <div className="text-sm">Nenhum lead nesta lista.</div>
                  <div className="mt-1 text-xs">Faça uma busca acima para populá-la.</div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Filtros inline da lista */}
        {searchId && (
          <div className="flex flex-wrap items-center gap-5 border-t border-slate-100 bg-slate-50/40 p-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span>Pontuação mínima</span>
              <input type="range" min={0} max={100} value={minScore === '' ? 0 : minScore} onChange={(e) => { setMinScore(e.target.value === '' ? '' : Number(e.target.value)); setPage(1); }} className="h-1.5 w-32 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-accent" />
              <span className="w-8 font-semibold text-brand-accent">{minScore === '' ? 0 : minScore}</span>
            </label>
            <Toggle checked={filterPhone} onChange={(v) => { setFilterPhone(v); setPage(1); }} label="Apenas com telefone" />
          </div>
        )}

        {/* Paginação */}
        {leads && leads.total > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-3 border-t border-slate-100 p-4">
            <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-white disabled:opacity-40">Anterior</button>
            <span className="text-sm text-slate-600">Página <span className="font-semibold text-brand">{page}</span> de {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-white disabled:opacity-40">Próxima</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-10 rounded-full transition ${checked ? 'bg-brand-accent' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
      {label}
    </label>
  );
}

function UsagePill({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="font-semibold text-brand">{used}/{limit}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : 'bg-brand-accent'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
