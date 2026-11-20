'use client';
import { useEffect, useState } from 'react';
import { RefreshCw, Plug } from 'lucide-react';
import { api, when } from '../lib/api';
import { badge } from './modules';
export default function Integrations() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const load = () =>
    api('/integrations')
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">OPERAÇÃO CONECTADA</span>
          <h1>Integração ERP</h1>
          <p>Acompanhe o envio de rotas concluídas e suas despesas.</p>
        </div>
        <button className="button secondary" onClick={load}>
          <RefreshCw size={17} /> Atualizar
        </button>
      </div>
      <div className="integration-note panel">
        <span className="icon-box green">
          <Plug size={24} />
        </span>
        <div>
          <h2>Receptor de demonstração</h2>
          <p>
            Intercâmbio de dados pelo contrato do FrotaLab. A integração com um ERP comercial
            depende da conexão e adaptação ao produto escolhido.
          </p>
          <span className="badge badge-assigned">
            {data?.configured ? 'Conexão configurada' : 'Aguardando configuração'}
          </span>
        </div>
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>Histórico de sincronização</h2>
          <span>{data?.items?.length || 0} eventos</span>
        </div>
        {data?.items?.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Rota</th>
                  <th>Registrado em</th>
                  <th>Situação</th>
                  <th>Tentativas</th>
                  <th>Último resultado</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.payload.name || 'Rota concluída'}</strong>
                    </td>
                    <td>{when(r.createdAt)}</td>
                    <td>{badge(r.status)}</td>
                    <td>{r.attempts}</td>
                    <td>{r.result || 'Aguardando envio'}</td>
                    <td>
                      {r.status !== 'SENT' && (
                        <button
                          className="table-button"
                          disabled={busy === r.id}
                          onClick={async () => {
                            setBusy(r.id);
                            setError('');
                            try {
                              await api(`/integrations/${r.id}/retry`, {
                                method: 'POST',
                                body: {},
                              });
                              await load();
                            } catch (e) {
                              setError((e as Error).message);
                            } finally {
                              setBusy('');
                            }
                          }}
                        >
                          {busy === r.id ? 'Enviando…' : 'Sincronizar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Plug size={30} />
            <h3>Nenhuma sincronização pendente</h3>
            <p>Conclua uma rota para gerar um evento de integração.</p>
          </div>
        )}
      </section>
    </>
  );
}
