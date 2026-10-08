import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  CircleCheck,
  CornerDownLeft,
  FolderPlus,
  House,
  Keyboard,
  ListPlus,
  Moon,
  Search,
  Settings,
  SquareCheck,
  Sun,
  Target,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { GlobalSearchResult, WorkspaceSnapshot } from "@orbitask/contracts";
import { api, errorMessage } from "../api";
import { Avatar, AutoTextarea, ColorSwatches, Dialog, ProjectGlyph, Spinner, useEscape, usePresence } from "../components/primitives";
import { ChoiceMenu, PropertyButton, memberChoices, priorityChoices, statusChoices } from "../components/task-bits";
import { palette, projectIcons } from "../lib/catalog";
import { formatDue } from "../lib/format";
import { firstStatusId } from "../lib/tasks";
import { useStore, type Route } from "../store";

/* ---------- Nova tarefa ---------- */

export function CreateTaskDialog() {
  const draft = useStore((state) => state.createTask);
  const close = useStore((state) => state.closeCreateTask);
  const current = useStore((state) => state.snapshot);
  const refresh = useStore((state) => state.refresh);
  const navigate = useStore((state) => state.navigate);
  const openTask = useStore((state) => state.openTask);
  const toast = useStore((state) => state.toast);
  const [target, setTarget] = useState<WorkspaceSnapshot | null>(null);
  const [form, setForm] = useState({ title: "", description: "", statusId: "", priority: "", assigneeIds: [] as string[], dueDate: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [another, setAnother] = useState(false);

  useEffect(() => {
    if (!draft || !current) return;
    setTarget(current);
    setError("");
    setForm({
      title: "",
      description: "",
      statusId: draft.statusId ?? firstStatusId(current) ?? "",
      priority: "",
      assigneeIds: [current.user.id],
      dueDate: draft.dueDate ?? "",
    });
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchProject = async (projectId: string) => {
    if (!current || projectId === target?.project.id) return;
    try {
      const next = projectId === current.project.id ? current : await api().getSnapshot(projectId);
      setTarget(next);
      setForm((value) => ({ ...value, statusId: firstStatusId(next) ?? "", priority: "" }));
    } catch (reason) {
      setError(errorMessage(reason, "Não foi possível abrir o projeto"));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!target || !form.title.trim()) return;
    setBusy(true);
    setError("");
    try {
      const task = await api().createTask({
        projectId: target.project.id,
        title: form.title.trim(),
        statusId: form.statusId,
        priority: form.priority || undefined,
        parentId: draft?.parentId ?? null,
      });
      const extra = {
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        ...(form.dueDate ? { dueDate: form.dueDate } : {}),
        ...(form.assigneeIds.join() !== target.user.id
          ? { assigneeIds: form.assigneeIds, primaryAssigneeId: form.assigneeIds[0] ?? null }
          : {}),
      };
      if (Object.keys(extra).length) await api().updateTask({ id: task.id, ...extra });
      if (target.project.id === current?.project.id) await refresh();
      const projectId = target.project.id;
      toast(`Tarefa criada em ${target.project.name}`, {
        tone: "success",
        action: {
          label: "Abrir",
          run: () => {
            navigate({ name: "project", projectId, view: "board" });
            void openTask(task.id, projectId);
          },
        },
      });
      if (another) setForm((value) => ({ ...value, title: "", description: "" }));
      else close();
    } catch (reason) {
      setError(errorMessage(reason, "Não foi possível criar a tarefa"));
    } finally {
      setBusy(false);
    }
  };

  const snapshot = target ?? current;
  if (!snapshot) return null;
  const status = snapshot.statuses.find((item) => item.id === form.statusId);
  const priority = snapshot.settings.priorities.find((item) => item.id === form.priority);
  const assignees = snapshot.members.filter((member) => form.assigneeIds.includes(member.userId));

  return (
    <Dialog
      open={Boolean(draft)}
      onClose={close}
      title={draft?.parentId ? "Nova subtarefa" : "Nova tarefa"}
      icon={ListPlus}
      size="md"
    >
      <form className="create-task" onSubmit={submit}>
        <input
          data-autofocus
          className="create-task-title"
          placeholder="O que precisa ser feito?"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          maxLength={240}
        />
        <AutoTextarea
          className="create-task-description"
          placeholder="Adicione detalhes, links ou critérios de pronto (opcional)"
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
        <div className="create-task-props">
          {!draft?.parentId && (
            <ChoiceMenu
              choices={current!.projects.map((project) => ({ id: project.id, label: project.name, color: project.color }))}
              value={[snapshot.project.id]}
              onChange={([id]) => void switchProject(id)}
              trigger={(props) => (
                <PropertyButton {...props}>
                  <ProjectGlyph icon={snapshot.project.icon} color={snapshot.project.color} size={16} />
                  {snapshot.project.name}
                </PropertyButton>
              )}
            />
          )}
          <ChoiceMenu
            choices={statusChoices(snapshot)}
            value={[form.statusId]}
            onChange={([id]) => setForm({ ...form, statusId: id })}
            trigger={(props) => (
              <PropertyButton {...props}>
                <i className="ui-dot" style={{ background: status?.color, width: 8, height: 8 }} />
                {status?.name ?? "Status"}
              </PropertyButton>
            )}
          />
          <ChoiceMenu
            choices={priorityChoices(snapshot)}
            value={[form.priority]}
            onChange={([id]) => setForm({ ...form, priority: id })}
            trigger={(props) => (
              <PropertyButton {...props} placeholder={!priority}>
                <i className="ui-dot" style={{ background: priority?.color ?? "var(--text-3)", width: 8, height: 8 }} />
                {priority?.name ?? "Prioridade"}
              </PropertyButton>
            )}
          />
          <ChoiceMenu
            multiple
            choices={memberChoices(snapshot.members, snapshot.project.id)}
            value={form.assigneeIds}
            onChange={(assigneeIds) => setForm({ ...form, assigneeIds })}
            trigger={(props) => (
              <PropertyButton {...props} placeholder={!assignees.length}>
                {assignees.length ? (
                  <>
                    <Avatar name={assignees[0].name} url={assignees[0].avatarUrl} size={16} />
                    {assignees.length === 1 ? assignees[0].name.split(" ")[0] : `${assignees.length} pessoas`}
                  </>
                ) : (
                  <>
                    <UserRound />
                    Responsável
                  </>
                )}
              </PropertyButton>
            )}
          />
          <label className={`prop-button date ${form.dueDate ? "" : "placeholder"}`}>
            <CalendarDays />
            <span>{form.dueDate ? formatDue(form.dueDate) : "Prazo"}</span>
            <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} aria-label="Prazo" />
          </label>
        </div>
        {error && <div className="ui-alert error">{error}</div>}
        <footer className="create-task-footer">
          <label className="inline-check">
            <input type="checkbox" checked={another} onChange={(event) => setAnother(event.target.checked)} />
            Criar outra
          </label>
          <span className="spacer" />
          <button type="button" className="ui-button" onClick={close}>
            Cancelar
          </button>
          <button className="ui-button primary" disabled={busy || !form.title.trim() || !form.statusId}>
            {busy && <Spinner size={14} />}
            Criar tarefa
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

/* ---------- Novo projeto ---------- */

export function CreateProjectDialog() {
  const open = useStore((state) => state.createProjectOpen);
  const setOpen = useStore((state) => state.setCreateProjectOpen);
  const addProject = useStore((state) => state.addProject);
  const [form, setForm] = useState({ name: "", description: "", color: palette[0], icon: "folder" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setForm({ name: "", description: "", color: palette[Math.floor(Math.random() * 6)], icon: "folder" });
  }, [open]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    await addProject({ ...form, name: form.name.trim() });
    setBusy(false);
  };
  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="Novo projeto"
      description="Um projeto reúne tarefas, fluxo de trabalho e pessoas em torno de um objetivo."
      icon={FolderPlus}
      footer={
        <>
        <button type="button" className="ui-button" onClick={() => setOpen(false)}>
          Cancelar
        </button>
        <button className="ui-button primary" form="create-project" disabled={busy || !form.name.trim()}>
          {busy && <Spinner size={14} />}
          Criar projeto
        </button>
        </>
      }
    >
      <form className="ui-form" onSubmit={submit} id="create-project">
        <div className="project-preview">
          <ProjectGlyph icon={form.icon} color={form.color} size={44} />
          <div>
            <strong>{form.name.trim() || "Nome do projeto"}</strong>
            <span>{form.description.trim() || "Quadro com A fazer, Em andamento, Em revisão e Concluído"}</span>
          </div>
        </div>
        <label className="ui-field">
          <span>Nome</span>
          <input data-autofocus required maxLength={160} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Lançamento do app" />
        </label>
        <label className="ui-field">
          <span>
            Descrição <em>opcional</em>
          </span>
          <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Qual é o objetivo deste projeto?" />
        </label>
        <div className="ui-field">
          <span>Cor</span>
          <ColorSwatches label="Cor do projeto" colors={palette} value={form.color} onChange={(color) => setForm({ ...form, color })} />
        </div>
        <div className="ui-field">
          <span>Ícone</span>
          <IconGrid value={form.icon} color={form.color} onChange={(icon) => setForm({ ...form, icon })} />
        </div>
      </form>
    </Dialog>
  );
}

export function IconGrid({ value, color, onChange }: { value: string; color: string; onChange: (icon: string) => void }) {
  return (
    <div className="icon-grid" role="radiogroup" aria-label="Ícone do projeto">
      {Object.entries(projectIcons).map(([key, { label, icon: Icon }]) => (
        <button
          type="button"
          key={key}
          role="radio"
          aria-checked={value === key}
          title={label}
          aria-label={label}
          className={value === key ? "selected" : ""}
          style={{ "--glyph": color } as React.CSSProperties}
          onClick={() => onChange(key)}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}

/* ---------- Paleta de comandos ---------- */

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon?: LucideIcon;
  leading?: React.ReactNode;
  keywords?: string;
  run: () => void;
}

export function CommandPalette() {
  const open = useStore((state) => state.paletteOpen);
  const setOpen = useStore((state) => state.setPaletteOpen);
  const snapshot = useStore((state) => state.snapshot);
  const navigate = useStore((state) => state.navigate);
  const openTask = useStore((state) => state.openTask);
  const openCreateTask = useStore((state) => state.openCreateTask);
  const setCreateProjectOpen = useStore((state) => state.setCreateProjectOpen);
  const prefs = useStore((state) => state.prefs);
  const setPrefs = useStore((state) => state.setPrefs);
  const { mounted, state } = usePresence(open, 160);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  useEscape(open, () => setOpen(false));

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      api()
        .searchGlobal(term)
        .then(setResults)
        .catch(() => setResults(null))
        .finally(() => setSearching(false));
    }, 160);
    return () => clearTimeout(timer);
  }, [query]);

  const commands = useMemo<Command[]>(() => {
    if (!snapshot) return [];
    const go = (route: Route) => () => navigate(route);
    const dark = prefs.theme === "dark" || (prefs.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    return [
      { id: "new-task", group: "Ações", label: "Nova tarefa", hint: "C", icon: ListPlus, keywords: "criar adicionar", run: () => openCreateTask() },
      ...(snapshot.workspace.role === "admin"
        ? [{ id: "new-project", group: "Ações", label: "Novo projeto", icon: FolderPlus, keywords: "criar", run: () => setCreateProjectOpen(true) }]
        : []),
      { id: "theme", group: "Ações", label: dark ? "Usar aparência clara" : "Usar aparência escura", icon: dark ? Sun : Moon, keywords: "tema modo escuro claro", run: () => setPrefs({ theme: dark ? "light" : "dark" }) },
      { id: "home", group: "Ir para", label: "Início", icon: House, run: go({ name: "home" }) },
      { id: "my-tasks", group: "Ir para", label: "Minhas tarefas", icon: CircleCheck, run: go({ name: "my-tasks" }) },
      { id: "inbox", group: "Ir para", label: "Caixa de entrada", icon: Bell, keywords: "notificações", run: go({ name: "inbox" }) },
      { id: "reports", group: "Ir para", label: "Relatórios", icon: BarChart3, keywords: "dashboard métricas", run: go({ name: "reports" }) },
      { id: "strategy", group: "Ir para", label: "Metas e portfólios", icon: Target, keywords: "objetivos okr", run: go({ name: "strategy" }) },
      { id: "people", group: "Ir para", label: "Pessoas", icon: Users, keywords: "membros convites equipe", run: go({ name: "people" }) },
      { id: "settings", group: "Ir para", label: "Ajustes", icon: Settings, keywords: "configurações preferências perfil senha", run: go({ name: "settings", tab: "profile" }) },
      { id: "shortcuts", group: "Ir para", label: "Atalhos de teclado", icon: Keyboard, run: go({ name: "settings", tab: "shortcuts" }) },
      ...snapshot.projects.map((project) => ({
        id: `project-${project.id}`,
        group: "Projetos",
        label: project.name,
        leading: <ProjectGlyph icon={project.icon} color={project.color} size={18} />,
        run: go({ name: "project", projectId: project.id, view: "board" }),
      })),
    ];
  }, [snapshot, prefs.theme, navigate, openCreateTask, setCreateProjectOpen, setPrefs]);

  const items = useMemo<Command[]>(() => {
    const term = query.trim().toLowerCase();
    const matching = term
      ? commands.filter((command) => `${command.label} ${command.keywords ?? ""}`.toLowerCase().includes(term))
      : commands.filter((command) => command.group !== "Projetos" || commands.indexOf(command) < 40);
    const found: Command[] = results
      ? [
          ...results.tasks.slice(0, 8).map((task) => ({
            id: `task-${task.id}`,
            group: "Tarefas",
            label: task.title,
            hint: task.projectName,
            leading: <i className="ui-dot" style={{ background: task.statusColor, width: 8, height: 8, margin: "0 5px" }} />,
            run: () => {
              navigate({ name: "project", projectId: task.projectId, view: "board" });
              void openTask(task.id, task.projectId);
            },
          })),
          ...results.projects
            .filter((project) => !matching.some((command) => command.id === `project-${project.id}`))
            .slice(0, 4)
            .map((project) => ({
              id: `found-project-${project.id}`,
              group: "Projetos",
              label: project.name,
              leading: <ProjectGlyph icon={project.icon} color={project.color} size={18} />,
              run: () => navigate({ name: "project", projectId: project.id, view: "board" }),
            })),
          ...results.people.slice(0, 4).map((person) => ({
            id: `person-${person.id}`,
            group: "Pessoas",
            label: person.name,
            hint: person.email,
            leading: <Avatar name={person.name} url={person.avatarUrl} size={20} />,
            run: () => navigate({ name: "people" }),
          })),
        ]
      : [];
    const order = ["Tarefas", "Ações", "Projetos", "Ir para", "Pessoas"];
    return [...found, ...matching].sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
  }, [commands, query, results, navigate, openTask]);

  useEffect(() => setActive(0), [query, results]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!mounted) return null;
  const run = (command?: Command) => {
    if (!command) return;
    setOpen(false);
    command.run();
  };
  let lastGroup = "";
  return createPortal(
    <div className="palette-overlay" data-state={state} onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Buscar e executar comandos" data-state={state}>
        <div className="palette-input">
          {searching ? <Spinner size={16} /> : <Search />}
          <input
            autoFocus
            value={query}
            placeholder="Buscar tarefas, projetos, pessoas ou comandos…"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((value) => Math.min(items.length - 1, value + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((value) => Math.max(0, value - 1));
              } else if (event.key === "Enter") {
                event.preventDefault();
                run(items[active]);
              }
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[active] ? `palette-${items[active].id}` : undefined}
          />
        </div>
        <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {items.map((command, index) => {
            const header = command.group !== lastGroup ? command.group : null;
            lastGroup = command.group;
            const Icon = command.icon;
            return (
              <React.Fragment key={command.id}>
                {header && <div className="palette-group">{header}</div>}
                <button
                  type="button"
                  id={`palette-${command.id}`}
                  role="option"
                  aria-selected={index === active}
                  data-index={index}
                  className={`palette-item ${index === active ? "active" : ""}`}
                  onMouseMove={() => index !== active && setActive(index)}
                  onClick={() => run(command)}
                >
                  {command.leading ?? (Icon ? <Icon className="palette-icon" /> : <SquareCheck className="palette-icon" />)}
                  <span className="palette-label">{command.label}</span>
                  {command.hint && <span className="palette-hint">{command.hint}</span>}
                  {index === active && <CornerDownLeft className="palette-enter" />}
                </button>
              </React.Fragment>
            );
          })}
          {!items.length && !searching && (
            <div className="palette-empty">
              Nada encontrado para “{query}”.
              <button type="button" className="ui-button small" onClick={() => run({ id: "x", group: "", label: "", run: () => openCreateTask() })}>
                Criar tarefa <ArrowRight />
              </button>
            </div>
          )}
        </div>
        <footer className="palette-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navegar
          </span>
          <span>
            <kbd>↵</kbd> abrir
          </span>
          <span>
            <kbd>esc</kbd> fechar
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
