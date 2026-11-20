'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Route, ArrowRight, ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
const schema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
});
export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });
  return (
    <main className="login-page">
      <section className="login-story">
        <Link className="brand light" href="/">
          <span className="brand-icon">
            <Route size={23} />
          </span>
          FrotaLab.
        </Link>
        <div>
          <span className="eyebrow">SUA OPERAÇÃO, CONECTADA</span>
          <h1>
            Bom planejamento.
            <br />
            Mais movimento.
          </h1>
          <p>As pessoas certas, as informações certas e cada etapa da sua frota no mesmo lugar.</p>
          <div className="login-road">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <span className="login-footer">
          <ShieldCheck size={16} /> Acesso seguro por perfil
        </span>
      </section>
      <section className="login-main">
        <Link href="/" className="back-link">
          <ArrowLeft size={17} /> Voltar ao início
        </Link>
        <div className="login-card">
          <span className="eyebrow">BEM-VINDO AO FROTALAB</span>
          <h2>Entre na sua operação.</h2>
          <p>Use seu e-mail e sua senha para continuar.</p>
          <form
            method="post"
            onSubmit={handleSubmit(async (data) => {
              setError('');
              try {
                await api('/auth/login', { method: 'POST', body: data });
                router.push('/app');
                router.refresh();
              } catch (e) {
                setError((e as Error).message);
              }
            })}
          >
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              disabled={!ready}
              type="email"
              autoComplete="username"
              placeholder="voce@empresa.com"
              {...register('email')}
            />
            {errors.email && <small className="field-error">{errors.email.message}</small>}
            <label htmlFor="password">Senha</label>
            <div className="password-input">
              <input
                id="password"
                disabled={!ready}
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Sua senha"
                {...register('password')}
              />
              <button
                type="button"
                aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <small className="field-error">{errors.password.message}</small>}
            {error && (
              <div className="error-box" role="alert">
                {error}
              </div>
            )}
            <button className="button primary full" disabled={isSubmitting || !ready}>
              {isSubmitting ? 'Entrando…' : 'Entrar no sistema'}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="demo-box">
            <strong>Explore a demonstração</strong>
            <p>Contas fictícias para conhecer os perfis.</p>
            <div className="demo-roles">
              {[
                ['admin', 'Administrador'],
                ['gestor', 'Gestor'],
                ['operador', 'Operador'],
                ['motorista', 'Motorista'],
                ['mecanico', 'Mecânico'],
              ].map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => {
                    setValue('email', `${id}@frotalab.test`);
                    setValue('password', 'FrotaLab@2026');
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            <small>Senha inicial da demonstração: FrotaLab@2026</small>
          </div>
        </div>
        <footer>Projeto acadêmico · Dados de demonstração fictícios</footer>
      </section>
    </main>
  );
}
