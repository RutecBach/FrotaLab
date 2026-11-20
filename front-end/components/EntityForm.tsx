'use client';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, ArrowUp, ArrowDown, Plus, Trash2 } from 'lucide-react';
import type { Field } from './modules';
import { localDateTime, initialDateTime } from '../lib/dates';
export default function EntityForm({
  title,
  fields,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  fields: Field[];
  initial?: any;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState('');
  const shape: Record<string, z.ZodType> = {};
  const defaults: Record<string, any> = {};
  for (const f of fields) {
    const optional = f.required === false || (!!initial && f.type === 'password');
    if (f.type === 'checkbox') shape[f.key] = z.boolean();
    else if (['multi', 'ordered'].includes(f.type || ''))
      shape[f.key] = z.array(z.string()).min(optional ? 0 : 1, 'Selecione pelo menos uma opção.');
    else shape[f.key] = optional ? z.any() : z.string().min(1, 'Preencha este campo.');
    let value =
      initial?.[f.key] ??
      f.default ??
      (f.type === 'checkbox' ? false : ['multi', 'ordered'].includes(f.type || '') ? [] : '');
    if (f.type === 'password') value = '';
    if (f.type === 'datetime-local') value = value ? localDateTime(value) : initialDateTime(f.key);
    if (f.type === 'money' && value !== '') value = String(value / 100);
    if (typeof value === 'number') value = String(value);
    defaults[f.key] = value;
  }
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Record<string, any>>({
    resolver: zodResolver(z.object(shape)),
    defaultValues: defaults,
  });
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  return (
    <dialog className="modal" ref={dialog} aria-labelledby="form-title" onCancel={onClose}>
      <div className="modal-heading">
        <div>
          <span className="eyebrow">FROTALAB · CADASTRO</span>
          <h2 id="form-title">{title}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Fechar formulário">
          <X size={20} />
        </button>
      </div>
      <form
        onSubmit={handleSubmit(async (values) => {
          setError('');
          const data: any = {};
          for (const f of fields) {
            let v = values[f.key];
            if (f.type === 'password' && !v && initial) continue;
            if (v === '' && f.required === false) {
              if (f.type === 'number' || f.type === 'date' || f.key === 'planId')
                data[f.key] = null;
              continue;
            }
            if (['number', 'decimal', 'money'].includes(f.type || ''))
              v = f.type === 'money' ? Math.round(Number(v) * 100) : Number(v);
            if (f.type === 'datetime-local') v = new Date(v).toISOString();
            data[f.key] = v;
          }
          try {
            await onSave(data);
          } catch (e) {
            setError((e as Error).message);
          }
        })}
      >
        <div className="form-grid">
          {fields.map((f) => (
            <div
              className={`form-field ${f.type === 'ordered' || f.type === 'checkbox' ? 'wide' : ''}`}
              key={f.key}
            >
              <label htmlFor={`field-${f.key}`}>
                {f.label}
                {f.required === false && <span> opcional</span>}
              </label>
              {f.type === 'checkbox' ? (
                <label className="checkbox-label">
                  <input id={`field-${f.key}`} type="checkbox" {...register(f.key)} />{' '}
                  {f.key === 'blocking' ? 'Sim, bloquear novas viagens' : 'Sim, manter ativo'}
                </label>
              ) : f.type === 'ordered' ? (
                <OrderedPicker
                  value={watch(f.key) || []}
                  options={f.options || []}
                  onChange={(v) => setValue(f.key, v, { shouldValidate: true })}
                />
              ) : f.type === 'select' || f.type === 'multi' ? (
                <select id={`field-${f.key}`} multiple={f.type === 'multi'} {...register(f.key)}>
                  <option value="" disabled={f.required !== false}>
                    Selecione…
                  </option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`field-${f.key}`}
                  type={
                    ['number', 'decimal', 'money'].includes(f.type || '')
                      ? 'number'
                      : f.type || 'text'
                  }
                  step={f.type === 'decimal' ? 'any' : f.type === 'money' ? '0.01' : '1'}
                  autoComplete={f.type === 'password' ? 'new-password' : 'off'}
                  {...register(f.key)}
                />
              )}{' '}
              {f.type === 'password' && (
                <small>
                  Mínimo de 10 caracteres.{initial ? ' Deixe em branco para manter a senha.' : ''}
                </small>
              )}
              {f.type === 'multi' && (
                <small>Selecione as categorias que constam na habilitação.</small>
              )}
              {errors[f.key] && (
                <small className="field-error">{String(errors[f.key]?.message)}</small>
              )}
            </div>
          ))}
        </div>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : 'Salvar cadastro'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
function OrderedPicker({
  value,
  options,
  onChange,
}: {
  value: string[];
  options: { value: string; label: string }[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="order-picker">
      <select
        aria-label="Adicionar entrega à rota"
        value=""
        onChange={(e) => e.target.value && onChange([...value, e.target.value])}
      >
        <option value="">Adicionar entrega pendente…</option>
        {options
          .filter((o) => !value.includes(o.value))
          .map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
      </select>
      {value.length === 0 && (
        <p className="muted">
          Nenhuma parada adicionada. Você pode organizar as entregas antes de atribuir a rota.
        </p>
      )}
      {value.map((id, i) => (
        <div className="order-row" key={id}>
          <span className="stop-number">{i + 1}</span>
          <span>{options.find((o) => o.value === id)?.label || id}</span>
          <button
            type="button"
            className="icon-button"
            disabled={i === 0}
            aria-label="Subir parada"
            onClick={() => {
              const n = [...value];
              [n[i - 1], n[i]] = [n[i], n[i - 1]];
              onChange(n);
            }}
          >
            <ArrowUp size={15} />
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={i === value.length - 1}
            aria-label="Descer parada"
            onClick={() => {
              const n = [...value];
              [n[i], n[i + 1]] = [n[i + 1], n[i]];
              onChange(n);
            }}
          >
            <ArrowDown size={15} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Remover parada"
            onClick={() => onChange(value.filter((x) => x !== id))}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
