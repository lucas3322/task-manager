import React, { useMemo, useState } from "react";
import { DndContext, DragOverlay, useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckSquare, GitBranch, Lock, MessageSquare, MoreHorizontal, Paperclip, Plus, Settings2 } from "lucide-react";
import type { Status, Task } from "@orbitask/contracts";
import { MenuItem, Popover } from "../components/primitives";
import { Assignees, DueChip, Pill, PriorityFlag } from "../components/task-bits";
import { customFieldDisplay, taskStats } from "../lib/tasks";
import { useStore } from "../store";
import { dropAnimation, sortableTransition, useFreshTaskIds, useTaskDnd } from "./dnd";
import { useTaskHelpers } from "./ProjectScreen";

export function Board({ tasks, filtered }: { tasks: Task[]; filtered: boolean }) {
  const snapshot = useStore((state) => state.snapshot)!;
  const { columns, activeTask, contextProps } = useTaskDnd(tasks, snapshot.statuses);
  const fresh = useFreshTaskIds();

  return (
    <DndContext {...contextProps}>
      <div className={`board ${activeTask ? "dragging" : ""}`}>
        {snapshot.statuses.map((status) => (
          <Column key={status.id} status={status} tasks={columns[status.id] ?? []} filtered={filtered} fresh={fresh} />
        ))}
      </div>
      <DragOverlay dropAnimation={dropAnimation()}>{activeTask ? <TaskCard task={activeTask} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({ status, tasks, filtered, fresh }: { status: Status; tasks: Task[]; filtered: boolean; fresh: Set<string> }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  const navigate = useStore((state) => state.navigate);
  const projectId = useStore((state) => state.snapshot!.project.id);
  const [adding, setAdding] = useState(false);
  const ids = useMemo(() => tasks.map((task) => task.id), [tasks]);
  return (
    <section className={`board-column ${isOver ? "over" : ""}`} aria-label={status.name} style={{ "--status": status.color } as React.CSSProperties}>
      <header className="board-column-head">
        <i className="ui-dot" style={{ background: status.color, width: 9, height: 9 }} />
        <h2>{status.name}</h2>
        <span className="count">{tasks.length}</span>
        <span className="spacer" />
        <button type="button" className="ui-icon-button small" aria-label={`Adicionar em ${status.name}`} title="Adicionar tarefa" onClick={() => setAdding(true)}>
          <Plus />
        </button>
        <Popover
          align="end"
          trigger={(props) => (
            <button {...props} type="button" className="ui-icon-button small" aria-label="Opções da coluna">
              <MoreHorizontal />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon={Plus} onSelect={() => (close(), setAdding(true))}>
                Adicionar tarefa
              </MenuItem>
              <MenuItem icon={Settings2} onSelect={() => (close(), navigate({ name: "project-settings", projectId, tab: "workflow" }))}>
                Editar colunas…
              </MenuItem>
            </>
          )}
        </Popover>
      </header>
      <div ref={setNodeRef} className="board-column-body">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableCard key={task.id} task={task} entering={fresh.has(task.id)} />
          ))}
        </SortableContext>
        {!tasks.length && !adding && <div className="board-empty">{filtered ? "Nenhuma tarefa com estes filtros" : "Arraste tarefas para cá"}</div>}
        {adding ? (
          <QuickAdd statusId={status.id} onDone={() => setAdding(false)} />
        ) : (
          <button type="button" className="board-add" onClick={() => setAdding(true)}>
            <Plus /> Adicionar tarefa
          </button>
        )}
      </div>
    </section>
  );
}

