import Link from 'next/link';
import {
  ArrowUpRight,
  Truck,
  Route,
  ShieldCheck,
  Wrench,
  BarChart3,
  MapPin,
  ArrowRight,
} from 'lucide-react';
import { hasActiveSession } from '../lib/server-session';
export default async function Home() {
  const signedIn = await hasActiveSession();
  const operationHref = signedIn ? '/app' : '/login';
  return (
    <main className="public-page">
      <nav className="public-nav">
        <Link className="brand" href={signedIn ? '/app' : '/'}>
          <span className="brand-icon">
            <Route size={23} />
          </span>
          FrotaLab<span className="brand-dot">.</span>
        </Link>
        <div>
          <Link href="/como-funciona">Como funciona</Link>
          <Link className="button primary small" href={operationHref}>
            {signedIn ? 'Ir para o painel' : 'Acessar sistema'} <ArrowUpRight size={16} />
          </Link>
        </div>
      </nav>
      <section className="hero">
        <div>
          <span className="eyebrow">
            <span className="live-dot" /> GESTÃO DE FROTAS E LOGÍSTICA
          </span>
          <h1>
            Uma operação
            <br />
            bem organizada.
            <br />
            <em>Cada entrega conta.</em>
          </h1>
          <p>
            Veículos, pessoas e rotas no mesmo lugar. Acompanhe sua frota e transforme os registros
            do dia a dia em decisões melhores.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href={operationHref}>
              {signedIn ? 'Continuar na operação' : 'Entrar na operação'} <ArrowRight size={18} />
            </Link>
            <Link className="text-link" href="/como-funciona">
              Conhecer o sistema <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="hero-caption">
            <ShieldCheck size={18} /> Acesso por perfil · Registros conectados · Dados persistentes
          </div>
        </div>
        <div className="hero-art" aria-label="Ilustração de uma operação logística">
          <div className="map-grid" />
          <svg viewBox="0 0 500 500" className="route-art" aria-hidden="true">
            <path
              d="M80 380V230Q80 200 110 200H230Q260 200 260 170V90M260 200V350Q260 380 290 380H420"
              fill="none"
              stroke="#d3ddc8"
              strokeWidth="40"
            />
            <path
              d="M80 380V230Q80 200 110 200H230Q260 200 260 170V90"
              fill="none"
              stroke="#567864"
              strokeWidth="4"
              strokeDasharray="7 8"
            />
            <circle cx="80" cy="380" r="11" fill="#efaa59" />
            <circle cx="260" cy="90" r="11" fill="#244e3e" />
            <circle cx="420" cy="380" r="11" fill="#244e3e" />
          </svg>
          <div className="float-card delivery-card">
            <span className="icon-box green">
              <Truck size={24} />
            </span>
            <div>
              <small>SUA FROTA CONECTADA</small>
              <strong>Da saída à última entrega</strong>
              <span>Visibilidade em cada etapa</span>
            </div>
          </div>
          <div className="float-card location-card">
            <MapPin size={20} />
            <div>
              <strong>Operação em movimento</strong>
              <span>Rotas, prazos e pessoas</span>
            </div>
            <span className="live-dot" />
          </div>
          <div className="map-tag">
            SANTA HELENA, PR <span>24°51′ S · 54°19′ W</span>
          </div>
        </div>
      </section>
      <section className="public-features">
        <article>
          <Route />
          <h2>Planeje com clareza</h2>
          <p>Distribua rotas, organize paradas e acompanhe cada entrega.</p>
        </article>
        <article>
          <Wrench />
          <h2>Cuide da sua frota</h2>
          <p>Revisões, documentos e abastecimentos com histórico completo.</p>
        </article>
        <article>
          <BarChart3 />
          <h2>Decida com dados</h2>
          <p>Indicadores e relatórios baseados na sua operação.</p>
        </article>
      </section>
      <footer className="public-footer">
        <span>FrotaLab · Projeto acadêmico</span>
        <span>Projeto e Desenvolvimento de Sistemas Web · UTFPR</span>
      </footer>
    </main>
  );
}
