import { FormEvent, useEffect, useState } from "react";
import { Building2, Check, Info, Keyboard, LogOut, Monitor, Moon, Palette, ShieldCheck, Sun, UserRound, type LucideIcon } from "lucide-react";
import { api, errorMessage } from "../api";
import { LogoMark } from "../components/Logo";
import { requestUpdateCheck } from "../components/UpdateNotice";
import { Avatar, Kbd, Spinner, Switch, confirm, modKey } from "../components/primitives";
import { formatDate, roleLabel } from "../lib/format";
import { PageHeader } from "../shell/Sidebar";
import { useStore, type Accent, type SettingsTab } from "../store";
import { APP_VERSION, siteUrl } from "../version";

const tabs: { id: SettingsTab; label: string; icon: LucideIcon; group: string }[] = [
  { id: "profile", label: "Perfil", icon: UserRound, group: "Conta" },
  { id: "security", label: "Senha e segurança", icon: ShieldCheck, group: "Conta" },
  { id: "appearance", label: "Aparência", icon: Palette, group: "Preferências" },
  { id: "shortcuts", label: "Atalhos de teclado", icon: Keyboard, group: "Preferências" },
  { id: "workspace", label: "Workspace", icon: Building2, group: "Workspace" },
  { id: "about", label: "Sobre o Orbitask", icon: Info, group: "Workspace" },
];

export function SettingsScreen({ tab }: { tab: SettingsTab }) {
  const navigate = useStore((state) => state.navigate);
  const current = tabs.find((item) => item.id === tab) ?? tabs[0];
  let lastGroup = "";
  return (
    <div className="page">
      <PageHeader title="Ajustes" subtitle="Sua conta, preferências e o workspace" />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Seções de ajustes">
          {tabs.map((item) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            const Icon = item.icon;
            return (
              <div key={item.id}>
                {header && <div className="settings-nav-group">{header}</div>}
                <button
                  type="button"
                  className={`settings-nav-item ${item.id === current.id ? "active" : ""}`}
                  aria-current={item.id === current.id ? "page" : undefined}
                  onClick={() => navigate({ name: "settings", tab: item.id })}
                >
                  <span className="settings-nav-icon">
                    <Icon />
                  </span>
                  {item.label}
                </button>
              </div>
            );
          })}
        </nav>
        <div className="settings-content">
          <h2 className="settings-title">{current.label}</h2>
          {current.id === "profile" && <ProfileSettings />}
          {current.id === "security" && <SecuritySettings />}
          {current.id === "appearance" && <AppearanceSettings />}
          {current.id === "shortcuts" && <ShortcutSettings />}
          {current.id === "workspace" && <WorkspaceSettings />}
          {current.id === "about" && <AboutSettings />}
        </div>
      </div>
    </div>
  );
}

export function SettingsGroup({ title, description, children, footer }: { title?: string; description?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section className="settings-group">
      {(title || description) && (
        <header>
          {title && <h3>{title}</h3>}
          {description && <p>{description}</p>}
        </header>
      )}
      <div className="ui-card settings-card">{children}</div>
      {footer && <div className="settings-group-footer">{footer}</div>}
    </section>
  );
}

export function SettingsRow({ label, description, children }: { label: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        <strong>{label}</strong>
        {description && <span>{description}</span>}
      </div>
      {children && <div className="settings-row-control">{children}</div>}
    </div>
  );
}