export function QuickAdd({ statusId, onDone, dueDate }: { statusId: string; onDone: () => void; dueDate?: string }) {
  const addTask = useStore((state) => state.addTask);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    const task = await addTask({ title, statusId, extra: dueDate ? { dueDate } : undefined });
    setBusy(false);
    if (task) setTitle("");
  };
  return (
    <div className="quick-add">
      <textarea
        autoFocus
        rows={2}
        value={title}
        placeholder="Título da tarefa"
        disabled={busy}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => !title.trim() && onDone()}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void submit();
          }
          if (event.key === "Escape") {
            event.stopPropagation();
            onDone();
          }
        }}
      />
      <div className="quick-add-actions">
        <span className="subtle">Enter para criar · Esc para fechar</span>
        <button type="button" className="ui-button small primary" onMouseDown={(event) => event.preventDefault()} onClick={submit} disabled={!title.trim() || busy}>
          Adicionar
        </button>
      </div>
    </div>
  );
}

function SortableCard({ task, entering }: { task: Task; entering: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, transition: sortableTransition });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`sortable-card ${isDragging ? "card-placeholder" : ""}`} {...attributes} {...listeners}>
      <TaskCard task={task} entering={entering} />
    </div>
  );
}

export function TaskCard({ task, overlay, entering }: { task: Task; overlay?: boolean; entering?: boolean }) {
  const snapshot = useStore((state) => state.snapshot)!;
  const openTask = useStore((state) => state.openTask);
  const selected = useStore((state) => state.selectedTaskId === task.id);
  const { priorityById, tagById, badgeById, doneId } = useTaskHelpers();
  const compact = snapshot.preferences.cardDensity === "compact";
  const stats = taskStats(task, snapshot);
  const done = task.statusId === doneId;
  const fields = compact ? [] : customFieldDisplay(snapshot, task, 2);
  const labels = [...task.badgeIds.map((id) => badgeById.get(id)), ...task.tagIds.map((id) => tagById.get(id))].filter(Boolean);
  return (
    <article
      className={`task-card ${overlay ? "overlay" : ""} ${entering ? "enter" : ""} ${selected ? "selected" : ""} ${done ? "done" : ""} ${compact ? "compact" : ""}`}
      onClick={() => !overlay && void openTask(task.id)}
      onKeyDown={(event) => event.key === "Enter" && void openTask(task.id)}
      aria-label={task.title}
    >
      {!compact && labels.length > 0 && (
        <div className="task-card-labels">
          {labels.slice(0, 3).map((label) => (
            <Pill key={label!.id} color={label!.color}>
              {label!.name}
            </Pill>
          ))}
          {labels.length > 3 && <span className="subtle small-text">+{labels.length - 3}</span>}
        </div>
      )}
      <h3 className="task-card-title">
        {stats.blocked && <Lock className="task-blocked" aria-label="Bloqueada por outra tarefa" />}
        {task.title}
      </h3>
      {!compact && task.description && <p className="task-card-description">{task.description}</p>}
      {fields.length > 0 && (
        <dl className="task-card-fields">
          {fields.map((field) => (
            <div key={field.id}>
              <dt>{field.name}</dt>
              <dd>{field.text}</dd>
            </div>
          ))}
        </dl>
      )}
      <footer className="task-card-meta">
        <PriorityFlag option={priorityById.get(task.priority)} />
        <DueChip date={task.dueDate} done={done} compact={compact} />
        {!compact && stats.subtasks > 0 && (
          <span className="meta-count" title="Subtarefas">
            <GitBranch /> {stats.subtasksDone}/{stats.subtasks}
          </span>
        )}
        {!compact && stats.checklist > 0 && (
          <span className={`meta-count ${stats.checklistDone === stats.checklist ? "complete" : ""}`} title="Checklist">
            <CheckSquare /> {stats.checklistDone}/{stats.checklist}
          </span>
        )}
        {!compact && stats.comments > 0 && (
          <span className="meta-count" title="Comentários">
            <MessageSquare /> {stats.comments}
          </span>
        )}
        {!compact && stats.attachments > 0 && (
          <span className="meta-count" title="Anexos">
            <Paperclip /> {stats.attachments}
          </span>
        )}
        <span className="spacer" />
        <Assignees task={task} members={snapshot.members} size={compact ? 20 : 22} />
      </footer>
    </article>
  );
}
