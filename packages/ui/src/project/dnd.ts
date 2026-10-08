import { useEffect, useRef, useState } from "react";
import {
  closestCorners,
  defaultDropAnimationSideEffects,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { Status, Task } from "@orbitask/contracts";
import { positionBetween } from "../lib/tasks";
import { useStore } from "../store";

/** Mesma curva do token --ease-out, para movimentos dirigidos por JS. */
export const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

export const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Vizinhos abrem espaço com a mesma curva das demais transições do app. */
export const sortableTransition = { duration: 220, easing: EASE_OUT };

/** Ao soltar, o cartão “assenta”: perde a inclinação e a sombra elevada enquanto vai para o lugar. */
export const dropAnimation = (): DropAnimation | null =>
  prefersReducedMotion()
    ? null
    : {
        duration: 240,
        easing: EASE_OUT,
        sideEffects: defaultDropAnimationSideEffects({ className: { dragOverlay: "dropping" }, styles: { active: { opacity: "0" } } }),
      };

type Columns = Record<string, Task[]>;

function group(tasks: Task[], statuses: Status[]): Columns {
  const columns: Columns = Object.fromEntries(statuses.map((status) => [status.id, [] as Task[]]));
  [...tasks].sort((a, b) => a.position - b.position).forEach((task) => columns[task.statusId]?.push(task));
  return columns;
}

/** Arrastar entre status e reordenar dentro deles — compartilhado pelo quadro e pela lista. */
export function useTaskDnd(tasks: Task[], statuses: Status[]) {
  const moveTask = useStore((state) => state.moveTask);
  const [columns, setColumns] = useState<Columns>(() => group(tasks, statuses));
  const [activeId, setActiveId] = useState<string | null>(null);
  const origin = useRef<string | null>(null);

  useEffect(() => {
    if (!activeId) setColumns(group(tasks, statuses));
  }, [tasks, statuses, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const containerOf = (id: string) => (id in columns ? id : Object.keys(columns).find((key) => columns[key].some((task) => task.id === id)));

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    origin.current = containerOf(String(active.id)) ?? null;
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = containerOf(String(active.id));
    const to = containerOf(String(over.id));
    if (!from || !to || from === to) return;
    setColumns((current) => {
      const moving = current[from].find((task) => task.id === active.id);
      if (!moving) return current;
      const target = current[to];
      const overIndex = target.findIndex((task) => task.id === over.id);
      const index = overIndex >= 0 ? overIndex : target.length;
      return {
        ...current,
        [from]: current[from].filter((task) => task.id !== active.id),
        [to]: [...target.slice(0, index), { ...moving, statusId: to }, ...target.slice(index)],
      };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const id = String(active.id);
    setActiveId(null);
    if (!over) return setColumns(group(tasks, statuses));
    const to = containerOf(id);
    if (!to) return;
    const list = columns[to];
    const from = list.findIndex((task) => task.id === id);
    const overIndex = list.findIndex((task) => task.id === over.id);
    const index = overIndex >= 0 ? overIndex : from;
    const reordered = [...list];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(index, 0, moved);
    setColumns({ ...columns, [to]: reordered });
    const original = tasks.find((task) => task.id === id);
    const position = positionBetween(reordered[index - 1]?.position, reordered[index + 1]?.position);
    if (original && (original.statusId !== to || index !== from || origin.current !== to)) void moveTask(id, to, position);
  };

  return {
    columns,
    activeTask: activeId ? (tasks.find((task) => task.id === activeId) ?? null) : null,
    contextProps: {
      sensors,
      collisionDetection: closestCorners,
      onDragStart,
      onDragOver,
      onDragEnd,
      onDragCancel: () => {
        setActiveId(null);
        setColumns(group(tasks, statuses));
      },
    },
  };
}

/**
 * Tarefas criadas depois que a visualização abriu — só elas ganham animação de entrada,
 * para que abrir um projeto ou limpar filtros não faça tudo surgir de uma vez.
 */
export function useFreshTaskIds() {
  const snapshot = useStore((state) => state.snapshot)!;
  const seen = useRef<{ projectId: string; ids: Set<string> } | null>(null);
  if (!seen.current || seen.current.projectId !== snapshot.project.id)
    seen.current = { projectId: snapshot.project.id, ids: new Set(snapshot.tasks.map((task) => task.id)) };
  const fresh = new Set(snapshot.tasks.filter((task) => !seen.current!.ids.has(task.id)).map((task) => task.id));
  useEffect(() => {
    fresh.forEach((id) => seen.current?.ids.add(id));
  });
  return fresh;
}
