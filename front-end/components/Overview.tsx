'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Truck,
  Route,
  PackageCheck,
  Clock3,
  AlertTriangle,
  ArrowRight,
  Wrench,
} from 'lucide-react';
import { api, SessionUser, when, cash } from '../lib/api';
import { badge } from './modules';
export default function Overview({ user }: { user: SessionUser }) {
  const [data, setData] = useState<any>(null);
  const [financial, setFinancial] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/dashboard')
      .then(setData)
      .catch((e) => setError(e.message));
    if (['ADMIN', 'MANAGER'].includes(user.role))
      api('/reports/financial')
        .then(setFinancial)
        .catch(() => {});
  }, [user.role]);
  const driver = user.role === 'DRIVER';
  const mechanic = user.role === 'MECHANIC';
  const metrics = driver
    ? [
        [Route, 'Rotas em andamento', data?.activeRoutes, 'Sua operação atual'],
        [PackageCheck, 'Rotas atribuídas', data?.assignedRoutes, 'Prontas para iniciar'],
      ]
    : [
        [
          Truck,
          'Veículos disponíveis',
          data?.availableVehicles,
          `${data?.totalVehicles ?? '—'} veículos cadastrados`,
        ],
        [Route, 'Rotas em andamento', data?.activeRoutes, 'Operação atual'],
        [PackageCheck, 'Entregas concluídas', data?.delivered, 'Histórico acumulado'],
        [
          Clock3,
          'Pontualidade',
          data?.onTimePercent == null ? '—' : `${data.onTimePercent}%`,
          'Entre entregas concluídas',
        ],
      ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SEU CENTRO DE OPERAÇÕES</span>
          <h1>Visão geral</h1>
          <p>Olá, {user.name.split(' ')[0]}. Acompanhe o que movimenta a sua frota.</p>
        </div>
        <span className="date-chip">
          {new Date().toLocaleDateString('pt-BR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </span>
      </div>
      {error && (
        <div role="alert" className="error-box">
          {error}
        </div>
      )}
      <div className="overview-banner">
        <div>
          <span className="eyebrow">{driver ? 'SUA JORNADA' : 'OPERAÇÃO CONECTADA'}</span>
          <h2>
            {driver
              ? 'Tudo pronto para a próxima entrega?'
              : mechanic
                ? 'Cuidar da frota é manter tudo em movimento.'
                : 'Do planejamento à última entrega.'}
          </h2>
          <p>
            {driver
              ? 'Consulte sua rota, registre a viagem e compartilhe sua localização.'
              : 'Pessoas, veículos e informações trabalhando juntos.'}
          </p>
          <Link href={mechanic ? '/app/maintenance-orders' : '/app/routes'} className="banner-link">
            {mechanic ? 'Ver manutenções' : 'Acompanhar rotas'} <ArrowRight size={17} />
          </Link>
        </div>
        <div className="banner-symbol">
          <Route size={120} strokeWidth={1} />
          <span className="banner-dot" />
        </div>
      </div>
      <div className={`metrics-grid ${driver ? 'two' : ''}`}>
        {metrics.map(([Icon, label, value, subtitle]) => {
          const Symbol = Icon as typeof Truck;
          return (
            <article className="metric-card" key={String(label)}>
              <div className="metric-top">
                <span>{String(label)}</span>
                <Symbol size={20} />
              </div>
              <strong>
                {value == null ? <span className="skeleton-text">—</span> : String(value)}
              </strong>
              <small>{String(subtitle)}</small>
            </article>
          );
        })}
      </div>
      {driver ? (
        <section className="panel quick-panel">
          <h2>Seu dia de trabalho</h2>
          <div className="quick-links">
            <Link href="/app/routes">
              <Route />
              <strong>Minhas rotas</strong>
              <span>Inicie e encerre suas viagens</span>
              <ArrowUpRight />
            </Link>
            <Link href="/app/deliveries">
              <PackageCheck />
              <strong>Minhas entregas</strong>
              <span>Registre cada conclusão</span>
              <ArrowUpRight />
            </Link>
            <Link href="/app/fuel">
              <Truck />
              <strong>Abastecimentos</strong>
              <span>Registre os custos da viagem</span>
              <ArrowUpRight />
            </Link>
          </div>
        </section>
      ) : (
        <div className="overview-bottom">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Rotas recentes</h2>
                <p>Os últimos registros da operação</p>
              </div>
              {!mechanic && (
                <Link href="/app/routes" className="text-link">
                  Ver todas <ArrowUpRight size={15} />
                </Link>
              )}
            </div>
            <div className="recent-routes">
              {data?.recentRoutes?.map((r: any) => (
                <div key={r.id}>
                  <span className="route-mini-icon">
                    <Route size={18} />
                  </span>
                  <div>
                    <strong>{r.name}</strong>
                    <small>{when(r.scheduledStart)}</small>
                  </div>
                  {badge(r.status)}
                </div>
              ))}
              {!data && <p className="muted">Carregando operação…</p>}
            </div>
            {financial && (
              <div className="cost-strip">
                <span>Despesas deste mês</span>
                <strong>{cash(financial.summary.totalCents)}</strong>
                <Link href="/app/reports">
                  Ver relatório <ArrowUpRight size={15} />
                </Link>
              </div>
            )}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Pontos de atenção</h2>
                <p>Documentos e revisões da frota</p>
              </div>
              <span className="attention-icon">
                <AlertTriangle size={20} />
              </span>
            </div>
            <div className="alerts-list">
              {data?.alerts?.map((a: any) => (
                <div key={a.id}>
                  <span className={`alert-dot ${a.state === 'expired' ? 'expired' : ''}`} />
                  <div>
                    <strong>{a.label}</strong>
                    <small>
                      {a.state === 'expired'
                        ? 'Vencido · ação necessária'
                        : 'Próximo do vencimento'}
                    </small>
                  </div>
                </div>
              ))}
              {data && !data.alerts.length && (
                <p className="muted">Nenhuma pendência neste momento.</p>
              )}
            </div>
            <Link href="/app/alerts" className="panel-bottom-link">
              Consultar todos os alertas <ArrowRight size={16} />
            </Link>
          </section>
        </div>
      )}
    </>
  );
}
