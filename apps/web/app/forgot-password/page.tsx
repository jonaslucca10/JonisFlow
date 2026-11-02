'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { AuthShell, Field, inputClass, primaryButtonClass, errorClass } from '@/components/AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
      setSent(true); // sempre 202: não revela se o e-mail existe
    } catch (err: any) {
      setError(err.message || 'Erro');
    }
  }

  return (
    <AuthShell title="Recuperar senha" subtitle="Enviaremos um link de redefinição se o e-mail existir.">
      {sent ? (
        <div className="rounded-xl border border-brand-accent/30 bg-brand-accent-soft/60 p-5 text-sm text-slate-700">
          <p className="font-semibold text-brand">E-mail enviado</p>
          <p className="mt-2 leading-relaxed">
            Se o e-mail existir, enviamos um link de redefinição em até 1 minuto. Verifique a caixa de
            entrada e o spam.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <Field label="E-mail">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
          </Field>
          {error && <p className={errorClass}>{error}</p>}
          <button className={primaryButtonClass}>Enviar link</button>
        </form>
      )}
    </AuthShell>
  );
}
