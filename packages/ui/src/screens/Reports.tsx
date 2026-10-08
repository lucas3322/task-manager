import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, CalendarClock, CircleCheck, FolderKanban, ListTodo } from "lucide-react";
import type { DashboardReport } from "@orbitask/contracts";
import { api } from "../api";
import { Avatar, EmptyState, ProgressBar, ProgressRing, ProjectGlyph, Spinner } from "../components/primitives";
import { PageHeader } from "../shell/Sidebar";
import { useStore } from "../store";

/** Barras horizontais com rótulo e valor em texto — legível sem depender da cor. */
function BarList({ rows, total }: { rows: { id: string; label: string; color: string; value: number; leading?: React.ReactNode }[]; total: number }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="bar-list">
      {rows.map((row) => (
        <div key={row.id} className="bar-row" title={`${row.label}: ${row.value} (${total ? Math.round((row.value / total) * 100) : 0}%)`}>
          <span className="bar-label">
            {row.leading ?? <i className="ui-dot" style={{ background: row.color, width: 8, height: 8 }} />}
            <span>{row.label}</span>
          </span>
          <span className="bar-track">
            <span style={{ width: `${(row.value / max) * 100}%`, background: row.color }} />
          </span>
          <span className="bar-value tabular">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ReportsScreen() {
  const navigate = useStore((state) => state.navigate);
  const revision = useStore((state) => state.revision);
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api()
      .getDashboard()
      .then((value) => {
        setReport(value);
        setError(false);
      })
      .catch(() => setError(true));
  }, [revision]);

  const totals = report?.totals;
  const completion = totals && totals.tasks ? Math.round((totals.completed / totals.tasks) * 100) : 0;

  return (
    <div className="page">
      <PageHeader title="Relatórios" subtitle="Saúde do workspace: progresso, prazos e carga da equipe" />
      <div className="page-body">
        {!report && !error && (
          <div className="page-loading">
            <Spinner />
          </div>
        )}
        {error && (
          <EmptyState icon={BarChart3} title="Não foi possível carregar os relatórios">
            Verifique sua conexão e tente novamente.
          </EmptyState>
        )}
        {report && totals && (
          <>
            <section className="report-hero ui-card">
              <div className="report-ring">
                <ProgressRing value={completion} size={112} stroke={10} />
                <div>
                  <strong className="tabular">{completion}%</strong>
                  <span>concluído</span>
                </div>
              </div>
              <div className="report-kpis">
                <div className="kpi">
                  <FolderKanban />
                  <strong className="tabular">{totals.projects}</strong>
                  <span>Projetos</span>
                </div>
                <div className="kpi">
                  <ListTodo />
                  <strong className="tabular">{totals.active}</strong>
                  <span>Em aberto</span>
                </div>
                <div className="kpi">
                  <CircleCheck />
                  <strong className="tabular">{totals.completed}</strong>
                  <span>Concluídas</span>
                </div>
                <div className={`kpi ${totals.overdue ? "alert" : ""}`}>
                  <AlertTriangle />
                  <strong className="tabular">{totals.overdue}</strong>
                  <span>Atrasadas</span>
                </div>
                <div className="kpi">
                  <CalendarClock />
                  <strong className="tabular">{totals.dueSoon}</strong>
                  <span>Vencem em 7 dias</span>
                </div>
              </div>
            </section>

            <div className="report-grid">
              <section className="ui-card report-card">
                <h2>Tarefas por status</h2>
                <p className="muted">Tarefas principais em todos os projetos</p>
                <BarList total={totals.tasks} rows={report.byStatus.map((item) => ({ id: item.id, label: item.name, color: item.color, value: item.count }))} />
              </section>
              <section className="ui-card report-card">
                <h2>Tarefas por prioridade</h2>
                <p className="muted">Onde está a urgência</p>
                <BarList total={totals.tasks} rows={report.byPriority.map((item) => ({ id: item.id, label: item.name, color: item.color, value: item.count }))} />
              </section>
              <section className="ui-card report-card wide">
                <h2>Carga da equipe</h2>
                <p className="muted">Tarefas atribuídas, concluídas e atrasadas por pessoa</p>
                {report.byAssignee.length ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Pessoa</th>
                        <th className="num">Atribuídas</th>
                        <th className="num">Concluídas</th>
                        <th className="num">Atrasadas</th>
                        <th>Progresso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byAssignee.map((person) => {
                        const progress = person.count ? Math.round((person.completed / person.count) * 100) : 0;
                        return (
                          <tr key={person.id}>
                            <td>
                              <span className="cell-person">
                                <Avatar name={person.name} url={person.avatarUrl} size={24} />
                                {person.name}
                              </span>
                            </td>
                            <td className="num tabular">{person.count}</td>
                            <td className="num tabular">{person.completed}</td>
                            <td className={`num tabular ${person.overdue ? "danger" : ""}`}>{person.overdue}</td>
                            <td className="cell-progress">
                              <ProgressBar value={progress} label={`Progresso de ${person.name}`} />
                              <span className="tabular">{progress}%</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <EmptyState compact icon={ListTodo} title="Ninguém com tarefas atribuídas ainda" />
                )}
              </section>
              <section className="ui-card report-card wide">
                <h2>Projetos</h2>
                <p className="muted">Progresso e atrasos de cada projeto</p>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Projeto</th>
                      <th className="num">Tarefas</th>
                      <th className="num">Concluídas</th>
                      <th className="num">Atrasadas</th>
                      <th>Progresso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.projects.map((project) => (
                      <tr key={project.id} className="clickable" onClick={() => navigate({ name: "project", projectId: project.id, view: "overview" })}>
                        <td>
                          <span className="cell-person">
                            <ProjectGlyph icon={project.icon} color={project.color} size={22} />
                            {project.name}
                          </span>
                        </td>
                        <td className="num tabular">{project.total}</td>
                        <td className="num tabular">{project.completed}</td>
                        <td className={`num tabular ${project.overdue ? "danger" : ""}`}>{project.overdue}</td>
                        <td className="cell-progress">
                          <ProgressBar value={project.progress} color={project.color} label={`Progresso de ${project.name}`} />
                          <span className="tabular">{project.progress}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
