import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  Bookmark,
  CalendarDays,
  Check,
  Columns3,
  GanttChart,
  LayoutDashboard,
  List,
  ListFilter,
  Plus,
  Rows3,
  Search,
  Settings2,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import type { AdvancedTaskFilter, DueFilter, SavedTaskFilter, TaskGroup, TaskSort } from "@orbitask/contracts";
import { api } from "../api";
import { AvatarStack, askText, MenuItem, MenuLabel, MenuSeparator, Popover, ProjectGlyph, Spinner } from "../components/primitives";
import { Choice, ChoiceMenu, memberChoices, priorityChoices, statusChoices } from "../components/task-bits";
import { activeFilterCount, applyFilter, blankFilter } from "../lib/tasks";
import { PageHeader } from "../shell/Sidebar";
import { useStore, type ProjectView } from "../store";
import { Board } from "./Board";
import { CalendarView } from "./CalendarView";
import { ListView } from "./ListView";
import { ProjectOverview } from "./Overview";
import { TimelineView } from "./TimelineView";

export const projectViewTabs: { id: ProjectView; label: string; icon: typeof List }[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "board", label: "Quadro", icon: Columns3 },
  { id: "list", label: "Lista", icon: List },
  { id: "calendar", label: "Calendário", icon: CalendarDays },
  { id: "timeline", label: "Cronograma", icon: GanttChart },
];

const dueLabels: Record<DueFilter, string> = { all: "Qualquer prazo", overdue: "Atrasadas", today: "Vencem hoje", week: "Próximos 7 dias", no_due: "Sem prazo" };
const sortLabels: Record<TaskSort, string> = { position: "Manual", title: "Título", due_date: "Prazo", priority: "Prioridade", updated_at: "Atualização" };
const groupLabels: Record<TaskGroup, string> = { status: "Status", priority: "Prioridade", assignee: "Responsável", none: "Sem agrupamento" };

