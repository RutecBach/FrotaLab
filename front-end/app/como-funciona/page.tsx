import Link from 'next/link';
import { Route, ArrowLeft, ArrowRight, Users, Navigation, Wrench, BarChart3 } from 'lucide-react';
import { hasActiveSession } from '../../lib/server-session';
export default async function About() {
  const signedIn = await hasActiveSession();
  const operationHref = signedIn ? '/app' : '/login';
  const backHref = signedIn ? '/app' : '/';
  return (
    <main className="public-page">
      <nav className="public-nav">
        <Link className="brand" href={backHref}>
          <span className="brand-icon">
            <Route size={23} />
          </span>
          FrotaLab.
        </Link>
        <Link className="button primary small" href={operationHref}>
          {signedIn ? 'Ir para o painel' : 'Acessar sistema'} <ArrowRight size={16} />
        </Link>
      </nav>
      <section className="about-heading">
        <Link className="text-link" href={backHref}>
          <ArrowLeft size={16} /> {signedIn ? 'Voltar ao painel' : 'Página inicial'}
        </Link>
        <span className="eyebrow">COMO FUNCIONA</span>
        <h1>
          Cada pessoa sabe
          <br />
          qual é o próximo passo.
        </h1>
        <p>
          Um fluxo integrado, do cadastro à análise de resultados. Cada perfil acessa as informações
          e ações necessárias ao seu trabalho.
        </p>
      </section>
      <section className="steps-grid">
        {[
          [
            Users,
            '01',
            'Prepare a operação',
            'Gestores cadastram veículos, motoristas, centros de distribuição e documentos. O sistema verifica validade e disponibilidade.',
          ],
          [
            Navigation,
            '02',
            'Planeje e execute',
            'Operadores organizam as entregas. Motoristas iniciam suas rotas, compartilham localização e registram entregas e abastecimentos.',
          ],
          [
            Wrench,
            '03',
            'Mantenha tudo em dia',
            'Mecânicos registram serviços. Alertas ajudam a acompanhar documentos, seguros e revisões preventivas.',
          ],
          [
            BarChart3,
            '04',
            'Acompanhe os resultados',
            'Gestores consultam indicadores e relatórios operacionais, financeiros e de produtividade com exportação de dados.',
          ],
        ].map(([Icon, n, title, description]) => (
          <article key={String(n)}>
            <div className="step-number">{String(n)}</div>
            {typeof Icon !== 'string' && <Icon size={27} />}
            <h2>{String(title)}</h2>
            <p>{String(description)}</p>
          </article>
        ))}
      </section>
      <section className="about-note">
        <h2>Um ambiente para demonstrar e aprender.</h2>
        <p>
          Esta aplicação foi desenvolvida para o Exame de Suficiência da disciplina de Projeto e
          Desenvolvimento de Sistemas Web. As contas e os registros de demonstração são fictícios. A
          localização é compartilhada somente com a autorização do motorista e enquanto a página
          está ativa.
        </p>
        <Link className="button primary" href={operationHref}>
          {signedIn ? 'Continuar na operação' : 'Conhecer a operação'} <ArrowRight size={17} />
        </Link>
      </section>
      <footer className="public-footer">FrotaLab · UTFPR · Projeto acadêmico</footer>
    </main>
  );
}
