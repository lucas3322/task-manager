import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, CircleCheck, Plus } from "lucide-react";
import type { MyTask } from "@orbitask/contracts";
import { api } from "../api";
import { EmptyState, ProjectGlyph, Segmented, Spinner } from "../components/primitives";
import { DueChip } from "../components/task-bits";
import { addDays, isoDate, parseDay, plural, startOfToday } from "../lib/format";
import { PageHeader } from "../shell/Sidebar";
import { useStore } from "../store";

/** Tarefas atribuídas a mim em todos os projetos; recarrega quando algo muda no workspace. */
export function useMyTasks() {
  const revision = useStore((state) => state.revision);
  const [tasks, setTasks] = useState<MyTask[] | null>(null);
  const [error, setError] = useState(false);
  const reload = useCallback(() => {
    api()
      .listMyTasks()
      .then((items) => {
        setTasks(items);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);
  useEffect(reload, [reload, revision]);
  return { tasks, setTasks, error, reload };
}

export function bucketOf(task: MyTask) {
  if (task.done) return "done";
  if (!task.dueDate) return "none";
  const due = parseDay(task.dueDate);
  const today = startOfToday();
  if (due < today) return "overdue";
  if (isoDate(due) === isoDate(today)) return "today";
  if (due <= addDays(today, 7)) return "week";
  return "later";
}

const buckets = [
  { id: "overdue", label: "Atrasadas" },
  { id: "today", label: "Hoje" },
  { id: "week", label: "Próximos 7 dias" },
  { id: "later", label: "Mais adiante" },
  { id: "none", label: "Sem prazo" },
  { id: "done", label: "Concluídas" },
] as const;

export function useCompleteMyTask(setTasks: (change: (tasks: MyTask[] | null) => MyTask[] | null) => void) {
  const toast = useStore((state) => state.toast);
  const fail = useStore((state) => state.fail);
  const refresh = useStore((state) => state.refresh);
  const snapshotProject = useStore((state) => state.snapshot?.project.id);
  return async (task: MyTask) => {
    if (task.done) return;
    const previous = task.statusId;
    const apply = (statusId: string, done: boolean) =>
      setTasks((items) => items?.map((item) => (item.id === task.id ? { ...item, statusId, done } : item)) ?? null);
    apply(task.doneStatusId, true);
    try {
      await api().updateTask({ id: task.id, statusId: task.doneStatusId });
      if (snapshotProject === task.projectId) void refresh();
      toast(`“${task.title}” concluída`, {
        tone: "success",
        action: {
          label: "Desfazer",
          run: async () => {
            apply(previous, false);
            await api().updateTask({ id: task.id, statusId: previous });
            if (snapshotProject === task.projectId) void refresh();
          },
        },
      });
    } catch (error) {
      apply(previous, false);
      fail(error, "Não foi possível concluir a tarefa");
    }
  };
}

export function MyTaskRow({ task, onComplete, showProject = true }: { task: MyTask; onComplete: (task: MyTask) => void; showProject?: boolean }) {
  const navigate = useStore((state) => state.navigate);
  const openTask = useStore((state) => state.openTask);
  const open = () => {
    navigate({ name: "project", projectId: task.projectId, view: "list" });
    void openTask(task.id, task.projectId);
  };
  return (
    <div className={`my-task-row ${task.done ? "done" : ""}`}>
      <button
        type="button"
        className={`ui-check ${task.done ? "done" : ""}`}
        aria-label={task.done ? "Concluída" : `Concluir ${task.title}`}
        onClick={() => onComplete(task)}
        disabled={task.done}
      >
        <Check />
      </button>
      <button type="button" className="my-task-main" onClick={open}>
        <span className="my-task-title">{task.title}</span>
        <span className="my-task-meta">
          {showProject && (
            <span className="my-task-project">
              <ProjectGlyph icon={task.projectIcon} color={task.projectColor} size={14} />
              {task.projectName}
            </span>
          )}
          <span className="my-task-status">
            <i className="ui-dot" style={{ background: task.statusColor, width: 6, height: 6 }} />
            {task.statusName}
          </span>
        </span>
      </button>
      {task.priorityName && (
        <span className="my-task-priority" style={{ color: task.priorityColor ?? undefined }} title={`Prioridade ${task.priorityName}`}>
          {task.priorityName}
        </span>
      )}
      <DueChip date={task.dueDate} done={task.done} />
      <ChevronRight className="my-task-chevron" />
    </div>
  );
}

export function MyTasksScreen() {
  const { tasks, setTasks, error, reload } = useMyTasks();
  const openCreateTask = useStore((state) => state.openCreateTask);
  const complete = useCompleteMyTask(setTasks);
  const [scope, setScope] = useState<"open" | "all">("open");
  const [projectFilter, setProjectFilter] = useState("all");
  const [showDone, setShowDone] = useState(false);

  const projects = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    tasks?.forEach((task) => map.set(task.projectId, { id: task.projectId, name: task.projectName }));
    return [...map.values()];
  }, [tasks]);

  const visible = (tasks ?? []).filter((task) => projectFilter === "all" || task.projectId === projectFilter);
  const grouped = buckets
    .filter((bucket) => scope === "all" || bucket.id !== "done")
    .map((bucket) => ({ ...bucket, items: visible.filter((task) => bucketOf(task) === bucket.id) }))
    .filter((bucket) => bucket.items.length);
  const openCount = visible.filter((task) => !task.done).length;

  return (
    <div className="page">
      <PageHeader
        title="Minhas tarefas"
        subtitle={tasks ? `${plural(openCount, "tarefa aberta", "tarefas abertas")} atribuídas a você` : "Tudo o que está com você, em todos os projetos"}
        actions={
          <button type="button" className="ui-button primary" onClick={() => openCreateTask()}>
            <Plus /> Nova tarefa
          </button>
        }
      >
        <div className="page-toolbar">
          <Segmented
            label="Mostrar"
            size="sm"
            value={scope}
            onChange={setScope}
            options={[
              { value: "open", label: "Abertas" },
              { value: "all", label: "Todas" },
            ]}
          />
          {projects.length > 1 && (
            <select className="ui-select" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} aria-label="Filtrar por projeto">
              <option value="all">Todos os projetos</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </PageHeader>
      <div className="page-body narrow">
        {!tasks && !error && (
          <div className="page-loading">
            <Spinner />
          </div>
        )}
        {error && (
          <EmptyState icon={CircleCheck} title="Não foi possível carregar suas tarefas" action={<button className="ui-button" onClick={reload}>Tentar de novo</button>}>
            Verifique sua conexão e tente novamente.
          </EmptyState>
        )}
        {tasks && !grouped.length && (
          <EmptyState
            icon={CircleCheck}
            title={tasks.length ? "Tudo em dia" : "Nenhuma tarefa com você"}
            action={
              <button type="button" className="ui-button primary" onClick={() => openCreateTask()}>
                <Plus /> Nova tarefa
              </button>
            }
          >
            {tasks.length ? "Você não tem tarefas abertas. Aproveite para planejar o próximo passo." : "Quando alguém atribuir uma tarefa a você, ela aparece aqui."}
          </EmptyState>
        )}
        {grouped.map((bucket) => {
          const collapsed = bucket.id === "done" && !showDone;
          return (
            <section key={bucket.id} className={`task-group bucket-${bucket.id}`}>
              <header>
                <h2>{bucket.label}</h2>
                <span className="count">{bucket.items.length}</span>
                {bucket.id === "done" && (
                  <button type="button" className="link-button" onClick={() => setShowDone(!showDone)}>
                    {showDone ? "Ocultar" : "Mostrar"}
                  </button>
                )}
              </header>
              {!collapsed && (
                <div className="ui-card task-group-list">
                  {bucket.items.map((task) => (
                    <MyTaskRow key={task.id} task={task} onComplete={complete} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
