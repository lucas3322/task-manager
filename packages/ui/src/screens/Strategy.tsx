import { FormEvent, useEffect, useState } from "react";
import { Briefcase, CalendarDays, MoreHorizontal, Pencil, Plus, Target, Trash2 } from "lucide-react";
import type { Goal, GoalStatus, Portfolio, PortfolioHealth, PortfolioOverview } from "@orbitask/contracts";
import { api, errorMessage } from "../api";
import { Avatar, Badge, ColorSwatches, Dialog, EmptyState, MenuItem, Popover, ProgressBar, ProjectGlyph, Segmented, Spinner, confirm } from "../components/primitives";
import { goalLabels, goalTone, healthLabels, healthTone, palette } from "../lib/catalog";
import { formatDate } from "../lib/format";
import { PageHeader } from "../shell/Sidebar";
import { useStore } from "../store";

type Editing = { kind: "goal"; value: Goal | null } | { kind: "portfolio"; value: Portfolio | null } | null;

export function StrategyScreen() {
  const snapshot = useStore((state) => state.snapshot)!;
  const fail = useStore((state) => state.fail);
  const toast = useStore((state) => state.toast);
  const navigate = useStore((state) => state.navigate);
  const [data, setData] = useState<PortfolioOverview | null>(null);
  const [tab, setTab] = useState<"goals" | "portfolios">("goals");
  const [editing, setEditing] = useState<Editing>(null);
  const admin = snapshot.workspace.role === "admin";

  const load = () =>
    api()
      .getPortfolioOverview()
      .then(setData)
      .catch((error) => {
        setData({ portfolios: [], goals: [], projectMetrics: [] });
        fail(error, "Não foi possível carregar metas e portfólios");
      });
  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const member = (id: string | null) => snapshot.members.find((item) => item.userId === id);
  const metric = (id: string) => data?.projectMetrics.find((item) => item.id === id);

  const remove = async (kind: "goal" | "portfolio", id: string, name: string) => {
    if (!(await confirm({ title: `Excluir “${name}”?`, message: "Essa ação não pode ser desfeita. Os projetos vinculados não são afetados.", confirmLabel: "Excluir", destructive: true }))) return;
    try {
      if (kind === "goal") await api().removeGoal(id);
      else await api().removePortfolio(id);
      toast(kind === "goal" ? "Meta excluída" : "Portfólio excluído");
      await load();
    } catch (error) {
      fail(error);
    }
  };

  const actions = (kind: "goal" | "portfolio", item: Goal | Portfolio, name: string) =>
    admin && (
      <Popover
        align="end"
        trigger={(props) => (
          <button {...props} type="button" className="ui-icon-button small" aria-label="Mais ações">
            <MoreHorizontal />
          </button>
        )}
      >
        {(close) => (
          <>
            <MenuItem icon={Pencil} onSelect={() => (close(), setEditing(kind === "goal" ? { kind, value: item as Goal } : { kind, value: item as Portfolio }))}>
              Editar
            </MenuItem>
            <MenuItem icon={Trash2} danger onSelect={() => (close(), void remove(kind, item.id, name))}>
              Excluir
            </MenuItem>
          </>
        )}
      </Popover>
    );

  const linkedProjects = (ids: string[]) =>
    ids.length ? (
      <div className="linked-projects">
        {ids.map((id) => {
          const project = snapshot.projects.find((item) => item.id === id);
          if (!project) return null;
          return (
            <button type="button" key={id} className="linked-project" onClick={() => navigate({ name: "project", projectId: id, view: "overview" })}>
              <ProjectGlyph icon={project.icon} color={project.color} size={16} />
              {project.name}
              {metric(id) && <span className="tabular">{metric(id)!.progress}%</span>}
            </button>
          );
        })}
      </div>
    ) : (
      <p className="subtle small-text">Nenhum projeto vinculado</p>
    );

  return (
    <div className="page">
      <PageHeader
        title="Metas e portfólios"
        subtitle="Conecte o trabalho do dia a dia aos objetivos da equipe"
        actions={
          admin && (
            <button type="button" className="ui-button primary" onClick={() => setEditing(tab === "goals" ? { kind: "goal", value: null } : { kind: "portfolio", value: null })}>
              <Plus /> {tab === "goals" ? "Nova meta" : "Novo portfólio"}
            </button>
          )
        }
      >
        <div className="page-toolbar">
          <Segmented
            label="Seção"
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { value: "goals", label: `Metas${data ? ` · ${data.goals.length}` : ""}`, icon: Target },
              { value: "portfolios", label: `Portfólios${data ? ` · ${data.portfolios.length}` : ""}`, icon: Briefcase },
            ]}
          />
        </div>
      </PageHeader>
      <div className="page-body">
        {!data && (
          <div className="page-loading">
            <Spinner />
          </div>
        )}
        {data && tab === "goals" && (
          <>
            {!data.goals.length && (
              <EmptyState
                icon={Target}
                title="Nenhuma meta ainda"
                action={admin && <button className="ui-button primary" onClick={() => setEditing({ kind: "goal", value: null })}><Plus /> Criar primeira meta</button>}
              >
                Metas dão direção: defina um objetivo, um responsável, um prazo e vincule os projetos que contribuem para ele.
              </EmptyState>
            )}
            <div className="card-grid">
              {data.goals.map((goal) => {
                const owner = member(goal.ownerId);
                return (
                  <article key={goal.id} className="ui-card strategy-card">
                    <header>
                      <Badge tone={goalTone[goal.status]}>{goalLabels[goal.status]}</Badge>
                      <span className="spacer" />
                      {actions("goal", goal, goal.title)}
                    </header>
                    <h3>{goal.title}</h3>
                    {goal.description && <p className="muted">{goal.description}</p>}
                    <div className="strategy-progress">
                      <ProgressBar value={goal.progress} label="Progresso da meta" />
                      <span className="tabular">{goal.progress}%</span>
                    </div>
                    {linkedProjects(goal.projectIds)}
                    <footer>
                      {owner ? (
                        <span className="meta-person">
                          <Avatar name={owner.name} url={owner.avatarUrl} size={20} /> {owner.name}
                        </span>
                      ) : (
                        <span className="subtle">Sem responsável</span>
                      )}
                      {goal.dueDate && (
                        <span className="meta-date">
                          <CalendarDays /> {formatDate(goal.dueDate)}
                        </span>
                      )}
                    </footer>
                  </article>
                );
              })}
            </div>
          </>
        )}
        {data && tab === "portfolios" && (
          <>
            {!data.portfolios.length && (
              <EmptyState
                icon={Briefcase}
                title="Nenhum portfólio ainda"
                action={admin && <button className="ui-button primary" onClick={() => setEditing({ kind: "portfolio", value: null })}><Plus /> Criar primeiro portfólio</button>}
              >
                Portfólios agrupam projetos relacionados para acompanhar saúde e progresso em conjunto.
              </EmptyState>
            )}
            <div className="card-grid">
              {data.portfolios.map((portfolio) => {
                const owner = member(portfolio.ownerId);
                const metrics = portfolio.projectIds.map(metric).filter(Boolean);
                const total = metrics.reduce((sum, item) => sum + item!.total, 0);
                const done = metrics.reduce((sum, item) => sum + item!.completed, 0);
                const progress = total ? Math.round((done / total) * 100) : 0;
                return (
                  <article key={portfolio.id} className="ui-card strategy-card" style={{ "--card-accent": portfolio.color } as React.CSSProperties}>
                    <header>
                      <span className="portfolio-swatch" />
                      <Badge tone={healthTone[portfolio.health]}>{healthLabels[portfolio.health]}</Badge>
                      <span className="spacer" />
                      {actions("portfolio", portfolio, portfolio.name)}
                    </header>
                    <h3>{portfolio.name}</h3>
                    {portfolio.description && <p className="muted">{portfolio.description}</p>}
                    <div className="strategy-progress">
                      <ProgressBar value={progress} color={portfolio.color} label="Progresso do portfólio" />
                      <span className="tabular">{progress}%</span>
                    </div>
                    {linkedProjects(portfolio.projectIds)}
                    <footer>
                      {owner ? (
                        <span className="meta-person">
                          <Avatar name={owner.name} url={owner.avatarUrl} size={20} /> {owner.name}
                        </span>
                      ) : (
                        <span className="subtle">Sem responsável</span>
                      )}
                      {(portfolio.startDate || portfolio.dueDate) && (
                        <span className="meta-date">
                          <CalendarDays /> {portfolio.startDate ? formatDate(portfolio.startDate, false) : "…"} – {portfolio.dueDate ? formatDate(portfolio.dueDate) : "…"}
                        </span>
                      )}
                    </footer>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
      <StrategyDialog editing={editing} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  );
}

function StrategyDialog({ editing, onClose, onSaved }: { editing: Editing; onClose: () => void; onSaved: () => Promise<void> }) {
  const snapshot = useStore((state) => state.snapshot)!;
  const toast = useStore((state) => state.toast);
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "on_track" as GoalStatus,
    health: "on_track" as PortfolioHealth,
    progress: 0,
    color: palette[0],
    ownerId: "",
    startDate: "",
    dueDate: "",
    projectIds: [] as string[],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) return;
    setError("");
    if (editing.kind === "goal") {
      const goal = editing.value;
      setForm({ title: goal?.title ?? "", description: goal?.description ?? "", status: goal?.status ?? "not_started", health: "on_track", progress: goal?.progress ?? 0, color: palette[0], ownerId: goal?.ownerId ?? snapshot.user.id, startDate: "", dueDate: goal?.dueDate ?? "", projectIds: goal?.projectIds ?? [] });
    } else {
      const portfolio = editing.value;
      setForm({ title: portfolio?.name ?? "", description: portfolio?.description ?? "", status: "on_track", health: portfolio?.health ?? "on_track", progress: 0, color: portfolio?.color ?? palette[1], ownerId: portfolio?.ownerId ?? snapshot.user.id, startDate: portfolio?.startDate ?? "", dueDate: portfolio?.dueDate ?? "", projectIds: portfolio?.projectIds ?? [] });
    }
  }, [editing, snapshot.user.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      if (editing.kind === "goal")
        await api().saveGoal({ id: editing.value?.id, title: form.title, description: form.description, status: form.status, progress: form.progress, ownerId: form.ownerId || null, dueDate: form.dueDate || null, projectIds: form.projectIds });
      else
        await api().savePortfolio({ id: editing.value?.id, name: form.title, description: form.description, color: form.color, health: form.health, ownerId: form.ownerId || null, startDate: form.startDate || null, dueDate: form.dueDate || null, projectIds: form.projectIds });
      toast(editing.value ? "Alterações salvas" : editing.kind === "goal" ? "Meta criada" : "Portfólio criado", { tone: "success" });
      await onSaved();
      onClose();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const goal = editing?.kind === "goal";
  return (
    <Dialog
      open={Boolean(editing)}
      onClose={onClose}
      icon={goal ? Target : Briefcase}
      title={editing?.value ? (goal ? "Editar meta" : "Editar portfólio") : goal ? "Nova meta" : "Novo portfólio"}
      footer={
        <>
          <button type="button" className="ui-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="ui-button primary" form="strategy-form" disabled={busy || !form.title.trim()}>
            {busy && <Spinner size={14} />}
            Salvar
          </button>
        </>
      }
    >
      <form id="strategy-form" className="ui-form" onSubmit={submit}>
        <label className="ui-field">
          <span>{goal ? "Objetivo" : "Nome"}</span>
          <input data-autofocus required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={goal ? "Ex.: Aumentar a retenção para 90%" : "Ex.: Produto 2026"} />
        </label>
        <label className="ui-field">
          <span>
            Descrição <em>opcional</em>
          </span>
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={2} />
        </label>
        <div className="ui-form-row">
          {goal ? (
            <label className="ui-field">
              <span>Status</span>
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as GoalStatus })}>
                {Object.entries(goalLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="ui-field">
              <span>Saúde</span>
              <select value={form.health} onChange={(event) => setForm({ ...form, health: event.target.value as PortfolioHealth })}>
                {Object.entries(healthLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="ui-field">
            <span>Responsável</span>
            <select value={form.ownerId} onChange={(event) => setForm({ ...form, ownerId: event.target.value })}>
              <option value="">Ninguém</option>
              {snapshot.members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {goal ? (
          <div className="ui-form-row">
            <label className="ui-field">
              <span>Progresso · {form.progress}%</span>
              <input type="range" min={0} max={100} step={5} value={form.progress} onChange={(event) => setForm({ ...form, progress: Number(event.target.value) })} />
            </label>
            <label className="ui-field">
              <span>Prazo</span>
              <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
            </label>
          </div>
        ) : (
          <>
            <div className="ui-form-row">
              <label className="ui-field">
                <span>Início</span>
                <input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
              </label>
              <label className="ui-field">
                <span>Término</span>
                <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
              </label>
            </div>
            <div className="ui-field">
              <span>Cor</span>
              <ColorSwatches label="Cor do portfólio" colors={palette} value={form.color} onChange={(color) => setForm({ ...form, color })} />
            </div>
          </>
        )}
        <div className="ui-field">
          <span>Projetos vinculados</span>
          <div className="check-list">
            {snapshot.projects.map((project) => (
              <label key={project.id} className="check-row">
                <input
                  type="checkbox"
                  checked={form.projectIds.includes(project.id)}
                  onChange={(event) => setForm({ ...form, projectIds: event.target.checked ? [...form.projectIds, project.id] : form.projectIds.filter((id) => id !== project.id) })}
                />
                <ProjectGlyph icon={project.icon} color={project.color} size={18} />
                {project.name}
              </label>
            ))}
          </div>
        </div>
        {error && <div className="ui-alert error">{error}</div>}
      </form>
    </Dialog>
  );
}
