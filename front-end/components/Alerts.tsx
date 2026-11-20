'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api, civil } from '../lib/api';
import { badge } from './modules';
export default function Alerts() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/alerts')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PREVENIR É MANTER EM MOVIMENTO</span>
          <h1>Alertas</h1>
          <p>Documentos, seguros, habilitações e revisões que precisam de atenção.</p>
        </div>
        <span className="date-chip">Até 30 dias ou 1.000 km</span>
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="alert-grid">
        {data?.items.map((a: any) => (
          <article className={`panel alert-card ${a.state}`} key={a.id}>
            <div className="alert-card-top">
              <span className="attention-icon">
                <AlertTriangle size={21} />
              </span>
              {badge(a.state)}
            </div>
            <h2>{a.label}</h2>
            {a.dueDate && (
              <p>
                Vencimento: <strong>{civil(a.dueDate)}</strong>
              </p>
            )}
            {a.remainingKm != null && (
              <p>
                {a.remainingKm <= 0
                  ? `Limite ultrapassado em ${Math.abs(a.remainingKm)} km`
                  : `Restam ${a.remainingKm} km`}
              </p>
            )}
            <small>
              {a.state === 'expired'
                ? 'Regularize a pendência antes de novas operações.'
                : 'Planeje a regularização com antecedência.'}
            </small>
          </article>
        ))}
      </div>
      {data && !data.items.length && (
        <div className="panel empty-state">
          <CheckCircle2 size={35} />
          <h2>Tudo em dia</h2>
          <p>Nenhuma pendência identificada.</p>
        </div>
      )}
    </>
  );
}
