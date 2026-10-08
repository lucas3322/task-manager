import type { AdvancedTaskFilter, Task, WorkspaceSnapshot } from "@orbitask/contracts";
import { parseDay, startOfToday } from "./format";

export const blankFilter = (): AdvancedTaskFilter => ({
  query: "",
  statusIds: [],
  priorityIds: [],
  assigneeIds: [],
  due: "all",
  sort: "position",
  direction: "asc",
  group: "status",
});

export const activeFilterCount = (filter: AdvancedTaskFilter) =>
  filter.statusIds.length + filter.priorityIds.length + filter.assigneeIds.length + (filter.due === "all" ? 0 : 1);

/** A última coluna do fluxo representa "concluído". */
export const doneStatusId = (snapshot: Pick<WorkspaceSnapshot, "statuses">) =>
  [...snapshot.statuses].sort((a, b) => a.position - b.position).at(-1)?.id;

export const firstStatusId = (snapshot: Pick<WorkspaceSnapshot, "statuses">) =>
  [...snapshot.statuses].sort((a, b) => a.position - b.position)[0]?.id;

export const isDone = (task: Task, snapshot: Pick<WorkspaceSnapshot, "statuses">) =>
  task.statusId === doneStatusId(snapshot);

export const isOverdue = (task: Task, done: boolean) =>
  Boolean(task.dueDate && !done && parseDay(task.dueDate) < startOfToday());

export function applyFilter(tasks: Task[], filter: AdvancedTaskFilter, snapshot: WorkspaceSnapshot) {
  const today = startOfToday();
  const week = new Date(today);
  week.setDate(week.getDate() + 7);
  const query = filter.query.trim().toLowerCase();
  const priorityOrder = (id: string) => snapshot.settings.priorities.find((item) => item.id === id)?.position ?? 999;
  return tasks
    .filter((task) => {
      const due = task.dueDate ? parseDay(task.dueDate) : null;
      return (
        (!query || `${task.title} ${task.description}`.toLowerCase().includes(query)) &&
        (!filter.statusIds.length || filter.statusIds.includes(task.statusId)) &&
        (!filter.priorityIds.length || filter.priorityIds.includes(task.priority)) &&
        (!filter.assigneeIds.length || task.assigneeIds.some((id) => filter.assigneeIds.includes(id))) &&
        (filter.due === "all" ||
          (filter.due === "no_due" && !due) ||
          (filter.due === "overdue" && Boolean(due && due < today)) ||
          (filter.due === "today" && due?.toDateString() === today.toDateString()) ||
          (filter.due === "week" && Boolean(due && due >= today && due <= week)))
      );
    })
    .sort((a, b) => {
      const value =
        filter.sort === "title"
          ? a.title.localeCompare(b.title, "pt-BR")
          : filter.sort === "due_date"
            ? (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")
            : filter.sort === "priority"
              ? priorityOrder(b.priority) - priorityOrder(a.priority)
              : filter.sort === "updated_at"
                ? b.updatedAt.localeCompare(a.updatedAt)
                : a.position - b.position;
      return filter.direction === "desc" ? -value : value;
    });
}

/** Posição entre dois vizinhos; mantém espaço para inserções futuras. */
export function positionBetween(before?: number, after?: number) {
  if (before === undefined && after === undefined) return Date.now();
  if (before === undefined) return Math.floor(after! - 1024);
  if (after === undefined) return Math.floor(before + 1024);
  const middle = Math.floor((before + after) / 2);
  return middle === before ? before + 1 : middle;
}

export function taskStats(task: Task, snapshot: WorkspaceSnapshot) {
  const done = doneStatusId(snapshot);
  const subtasks = snapshot.tasks.filter((item) => item.parentId === task.id);
  const checklist = snapshot.checklistItems.filter((item) => item.taskId === task.id);
  return {
    subtasks: subtasks.length,
    subtasksDone: subtasks.filter((item) => item.statusId === done).length,
    checklist: checklist.length,
    checklistDone: checklist.filter((item) => item.completed).length,
    comments: snapshot.comments.filter((item) => item.taskId === task.id).length,
    attachments: snapshot.attachments.filter((item) => item.taskId === task.id).length,
    blocked: snapshot.dependencies.some((dependency) => {
      if (dependency.taskId !== task.id) return false;
      const blocker = snapshot.tasks.find((item) => item.id === dependency.dependsOnTaskId);
      return Boolean(blocker && blocker.statusId !== done);
    }),
  };
}

export function customFieldDisplay(snapshot: WorkspaceSnapshot, task: Task, limit = 2) {
  return snapshot.customFields
    .map((field) => {
      const value = snapshot.customFieldValues.find((item) => item.taskId === task.id && item.fieldId === field.id)?.value;
      if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length)) return null;
      const text = Array.isArray(value)
        ? value.map((id) => field.options.find((option) => option.id === id)?.label ?? id).join(", ")
        : field.type === "single"
          ? (field.options.find((option) => option.id === value)?.label ?? String(value))
          : field.type === "date"
            ? parseDay(String(value)).toLocaleDateString("pt-BR")
            : String(value);
      return { id: field.id, name: field.name, text };
    })
    .filter((item): item is { id: string; name: string; text: string } => Boolean(item))
    .slice(0, limit);
}
