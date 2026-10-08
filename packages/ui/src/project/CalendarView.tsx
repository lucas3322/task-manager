import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Task } from "@orbitask/contracts";
import { addDays, isoDate, todayIso } from "../lib/format";
import { useStore } from "../store";
import { useTaskHelpers } from "./ProjectScreen";

const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function CalendarView({ tasks }: { tasks: Task[] }) {
  const openTask = useStore((state) => state.openTask);
  const updateTask = useStore((state) => state.updateTask);
  const openCreateTask = useStore((state) => state.openCreateTask);
  const { statusById, doneId } = useTaskHelpers();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dropDay, setDropDay] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [landedId, setLandedId] = useState<string | null>(null);

  const days = useMemo(() => {
    const start = addDays(cursor, -cursor.getDay());
    const weeks = Math.ceil((cursor.getDay() + new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()) / 7);
    return Array.from({ length: weeks * 7 }, (_, index) => addDays(start, index));
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => {
      if (!task.dueDate) return;
      map.set(task.dueDate, [...(map.get(task.dueDate) ?? []), task]);
    });
    return map;
  }, [tasks]);
  const undated = tasks.filter((task) => !task.dueDate);
  const today = todayIso();
  const label = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const drop = (day: string, taskId: string) => {
    setDropDay(null);
    const task = tasks.find((item) => item.id === taskId);
    if (task && task.dueDate !== day) {
      setLandedId(taskId);
      void updateTask({ id: taskId, dueDate: day }, { announce: "Prazo atualizado" });
    }
  };

  const chip = (task: Task) => {
    const status = statusById.get(task.statusId);
    const done = task.statusId === doneId;
    const overdue = !done && task.dueDate !== null && task.dueDate < today;
    return (
      <button
        type="button"
        key={task.id}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", task.id);
          event.dataTransfer.effectAllowed = "move";
          setLandedId(null);
          /* Adia um quadro para o navegador capturar a imagem de arrasto antes de esmaecer a origem. */
          requestAnimationFrame(() => setDraggingId(task.id));
        }}
        onDragEnd={() => {
          setDraggingId(null);
          setDropDay(null);
        }}
        onAnimationEnd={() => landedId === task.id && setLandedId(null)}
        className={`calendar-chip ${done ? "done" : ""} ${overdue ? "overdue" : ""} ${draggingId === task.id ? "dragging" : ""} ${landedId === task.id ? "landed" : ""}`}
        style={{ "--chip": status?.color ?? "var(--text-3)" } as React.CSSProperties}
        onClick={() => void openTask(task.id)}
        title={`${task.title} · ${status?.name ?? ""}`}
      >
        <i />
        <span>{task.title}</span>
      </button>
    );
  };

  return (
    <div className="calendar-layout">
      <div className="calendar">
        <header className="calendar-head">
          <h2 className="capitalize">{label}</h2>
          <span className="spacer" />
          <button type="button" className="ui-button small" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
            Hoje
          </button>
          <button type="button" className="ui-icon-button" aria-label="Mês anterior" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft />
          </button>
          <button type="button" className="ui-icon-button" aria-label="Próximo mês" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight />
          </button>
        </header>
        <div className="calendar-weekdays">
          {weekdays.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className={`calendar-grid ${draggingId ? "is-dragging" : ""}`} style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(108px, 1fr))` }}>
          {days.map((date) => {
            const key = isoDate(date);
            const items = byDay.get(key) ?? [];
            const outside = date.getMonth() !== cursor.getMonth();
            return (
              <div
                key={key}
                className={`calendar-day ${outside ? "outside" : ""} ${key === today ? "today" : ""} ${dropDay === key ? "drop" : ""} ${date.getDay() === 0 || date.getDay() === 6 ? "weekend" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (dropDay !== key) setDropDay(key);
                }}
                onDragLeave={() => dropDay === key && setDropDay(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  drop(key, event.dataTransfer.getData("text/plain"));
                }}
              >
                <div className="calendar-day-head">
                  <span className="calendar-date">{date.getDate()}</span>
                  <button type="button" className="calendar-add" aria-label={`Nova tarefa em ${date.toLocaleDateString("pt-BR")}`} onClick={() => openCreateTask({ dueDate: key })}>
                    <Plus />
                  </button>
                </div>
                <div className="calendar-items">
                  {items.slice(0, 4).map(chip)}
                  {items.length > 4 && <span className="calendar-more">+{items.length - 4} tarefas</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <aside className="calendar-side">
        <h3>Sem prazo</h3>
        <p className="subtle small-text">Arraste para um dia para definir o prazo.</p>
        <div className="calendar-undated">
          {undated.map(chip)}
          {!undated.length && <p className="subtle small-text">Todas as tarefas têm prazo.</p>}
        </div>
      </aside>
    </div>
  );
}
