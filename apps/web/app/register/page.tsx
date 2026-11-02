'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AuthShell, Field, inputClass, primaryButtonClass, errorClass } from '@/components/AuthShell';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api('/auth/register', { method: 'POST', body: JSON.stringify(form) });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Falha no cadastro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Criar conta" subtitle="Plano grátis: 3 buscas e 5 exportações por mês. Sem cartão.">
      <form onSubmit={submit} className="space-y-5">
        <Field label="Nome">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoComplete="name" className={inputClass} />
        </Field>
        <Field label="E-mail">
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" className={inputClass} />
        </Field>
        <Field label="Senha (min. 8 caracteres)">
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} autoComplete="new-password" className={inputClass} />
        </Field>
        {error && <p className={errorClass}>{error}</p>}
        <button disabled={loading} className={primaryButtonClass}>
          {loading ? 'Criando…' : 'Criar conta'}
        </button>
      </form>
      <p className="mt-6 text-sm text-slate-500">
        Já tem conta? <Link href="/login" className="font-semibold text-brand-accent hover:underline">Entrar</Link>
      </p>
    </AuthShell>
  );
}
