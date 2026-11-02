import Link from 'next/link';

function Icon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    search: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
    ),
    brain: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5a3 3 0 1 0-5.997.142 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
        <path d="M12 5a3 3 0 1 1 5.997.142 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      </svg>
    ),
    csv: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" /><path d="M8 13h8M8 17h8M8 9h2" strokeLinecap="round" />
      </svg>
    ),
    shield: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" />
      </svg>
    ),
    clock: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
      </svg>
    ),
    bolt: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
      </svg>
    ),
  };
  return <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-accent-soft text-brand-accent-dark">{icons[name]}</div>;
}

export default function Landing() {
  const features = [
    { icon: 'search', t: 'Busca inteligente', d: 'Google Maps Text Search com filtro “sem site” e “tem telefone”. Explore cidades e bairros do Brasil inteiro.' },
    { icon: 'brain', t: 'IA própria de priorização', d: 'Pontuação 0–100 de probabilidade de precisar de site, com motivo da classificação e abordagem sugerida.' },
    { icon: 'csv', t: 'CSV em 1 clique', d: 'Exporte a lista priorizada para trabalhar em qualquer CRM ou planilha. Download transacional, sem persistência.' },
    { icon: 'shield', t: 'Conformidade embutida', d: 'Cache do Google limitado a place_id + coordenadas com TTL de 30 dias (ToS). Nenhum armazenamento de dados pessoais.' },
    { icon: 'clock', t: 'Cache otimizado', d: 'Requisitas paginadas com limites do Google (200/dia, 60/min). Custo controlado, resultados rápidos.' },
    { icon: 'bolt', t: 'Preço transparente', d: 'Plano grátis com 3 buscas e 5 exportações. Assinatura mensal a R$ 79, cancelamento a qualquer momento.' },
  ];

  return (
    <div className="animate-fade-up">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-brand px-6 py-20 sm:px-12 sm:py-24">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-brand-accent-dark/30 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <img src="/logo.png" alt="JonisFlow" className="mx-auto h-20 w-auto" />
          <h1 className="mt-8 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl">
            Empresas locais <span className="text-brand-accent-light">sem site</span>, com IA de priorização
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
            Busque por cidade, bairro ou categoria, filtre os negócios sem presença digital e exporte uma
            lista qualificada de leads. Para agências, freelancers e prestadores de serviços digitais.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="w-full rounded-xl bg-brand-accent px-8 py-3.5 font-semibold text-white shadow-lg transition hover:bg-brand-accent-dark sm:w-auto"
            >
              Cadastrar grátis
            </Link>
            <Link
              href="/login"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-8 py-3.5 font-semibold text-white backdrop-blur transition hover:bg-white/10 sm:w-auto"
            >
              Entrar
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-400">Plano grátis: 3 buscas e 5 exportações por mês · Sem cartão</p>
        </div>
      </section>

      {/* Features */}
      <section className="mt-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-brand">Tudo o que você precisa para <span className="text-brand-accent">encontrar leads</span></h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            Uma plataforma focada em resultado, não em diversões. Siga o fluxo: busque, filtre, priorize e exporte.
          </p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.t}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <Icon name={f.icon} />
              <h3 className="mt-4 text-lg font-semibold text-brand">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mt-20">
        <h2 className="text-center text-3xl font-bold tracking-tight text-brand">Como funciona</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            { n: '01', t: 'Busque', d: 'Informe cidade/bairro + categoria. A API do Google retorna negócios com e sem site.' },
            { n: '02', t: 'Filtre e priorize', d: 'A IA pontua cada empresa 0–100 pela probabilidade de precisar de serviços digitais.' },
            { n: '03', t: 'Exporte', d: 'Gere o CSV com os leads priorizados e pegue o telefone de cada um para contato.' },
          ].map((s) => (
            <div key={s.n} className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
              <span className="text-4xl font-extrabold text-brand-accent-soft">{s.n}</span>
              <h3 className="mt-2 text-lg font-semibold text-brand">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Compliance */}
      <section className="mt-20 rounded-2xl border border-brand-accent/30 bg-brand-accent-soft/50 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <Icon name="shield" />
          <div>
            <h2 className="text-xl font-semibold text-brand">Conformidade: Google ToS e LGPD</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Dados do Google Maps/Places são de terceiros: armazenamos apenas <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">place_id</code> e coordenadas,
              por até 30 dias. Nenhum dado pessoal é armazenado ou enrichido. Para LGPD: o produto atende apenas
              pessoas jurídicas — empresa é dado aberto, e enriquecimento de pessoas físicas está fora do escopo.
              Em caso de scraping: risco legal e de bloqueio; a API oficial é o caminho suportado.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-20 overflow-hidden rounded-3xl bg-brand-accent p-8 text-center sm:p-12">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">Comece a gerar leads hoje</h2>
        <p className="mx-auto mt-3 max-w-lg text-white/80">
          Plano grátis com 3 buscas e 5 exportações por mês. Sem cartão, sem surpresas.
        </p>
        <Link
          href="/register"
          className="mt-8 inline-block rounded-xl bg-white px-8 py-3.5 font-semibold text-brand shadow-lg transition hover:bg-slate-100"
        >
          Criar conta grátis
        </Link>
      </section>
    </div>
  );
}
