'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AuthShell, Field, inputClass, primaryButtonClass, errorClass } from '@/components/AuthShell';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Falha no login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Entrar" subtitle="Bem-vindo de volta. Acesse sua lista de leads.">
      <form onSubmit={submit} className="space-y-5">
        <Field label="E-mail">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={inputClass} />
        </Field>
        <Field label="Senha">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className={inputClass} />
        </Field>
        {error && <p className={errorClass}>{error}</p>}
        <button disabled={loading} className={primaryButtonClass}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <div className="mt-6 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-slate-500 transition hover:text-brand-accent">Esqueci minha senha</Link>
        <Link href="/register" className="font-semibold text-brand-accent hover:underline">Criar conta</Link>
      </div>
    </AuthShell>
  );
}
