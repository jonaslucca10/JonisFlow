import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';

export const metadata: Metadata = {
  title: 'JonisFlow — empresas locais sem site, com pontuação de IA',
  description:
    'Encontre empresas locais sem site usando dados do Google Maps, com IA própria de priorização de leads e exportação CSV.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2.5">
              <img src="/logo.png" alt="JonisFlow" className="h-8 w-auto" />
              <span className="text-lg font-bold tracking-tight text-brand">JonisFlow</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm font-medium text-slate-600">
              <Link href="/" className="transition hover:text-brand">Plataforma</Link>
              <Link href="/login" className="transition hover:text-brand">Entrar</Link>
              <Link
                href="/register"
                className="rounded-lg bg-brand-accent px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-brand-accent-dark"
              >
                Começar grátis
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mt-16 border-t border-slate-200 bg-brand py-12 text-sm text-slate-400">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-3">
            <div>
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="JonisFlow" className="h-7 w-auto" />
                <span className="font-bold text-white">JonisFlow</span>
              </div>
              <p className="mt-3 leading-relaxed">
                Leads de empresas locais sem presença digital, priorizados por IA.
                Para agências, freelancers e prestadores de serviços digitais.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white">Plataforma</h3>
              <ul className="mt-3 space-y-2">
                <li><Link href="/register" className="transition hover:text-white">Cadastro</Link></li>
                <li><Link href="/login" className="transition hover:text-white">Entrar</Link></li>
                <li><Link href="/billing" className="transition hover:text-white">Assinatura</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white">Conformidade</h3>
              <ul className="mt-3 space-y-2">
                <li>Google Maps Platform ToS</li>
                <li>LGPD (Lei 13.709/2018)</li>
                <li>Cache com TTL de 30 dias</li>
              </ul>
            </div>
          </div>
          <div className="mx-auto mt-10 max-w-6xl border-t border-white/10 px-4 pt-6 text-xs text-slate-500">
            © {new Date().getFullYear()} JonisFlow. Dados de terceiros (Google Maps); cache limitado a place_id e coordenadas por 30 dias.
          </div>
        </footer>
      </body>
    </html>
  );
}
