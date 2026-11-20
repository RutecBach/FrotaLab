'use client';
import { Pencil, Power, Eye, Navigation, CheckCircle2, XCircle } from 'lucide-react';
import type { SessionUser } from '../lib/api';
import type { ModuleConfig } from './modules';
export default function RowActions({
  row,
  section,
  config,
  user,
  canWrite,
  onDetail,
  onEdit,
  onToggle,
  onForm,
  onLocate,
  onAct,
}: {
  row: any;
  section: string;
  config: ModuleConfig;
  user: SessionUser;
  canWrite: boolean;
  onDetail: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onForm: (action: string) => void;
  onLocate: () => void;
  onAct: (path: string) => void;
}) {
  return (
    <div className="row-actions">
      {(section === 'routes' || section === 'maintenance-orders') && (
        <button className="icon-button" aria-label="Ver detalhes" onClick={onDetail}>
          <Eye size={17} />
        </button>
      )}
      {config.editable &&
        canWrite &&
        (!row.status || ['DRAFT', 'ASSIGNED', 'PENDING'].includes(row.status)) && (
          <button className="icon-button" aria-label={`Editar ${config.singular}`} onClick={onEdit}>
            <Pencil size={16} />
          </button>
        )}
      {canWrite && 'active' in row && (
        <button
          className="icon-button"
          aria-label={row.active ? 'Desativar' : 'Ativar'}
          title={row.active ? 'Desativar' : 'Ativar'}
          onClick={onToggle}
        >
          <Power size={16} />
        </button>
      )}
      {section === 'routes' && (
        <>
          {['ADMIN', 'OPERATOR'].includes(user.role) &&
            ['DRAFT', 'ASSIGNED'].includes(row.status) && (
              <>
                <button className="table-button" onClick={() => onForm('assign')}>
                  Atribuir
                </button>
                <button
                  className="icon-button danger"
                  aria-label="Cancelar rota"
                  onClick={() => onForm('cancel')}
                >
                  <XCircle size={17} />
                </button>
              </>
            )}
          {['ADMIN', 'DRIVER'].includes(user.role) && row.status === 'ASSIGNED' && (
            <button className="table-button" onClick={() => onForm('start')}>
              Iniciar
            </button>
          )}
          {['ADMIN', 'DRIVER'].includes(user.role) && row.status === 'IN_PROGRESS' && (
            <>
              <button
                className="icon-button"
                aria-label="Compartilhar localização"
                title="Compartilhar localização"
                onClick={onLocate}
              >
                <Navigation size={17} />
              </button>
              <button className="table-button" onClick={() => onForm('complete')}>
                Encerrar
              </button>
            </>
          )}
        </>
      )}
      {section === 'deliveries' && row.status === 'PENDING' && (
        <>
          {['ADMIN', 'DRIVER'].includes(user.role) && (
            <button
              className="table-button"
              onClick={() => onAct(`/deliveries/${row.id}/complete`)}
            >
              Concluir
            </button>
          )}
          {['ADMIN', 'OPERATOR', 'DRIVER'].includes(user.role) && (
            <button
              className="icon-button danger"
              aria-label="Cancelar entrega"
              onClick={() => onForm('cancel')}
            >
              <XCircle size={17} />
            </button>
          )}
        </>
      )}
      {section === 'maintenance-orders' && ['ADMIN', 'MECHANIC'].includes(user.role) && (
        <>
          {row.status === 'OPEN' && (
            <button
              className="table-button"
              onClick={() => onAct(`/maintenance-orders/${row.id}/start`)}
            >
              Iniciar serviço
            </button>
          )}
          {row.status === 'IN_PROGRESS' &&
            (user.role === 'ADMIN' || row.mechanicId === user.id) && (
              <>
                <button className="table-button" onClick={() => onForm('services')}>
                  Registrar serviço
                </button>
                <button
                  className="icon-button"
                  aria-label="Concluir manutenção"
                  title="Concluir manutenção"
                  onClick={() => onAct(`/maintenance-orders/${row.id}/complete`)}
                >
                  <CheckCircle2 size={18} />
                </button>
              </>
            )}
        </>
      )}
    </div>
  );
}
