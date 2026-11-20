'use client';
import { useEffect, useState } from 'react';
import { Download, BarChart3 } from 'lucide-react';
import { api, cash, statusNames, civil, when } from '../lib/api';
import { civilToday } from '../lib/dates';
const names: Record<string, string> = {
  fuelCents: 'Abastecimentos',
  maintenanceCents: 'Manutenções',
  totalCents: 'Despesas totais',
  distanceKm: 'Distância (km)',
  costPerKmCents: 'Custo por km',
  routesStarted: 'Rotas iniciadas',
  delivered: 'Entregas concluídas',
  late: 'Concluídas com atraso',
  cancelled: 'Canceladas',
  pending: 'Pendentes ao fim',
  drivers: 'Motoristas',
  deliveries: 'Entregas',
  id: 'Registro',
  type: 'Tipo',
  date: 'Data',
  description: 'Descrição',
  reference: 'Referência',
  recipient: 'Destinatário',
  status: 'Situação',
  deadline: 'Prazo',
  completedAt: 'Conclusão',
  driver: 'Motorista',
  routes: 'Rotas',
  onTimePercent: 'Pontualidade (%)',
  durationMinutes: 'Duração (min)',
};
export default function Reports() {
  const [kind, setKind] = useState('operational');
  const [from, setFrom] = useState(`${civilToday().slice(0, 7)}-01`);
  const [to, setTo] = useState(civilToday());
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const path = `/reports/${kind}?from=${from}&to=${to}`;
  useEffect(() => {
    setError('');
    api(path)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [path]);
  const display = (k: string, v: any) =>
    v == null
      ? 'Sem dados'
      : k.endsWith('Cents')
        ? cash(v)
        : ['date', 'deadline', 'completedAt'].includes(k)
          ? when(v)
          : typeof v === 'boolean'
            ? v
              ? 'Sim'
              : 'Não'
            : statusNames[v] || String(v);
  const cols = data?.items?.length ? Object.keys(data.items[0]).filter((k) => k !== 'id') : [];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">DADOS QUE ORIENTAM DECISÕES</span>
          <h1>Relatórios</h1>
          <p>Consulte a operação, as despesas e a produtividade por período.</p>
        </div>
        <a className="button primary" href={`/api/reports/${kind}.csv?from=${from}&to=${to}`}>
          <Download size={17} /> Exportar CSV
        </a>
      </div>
      <div className="report-controls panel">
        <div className="tabs">
          {[
            ['operational', 'Operacional'],
            ['financial', 'Financeiro'],
            ['productivity', 'Produtividade'],
          ].map(([id, label]) => (
            <button className={kind === id ? 'active' : ''} key={id} onClick={() => setKind(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="period">
          <label>
            De
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="Início do período"
            />
          </label>
          <label>
            Até
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="Fim do período"
            />
          </label>
        </div>
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      <div className="metrics-grid report-metrics">
        {data &&
          Object.entries(data.summary).map(([k, v]) => (
            <article className="metric-card" key={k}>
              <span>{names[k] || k}</span>
              <strong>{display(k, v)}</strong>
            </article>
          ))}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Registros do período</h2>
            <p>
              {civil(from)} a {civil(to)} · {data?.items?.length || 0} registros
            </p>
          </div>
          <BarChart3 size={21} />
        </div>
        {cols.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {cols.map((k) => (
                    <th key={k}>{k === 'late' ? 'Atrasada no período' : names[k] || k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((r: any, i: number) => (
                  <tr key={r.id || i}>
                    {cols.map((k) => (
                      <td key={k}>{display(k, r[k])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <BarChart3 size={30} />
            <h3>Nenhum registro neste período</h3>
            <p>Altere as datas para consultar outro intervalo.</p>
          </div>
        )}
      </section>
      <p className="page-note">
        O relatório financeiro apresenta despesas registradas. Custo por quilômetro considera a
        distância de rotas concluídas no período.
      </p>
    </>
  );
}
