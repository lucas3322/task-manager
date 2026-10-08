import React, { useMemo, useState } from "react";
import { DndContext, DragOverlay, useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronDown, GitBranch, GripVertical, Inbox, Lock, MessageSquare, Plus } from "lucide-react";
import type { Task, TaskGroup } from "@orbitask/contracts";
import { EmptyState } from "../components/primitives";
import { Assignees, ChoiceMenu, DueChip, Pill, PriorityFlag, statusChoices } from "../components/task-bits";
import { taskStats } from "../lib/tasks";
import { useStore } from "../store";
import { QuickAdd } from "./Board";
import { dropAnimation, sortableTransition, useFreshTaskIds, useTaskDnd } from "./dnd";
import { useTaskHelpers } from "./ProjectScreen";

interface Group {
  id: string;
  label: string;
  color?: string;
  tasks: Task[];
  statusId?: string;
}

export function ListView({ tasks, group, manual }: { tasks: Task[]; group: TaskGroup; manual: boolean }) {
  const snapshot = useStore((state) => state.snapshot)!;
  const openCreateTask = useStore((state) => state.openCreateTask);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const ordered = useMemo(() => (manual ? [...tasks].sort((a, b) => a.position - b.position) : tasks), [tasks, manual]);
  const sortable = group === "status" && manual;
  const { columns, activeTask, contextProps } = useTaskDnd(tasks, snapshot.statuses);
  const fresh = useFreshTaskIds();

  const groups = useMemo<Group[]>(() => {
    if (group === "status")
      return snapshot.statuses.map((status) => ({ id: status.id, label: status.name, color: status.color, statusId: status.id, tasks: sortable ? (columns[status.id] ?? []) : ordered.filter((task) => task.statusId === status.id) }));
    if (group === "priority")
      return [...snapshot.settings.priorities]
        .sort((a, b) => b.position - a.position)
        .map((priority) => ({ id: priority.id, label: priority.name, color: priority.color, tasks: ordered.filter((task) => task.priority === priority.id) }))
        .filter((item) => item.tasks.length);
    if (group === "assignee") {
      const people = snapshot.members
        .map((member) => ({ id: member.userId, label: member.name, tasks: ordered.filter((task) => task.assigneeIds.includes(member.userId)) }))
        .filter((item) => item.tasks.length);
      const nobody = ordered.filter((task) => !task.assigneeIds.length);
      return nobody.length ? [...people, { id: "nobody", label: "Sem responsável", tasks: nobody }] : people;
    }
    return [{ id: "all", label: "Todas as tarefas", tasks: ordered }];
  }, [group, ordered, snapshot, sortable, columns]);

  if (!tasks.length && !snapshot.tasks.some((task) => !task.parentId))
    return (
      <EmptyState icon={Inbox} title="Nenhuma tarefa neste projeto" action={<button className="ui-button primary" onClick={() => openCreateTask()}><Plus /> Criar primeira tarefa</button>}>
        Organize o trabalho em tarefas com responsáveis, prazos e prioridades.
      </EmptyState>
    );

  const body = (
    <div className={`list-view ${sortable ? "sortable" : ""} ${activeTask ? "dragging" : ""}`}>
      <div className="list-header" aria-hidden="true">
        <span>Tarefa</span>
        <span>Responsável</span>
        <span>Prazo</span>
        <span>Prioridade</span>
        <span>Status</span>
      </div>
      {groups.map((item) => {
        const isCollapsed = collapsed[item.id];
        return (
          <section key={item.id} className="list-group">
            <header>
              <button type="button" className="list-group-toggle" aria-expanded={!isCollapsed} onClick={() => setCollapsed({ ...collapsed, [item.id]: !isCollapsed })}>
                <ChevronDown className={isCollapsed ? "rotated" : ""} />
                {item.color && <i className="ui-dot" style={{ background: item.color, width: 9, height: 9 }} />}
                <h2>{item.label}</h2>
                <span className="count">{item.tasks.length}</span>
              </button>
              {item.statusId && (
                <button type="button" className="ui-icon-button small" aria-label={`Adicionar em ${item.label}`} onClick={() => setAdding(item.statusId!)}>
                  <Plus />
                </button>
              )}
            </header>
            {!isCollapsed && (
              <GroupRows id={item.id} enabled={sortable} ids={item.tasks.map((task) => task.id)}>
                {item.tasks.map((task) => (sortable ? <SortableRow key={task.id} task={task} entering={fresh.has(task.id)} /> : <ListRow key={task.id} task={task} entering={fresh.has(task.id)} />))}
                {item.statusId &&
                  (adding === item.statusId ? (
                    <div className="list-quick-add">
                      <QuickAdd statusId={item.statusId} onDone={() => setAdding(null)} />
                    </div>
                  ) : (
                    <button type="button" className="list-add" onClick={() => setAdding(item.statusId!)}>
                      <Plus /> Adicionar tarefa
                    </button>
                  ))}
                {!item.tasks.length && !item.statusId && <div className="list-empty">Nenhuma tarefa</div>}
              </GroupRows>
            )}
          </section>
        );
      })}
    </div>
  );

  if (!sortable) return body;
  return (
    <DndContext {...contextProps}>
      {body}
      <DragOverlay dropAnimation={dropAnimation()}>{activeTask ? <ListRow task={activeTask} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

/** Grupo da lista; quando ordenável, também é área de soltura (soltar num grupo vazio muda o status). */
function GroupRows({ id, enabled, ids, children }: { id: string; enabled: boolean; ids: string[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !enabled });
  if (!enabled) return <div className="list-rows">{children}</div>;
  return (
    <div ref={setNodeRef} className={`list-rows ${isOver ? "over" : ""}`}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  );
}

function SortableRow({ task, entering }: { task: Task; entering: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, transition: sortableTransition });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`sortable-row ${isDragging ? "row-placeholder" : ""}`} {...attributes} {...listeners}>
      <ListRow task={task} entering={entering} draggable />
    </div>
  );
}

