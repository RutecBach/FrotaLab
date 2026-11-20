'use client';
import { useEffect, useState } from 'react';
import { api, when } from '../lib/api';
export default function Audit() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/audit')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  const actions: Record<string, string> = {
    LOGIN: 'Entrada no sistema',
    CREATE: 'Cadastro criado',
    UPDATE: 'Cadastro alterado',
    UPLOAD: 'Documento anexado',
    ASSIGN: 'Rota atribuída',
    START: 'Operação iniciada',
    COMPLETE: 'Operação concluída',
    CANCEL: 'Operação cancelada',
    RETRY: 'Sincronização solicitada',
  };
  const entities: Record<string, string> = {
    user: 'Usuário',
    users: 'Usuários',
    vehicles: 'Veículos',
    drivers: 'Motoristas',
    centers: 'Centros',
    route: 'Rota',
    delivery: 'Entrega',
    fuel: 'Abastecimento',
    'maintenance-plan': 'Plano preventivo',
    'maintenance-order': 'Manutenção',
    'maintenance-service': 'Serviço',
    document: 'Documento',
    integration: 'Integração',
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">HISTÓRICO DA OPERAÇÃO</span>
          <h1>Atividades</h1>
          <p>Registros de acesso e alterações relevantes, preservados para consulta.</p>
        </div>
      </div>
      {error && <div className="error-box">{error}</div>}
      <section className="panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Atividade</th>
                <th>Área</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((r: any) => (
                <tr key={r.id}>
                  <td>{when(r.createdAt)}</td>
                  <td>{actions[r.action] || r.action}</td>
                  <td>{entities[r.entity] || r.entity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
