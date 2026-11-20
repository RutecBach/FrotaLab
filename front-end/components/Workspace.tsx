'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import {
  Route,
  LayoutDashboard,
  Truck,
  Users,
  Building2,
  Package,
  Fuel,
  Wrench,
  CalendarClock,
  FileText,
  MapPin,
  BarChart3,
  AlertTriangle,
  Plug,
  UserCog,
  History,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { api, setCsrf, SessionUser, roleNames } from '../lib/api';
import { modules } from './modules';
import Overview from './Overview';
import DataPage from './DataPage';
import Reports from './Reports';
import Documents from './Documents';
import Alerts from './Alerts';
import Integrations from './Integrations';
import Audit from './Audit';
const Tracking = dynamic(() => import('./Tracking'), {
  ssr: false,
  loading: () => <div className="panel empty-state">Carregando mapa…</div>,
});
const links = [
  { id: 'overview', name: 'Visão geral', icon: LayoutDashboard, group: 'PRINCIPAL' },
  { id: 'vehicles', name: 'Veículos', icon: Truck, group: 'FROTA' },
  { id: 'drivers', name: 'Motoristas', icon: Users },
  { id: 'centers', name: 'Centros de distribuição', icon: Building2 },
  { id: 'routes', name: 'Rotas', icon: Route, group: 'OPERAÇÃO' },
  { id: 'deliveries', name: 'Entregas', icon: Package },
  { id: 'tracking', name: 'Rastreamento', icon: MapPin },
  { id: 'fuel', name: 'Abastecimentos', icon: Fuel },
  { id: 'maintenance-orders', name: 'Manutenções', icon: Wrench, group: 'CONTROLE' },
  { id: 'maintenance-plans', name: 'Revisões preventivas', icon: CalendarClock },
  { id: 'documents', name: 'Documentos', icon: FileText },
  { id: 'alerts', name: 'Alertas', icon: AlertTriangle },
  { id: 'reports', name: 'Relatórios', icon: BarChart3 },
  { id: 'integrations', name: 'Integração ERP', icon: Plug, group: 'ADMINISTRAÇÃO' },
  { id: 'users', name: 'Usuários', icon: UserCog },
  { id: 'audit', name: 'Atividades', icon: History },
];
function canView(id: string, role: string) {
  if (modules[id]) return modules[id].roles.includes(role);
  if (id === 'reports') return ['ADMIN', 'MANAGER'].includes(role);
  if (['integrations', 'audit'].includes(id)) return role === 'ADMIN';
  if (id === 'tracking') return ['ADMIN', 'MANAGER', 'OPERATOR'].includes(role);
  if (id === 'alerts') return role !== 'DRIVER';
  return true;
}
export default function Workspace({
  user,
  csrfToken,
  section,
}: {
  user: SessionUser;
  csrfToken: string;
  section: string;
}) {
  setCsrf(csrfToken);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState('');
  const title = links.find((l) => l.id === section)?.name || 'Página não encontrada';
  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('');
  return (
    <div className="workspace">
      {menu && (
        <button
          className="sidebar-shade"
          aria-label="Fechar navegação"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? 'is-open' : ''}`}>
        <Link className="brand light" href="/app">
          <span className="brand-icon">
            <Route size={23} />
          </span>
          FrotaLab<span className="brand-dot">.</span>
        </Link>
        <span className="workspace-label">GESTÃO DE FROTAS</span>
        <nav aria-label="Navegação principal">
          {links
            .filter((l) => canView(l.id, user.role))
            .map(({ id, name, icon: Icon, group }) => (
              <div key={id}>
                {group && <span className="nav-group">{group}</span>}
                <Link
                  className={`nav-link ${section === id ? 'active' : ''}`}
                  href={id === 'overview' ? '/app' : `/app/${id}`}
                  onClick={() => setMenu(false)}
                >
                  <Icon size={18} />
                  <span>{name}</span>
                  {section === id && <span className="nav-active-dot" />}
                </Link>
              </div>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="demo-indicator">
            <span /> Ambiente acadêmico
          </span>
          <small>Dados de demonstração fictícios</small>
          <Link href="/como-funciona">
            Sobre o FrotaLab <ChevronRight size={14} />
          </Link>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu(!menu)}
              aria-label="Abrir navegação"
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              Operação <ChevronRight size={13} />
              <strong>{title}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="role-chip">{roleNames[user.role]}</span>
            <div className="user-avatar">{initials}</div>
            <div className="user-label">
              <strong>{user.name}</strong>
              <small>{roleNames[user.role]}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Sair do sistema"
              title="Sair do sistema"
              onClick={async () => {
                try {
                  await api('/auth/logout', { method: 'POST', body: {} });
                  window.location.assign('/login');
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="workspace-content">
          {error && <div className="error-box">{error}</div>}
          {!canView(section, user.role) ? (
            <div className="empty-state">
              <h1>Área restrita</h1>
              <p>Seu perfil não tem acesso a esta área.</p>
            </div>
          ) : section === 'overview' ? (
            <Overview user={user} />
          ) : modules[section] ? (
            <DataPage key={section} section={section} user={user} />
          ) : section === 'reports' ? (
            <Reports />
          ) : section === 'documents' ? (
            <Documents user={user} />
          ) : section === 'tracking' ? (
            <Tracking />
          ) : section === 'alerts' ? (
            <Alerts />
          ) : section === 'integrations' ? (
            <Integrations />
          ) : section === 'audit' ? (
            <Audit />
          ) : (
            <div className="empty-state">
              <h1>Página não encontrada</h1>
              <Link href="/app">Voltar à visão geral</Link>
            </div>
          )}
          <footer className="workspace-footer">
            <span>FrotaLab · Gestão de frotas e logística</span>
            <span>Projeto acadêmico · UTFPR</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
