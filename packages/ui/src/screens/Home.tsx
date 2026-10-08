import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Bell, CalendarClock, CircleCheck, FolderPlus, ListPlus, Search, Sun, UserPlus } from "lucide-react";
import type { DashboardReport, Notification } from "@orbitask/contracts";
import { api } from "../api";
import { EmptyState, Kbd, ProgressBar, ProjectGlyph, Spinner, modKey } from "../components/primitives";
import { firstName, greeting, plural, relativeTime } from "../lib/format";
import { PageHeader } from "../shell/Sidebar";
import { useStore } from "../store";
import { MyTaskRow, bucketOf, useCompleteMyTask, useMyTasks } from "./MyTasks";

export function HomeScreen() {
  const snapshot = useStore((state) => state.snapshot)!;
  const navigate = useStore((state) => state.navigate);
  const openCreateTask = useStore((state) => state.openCreateTask);
  const setCreateProjectOpen = useStore((state) => state.setCreateProjectOpen);
  const setPaletteOpen = useStore((state) => state.setPaletteOpen);
  const openTask = useStore((state) => state.openTask);
  const revision = useStore((state) => state.revision);
  const { tasks, setTasks } = useMyTasks();
  const complete = useCompleteMyTask(setTasks);
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [notifications, setNotifications] = useState<Notification[] | null>(null);

  useEffect(() => {
    api().getDashboard().then(setReport).catch(() => setReport(null));
    api().listNotifications().then(setNotifications).catch(() => setNotifications([]));
  }, [revision]);

  const open = (tasks ?? []).filter((task) => !task.done);
  const counts = {
    overdue: open.filter((task) => bucketOf(task) === "overdue").length,
    today: open.filter((task) => bucketOf(task) === "today").length,
    week: open.filter((task) => bucketOf(task) === "week").length,
    done: (tasks ?? []).filter((task) => task.done).length,
  };
  const focus = open.filter((task) => ["overdue", "today", "week"].includes(bucketOf(task))).slice(0, 7);
  const fallback = focus.length ? [] : open.slice(0, 5);
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const admin = snapshot.workspace.role === "admin";

  const summary = !tasks
    ? "Carregando seu dia…"
    : counts.overdue
      ? `Você tem ${plural(counts.overdue, "tarefa atrasada", "tarefas atrasadas")}${counts.today ? ` e ${counts.today} para hoje` : ""}.`
      : counts.today
        ? `${plural(counts.today, "tarefa", "tarefas")} para hoje. Bom trabalho pela frente.`
        : open.length
          ? "Nada vence hoje. Bom momento para adiantar o que vem por aí."
          : "Sua lista está vazia. Que tal planejar o próximo passo?";

  return (
    <div className="page">
      <PageHeader title={`${greeting()}, ${firstName(snapshot.user.name)}`} subtitle={<span className="capitalize">{today}</span>} />
      <div className="page-body home">
        <section className="home-hero">
          <div className="home-hero-text">
            <Sun />
            <p>{summary}</p>
          </div>
          <div className="home-quick">
            <button type="button" className="quick-action" onClick={() => openCreateTask()}>
              <ListPlus />
              <span>Nova tarefa</span>
              <Kbd>C</Kbd>
            </button>
            <button type="button" className="quick-action" onClick={() => setPaletteOpen(true)}>
              <Search />
              <span>Buscar</span>
              <Kbd>{modKey()}K</Kbd>
            </button>
            {admin && (
              <button type="button" className="quick-action" onClick={() => setCreateProjectOpen(true)}>
                <FolderPlus />
                <span>Novo projeto</span>
              </button>
            )}
            {admin && (
              <button
                type="button"
                className="quick-action"
                onClick={() => {
                  navigate({ name: "people" });
                  window.dispatchEvent(new CustomEvent("orbitask:invite"));
                }}
              >
                <UserPlus />
                <span>Convidar</span>
              </button>
            )}
          </div>
        </section>

        <section className="stat-row">
          <button type="button" className="stat-tile tone-red" onClick={() => navigate({ name: "my-tasks" })}>
            <span className="stat-icon">
              <AlertTriangle />
            </span>
            <strong className="tabular">{tasks ? counts.overdue : "–"}</strong>
            <span>Atrasadas</span>
          </button>
          <button type="button" className="stat-tile tone-orange" onClick={() => navigate({ name: "my-tasks" })}>
            <span className="stat-icon">
              <CalendarClock />
            </span>
            <strong className="tabular">{tasks ? counts.today : "–"}</strong>
            <span>Para hoje</span>
          </button>
          <button type="button" className="stat-tile tone-accent" onClick={() => navigate({ name: "my-tasks" })}>
            <span className="stat-icon">
              <CalendarClock />
            </span>
            <strong className="tabular">{tasks ? counts.week : "–"}</strong>
            <span>Próximos 7 dias</span>
          </button>
          <button type="button" className="stat-tile tone-green" onClick={() => navigate({ name: "my-tasks" })}>
            <span className="stat-icon">
              <CircleCheck />
            </span>
            <strong className="tabular">{tasks ? counts.done : "–"}</strong>
            <span>Concluídas por você</span>
          </button>
        </section>

        <div className="home-grid">
          <section className="home-panel">
            <header className="panel-head">
              <h2>Seu foco</h2>
              <button type="button" className="link-button" onClick={() => navigate({ name: "my-tasks" })}>
                Ver todas <ArrowRight />
              </button>
            </header>
            <div className="ui-card task-group-list">
              {!tasks && (
                <div className="page-loading small">
                  <Spinner />
                </div>
              )}
              {tasks && [...focus, ...fallback].map((task) => <MyTaskRow key={task.id} task={task} onComplete={complete} />)}
              {tasks && !focus.length && !fallback.length && (
                <EmptyState
                  compact
                  icon={CircleCheck}
                  title="Nada pendente com você"
                  action={
                    <button type="button" className="ui-button small" onClick={() => openCreateTask()}>
                      Criar tarefa
                    </button>
                  }
                >
                  Tarefas atribuídas a você com prazo próximo aparecem aqui.
                </EmptyState>
              )}
            </div>
          </section>

          <aside className="home-side">
            <section className="home-panel">
              <header className="panel-head">
                <h2>Projetos</h2>
                <button type="button" className="link-button" onClick={() => navigate({ name: "reports" })}>
                  Relatórios <ArrowRight />
                </button>
              </header>
              <div className="ui-card project-progress-list">
                {(report?.projects ?? snapshot.projects.map((project) => ({ ...project, total: 0, completed: 0, overdue: 0, progress: 0 })))
                  .slice(0, 6)
                  .map((project) => (
                    <button type="button" key={project.id} className="project-progress" onClick={() => navigate({ name: "project", projectId: project.id, view: "overview" })}>
                      <ProjectGlyph icon={project.icon} color={project.color} size={28} />
                      <span className="project-progress-body">
                        <span className="project-progress-top">
                          <strong>{project.name}</strong>
                          <span className="tabular">{project.progress}%</span>
                        </span>
                        <ProgressBar value={project.progress} color={project.color} label={`Progresso de ${project.name}`} />
                        <small>
                          {project.completed}/{project.total} concluídas{project.overdue ? ` · ${project.overdue} atrasadas` : ""}
                        </small>
                      </span>
                    </button>
                  ))}
              </div>
            </section>

            <section className="home-panel">
              <header className="panel-head">
                <h2>Atividade recente</h2>
                <button type="button" className="link-button" onClick={() => navigate({ name: "inbox" })}>
                  Caixa de entrada <ArrowRight />
                </button>
              </header>
              <div className="ui-card activity-mini">
                {!notifications && (
                  <div className="page-loading small">
                    <Spinner />
                  </div>
                )}
                {notifications?.slice(0, 5).map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`activity-mini-item ${item.readAt ? "" : "unread"}`}
                    onClick={() => (item.taskId ? void openTask(item.taskId, item.projectId ?? undefined) : navigate({ name: "inbox" }))}
                  >
                    <span className="activity-mini-dot" />
                    <span>
                      <strong>{item.title}</strong>
                      <small>
                        {item.message} · {relativeTime(item.createdAt)}
                      </small>
                    </span>
                  </button>
                ))}
                {notifications && !notifications.length && (
                  <EmptyState compact icon={Bell} title="Sem novidades">
                    Menções, atribuições e comentários aparecem aqui.
                  </EmptyState>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
