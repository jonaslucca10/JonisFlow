'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Subscription {
  status: string;
  plan: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export default function BillingPage() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [gateway, setGateway] = useState<'stripe' | 'mercadopago'>('stripe');

  async function load() {
    try {
      setSub(await api('/billing/subscription'));
    } catch (err: any) {
      setError(err.message || 'Não foi possível carregar a assinatura');
    }
  }

  useEffect(() => { load(); }, []);

  async function checkout() {
    setLoading(true);
    setError('');
    try {
      // Redireciona para o Checkout hospedado (Stripe ou Mercado Pago — PCI reduzido)
      const res = await api<{ url: string }>('/billing/checkout', { method: 'POST', body: JSON.stringify({ gateway }) });
      window.location.href = res.url;
    } catch (err: any) {
      setError(err.message || 'Checkout falhou');
    } finally {
      setLoading(false);
    }
  }

  async function cancel() {
    setError('');
    try {
      await api('/billing/cancel', { method: 'POST', body: JSON.stringify({}) });
      await load();
    } catch (err: any) {
      setError(err.message || 'Cancelamento falhou');
    }
  }

  const active = sub?.status === 'active';

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand">Assinatura</h1>
        <p className="mt-1 text-sm text-slate-500">Gerencie seu plano e forma de pagamento.</p>
      </div>

      {/* Plano */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="bg-brand px-8 py-6">
          <p className="text-sm text-brand-accent-light">Plano PRO mensal</p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight text-white">R$ 79<span className="text-lg font-medium text-slate-400">/mês</span></p>
          <p className="mt-2 text-sm text-slate-300">Assinar agora, cancelar a qualquer momento (efetivo no fim do período).</p>
        </div>
        <div className="p-8">
          <ul className="grid gap-3 sm:grid-cols-2">
            {['Buscas ilimitadas por mês', 'Exportações CSV ilimitadas', 'Pontuação de IA de leads', 'Prioridade de cache no Google'].map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 shrink-0 text-brand-accent" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12 5 5L20 7" />
                </svg>
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <GatewayOption
              active={gateway === 'stripe'} onClick={() => setGateway('stripe')}
              name="Stripe" desc="Cartão internacional" tag="3,6% + R$ 0,60"
            />
            <GatewayOption
              active={gateway === 'mercadopago'} onClick={() => setGateway('mercadopago')}
              name="Mercado Pago" desc="PIX e cartão nacional" tag="2,9% + R$ 0,60"
            />
          </div>

          {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            disabled={loading}
            onClick={checkout}
            className="mt-6 w-full rounded-xl bg-brand-accent px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-accent-dark disabled:opacity-50"
          >
            {loading ? 'Redirecionando…' : active ? 'Assinar plano extra' : 'Assinar agora'}
          </button>
          <p className="mt-3 text-center text-xs text-slate-400">
            Pagamento seguro via Stripe ou Mercado Pago. Não armazenamos dados de cartão.
          </p>
        </div>
      </div>

      {/* Status */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <h2 className="text-lg font-semibold text-brand">Seu status</h2>
        {sub ? (
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <span className="text-slate-600">Status da assinatura</span>
              <span className={`font-semibold ${active ? 'text-emerald-600' : sub.status === 'past_due' ? 'text-red-600' : 'text-slate-500'}`}>
                {sub.status === 'active' ? 'Ativa' : sub.status}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <span className="text-slate-600">Período atual</span>
              <span className="font-medium text-brand">{sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('pt-BR') : '—'}</span>
            </div>
            {sub.cancelAtPeriodEnd && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                Cancelamento programado para o fim do período.
              </p>
            )}
            <button onClick={cancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
              Cancelar assinatura
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Nenhuma assinatura ativa — você está no plano grátis.
            <span className="ml-1 font-semibold text-brand-accent">
              <Link href="/register">Assinar PRO</Link>
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

function GatewayOption({ active, onClick, name, desc, tag }: { active: boolean; onClick: () => void; name: string; desc: string; tag: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between rounded-xl border-2 p-4 text-left transition ${active ? 'border-brand-accent bg-brand-accent-soft/50' : 'border-slate-200 hover:border-slate-300'}`}
    >
      <div>
        <div className="text-sm font-semibold text-brand">{name}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
      <span className="text-xs font-medium text-slate-500">{tag}</span>
    </button>
  );
}