function ProfileSettings() {
  const snapshot = useStore((state) => state.snapshot)!;
  const session = useStore((state) => state.session)!;
  const setSession = useStore((state) => state.setSession);
  const patchSnapshot = useStore((state) => state.patchSnapshot);
  const toast = useStore((state) => state.toast);
  const [form, setForm] = useState({ name: snapshot.user.name, avatarUrl: snapshot.user.avatarUrl ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = form.name.trim() !== snapshot.user.name || (form.avatarUrl.trim() || null) !== snapshot.user.avatarUrl;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await api().updateProfile({ name: form.name.trim(), avatarUrl: form.avatarUrl.trim() || null });
      setSession({ ...session, user });
      patchSnapshot((current) => ({
        ...current,
        user,
        members: current.members.map((member) => (member.userId === user.id ? { ...member, name: user.name, avatarUrl: user.avatarUrl } : member)),
      }));
      toast("Perfil atualizado", { tone: "success" });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="profile-hero">
        <Avatar name={form.name || snapshot.user.name} url={form.avatarUrl || null} size={64} />
        <div>
          <strong>{snapshot.user.name}</strong>
          <span>{snapshot.user.email}</span>
          <small>Membro desde {formatDate(snapshot.user.createdAt)}</small>
        </div>
      </div>
      <SettingsGroup>
        <div className="settings-form">
          <label className="ui-field">
            <span>Nome</span>
            <input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" />
          </label>
          <label className="ui-field">
            <span>E-mail</span>
            <input value={snapshot.user.email} disabled />
            <small>O e-mail identifica sua conta e não pode ser alterado por aqui.</small>
          </label>
          <label className="ui-field">
            <span>
              Foto <em>URL de uma imagem</em>
            </span>
            <input type="url" value={form.avatarUrl} onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })} placeholder="https://…" />
          </label>
        </div>
      </SettingsGroup>
      {error && <div className="ui-alert error">{error}</div>}
      <div className="settings-actions">
        <button type="button" className="ui-button" disabled={!dirty} onClick={() => setForm({ name: snapshot.user.name, avatarUrl: snapshot.user.avatarUrl ?? "" })}>
          Descartar
        </button>
        <button className="ui-button primary" disabled={!dirty || busy || form.name.trim().length < 2}>
          {busy && <Spinner size={14} />}
          Salvar alterações
        </button>
      </div>
    </form>
  );
}

function SecuritySettings() {
  const toast = useStore((state) => state.toast);
  const fail = useStore((state) => state.fail);
  const signOut = useStore((state) => state.signOut);
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mismatch = form.confirm.length > 0 && form.confirm !== form.newPassword;
  const strength = Math.min(4, [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/, /.{12,}/].filter((rule) => rule.test(form.newPassword)).length);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mismatch) return;
    setBusy(true);
    setError("");
    try {
      const result = await api().changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
      toast(result.revoked ? `Senha alterada. ${result.revoked} outra(s) sessão(ões) encerrada(s).` : "Senha alterada", { tone: "success" });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const others = async () => {
    if (!(await confirm({ title: "Encerrar as outras sessões?", message: "Você continua conectado aqui. Outros navegadores e computadores precisarão entrar de novo.", confirmLabel: "Encerrar sessões" }))) return;
    try {
      const result = await api().signOutOtherSessions();
      toast(result.revoked ? `${result.revoked} sessão(ões) encerrada(s)` : "Nenhuma outra sessão estava ativa", { tone: "success" });
    } catch (error) {
      fail(error);
    }
  };

  return (
    <>
      <form onSubmit={submit}>
        <SettingsGroup title="Alterar senha" description="Use pelo menos 8 caracteres. Ao trocar a senha, as outras sessões são encerradas.">
          <div className="settings-form">
            <label className="ui-field">
              <span>Senha atual</span>
              <input type="password" required autoComplete="current-password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} />
            </label>
            <label className="ui-field">
              <span>Nova senha</span>
              <input type="password" required minLength={8} autoComplete="new-password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} />
              {form.newPassword && (
                <span className="strength" data-level={strength}>
                  <i />
                  <i />
                  <i />
                  <i />
                  <small>{["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"][strength]}</small>
                </span>
              )}
            </label>
            <label className="ui-field">
              <span>Confirmar nova senha</span>
              <input type="password" required autoComplete="new-password" value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} aria-invalid={mismatch} />
              {mismatch && <small className="field-error">As senhas não coincidem</small>}
            </label>
          </div>
        </SettingsGroup>
        {error && <div className="ui-alert error">{error}</div>}
        <div className="settings-actions">
          <button className="ui-button primary" disabled={busy || mismatch || form.newPassword.length < 8 || !form.currentPassword}>
            {busy && <Spinner size={14} />}
            Alterar senha
          </button>
        </div>
      </form>
      <SettingsGroup title="Sessões">
        <SettingsRow label="Encerrar outras sessões" description="Desconecta todos os outros dispositivos, mantendo este.">
          <button type="button" className="ui-button" onClick={others}>
            Encerrar
          </button>
        </SettingsRow>
        <SettingsRow label="Sair deste dispositivo" description="Você precisará entrar novamente.">
          <button type="button" className="ui-button danger-ghost" onClick={() => void signOut()}>
            <LogOut /> Sair
          </button>
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}

