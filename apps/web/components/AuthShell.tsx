import Link from 'next/link';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';

/**
 * Shell profissional para telas de auth (login/register/forgot):
 * split em duas colunas — painel da marca (navy + teal) + formulário.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      {/* Painel da marca */}
      <div className="relative hidden overflow-hidden bg-brand lg:block">
        <div className="pointer-events-none absolute -right-24 top-24 h-80 w-80 rounded-full bg-brand-accent/20 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="JonisFlow" className="h-9 w-auto" />
            <span className="text-lg font-bold tracking-tight text-white">JonisFlow</span>
          </Link>
          <div className="max-w-sm">
            <h2 className="text-3xl font-bold leading-snug text-white">
              Empresas locais <span className="text-brand-accent-light">sem site</span>, com IA de priorização
            </h2>
            <p className="mt-4 leading-relaxed text-slate-300">
              Busque por cidade e categoria, filtre os negócios sem presença digital e exporte leads
              priorizados em CSV.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-slate-300">
              <li className="flex items-center gap-3"><Dot /> Busca no Google Maps com filtro “sem site”</li>
              <li className="flex items-center gap-3"><Dot /> Pontuação de IA 0–100 + abordagem sugerida</li>
              <li className="flex items-center gap-3"><Dot /> Exportação CSV em 1 clique</li>
              <li className="flex items-center gap-3"><Dot /> Conformidade ToS/LGPD embutida</li>
            </ul>
          </div>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} JonisFlow</p>
        </div>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="flex items-center gap-2.5">
              <img src="/logo.png" alt="JonisFlow" className="h-9 w-auto" />
              <span className="text-lg font-bold tracking-tight text-brand">JonisFlow</span>
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-brand">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Dot() {
  return <span className="flex h-1.5 w-1.5 shrink-0 rounded-full bg-brand-accent" />;
}

/** Campo de input profissional com label + estado de foco. */
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-brand shadow-sm outline-none transition focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30 placeholder:text-slate-400';

export const primaryButtonClass =
  'w-full rounded-xl bg-brand-accent px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-accent-dark disabled:cursor-not-allowed disabled:opacity-50';

export const errorClass = 'mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700';
