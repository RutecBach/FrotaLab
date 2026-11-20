'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api, SessionUser } from '../lib/api';
import { modules, Field } from './modules';
import DetailPanel from './DetailPanel';
import EntityForm from './EntityForm';
import DriverLocation from './DriverLocation';
import RowActions from './RowActions';
type FormState = {
  title: string;
  fields: Field[];
  initial?: any;
  save: (data: any) => Promise<any>;
};
export default function DataPage({ section, user }: { section: string; user: SessionUser }) {
  const config = modules[section];
  const createWord = ['routes', 'deliveries', 'maintenance-orders'].includes(section)
    ? 'Nova'
    : 'Novo';
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [geo, setGeo] = useState<any>(null);
  const [lookup, setLookup] = useState<Record<string, any[]>>({});
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/${section}?page=${page}&limit=20&q=${encodeURIComponent(q)}`);
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [section, page, q]);
  useEffect(() => {
    setPage(1);
    setQ('');
    setNotice('');
  }, [section]);
  useEffect(() => {
    void load();
  }, [load]);
  const act = async (path: string, body: any = {}) => {
    setError('');
    try {
      await api(path, { method: 'POST', body });
      setNotice('Operação registrada com sucesso.');
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const toggle = async (row: any) => {
    setError('');
    try {
      await api(`/${section}/${row.id}`, {
        method: 'PATCH',
        body: { active: !row.active },
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  async function choices(fields: Field[], row?: any) {
    const map: Record<string, { path: string; label: (r: any) => string }> = {
      vehicleId: {
        path: '/vehicles?limit=200',
        label: (r) => `${r.plate} · ${r.model}${!r.active ? ' (desativado)' : ''}`,
      },
      driverId: {
        path: '/drivers?limit=200',
        label: (r) => `${r.name} · ${r.categories.join(', ')}`,
      },
      centerId: { path: '/centers?limit=200&active=true', label: (r) => r.name },
      deliveryIds: {
        path: '/deliveries?limit=200&available=true',
        label: (r) => `${r.reference} · ${r.recipient} · ${r.weightKg} kg`,
      },
      routeId: { path: '/routes?limit=200&status=IN_PROGRESS', label: (r) => r.name },
      planId: { path: '/maintenance-plans?limit=200', label: (r) => r.description },
    };
    const result = await Promise.all(
      fields.map(async (f) => {
        if (!map[f.key]) return f;
        const m = map[f.key];
        const d = await api(m.path);
        let opts = d.items;
        if (f.key === 'deliveryIds' && row?.deliveries)
          opts = [
            ...opts,
            ...row.deliveries.filter((x: any) => !opts.some((o: any) => o.id === x.id)),
          ];
        setLookup((old) => ({ ...old, [f.key]: opts }));
        return { ...f, options: opts.map((o: any) => ({ value: o.id, label: m.label(o) })) };
      }),
    );
    return result;
  }
  async function edit(row?: any) {
    setError('');
    try {
      const fields = await choices(config.fields, row);
      setForm({
        title: `${row ? 'Editar' : createWord} ${config.singular}`,
        fields,
        initial: row
          ? {
              ...row,
              deliveryIds: row.deliveries
                ?.filter((d: any) => d.status === 'PENDING')
                .map((d: any) => d.id),
            }
          : undefined,
        save: (data) =>
          api(`/${section}${row ? `/${row.id}` : ''}`, {
            method: row ? 'PATCH' : 'POST',
            body: data,
          }),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function actionForm(row: any, action: string) {
    let fields: Field[] = [];
    let title = '';
    let initial: any;
    if (action === 'assign') {
      fields = [
        { key: 'vehicleId', label: 'Veículo', type: 'select' },
        { key: 'driverId', label: 'Motorista', type: 'select' },
      ];
      title = 'Atribuir rota';
      initial = { vehicleId: row.vehicleId || '', driverId: row.driverId || '' };
    }
    if (action === 'start' || action === 'complete') {
      fields = [{ key: 'odometer', label: 'Hodômetro (km)', type: 'number' }];
      title = action === 'start' ? 'Iniciar viagem' : 'Encerrar viagem';
      initial = { odometer: row.vehicle?.odometer || row.startKm || 0 };
    }
    if (action === 'cancel') {
      fields = [{ key: 'reason', label: 'Motivo do cancelamento' }];
      title = 'Cancelar operação';
    }
    if (action === 'services') {
      fields = [
        { key: 'description', label: 'Serviço realizado' },
        { key: 'parts', label: 'Peças utilizadas', required: false },
        { key: 'partsCents', label: 'Valor das peças (R$)', type: 'money', default: 0 },
        { key: 'laborCents', label: 'Mão de obra (R$)', type: 'money', default: 0 },
      ];
      title = 'Registrar serviço';
    }
    try {
      setForm({
        title,
        fields: await choices(fields),
        initial,
        save: (data) => api(`/${section}/${row.id}/${action}`, { method: 'POST', body: data }),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!config.roles.includes(user.role))
    return (
      <div className="empty-state">
        <h2>Área restrita</h2>
        <p>Seu perfil não tem acesso a este módulo.</p>
      </div>
    );
  const canWrite = config.write.includes(user.role);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">OPERAÇÃO · {config.title.toUpperCase()}</span>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </div>
        {canWrite && (
          <button className="button primary" onClick={() => edit()}>
            <Plus size={18} /> {createWord} {config.singular}
          </button>
        )}
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="success-box" role="status">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}
      {geo && <DriverLocation route={geo} onClose={() => setGeo(null)} />}
      <section className="panel">
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label={`Buscar ${config.title.toLowerCase()}`}
              placeholder="Buscar registros…"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
            />
          </div>
          <div className="table-meta">
            <span>
              {total} registro{total !== 1 ? 's' : ''}
            </span>
            <button className="icon-button" aria-label="Atualizar registros" onClick={load}>
              <RefreshCw size={17} />
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {config.columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th className="actions-col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  {config.columns.map((c) => (
                    <td key={c.key}>
                      {c.key === 'vehicleId' && lookup.vehicleId
                        ? lookup.vehicleId.find((v) => v.id === row.vehicleId)?.plate || 'Veículo'
                        : c.render
                          ? c.render(row)
                          : String(row[c.key] ?? '—')}
                    </td>
                  ))}
                  <td>
                    <RowActions
                      row={row}
                      section={section}
                      config={config}
                      user={user}
                      canWrite={canWrite}
                      onDetail={() => setDetail(row)}
                      onEdit={() => edit(row)}
                      onToggle={() => toggle(row)}
                      onForm={(action) => actionForm(row, action)}
                      onLocate={() => setGeo(row)}
                      onAct={act}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && <div className="table-loading">Carregando registros…</div>}
        {!loading && !items.length && (
          <div className="empty-state">
            <Search size={28} />
            <h3>Nenhum registro encontrado</h3>
            <p>
              {q ? 'Tente buscar por outro termo.' : 'Os registros desta área aparecerão aqui.'}
            </p>
          </div>
        )}
        <div className="table-footer">
          <span>
            Página {page} de {Math.max(1, Math.ceil(total / 20))}
          </span>
          <div>
            <button
              className="table-button"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </button>
            <button
              className="table-button"
              disabled={page * 20 >= total}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      </section>
      {form && (
        <EntityForm
          key={`${section}-${form.title}-${form.initial?.id || ''}`}
          title={form.title}
          fields={form.fields}
          initial={form.initial}
          onClose={() => setForm(null)}
          onSave={async (data) => {
            await form.save(data);
            setForm(null);
            setNotice('Registro salvo com sucesso.');
            await load();
          }}
        />
      )}
      {detail && <DetailPanel detail={detail} onClose={() => setDetail(null)} />}
    </>
  );
}