export function ProjectScreen({ projectId, view }: { projectId: string; view: ProjectView }) {
  const snapshot = useStore((state) => state.snapshot)!;
  const loading = useStore((state) => state.loadingProject);
  const navigate = useStore((state) => state.navigate);
  const loadProject = useStore((state) => state.loadProject);
  const openCreateTask = useStore((state) => state.openCreateTask);
  const setDefaultView = useStore((state) => state.setDefaultView);
  const setDensity = useStore((state) => state.setDensity);
  const toast = useStore((state) => state.toast);
  const fail = useStore((state) => state.fail);
  const [filter, setFilter] = useState<AdvancedTaskFilter>(blankFilter);
  const [saved, setSaved] = useState<SavedTaskFilter[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  const mismatch = snapshot.project.id !== projectId;
  useEffect(() => {
    if (mismatch && !loading) void loadProject(projectId).then((result) => !result && navigate({ name: "home" }));
  }, [mismatch, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setFilter(blankFilter());
    api()
      .listSavedFilters(projectId)
      .then(setSaved)
      .catch(() => setSaved([]));
  }, [projectId]);

  useEffect(() => {
    if (view === "board" || view === "list") void setDefaultView(view);
  }, [view, setDefaultView]);

  useEffect(() => {
    const onFocus = () => searchRef.current?.focus();
    window.addEventListener("orbitask:focus-filter", onFocus);
    return () => window.removeEventListener("orbitask:focus-filter", onFocus);
  }, []);

  const topLevel = useMemo(() => snapshot.tasks.filter((task) => !task.parentId), [snapshot.tasks]);
  const filtered = useMemo(() => applyFilter(topLevel, filter, snapshot), [topLevel, filter, snapshot]);

  if (mismatch) {
    return (
      <div className="page">
        <div className="page-loading full">
          <Spinner />
        </div>
      </div>
    );
  }

  const project = snapshot.project;
  const admin = snapshot.workspace.role === "admin";
  const members = snapshot.members.filter((member) => member.role !== "guest" || member.projectIds.includes(project.id));
  const filters = activeFilterCount(filter);
  const hasQuery = Boolean(filter.query.trim());
  const showToolbar = view !== "overview";

  const toggle = (key: "statusIds" | "priorityIds" | "assigneeIds", ids: string[]) => setFilter({ ...filter, [key]: ids });

  const saveCurrent = async () => {
    const name = await askText({ title: "Salvar filtro", label: "Nome", placeholder: "Ex.: Urgentes da semana" });
    if (!name?.trim()) return;
    try {
      const item = await api().saveTaskFilter({ projectId, name: name.trim(), filter });
      setSaved((current) => [...current.filter((value) => value.id !== item.id), item]);
      toast("Filtro salvo", { tone: "success" });
    } catch (error) {
      fail(error);
    }
  };
  const removeSaved = async (item: SavedTaskFilter) => {
    try {
      await api().removeSavedFilter(item.id);
      setSaved((current) => current.filter((value) => value.id !== item.id));
    } catch (error) {
      fail(error);
    }
  };

  const filterChip = (label: string, choices: Choice[], key: "statusIds" | "priorityIds" | "assigneeIds") => (
    <ChoiceMenu
      multiple
      choices={choices}
      value={filter[key]}
      onChange={(ids) => toggle(key, ids)}
      trigger={(props) => (
        <button {...props} type="button" className={`filter-chip ${filter[key].length ? "active" : ""}`}>
          {label}
          {filter[key].length ? <span className="filter-count">{filter[key].length}</span> : null}
        </button>
      )}
    />
  );

  return (
    <div className="page project-page">
      <PageHeader
        breadcrumb={[{ label: "Projetos", onClick: () => navigate({ name: "reports" }) }]}
        leading={<ProjectGlyph icon={project.icon} color={project.color} size={34} />}
        title={project.name}
        subtitle={project.description || undefined}
        actions={
          <>
            <button type="button" className="member-stack" onClick={() => navigate({ name: "people" })} title="Pessoas com acesso">
              <AvatarStack people={members.map((member) => ({ name: member.name, avatarUrl: member.avatarUrl }))} max={4} size={26} />
            </button>
            {admin && (
              <button
                type="button"
                className="ui-button ghost hide-sm"
                onClick={() => {
                  navigate({ name: "people" });
                  window.dispatchEvent(new CustomEvent("orbitask:invite"));
                }}
              >
                <UserPlus /> Convidar
              </button>
            )}
            <button type="button" className="ui-icon-button" aria-label="Configurações do projeto" title="Configurações do projeto" onClick={() => navigate({ name: "project-settings", projectId, tab: "general" })}>
              <Settings2 />
            </button>
            <button type="button" className="ui-button primary" onClick={() => openCreateTask()}>
              <Plus /> <span className="hide-sm">Nova tarefa</span>
            </button>
          </>
        }
      >
        <nav className="view-tabs" aria-label="Visualizações do projeto">
          {projectViewTabs.map((tab, index) => (
            <button
              type="button"
              key={tab.id}
              className={`view-tab ${view === tab.id ? "active" : ""}`}
              aria-current={view === tab.id ? "page" : undefined}
              title={`${tab.label} (${index + 1})`}
              onClick={() => navigate({ name: "project", projectId, view: tab.id })}
            >
              <tab.icon />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
        {showToolbar && (
          <div className="page-toolbar project-toolbar">
            <label className="toolbar-search-field">
              <Search />
              <input ref={searchRef} value={filter.query} onChange={(event) => setFilter({ ...filter, query: event.target.value })} placeholder="Filtrar tarefas" aria-label="Filtrar tarefas" />
              {hasQuery && (
                <button type="button" aria-label="Limpar busca" onClick={() => setFilter({ ...filter, query: "" })}>
                  <X />
                </button>
              )}
            </label>
            <span className="toolbar-divider" />
            <span className="toolbar-label">
              <ListFilter />
            </span>
            {filterChip("Status", statusChoices(snapshot), "statusIds")}
            {filterChip("Prioridade", priorityChoices(snapshot), "priorityIds")}
            {filterChip("Responsável", memberChoices(snapshot.members, projectId), "assigneeIds")}
            <ChoiceMenu
              choices={(Object.keys(dueLabels) as DueFilter[]).map((id) => ({ id, label: dueLabels[id] }))}
              value={[filter.due]}
              onChange={([due]) => setFilter({ ...filter, due: due as DueFilter })}
              trigger={(props) => (
                <button {...props} type="button" className={`filter-chip ${filter.due !== "all" ? "active" : ""}`}>
                  {filter.due === "all" ? "Prazo" : dueLabels[filter.due]}
                </button>
              )}
            />
            {(filters > 0 || hasQuery) && (
              <button type="button" className="link-button" onClick={() => setFilter({ ...blankFilter(), sort: filter.sort, direction: filter.direction, group: filter.group })}>
                Limpar
              </button>
            )}
            <span className="spacer" />
            {(filters > 0 || hasQuery) && (
              <span className="toolbar-result">
                {filtered.length} de {topLevel.length}
              </span>
            )}
            {view === "list" && (
              <Popover
                align="end"
                width={220}
                trigger={(props) => (
                  <button {...props} type="button" className="ui-button small ghost">
                    <ArrowDownUp /> {sortLabels[filter.sort]}
                  </button>
                )}
              >
                {(close) => (
                  <>
                    <MenuLabel>Ordenar por</MenuLabel>
                    {(Object.keys(sortLabels) as TaskSort[]).map((sort) => (
                      <MenuItem key={sort} checked={filter.sort === sort} onSelect={() => setFilter({ ...filter, sort })}>
                        {sortLabels[sort]}
                      </MenuItem>
                    ))}
                    <MenuSeparator />
                    <MenuItem checked={filter.direction === "desc"} onSelect={() => setFilter({ ...filter, direction: filter.direction === "asc" ? "desc" : "asc" })}>
                      Ordem decrescente
                    </MenuItem>
                    <MenuSeparator />
                    <MenuLabel>Agrupar por</MenuLabel>
                    {(Object.keys(groupLabels) as TaskGroup[]).map((group) => (
                      <MenuItem key={group} checked={filter.group === group} onSelect={() => (setFilter({ ...filter, group }), close())}>
                        {groupLabels[group]}
                      </MenuItem>
                    ))}
                  </>
                )}
              </Popover>
            )}
            {view === "board" && (
              <button
                type="button"
                className="ui-icon-button"
                aria-label={snapshot.preferences.cardDensity === "compact" ? "Cartões detalhados" : "Cartões compactos"}
                title={snapshot.preferences.cardDensity === "compact" ? "Cartões detalhados" : "Cartões compactos"}
                onClick={() => setDensity(snapshot.preferences.cardDensity === "compact" ? "detailed" : "compact")}
              >
                {snapshot.preferences.cardDensity === "compact" ? <Rows3 /> : <List />}
              </button>
            )}
            <Popover
              align="end"
              width={260}
              trigger={(props) => (
                <button {...props} type="button" className="ui-icon-button" aria-label="Filtros salvos" title="Filtros salvos">
                  <Bookmark />
                </button>
              )}
            >
              {(close) => (
                <>
                  <MenuLabel>Filtros salvos</MenuLabel>
                  {saved.map((item) => (
                    <div key={item.id} className="saved-filter-row">
                      <MenuItem icon={Check} onSelect={() => (setFilter({ ...blankFilter(), ...item.filter }), close())}>
                        {item.name}
                      </MenuItem>
                      <button type="button" className="ui-icon-button small" aria-label={`Excluir ${item.name}`} onClick={() => removeSaved(item)}>
                        <Trash2 />
                      </button>
                    </div>
                  ))}
                  {!saved.length && <div className="ui-menu-empty">Nenhum filtro salvo neste projeto</div>}
                  <MenuSeparator />
                  <MenuItem icon={Plus} disabled={!filters && !hasQuery && filter.sort === "position"} onSelect={() => (close(), void saveCurrent())}>
                    Salvar filtro atual…
                  </MenuItem>
                </>
              )}
            </Popover>
          </div>
        )}
      </PageHeader>
      <div className={`project-body view-${view}`}>
        {view === "overview" && <ProjectOverview />}
        {view === "board" && <Board tasks={filtered} filtered={filters > 0 || hasQuery} />}
        {view === "list" && <ListView tasks={filtered} group={filter.group} manual={filter.sort === "position"} />}
        {view === "calendar" && <CalendarView tasks={filtered} />}
        {view === "timeline" && <TimelineView tasks={filtered} />}
      </div>
    </div>
  );
}

export function useTaskHelpers() {
  const snapshot = useStore((state) => state.snapshot)!;
  return React.useMemo(() => {
    const statusById = new Map(snapshot.statuses.map((status) => [status.id, status]));
    const priorityById = new Map(snapshot.settings.priorities.map((priority) => [priority.id, priority]));
    const tagById = new Map(snapshot.settings.tags.map((tag) => [tag.id, tag]));
    const badgeById = new Map(snapshot.settings.badges.map((badge) => [badge.id, badge]));
    const doneId = snapshot.statuses.at(-1)?.id;
    return { statusById, priorityById, tagById, badgeById, doneId };
  }, [snapshot]);
}
