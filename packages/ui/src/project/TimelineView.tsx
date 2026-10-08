import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange } from "lucide-react";
import type { Task } from "@orbitask/contracts";
import type React from "react";
import { EmptyState } from "../components/primitives";
import { addDays, formatDue, isoDate, parseDay, startOfToday } from "../lib/format";
import { prefersReducedMotion } from "./dnd";
import { useStore } from "../store";
import { useTaskHelpers } from "./ProjectScreen";

const DAY = 34;

export function TimelineView({ tasks }: { tasks: Task[] }) {
  const snapshot = useStore((state) => state.snapshot)!;
  const openTask = useStore((state) => state.openTask);
  const { statusById, doneId } = useTaskHelpers();
  const scroller = useRef<HTMLDivElement>(null);

  const dated = useMemo(
    () =>
      tasks
        .filter((task) => task.startDate || task.dueDate)
        .sort((a, b) => (a.startDate ?? a.dueDate ?? "").localeCompare(b.startDate ?? b.dueDate ?? "")),
    [tasks],
  );
  const undated = tasks.filter((task) => !task.startDate && !task.dueDate);

  const { start, days } = useMemo(() => {
    const today = startOfToday();
    const dates = dated.flatMap((task) => [task.startDate, task.dueDate].filter(Boolean).map((value) => parseDay(value!)));
    const min = new Date(Math.min(addDays(today, -7).getTime(), ...dates.map((date) => date.getTime())));
    const max = new Date(Math.max(addDays(today, 28).getTime(), ...dates.map((date) => date.getTime())));
    const first = addDays(min, -min.getDay() - 7);
    const count = Math.ceil((max.getTime() - first.getTime()) / 86400000) + 14;
    return { start: first, days: Array.from({ length: count }, (_, index) => addDays(first, index)) };
  }, [dated]);

  const offset = (value: string) => Math.round((parseDay(value).getTime() - start.getTime()) / 86400000);
  const todayIndex = offset(isoDate(new Date()));

  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = Math.max(0, (todayIndex - 5) * DAY);
  }, [todayIndex]);

  if (!tasks.length) return <EmptyState icon={CalendarRange} title="Nenhuma tarefa para mostrar">Ajuste os filtros ou crie tarefas com datas de início e prazo.</EmptyState>;

  const months: { label: string; span: number }[] = [];
  days.forEach((date) => {
    const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    if (months.at(-1)?.label === label) months.at(-1)!.span++;
    else months.push({ label, span: 1 });
  });

  return (
    <div className="timeline">
      <div className="timeline-scroller" ref={scroller}>
        <div className="timeline-inner" style={{ width: 260 + days.length * DAY }}>
          <div className="timeline-head">
            <div className="timeline-corner">Tarefa</div>
            <div className="timeline-scale">
              <div className="timeline-months">
                {months.map((month, index) => (
                  <span key={index} style={{ width: month.span * DAY }} className="capitalize">
                    <em>{month.label}</em>
                  </span>
                ))}
              </div>
              <div className="timeline-days">
                {days.map((date, index) => (
                  <span key={index} className={`${date.getDay() === 0 || date.getDay() === 6 ? "weekend" : ""} ${index === todayIndex ? "today" : ""}`} style={{ width: DAY }}>
                    {date.getDate()}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="timeline-body" style={{ "--today": `${260 + todayIndex * DAY + DAY / 2}px`, "--day": `${DAY}px` } as React.CSSProperties}>
            {dated.map((task) => {
              const status = statusById.get(task.statusId);
              const from = offset(task.startDate ?? task.dueDate!);
              const to = offset(task.dueDate ?? task.startDate!);
              const left = Math.min(from, to);
              const width = (Math.abs(to - from) + 1) * DAY;
              const done = task.statusId === doneId;
              return (
                <div key={task.id} className="timeline-row">
                  <button type="button" className="timeline-label" onClick={() => void openTask(task.id)}>
                    <i className="ui-dot" style={{ background: status?.color, width: 8, height: 8 }} />
                    <span>{task.title}</span>
                  </button>
                  <div className="timeline-track">
                    <TimelineBar task={task} left={left * DAY + 3} width={width - 6} color={status?.color ?? snapshot.project.color} done={done} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {undated.length > 0 && (
        <section className="timeline-undated">
          <h3>Sem datas · {undated.length}</h3>
          <p className="subtle small-text">Abra a tarefa e defina início e prazo para vê-la no cronograma.</p>
          <div className="timeline-undated-list">
            {undated.map((task) => (
              <button type="button" key={task.id} className="calendar-chip" style={{ "--chip": statusById.get(task.statusId)?.color } as React.CSSProperties} onClick={() => void openTask(task.id)}>
                <i />
                <span>{task.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const shift = (value: string | null, days: number) => (value ? isoDate(addDays(parseDay(value), days)) : null);

/**
 * Barra arrastável: acompanha o ponteiro 1:1 (respeitando onde foi agarrada),
 * encaixa no dia mais próximo ao soltar e só então grava as novas datas.
 * Arrastar o corpo move início e prazo; arrastar a borda direita muda só o prazo.
 */
function TimelineBar({ task, left, width, color, done }: { task: Task; left: number; width: number; color: string; done: boolean }) {
  const openTask = useStore((state) => state.openTask);
  const updateTask = useStore((state) => state.updateTask);
  const [drag, setDrag] = useState<{ mode: "move" | "end"; dx: number; settling: boolean } | null>(null);
  const start = useRef<{ x: number; mode: "move" | "end"; moved: boolean } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || drag?.settling) return;
    const mode = (event.target as HTMLElement).dataset.handle === "end" ? "end" : "move";
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX, mode, moved: false };
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const origin = start.current;
    if (!origin) return;
    let dx = event.clientX - origin.x;
    if (!origin.moved && Math.abs(dx) < 4) return;
    origin.moved = true;
    if (origin.mode === "end") dx = Math.max(dx, -width + DAY - 6);
    setDrag({ mode: origin.mode, dx, settling: false });
  };
  const onPointerUp = () => {
    const origin = start.current;
    start.current = null;
    if (!origin) return;
    if (!origin.moved) return void openTask(task.id);
    const days = Math.round((drag?.dx ?? 0) / DAY);
    setDrag({ mode: origin.mode, dx: days * DAY, settling: true });
    window.setTimeout(
      () => {
        if (days) {
          const input =
            origin.mode === "move"
              ? { startDate: shift(task.startDate, days), dueDate: shift(task.dueDate, days) }
              : { startDate: task.startDate ?? task.dueDate, dueDate: shift(task.dueDate ?? task.startDate, days) };
          void updateTask({ id: task.id, ...input }, { announce: origin.mode === "move" ? "Datas atualizadas" : "Prazo atualizado" });
        }
        setDrag(null);
      },
      prefersReducedMotion() ? 0 : 180,
    );
  };

  const dx = drag?.dx ?? 0;
  return (
    <button
      type="button"
      className={`timeline-bar ${done ? "done" : ""} ${drag && !drag.settling ? "grabbing" : ""} ${drag?.settling ? "settling" : ""}`}
      style={
        {
          left,
          width: drag?.mode === "end" ? width + dx : width,
          transform: drag?.mode === "move" ? `translateX(${dx}px)` : undefined,
          "--bar": color,
        } as React.CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current = null;
        setDrag(null);
      }}
      onKeyDown={(event) => event.key === "Enter" && void openTask(task.id)}
      title={`${task.title}: ${task.startDate ? formatDue(task.startDate) : "?"} → ${task.dueDate ? formatDue(task.dueDate) : "?"} · arraste para mover, puxe a borda para mudar o prazo`}
    >
      <span>{task.title}</span>
      <i className="timeline-handle" data-handle="end" aria-hidden="true" />
    </button>
  );
}
