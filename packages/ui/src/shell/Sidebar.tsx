import React from "react";
import {
  BarChart3,
  Bell,
  ChevronsUpDown,
  CircleCheck,
  House,
  Keyboard,
  LogOut,
  Palette,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  Settings2,
  Target,
  UserPlus,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Avatar, Kbd, MenuItem, MenuLabel, MenuSeparator, Popover, ProjectGlyph, confirm, modKey } from "../components/primitives";
import { roleLabel } from "../lib/format";
import { useStore, type Route } from "../store";

function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button type="button" className={`nav-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined} onClick={onClick}>
      <Icon className="nav-icon" />
      <span className="nav-label">{label}</span>
      {badge ? <span className="nav-badge">{badge > 99 ? "99+" : badge}</span> : null}
    </button>
  );
}

export function Sidebar() {
  const snapshot = useStore((state) => state.snapshot)!;
  const session = useStore((state) => state.session)!;
  const route = useStore((state) => state.route);
  const navigate = useStore((state) => state.navigate);
  const unread = useStore((state) => state.unread);
  const signOut = useStore((state) => state.signOut);
  const setPaletteOpen = useStore((state) => state.setPaletteOpen);
  const openCreateTask = useStore((state) => state.openCreateTask);
  const setCreateProjectOpen = useStore((state) => state.setCreateProjectOpen);
  const setPrefs = useStore((state) => state.setPrefs);
  const platform = useStore((state) => state.platform);
  const os = useStore((state) => state.os);

  const is = (name: Route["name"]) => route.name === name;
  const activeProjectId = route.name === "project" || route.name === "project-settings" ? route.projectId : null;
  const admin = snapshot.workspace.role === "admin";
  const user = snapshot.user ?? session.user;

  const leave = async () => {
    if (await confirm({ title: "Sair do Orbitask?", message: "Você precisará entrar novamente para acessar seus projetos.", confirmLabel: "Sair" }))
      await signOut();
  };

  return (
    <aside className={`sidebar ${platform === "desktop" && os === "darwin" ? "with-traffic-lights" : ""}`} aria-label="Navegação principal">
      <div className="sidebar-top">
        <Popover
          width={264}
          trigger={(props) => (
            <button {...props} type="button" className="workspace-switch" aria-label="Menu do workspace">
              <span className="workspace-avatar">{snapshot.workspace.name.trim()[0]?.toUpperCase() ?? "O"}</span>
              <span className="workspace-name">
                <strong>{snapshot.workspace.name}</strong>
                <small>{roleLabel[snapshot.workspace.role]}</small>
              </span>
              <ChevronsUpDown className="workspace-caret" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuLabel>{snapshot.workspace.name}</MenuLabel>
              <MenuItem icon={Settings2} onSelect={() => (close(), navigate({ name: "settings", tab: "workspace" }))}>
                Ajustes do workspace
              </MenuItem>
              <MenuItem icon={Users} onSelect={() => (close(), navigate({ name: "people" }))}>
                Pessoas e acessos
              </MenuItem>
              {admin && (
                <MenuItem icon={UserPlus} onSelect={() => (close(), navigate({ name: "people" }), window.dispatchEvent(new CustomEvent("orbitask:invite")))}>
                  Convidar pessoas
                </MenuItem>
              )}
              <MenuSeparator />
              <MenuItem icon={LogOut} onSelect={() => (close(), void leave())}>
                Sair
              </MenuItem>
            </>
          )}
        </Popover>
        <button type="button" className="ui-icon-button sidebar-collapse" aria-label="Recolher barra lateral" title="Recolher barra lateral" onClick={() => setPrefs({ sidebarCollapsed: true })}>
          <PanelLeftClose />
        </button>
      </div>

      <div className="sidebar-actions">
        <button type="button" className="sidebar-search" onClick={() => setPaletteOpen(true)}>
          <Search />
          <span>Buscar</span>
          <Kbd>{modKey()}K</Kbd>
        </button>
        <button type="button" className="sidebar-new" aria-label="Nova tarefa" title="Nova tarefa (C)" onClick={() => openCreateTask()}>
          <Plus />
        </button>
      </div>

      <nav className="sidebar-nav">
        <NavItem icon={House} label="Início" active={is("home")} onClick={() => navigate({ name: "home" })} />
        <NavItem icon={CircleCheck} label="Minhas tarefas" active={is("my-tasks")} onClick={() => navigate({ name: "my-tasks" })} />
        <NavItem icon={Bell} label="Caixa de entrada" active={is("inbox")} badge={unread} onClick={() => navigate({ name: "inbox" })} />
        <NavItem icon={BarChart3} label="Relatórios" active={is("reports")} onClick={() => navigate({ name: "reports" })} />
        <NavItem icon={Target} label="Metas e portfólios" active={is("strategy")} onClick={() => navigate({ name: "strategy" })} />
        <NavItem icon={Users} label="Pessoas" active={is("people")} onClick={() => navigate({ name: "people" })} />
      </nav>

      <div className="sidebar-section">
        <div className="sidebar-section-head">
          <span>Projetos</span>
          {admin && (
            <button type="button" className="ui-icon-button small" aria-label="Novo projeto" title="Novo projeto" onClick={() => setCreateProjectOpen(true)}>
              <Plus />
            </button>
          )}
        </div>
        <div className="sidebar-projects">
          {snapshot.projects.map((project) => (
            <button
              type="button"
              key={project.id}
              className={`nav-item project ${activeProjectId === project.id ? "active" : ""}`}
              aria-current={activeProjectId === project.id ? "page" : undefined}
              onClick={() => navigate({ name: "project", projectId: project.id, view: snapshot.project.id === project.id ? (route.name === "project" ? route.view : snapshot.preferences.defaultView) : "board" })}
            >
              <ProjectGlyph icon={project.icon} color={project.color} size={18} />
              <span className="nav-label">{project.name}</span>
            </button>
          ))}
          {admin && (
            <button type="button" className="nav-item add-project" onClick={() => setCreateProjectOpen(true)}>
              <Plus className="nav-icon" />
              <span className="nav-label">Novo projeto</span>
            </button>
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <Popover
          width={240}
          trigger={(props) => (
            <button {...props} type="button" className="sidebar-user" aria-label="Menu da conta">
              <Avatar name={user.name} url={user.avatarUrl} size={26} />
              <span className="sidebar-user-name">
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </span>
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon={UserRound} onSelect={() => (close(), navigate({ name: "settings", tab: "profile" }))}>
                Meu perfil
              </MenuItem>
              <MenuItem icon={Palette} onSelect={() => (close(), navigate({ name: "settings", tab: "appearance" }))}>
                Aparência
              </MenuItem>
              <MenuItem icon={Keyboard} hint="?" onSelect={() => (close(), navigate({ name: "settings", tab: "shortcuts" }))}>
                Atalhos de teclado
              </MenuItem>
              <MenuItem icon={Settings} hint={`${modKey()},`} onSelect={() => (close(), navigate({ name: "settings", tab: "profile" }))}>
                Ajustes
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={LogOut} onSelect={() => (close(), void leave())}>
                Sair
              </MenuItem>
            </>
          )}
        </Popover>
        <button type="button" className={`ui-icon-button ${is("settings") ? "active" : ""}`} aria-label="Ajustes" title="Ajustes" onClick={() => navigate({ name: "settings", tab: "profile" })}>
          <Settings />
        </button>
      </div>
    </aside>
  );
}

/** Cabeçalho fixo e translúcido de cada página: onde estou, o que posso fazer aqui. */
export function PageHeader({
  title,
  subtitle,
  leading,
  actions,
  children,
  breadcrumb,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  breadcrumb?: { label: string; onClick: () => void }[];
}) {
  const setNavOpen = useStore((state) => state.setNavOpen);
  const collapsed = useStore((state) => state.prefs.sidebarCollapsed);
  const setPrefs = useStore((state) => state.setPrefs);
  return (
    <header className="page-header">
      <div className="page-header-row">
        <button type="button" className="ui-icon-button nav-toggle" aria-label="Abrir navegação" onClick={() => setNavOpen(true)}>
          <MenuGlyph />
        </button>
        {collapsed && (
          <button type="button" className="ui-icon-button nav-expand" aria-label="Mostrar barra lateral" title="Mostrar barra lateral" onClick={() => setPrefs({ sidebarCollapsed: false })}>
            <MenuGlyph />
          </button>
        )}
        {leading}
        <div className="page-title">
          {breadcrumb && (
            <nav className="breadcrumb" aria-label="Você está em">
              {breadcrumb.map((item) => (
                <React.Fragment key={item.label}>
                  <button type="button" onClick={item.onClick}>
                    {item.label}
                  </button>
                  <span aria-hidden="true">/</span>
                </React.Fragment>
              ))}
            </nav>
          )}
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

function MenuGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2.5" />
      <path d="M6 3v10" />
    </svg>
  );
}
