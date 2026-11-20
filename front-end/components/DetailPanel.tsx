'use client';
import { when, cash } from '../lib/api';
import { badge } from './modules';
export default function DetailPanel({ detail, onClose }: { detail: any; onClose: () => void }) {
  return (
    <div className="detail-backdrop" onClick={onClose}>
      <section
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="button secondary small" onClick={onClose}>
          Fechar
        </button>
        <h2 id="detail-title">{detail.name || detail.description}</h2>
        {badge(detail.status)}
        {detail.deliveries && (
          <>
            <p>
              {detail.driverName || 'Motorista não atribuído'} ·{' '}
              {detail.vehicle?.plate || 'Veículo não atribuído'}
            </p>
            <h3>Paradas planejadas</h3>
            {detail.deliveries.length ? (
              detail.deliveries.map((d: any, i: number) => (
                <div className="detail-stop" key={d.id}>
                  <span className="stop-number">{i + 1}</span>
                  <div>
                    <strong>
                      {d.reference} · {d.recipient}
                    </strong>
                    <p>{d.address}</p>
                    <small>Prazo: {when(d.deadline)}</small>
                  </div>
                  {badge(d.status)}
                </div>
              ))
            ) : (
              <p>Nenhuma entrega adicionada.</p>
            )}
          </>
        )}
        {detail.services && (
          <>
            <h3>Serviços registrados</h3>
            {detail.services.length ? (
              detail.services.map((s: any) => (
                <div className="detail-stop" key={s.id}>
                  <div>
                    <strong>{s.description}</strong>
                    <p>{s.parts}</p>
                    <small>{when(s.completedAt)}</small>
                  </div>
                  <strong>{cash(s.partsCents + s.laborCents)}</strong>
                </div>
              ))
            ) : (
              <p>Nenhum serviço registrado.</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
