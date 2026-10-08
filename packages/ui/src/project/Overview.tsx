import { AlertTriangle, ArrowRight, CalendarClock, CircleCheck, History, ListTodo, Pencil, Users } from "lucide-react";
import { Avatar, EmptyState, ProgressRing } from "../components/primitives";
import { DueChip } from "../components/task-bits";
import { activityLabels } from "../lib/catalog";
import { addDays, parseDay, relativeTime, roleLabel, startOfToday } from "../lib/format";
import { useStore } from "../store";
import { useTaskHelpers } from "./ProjectScreen";

export function ProjectOverview() {
  const snapshot = useStore((state) => state.snapshot)!;
  const navigate = useStore((state) => state.navigate);
  const openTask = useStore((state) => state.openTask);
  const { doneId, statusById } = useTaskHelpers();
  const project = snapshot.project;
  const tasks = snapshot.tasks.filter((task) => !task.parentId);
  const done = tasks.filter((task) => task.statusId === doneId);
  const open = tasks.filter((task) => task.statusId !== doneId);
  const today = startOfToday();
  const overdue = open.filter((task) => task.dueDate && parseDay(task.dueDate) < today);
  const upcoming = open
    .filter((task) => task.dueDate && parseDay(task.dueDate) >= today && parseDay(task.dueDate) <= addDays(today, 14))
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const progress = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
  const members = snapshot.members.filter((member) => member.role !== "guest" || member.projectIds.includes(project.id));
  const taskTitle = (id: string) => snapshot.tasks.find((task) => task.id === id)?.title;
  const max = Math.max(1, ...snapshot.statuses.map((status) => tasks.filter((task) => task.statusId === status.id).length));

  return (
    <div className="overview">
      <section className="overview-hero ui-card">
        <div className="report-ring">
          <ProgressRing value={progress} size={104} stroke={10} color={project.color} />
          <div>
            <strong className="tabular">{progress}%</strong>
            <span>concluído</span>
          </div>
        </div>
        <div className="overview-about">
          <h2>Sobre o projeto</h2>
          <p className={project.description ? "" : "subtle"}>{project.description || "Sem descrição. Conte para a equipe qual é o objetivo deste projeto."}</p>
          <button type="button" className="link-button" onClick={() => navigate({ name: "project-settings", projectId: project.id, tab: "general" })}>
            <Pencil /> Editar detalhes
          </button>
        </div>
        <div className="overview-kpis">
          <div className="kpi">
            <ListTodo />
            <strong className="tabular">{open.length}</strong>
            <span>Em aberto</span>
          </div>
          <div className="kpi">
            <CircleCheck />
            <strong className="tabular">{done.length}</strong>
            <span>Concluídas</span>
          </div>
          <div className={`kpi ${overdue.length ? "alert" : ""}`}>
            <AlertTriangle />
            <strong className="tabular">{overdue.length}</strong>
            <span>Atrasadas</span>
          </div>
        </div>
      </section>

      <div className="overview-grid">
        <section className="ui-card report-card">
          <h2>Distribuição por status</h2>
          <div className="bar-list">
            {snapshot.statuses.map((status) => {
              const count = tasks.filter((task) => task.statusId === status.id).length;
              return (
                <button type="button" key={status.id} className="bar-row clickable" onClick={() => navigate({ name: "project", projectId: project.id, view: "board" })}>
                  <span className="bar-label">
                    <i className="ui-dot" style={{ background: status.color, width: 8, height: 8 }} />
                    <span>{status.name}</span>
                  </span>
                  <span className="bar-track">
                    <span style={{ width: `${(count / max) * 100}%`, background: status.color }} />
                  </span>
                  <span className="bar-value tabular">{count}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="ui-card report-card">
          <header className="panel-head">
            <h2>
              <CalendarClock /> Próximos prazos
            </h2>
            <button type="button" className="link-button" onClick={() => navigate({ name: "project", projectId: project.id, view: "calendar" })}>
              Calendário <ArrowRight />
            </button>
          </header>
          <div className="mini-task-list">
            {[...overdue, ...upcoming].slice(0, 7).map((task) => (
              <button type="button" key={task.id} className="mini-task" onClick={() => void openTask(task.id)}>
                <i className="ui-dot" style={{ background: statusById.get(task.statusId)?.color, width: 8, height: 8 }} />
                <span>{task.title}</span>
                <DueChip date={task.dueDate} />
              </button>
            ))}
            {!overdue.length && !upcoming.length && <EmptyState compact icon={CalendarClock} title="Nenhum prazo nas próximas duas semanas" />}
          </div>
        </section>

        <section className="ui-card report-card">
          <header className="panel-head">
            <h2>
              <Users /> Pessoas
            </h2>
            <button type="button" className="link-button" onClick={() => navigate({ name: "people" })}>
              Gerenciar <ArrowRight />
            </button>
          </header>
          <div className="mini-people">
            {members.map((member) => {
              const assigned = open.filter((task) => task.assigneeIds.includes(member.userId)).length;
              return (
                <div key={member.userId} className="mini-person">
                  <Avatar name={member.name} url={member.avatarUrl} size={28} />
                  <span>
                    <strong>{member.name}</strong>
                    <small>{roleLabel[member.role]}</small>
                  </span>
                  <span className="subtle small-text tabular">{assigned} abertas</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="ui-card report-card">
          <h2>
            <History /> Atividade recente
          </h2>
          <ol className="activity-feed">
            {snapshot.activities.slice(0, 8).map((activity) => (
              <li key={activity.id}>
                <Avatar name={activity.authorName ?? "Sistema"} size={22} />
                <div>
                  <p>
                    <strong>{activity.authorName ?? "Automação"}</strong> {activityLabels[activity.action] ?? "atualizou"}{" "}
                    {taskTitle(activity.taskId) && (
                      <button type="button" className="inline-link" onClick={() => void openTask(activity.taskId)}>
                        {taskTitle(activity.taskId)}
                      </button>
                    )}
                  </p>
                  <small>{relativeTime(activity.createdAt)}</small>
                </div>
              </li>
            ))}
            {!snapshot.activities.length && <EmptyState compact icon={History} title="Nada por aqui ainda" />}
          </ol>
        </section>
      </div>
    </div>
  );
}