const accents: { id: Accent; label: string; color: string }[] = [
  { id: "violet", label: "Violeta", color: "#6559e8" },
  { id: "blue", label: "Azul", color: "#0a7aff" },
  { id: "pink", label: "Rosa", color: "#e0457b" },
  { id: "orange", label: "Laranja", color: "#ec7a1c" },
  { id: "green", label: "Verde", color: "#23a26d" },
  { id: "graphite", label: "Grafite", color: "#4b4b55" },
];

function AppearanceSettings() {
  const prefs = useStore((state) => state.prefs);
  const setPrefs = useStore((state) => state.setPrefs);
  const themes = [
    { id: "system" as const, label: "Automático", icon: Monitor },
    { id: "light" as const, label: "Claro", icon: Sun },
    { id: "dark" as const, label: "Escuro", icon: Moon },
  ];
  return (
    <>
      <SettingsGroup title="Tema" description="Automático acompanha a aparência do sistema.">
        <div className="theme-cards" role="radiogroup" aria-label="Tema">
          {themes.map((theme) => (
            <button type="button" key={theme.id} role="radio" aria-checked={prefs.theme === theme.id} className={`theme-card ${prefs.theme === theme.id ? "selected" : ""}`} onClick={() => setPrefs({ theme: theme.id })}>
              <span className={`theme-preview ${theme.id}`}>
                <i />
                <i />
                <i />
              </span>
              <span className="theme-label">
                <theme.icon /> {theme.label}
              </span>
            </button>
          ))}
        </div>
      </SettingsGroup>
      <SettingsGroup title="Cor de destaque" description="Usada em botões, seleção e indicadores.">
        <div className="accent-row" role="radiogroup" aria-label="Cor de destaque">
          {accents.map((accent) => (
            <button
              type="button"
              key={accent.id}
              role="radio"
              aria-checked={prefs.accent === accent.id}
              className={`accent-swatch ${prefs.accent === accent.id ? "selected" : ""}`}
              style={{ "--swatch": accent.color } as React.CSSProperties}
              onClick={() => setPrefs({ accent: accent.id })}
            >
              <span>{prefs.accent === accent.id && <Check />}</span>
              <small>{accent.label}</small>
            </button>
          ))}
        </div>
      </SettingsGroup>
      <SettingsGroup title="Navegação">
        <SettingsRow label="Mostrar barra lateral" description="Você também pode recolher pela barra lateral.">
          <Switch label="Mostrar barra lateral" checked={!prefs.sidebarCollapsed} onChange={(value) => setPrefs({ sidebarCollapsed: !value })} />
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}

export const shortcutList = () => [
  { group: "Geral", items: [
    { keys: [modKey(), "K"], label: "Buscar e executar comandos" },
    { keys: ["C"], label: "Nova tarefa" },
    { keys: [modKey(), ","], label: "Abrir ajustes" },
    { keys: ["?"], label: "Ver atalhos" },
    { keys: ["Esc"], label: "Fechar painel ou janela" },
  ] },
  { group: "Navegação", items: [
    { keys: ["G", "I"], label: "Ir para Início" },
    { keys: ["G", "T"], label: "Ir para Minhas tarefas" },
    { keys: ["G", "E"], label: "Ir para Caixa de entrada" },
    { keys: ["G", "R"], label: "Ir para Relatórios" },
  ] },
  { group: "Projeto", items: [
    { keys: ["1"], label: "Visão geral" },
    { keys: ["2"], label: "Quadro" },
    { keys: ["3"], label: "Lista" },
    { keys: ["4"], label: "Calendário" },
    { keys: ["5"], label: "Cronograma" },
    { keys: ["/"], label: "Filtrar tarefas" },
  ] },
];

function ShortcutSettings() {
  return (
    <>
      {shortcutList().map((group) => (
        <SettingsGroup key={group.group} title={group.group}>
          {group.items.map((item) => (
            <SettingsRow key={item.label} label={item.label}>
              <span className="kbd-combo">
                {item.keys.map((key, index) => (
                  <Kbd key={index}>{key}</Kbd>
                ))}
              </span>
            </SettingsRow>
          ))}
        </SettingsGroup>
      ))}
    </>
  );
}

function WorkspaceSettings() {
  const snapshot = useStore((state) => state.snapshot)!;
  const session = useStore((state) => state.session)!;
  const setSession = useStore((state) => state.setSession);
  const patchSnapshot = useStore((state) => state.patchSnapshot);
  const navigate = useStore((state) => state.navigate);
  const toast = useStore((state) => state.toast);
  const [name, setName] = useState(snapshot.workspace.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const admin = snapshot.workspace.role === "admin";
  useEffect(() => setName(snapshot.workspace.name), [snapshot.workspace.name]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const workspace = await api().updateWorkspace({ name: name.trim() });
      setSession({ ...session, workspace });
      patchSnapshot((current) => ({ ...current, workspace }));
      toast("Workspace renomeado", { tone: "success" });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form onSubmit={submit}>
        <SettingsGroup title="Identidade" description={admin ? "O nome aparece para todas as pessoas do workspace." : "Somente administradores podem alterar o nome."}>
          <div className="settings-form">
            <label className="ui-field">
              <span>Nome do workspace</span>
              <input value={name} disabled={!admin} minLength={2} maxLength={160} onChange={(event) => setName(event.target.value)} />
            </label>
          </div>
        </SettingsGroup>
        {error && <div className="ui-alert error">{error}</div>}
        {admin && (
          <div className="settings-actions">
            <button className="ui-button primary" disabled={busy || name.trim().length < 2 || name.trim() === snapshot.workspace.name}>
              {busy && <Spinner size={14} />}
              Salvar
            </button>
          </div>
        )}
      </form>
      <SettingsGroup title="Resumo">
        <SettingsRow label="Seu papel" description={roleLabel[snapshot.workspace.role]} />
        <SettingsRow label="Pessoas" description={`${snapshot.members.length} membro(s) · ${snapshot.invites.length} convite(s) pendente(s)`}>
          <button type="button" className="ui-button" onClick={() => navigate({ name: "people" })}>
            Gerenciar
          </button>
        </SettingsRow>
        <SettingsRow label="Projetos" description={`${snapshot.projects.length} projeto(s)`}>
          <button type="button" className="ui-button" onClick={() => navigate({ name: "project-settings", projectId: snapshot.project.id, tab: "general" })}>
            Configurar projeto atual
          </button>
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}

function AboutSettings() {
  const platform = useStore((state) => state.platform);
  const os = useStore((state) => state.os);
  return (
    <>
      <div className="about-hero">
        <LogoMark size={64} />
        <div>
          <strong>Orbitask</strong>
          <span>Versão {APP_VERSION}</span>
          <small>{platform === "desktop" ? `Aplicativo Desktop${os === "darwin" ? " para macOS" : os === "win32" ? " para Windows" : ""}` : "Aplicativo Web"}</small>
        </div>
      </div>
      <SettingsGroup>
        <SettingsRow label="Novidades" description="O que mudou nas últimas versões.">
          <a className="ui-button" href={`${siteUrl()}/novidades`} target="_blank" rel="noreferrer">
            Ver notas
          </a>
        </SettingsRow>
        {platform === "desktop" && window.orbitaskDesktop?.updates && (
          <SettingsRow label="Atualizações" description="O Orbitask verifica sozinho ao abrir e a cada 6 horas.">
            <button type="button" className="ui-button" onClick={requestUpdateCheck}>
              Buscar atualizações
            </button>
          </SettingsRow>
        )}
        <SettingsRow label="Seus dados" description="Projetos e tarefas ficam na API Orbitask com PostgreSQL. Senhas são protegidas com bcrypt." />
      </SettingsGroup>
    </>
  );
}
