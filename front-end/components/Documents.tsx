'use client';
import { useEffect, useState } from 'react';
import { FileText, Plus, Download, X } from 'lucide-react';
import { api, SessionUser, civil, statusNames } from '../lib/api';
export default function Documents({ user }: { user: SessionUser }) {
  const [items, setItems] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('vehicleId');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const load = () =>
    api('/documents')
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
    api('/vehicles?limit=200').then((d) => setVehicles(d.items));
    if (user.role !== 'DRIVER') api('/drivers?limit=200').then((d) => setDrivers(d.items));
  }, [user.role]);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">INFORMAÇÕES EM DIA</span>
          <h1>Documentos</h1>
          <p>Arquivos vinculados a veículos e motoristas, com acesso protegido.</p>
        </div>
        {['ADMIN', 'MANAGER'].includes(user.role) && (
          <button
            className="button primary"
            onClick={() => {
              setOpen(true);
              setError('');
            }}
          >
            <Plus size={17} /> Anexar documento
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
          {notice}
        </div>
      )}
      {open && (
        <section className="panel upload-panel">
          <div className="panel-heading">
            <h2>Novo documento</h2>
            <button
              className="icon-button"
              onClick={() => setOpen(false)}
              aria-label="Fechar envio"
            >
              <X size={18} />
            </button>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              setError('');
              try {
                const body = new FormData(e.currentTarget);
                body.delete('target');
                if (!body.get('validUntil')) body.delete('validUntil');
                await api('/documents', { method: 'POST', body });
                setOpen(false);
                setNotice('Documento anexado com sucesso.');
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <div className="form-grid">
              <label>
                Vincular a
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="vehicleId">Veículo</option>
                  <option value="driverId">Motorista</option>
                </select>
              </label>
              <label>
                {target === 'vehicleId' ? 'Veículo' : 'Motorista'}
                <select name={target} required key={target}>
                  <option value="">Selecione…</option>
                  {(target === 'vehicleId' ? vehicles : drivers).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.plate ? `${r.plate} · ${r.model}` : r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tipo de documento
                <select name="type">
                  <option value="REGISTRATION">Documento do veículo</option>
                  <option value="INSURANCE">Seguro</option>
                  <option value="LICENSE">Habilitação</option>
                  <option value="OTHER">Outro</option>
                </select>
              </label>
              <label>
                Validade <span className="muted">opcional</span>
                <input name="validUntil" type="date" />
              </label>
              <label className="wide file-drop">
                <FileText size={25} />
                <strong>Selecione o arquivo</strong>
                <span>PDF, JPEG ou PNG · Até 10 MB</span>
                <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg" required />
              </label>
            </div>
            <div className="modal-footer">
              <button type="button" className="button secondary" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button className="button primary" disabled={saving}>
                {saving ? 'Enviando…' : 'Salvar documento'}
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>Arquivos da operação</h2>
          <span className="muted">{items.length} documentos</span>
        </div>
        {items.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Vínculo</th>
                  <th>Tipo</th>
                  <th>Validade</th>
                  <th>Tamanho</th>
                  <th>Download</th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className="file-name">
                        <FileText size={20} />
                        <strong>{d.originalName}</strong>
                      </div>
                    </td>
                    <td>
                      {d.vehicleId
                        ? vehicles.find((v) => v.id === d.vehicleId)?.plate || 'Veículo'
                        : drivers.find((v) => v.id === d.driverId)?.name || 'Motorista'}
                    </td>
                    <td>{statusNames[d.type] || d.type}</td>
                    <td>{civil(d.validUntil)}</td>
                    <td>{Math.ceil(d.size / 1024)} KB</td>
                    <td>
                      <a
                        className="icon-button"
                        aria-label={`Baixar ${d.originalName}`}
                        href={`/api/documents/${d.id}/download`}
                      >
                        <Download size={18} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <FileText size={34} />
            <h3>Nenhum documento anexado</h3>
            <p>Os documentos de veículos e motoristas serão organizados aqui.</p>
          </div>
        )}
      </section>
    </>
  );
}