function ListRow({ task, overlay, entering, draggable }: { task: Task; overlay?: boolean; entering?: boolean; draggable?: boolean }) {
  const snapshot = useStore((state) => state.snapshot)!;
  const openTask = useStore((state) => state.openTask);
  const updateTask = useStore((state) => state.updateTask);
  const selected = useStore((state) => state.selectedTaskId === task.id);
  const { statusById, priorityById, tagById, doneId } = useTaskHelpers();
  const stats = taskStats(task, snapshot);
  const done = task.statusId === doneId;
  const status = statusById.get(task.statusId);
  const firstId = snapshot.statuses[0]?.id;

  const toggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!doneId || !firstId) return;
    void updateTask({ id: task.id, statusId: done ? firstId : doneId }, { announce: done ? "Tarefa reaberta" : "Tarefa concluída" });
  };

  return (
    <div className={`list-row ${selected ? "selected" : ""} ${done ? "done" : ""} ${overlay ? "overlay" : ""} ${entering ? "enter" : ""}`} onClick={() => !overlay && void openTask(task.id)}>
      <span className="list-cell title">
        {(draggable || overlay) && <GripVertical className="row-grip" aria-hidden="true" />}
        <button type="button" className={`ui-check ${done ? "done" : ""}`} aria-label={done ? "Reabrir tarefa" : "Concluir tarefa"} onClick={toggle}>
          <Check />
        </button>
        {stats.blocked && <Lock className="task-blocked" aria-label="Bloqueada" />}
        <span className="list-title">{task.title}</span>
        {task.tagIds.slice(0, 2).map((id) => {
          const tag = tagById.get(id);
          return tag ? (
            <Pill key={id} color={tag.color}>
              {tag.name}
            </Pill>
          ) : null;
        })}
        {stats.subtasks > 0 && (
          <span className="meta-count">
            <GitBranch /> {stats.subtasksDone}/{stats.subtasks}
          </span>
        )}
        {stats.comments > 0 && (
          <span className="meta-count">
            <MessageSquare /> {stats.comments}
          </span>
        )}
      </span>
      <span className="list-cell people">
        <Assignees task={task} members={snapshot.members} size={22} />
      </span>
      <span className="list-cell due">
        <DueChip date={task.dueDate} done={done} />
      </span>
      <span className="list-cell priority">
        <PriorityFlag option={priorityById.get(task.priority)} showLabel />
      </span>
      <span className="list-cell status" onClick={(event) => event.stopPropagation()}>
        <ChoiceMenu
          align="end"
          choices={statusChoices(snapshot)}
          value={[task.statusId]}
          onChange={([statusId]) => statusId !== task.statusId && void updateTask({ id: task.id, statusId })}
          trigger={(props) => (
            <button {...props} type="button" className="status-button" aria-label={`Status: ${status?.name}`}>
              {status && <Pill color={status.color}>{status.name}</Pill>}
            </button>
          )}
        />
      </span>
    </div>
  );
}
