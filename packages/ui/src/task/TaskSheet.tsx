import React, { FormEvent, useEffect, useState } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDot,
  Copy,
  ExternalLink,
  Flag,
  GitBranch,
  Link2,
  ListChecks,
  Lock,
  MoreHorizontal,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  Tag,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { CustomFieldDefinition, Task } from "@orbitask/contracts";
import { api, errorMessage } from "../api";
import { AutoTextarea, Avatar, MenuItem, MenuSeparator, Popover, ProjectGlyph, Segmented, Sheet, modKey } from "../components/primitives";
import { ChoiceMenu, Pill, PropertyButton, memberChoices, optionChoices, priorityChoices, statusChoices } from "../components/task-bits";
import { activityLabels } from "../lib/catalog";
import { dueTone, formatDateTime, formatDue, hostOf, relativeTime } from "../lib/format";
import { taskStats } from "../lib/tasks";
import { useTaskHelpers } from "../project/ProjectScreen";
import { useStore } from "../store";

export function TaskSheet() {
  const selectedTaskId = useStore((state) => state.selectedTaskId);
  const snapshot = useStore((state) => state.snapshot);
  const closeTask = useStore((state) => state.closeTask);
  const task = snapshot?.tasks.find((item) => item.id === selectedTaskId) ?? null;
  const [last, setLast] = useState<Task | null>(null);
  useEffect(() => {
    if (task) setLast(task);
  }, [task]);
  const shown = task ?? last;
  return (
    <Sheet open={Boolean(task)} onClose={closeTask} label={shown ? `Tarefa: ${shown.title}` : "Tarefa"} width={640}>
      {shown && snapshot && <TaskDetail key={shown.id} task={shown} />}
    </Sheet>
  );
}

function Section({ icon: Icon, title, count, children, action }: { icon: typeof Check; title: string; count?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="task-section">
      <header>
        <Icon />
        <h3>{title}</h3>
        {count && <span className="count">{count}</span>}
        <span className="spacer" />
        {action}
      </header>
      {children}
    </section>
  );
}

function TaskDetail({ task }: { task: Task }) {
  const snapshot = useStore((state) => state.snapshot)!;
  const updateTask = useStore((state) => state.updateTask);
  const trashTask = useStore((state) => state.trashTask);
  const closeTask = useStore((state) => state.closeTask);
  const openTask = useStore((state) => state.openTask);
  const refresh = useStore((state) => state.refresh);
  const fail = useStore((state) => state.fail);
  const toast = useStore((state) => state.toast);
  const { statusById, priorityById, doneId } = useTaskHelpers();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [tab, setTab] = useState<"comments" | "history">("comments");
  const [comment, setComment] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [newItem, setNewItem] = useState("");
  const [link, setLink] = useState<{ name: string; url: string } | null>(null);

  useEffect(() => setTitle(task.title), [task.title]);
  useEffect(() => setDescription(task.description), [task.description]);

  const status = statusById.get(task.statusId);
  const priority = priorityById.get(task.priority);
  const done = task.statusId === doneId;
  const parent = task.parentId ? snapshot.tasks.find((item) => item.id === task.parentId) : null;
  const subtasks = snapshot.tasks.filter((item) => item.parentId === task.id).sort((a, b) => a.position - b.position);
  const checklist = snapshot.checklistItems.filter((item) => item.taskId === task.id).sort((a, b) => a.position - b.position);
  const comments = snapshot.comments.filter((item) => item.taskId === task.id);
  const attachments = snapshot.attachments.filter((item) => item.taskId === task.id);
  const activities = snapshot.activities.filter((item) => item.taskId === task.id);
  const blockers = snapshot.dependencies.filter((item) => item.taskId === task.id).map((item) => snapshot.tasks.find((value) => value.id === item.dependsOnTaskId)).filter((item): item is Task => Boolean(item));
  const blocking = snapshot.dependencies.filter((item) => item.dependsOnTaskId === task.id).map((item) => snapshot.tasks.find((value) => value.id === item.taskId)).filter((item): item is Task => Boolean(item));
  const stats = taskStats(task, snapshot);
  const member = (id: string) => snapshot.members.find((item) => item.userId === id);
  const assignees = task.assigneeIds.map(member).filter(Boolean);
  const followers = task.followerIds.map(member).filter(Boolean);
  const following = task.followerIds.includes(snapshot.user.id);

  const run = async (action: () => Promise<unknown>, fallback?: string) => {
    try {
      await action();
      await refresh();
      return true;
    } catch (error) {
      fail(error, fallback);
      return false;
    }
  };

  const saveTitle = () => {
    const value = title.trim();
    if (!value) return setTitle(task.title);
    if (value !== task.title) void updateTask({ id: task.id, title: value });
  };
  const saveDescription = () => description !== task.description && void updateTask({ id: task.id, description });
  const toggleDone = () => {
    const first = snapshot.statuses[0]?.id;
    if (!doneId || !first) return;
    void updateTask({ id: task.id, statusId: done ? first : doneId }, { announce: done ? "Tarefa reaberta" : "Tarefa concluída" });
  };

  const addSubtask = async (event: FormEvent) => {
    event.preventDefault();
    if (!newSubtask.trim()) return;
    const first = snapshot.statuses[0]?.id;
    if (!first) return;
    if (await run(() => api().createTask({ projectId: snapshot.project.id, title: newSubtask.trim(), statusId: first, parentId: task.id }), "Não foi possível criar a subtarefa")) setNewSubtask("");
  };
  const addItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!newItem.trim()) return;
    if (await run(() => api().createChecklistItem({ taskId: task.id, title: newItem.trim() }))) setNewItem("");
  };
  const addLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!link) return;
    let url = link.url.trim();
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      new URL(url);
    } catch {
      return fail(new Error("Informe um link válido"));
    }
    if (await run(() => api().addAttachment({ taskId: task.id, name: link.name.trim() || hostOf(url), url }))) setLink(null);
  };
  const sendComment = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!comment.trim()) return;
    if (await run(() => api().createComment({ taskId: task.id, body: comment.trim() }), "Não foi possível comentar")) setComment("");
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${task.title} — ${snapshot.project.name}`);
      toast("Título copiado");
    } catch {
      /* sem acesso à área de transferência */
    }
  };

  const otherTasks = snapshot.tasks.filter((item) => item.id !== task.id && !blockers.some((blocker) => blocker.id === item.id) && item.parentId !== task.id);

  return (
    <div className="task-sheet">
      <header className="task-sheet-head">
        <nav className="task-crumbs" aria-label="Local da tarefa">
          <ProjectGlyph icon={snapshot.project.icon} color={snapshot.project.color} size={18} />
          <span>{snapshot.project.name}</span>
          {parent && (
            <>
              <ChevronRight />
              <button type="button" onClick={() => void openTask(parent.id)}>
                {parent.title}
              </button>
            </>
          )}
        </nav>
        <span className="spacer" />
        <button type="button" className={`ui-button small ${done ? "" : "primary"} complete-button`} onClick={toggleDone}>
          <Check /> {done ? "Concluída" : "Concluir"}
        </button>
        <button type="button" className={`ui-icon-button ${following ? "active-soft" : ""}`} aria-pressed={following} title={following ? "Deixar de seguir" : "Seguir tarefa"} aria-label={following ? "Deixar de seguir" : "Seguir tarefa"} onClick={() => void updateTask({ id: task.id, followerIds: following ? task.followerIds.filter((id) => id !== snapshot.user.id) : [...task.followerIds, snapshot.user.id] }, { announce: following ? "Você deixou de seguir" : "Você está seguindo esta tarefa" })}>
          <Bell />
        </button>
        <Popover
          align="end"
          trigger={(props) => (
            <button {...props} type="button" className="ui-icon-button" aria-label="Mais ações">
              <MoreHorizontal />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon={Copy} onSelect={() => (close(), void copyLink())}>
                Copiar título
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={Trash2} danger onSelect={() => (close(), void trashTask(task.id))}>
                Mover para a lixeira
              </MenuItem>
            </>
          )}
        </Popover>
        <button type="button" className="ui-icon-button" aria-label="Fechar" title="Fechar (Esc)" onClick={closeTask}>
          <X />
        </button>
      </header>

      <div className="task-sheet-body">
        {stats.blocked && (
          <div className="ui-alert info blocked-alert">
            <Lock /> Bloqueada até concluir: {blockers.filter((item) => item.statusId !== doneId).map((item) => item.title).join(", ")}
          </div>
        )}
        <AutoTextarea
          className={`task-title-input ${done ? "done" : ""}`}
          value={title}
          onChange={(event) => setTitle(event.target.value.replace(/\n/g, ""))}
          onBlur={saveTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              (event.target as HTMLTextAreaElement).blur();
            }
          }}
          aria-label="Título da tarefa"
          maxLength={240}
        />

        <dl className="task-props">
          <dt>
            <CircleDot /> Status
          </dt>
          <dd>
            <ChoiceMenu choices={statusChoices(snapshot)} value={[task.statusId]} onChange={([id]) => id !== task.statusId && void updateTask({ id: task.id, statusId: id })} trigger={(props) => <PropertyButton {...props}>{status ? <Pill color={status.color}>{status.name}</Pill> : "—"}</PropertyButton>} />
          </dd>
          <dt>
            <Flag /> Prioridade
          </dt>
          <dd>
            <ChoiceMenu
              choices={priorityChoices(snapshot)}
              value={[task.priority]}
              onChange={([id]) => void updateTask({ id: task.id, priority: id })}
              trigger={(props) => (
                <PropertyButton {...props}>
                  <Flag style={{ color: priority?.color }} className="prop-icon" />
                  {priority?.name ?? "—"}
                </PropertyButton>
              )}
            />
          </dd>
          <dt>
            <UserRound /> Responsáveis
          </dt>
          <dd>
            <ChoiceMenu
              multiple
              choices={memberChoices(snapshot.members, snapshot.project.id)}
              value={task.assigneeIds}
              onChange={(ids) => void updateTask({ id: task.id, assigneeIds: ids, primaryAssigneeId: ids.includes(task.primaryAssigneeId ?? "") ? task.primaryAssigneeId : (ids[0] ?? null) })}
              trigger={(props) => (
                <PropertyButton {...props} placeholder={!assignees.length}>
                  {assignees.length ? (
                    <span className="prop-people">
                      {assignees.slice(0, 3).map((person) => (
                        <span key={person!.userId} className="prop-person">
                          <Avatar name={person!.name} url={person!.avatarUrl} size={20} />
                          {assignees.length === 1 ? person!.name : person!.name.split(" ")[0]}
                        </span>
                      ))}
                      {assignees.length > 3 && <span className="subtle">+{assignees.length - 3}</span>}
                    </span>
                  ) : (
                    "Ninguém"
                  )}
                </PropertyButton>
              )}
            />
          </dd>
          <dt>
            <CalendarDays /> Datas
          </dt>
          <dd className="prop-dates">
            <label className={`prop-button date ${task.startDate ? "" : "placeholder"}`}>
              <span>{task.startDate ? formatDue(task.startDate) : "Início"}</span>
              <input type="date" value={task.startDate ?? ""} max={task.dueDate ?? undefined} onChange={(event) => void updateTask({ id: task.id, startDate: event.target.value || null })} aria-label="Data de início" />
            </label>
            <ChevronRight className="subtle" />
            <label className={`prop-button date due-${dueTone(task.dueDate, done)} ${task.dueDate ? "" : "placeholder"}`}>
              <span>{task.dueDate ? formatDue(task.dueDate) : "Prazo"}</span>
              <input type="date" value={task.dueDate ?? ""} min={task.startDate ?? undefined} onChange={(event) => void updateTask({ id: task.id, dueDate: event.target.value || null })} aria-label="Prazo" />
            </label>
            {(task.startDate || task.dueDate) && (
              <button type="button" className="ui-icon-button small" aria-label="Limpar datas" title="Limpar datas" onClick={() => void updateTask({ id: task.id, startDate: null, dueDate: null })}>
                <X />
              </button>
            )}
          </dd>
          <dt>
            <Tag /> Tags
          </dt>
          <dd>
            <ChoiceMenu
              multiple
              choices={[...optionChoices(snapshot.settings.badges).map((item) => ({ ...item, hint: "Selo" })), ...optionChoices(snapshot.settings.tags)]}
              value={[...task.badgeIds, ...task.tagIds]}
              onChange={(ids) => void updateTask({ id: task.id, badgeIds: ids.filter((id) => snapshot.settings.badges.some((item) => item.id === id)), tagIds: ids.filter((id) => snapshot.settings.tags.some((item) => item.id === id)) })}
              emptyLabel="Crie tags nas configurações do projeto"
              trigger={(props) => (
                <PropertyButton {...props} placeholder={!task.tagIds.length && !task.badgeIds.length}>
                  {task.tagIds.length || task.badgeIds.length ? (
                    <span className="prop-pills">
                      {[...task.badgeIds.map((id) => snapshot.settings.badges.find((item) => item.id === id)), ...task.tagIds.map((id) => snapshot.settings.tags.find((item) => item.id === id))].map((item) =>
                        item ? (
                          <Pill key={item.id} color={item.color}>
                            {item.name}
                          </Pill>
                        ) : null,
                      )}
                    </span>
                  ) : (
                    "Adicionar"
                  )}
                </PropertyButton>
              )}
            />
          </dd>
          <dt>
            <Users /> Seguidores
          </dt>
          <dd>
            <ChoiceMenu
              multiple
              choices={memberChoices(snapshot.members, snapshot.project.id)}
              value={task.followerIds}
              onChange={(ids) => void updateTask({ id: task.id, followerIds: ids })}
              trigger={(props) => (
                <PropertyButton {...props} placeholder={!followers.length}>
                  {followers.length ? (
                    <span className="prop-people">
                      {followers.slice(0, 5).map((person) => (
                        <Avatar key={person!.userId} name={person!.name} url={person!.avatarUrl} size={20} />
                      ))}
                    </span>
                  ) : (
                    "Ninguém"
                  )}
                </PropertyButton>
              )}
            />
          </dd>
          {snapshot.customFields.map((field) => (
            <CustomFieldProp key={field.id} field={field} task={task} />
          ))}
        </dl>

        <div className="task-description">
          <AutoTextarea value={description} placeholder="Adicione uma descrição, contexto ou critérios de pronto…" onChange={(event) => setDescription(event.target.value)} onBlur={saveDescription} aria-label="Descrição" />
        </div>

        {!task.parentId && (
          <Section icon={GitBranch} title="Subtarefas" count={subtasks.length ? `${stats.subtasksDone}/${subtasks.length}` : undefined}>
            <div className="sub-list">
              {subtasks.map((item) => {
                const itemDone = item.statusId === doneId;
                return (
                  <div key={item.id} className={`sub-row ${itemDone ? "done" : ""}`}>
                    <button type="button" className={`ui-check ${itemDone ? "done" : ""}`} aria-label={itemDone ? "Reabrir" : "Concluir"} onClick={() => void updateTask({ id: item.id, statusId: itemDone ? snapshot.statuses[0].id : doneId! })}>
                      <Check />
                    </button>
                    <button type="button" className="sub-title" onClick={() => void openTask(item.id)}>
                      {item.title}
                    </button>
                    {item.dueDate && <span className={`task-due ${dueTone(item.dueDate, itemDone)}`}>{formatDue(item.dueDate)}</span>}
                    <ChevronRight className="subtle" />
                  </div>
                );
              })}
              <form className="inline-add" onSubmit={addSubtask}>
                <Plus />
                <input value={newSubtask} onChange={(event) => setNewSubtask(event.target.value)} placeholder="Adicionar subtarefa" aria-label="Nova subtarefa" />
              </form>
            </div>
          </Section>
        )}

        <Section icon={ListChecks} title="Checklist" count={checklist.length ? `${stats.checklistDone}/${checklist.length}` : undefined}>
          {checklist.length > 0 && (
            <div className="checklist-progress">
              <span style={{ width: `${(stats.checklistDone / checklist.length) * 100}%` }} />
            </div>
          )}
          <div className="sub-list">
            {checklist.map((item) => (
              <div key={item.id} className={`sub-row ${item.completed ? "done" : ""}`}>
                <button type="button" className={`ui-check square ${item.completed ? "done" : ""}`} aria-label={item.completed ? "Desmarcar" : "Marcar"} onClick={() => void run(() => api().updateChecklistItem({ id: item.id, completed: !item.completed }))}>
                  <Check />
                </button>
                <input
                  className="sub-input"
                  defaultValue={item.title}
                  onBlur={(event) => event.target.value.trim() && event.target.value.trim() !== item.title && void run(() => api().updateChecklistItem({ id: item.id, title: event.target.value.trim() }))}
                  onKeyDown={(event) => event.key === "Enter" && (event.target as HTMLInputElement).blur()}
                  aria-label="Item do checklist"
                />
                <button type="button" className="ui-icon-button small row-action" aria-label="Remover item" onClick={() => void run(() => api().removeChecklistItem(item.id))}>
                  <Trash2 />
                </button>
              </div>
            ))}
            <form className="inline-add" onSubmit={addItem}>
              <Plus />
              <input value={newItem} onChange={(event) => setNewItem(event.target.value)} placeholder="Adicionar item" aria-label="Novo item do checklist" />
            </form>
          </div>
        </Section>

        <Section
          icon={Lock}
          title="Dependências"
          action={
            <ChoiceMenu
              align="end"
              searchable
              choices={otherTasks.map((item) => ({ id: item.id, label: item.title, color: statusById.get(item.statusId)?.color }))}
              value={[]}
              onChange={([id]) => id && void run(() => api().addDependency({ taskId: task.id, dependsOnTaskId: id }), "Não foi possível adicionar a dependência")}
              placeholder="Buscar tarefa…"
              trigger={(props) => (
                <button {...props} type="button" className="link-button">
                  <Plus /> Bloqueada por…
                </button>
              )}
            />
          }
        >
          {!blockers.length && !blocking.length && <p className="subtle small-text section-empty">Nenhuma dependência. Indique tarefas que precisam terminar antes desta.</p>}
          <div className="sub-list">
            {blockers.map((item) => (
              <div key={item.id} className={`sub-row ${item.statusId === doneId ? "done" : ""}`}>
                <span className="dep-kind">Depende de</span>
                <button type="button" className="sub-title" onClick={() => void openTask(item.id)}>
                  {item.title}
                </button>
                <Pill color={statusById.get(item.statusId)?.color ?? "#888"}>{statusById.get(item.statusId)?.name}</Pill>
                <button type="button" className="ui-icon-button small row-action" aria-label="Remover dependência" onClick={() => void run(() => api().removeDependency({ taskId: task.id, dependsOnTaskId: item.id }))}>
                  <X />
                </button>
              </div>
            ))}
            {blocking.map((item) => (
              <div key={item.id} className="sub-row">
                <span className="dep-kind">Bloqueia</span>
                <button type="button" className="sub-title" onClick={() => void openTask(item.id)}>
                  {item.title}
                </button>
              </div>
            ))}
          </div>
        </Section>

        <Section
          icon={Paperclip}
          title="Links e anexos"
          count={attachments.length ? String(attachments.length) : undefined}
          action={
            !link && (
              <button type="button" className="link-button" onClick={() => setLink({ name: "", url: "" })}>
                <Plus /> Adicionar link
              </button>
            )
          }
        >
          <div className="attachment-list">
            {attachments.map((item) => (
              <div key={item.id} className="attachment">
                <span className="attachment-icon">
                  <Link2 />
                </span>
                <a href={item.url} target="_blank" rel="noreferrer">
                  <strong>{item.name}</strong>
                  <small>{hostOf(item.url)}</small>
                </a>
                <ExternalLink className="subtle" />
                <button type="button" className="ui-icon-button small row-action" aria-label="Remover link" onClick={() => void run(() => api().removeAttachment(item.id))}>
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
          {link && (
            <form className="link-form" onSubmit={addLink}>
              <input autoFocus className="ui-input" value={link.url} onChange={(event) => setLink({ ...link, url: event.target.value })} placeholder="https://docs.google.com/…" aria-label="URL" />
              <input className="ui-input" value={link.name} onChange={(event) => setLink({ ...link, name: event.target.value })} placeholder="Nome (opcional)" aria-label="Nome do link" />
              <button type="button" className="ui-button small" onClick={() => setLink(null)}>
                Cancelar
              </button>
              <button className="ui-button small primary" disabled={!link.url.trim()}>
                Adicionar
              </button>
            </form>
          )}
          {!attachments.length && !link && <p className="subtle small-text section-empty">Documentos, protótipos e referências da tarefa.</p>}
        </Section>

        <section className="task-activity">
          <Segmented
            label="Atividade"
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { value: "comments", label: `Comentários${comments.length ? ` · ${comments.length}` : ""}` },
              { value: "history", label: "Histórico" },
            ]}
          />
          {tab === "comments" ? (
            <>
              <ol className="comment-list">
                {comments.map((item) => (
                  <li key={item.id}>
                    <Avatar name={item.authorName} url={member(item.userId)?.avatarUrl} size={28} />
                    <div className="comment-bubble">
                      <header>
                        <strong>{item.authorName}</strong>
                        <time title={formatDateTime(item.createdAt)}>{relativeTime(item.createdAt)}</time>
                      </header>
                      <p>{item.body}</p>
                    </div>
                  </li>
                ))}
                {!comments.length && <p className="subtle small-text section-empty">Nenhum comentário ainda. Comece a conversa.</p>}
              </ol>
              <form className="comment-composer" onSubmit={sendComment}>
                <Avatar name={snapshot.user.name} url={snapshot.user.avatarUrl} size={28} />
                <div>
                  <AutoTextarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Escreva um comentário…"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void sendComment();
                    }}
                    aria-label="Novo comentário"
                  />
                  <footer>
                    <span className="subtle small-text">{modKey()} + Enter para enviar</span>
                    <button className="ui-button small primary" disabled={!comment.trim()}>
                      <Send /> Comentar
                    </button>
                  </footer>
                </div>
              </form>
            </>
          ) : (
            <ol className="activity-feed">
              {activities.map((activity) => (
                <li key={activity.id}>
                  <span className="activity-glyph">{activity.authorName ? <Avatar name={activity.authorName} size={22} /> : <Sparkles />}</span>
                  <div>
                    <p>
                      <strong>{activity.authorName ?? "Automação"}</strong> {activityLabels[activity.action] ?? activity.action}
                    </p>
                    <small title={formatDateTime(activity.createdAt)}>{relativeTime(activity.createdAt)}</small>
                  </div>
                </li>
              ))}
              {!activities.length && <p className="subtle small-text section-empty">Sem histórico.</p>}
            </ol>
          )}
        </section>
        <p className="task-footnote subtle">
          Criada {relativeTime(task.createdAt)} · atualizada {relativeTime(task.updatedAt)}
        </p>
      </div>
    </div>
  );
}

function CustomFieldProp({ field, task }: { field: CustomFieldDefinition; task: Task }) {
  const snapshot = useStore((state) => state.snapshot)!;
  const refresh = useStore((state) => state.refresh);
  const patchSnapshot = useStore((state) => state.patchSnapshot);
  const fail = useStore((state) => state.fail);
  const value = snapshot.customFieldValues.find((item) => item.taskId === task.id && item.fieldId === field.id)?.value ?? null;
  const save = async (next: string | number | string[] | null) => {
    patchSnapshot((current) => ({ ...current, customFieldValues: [...current.customFieldValues.filter((item) => !(item.taskId === task.id && item.fieldId === field.id)), { taskId: task.id, fieldId: field.id, value: next }] }));
    try {
      await api().setTaskCustomField({ taskId: task.id, fieldId: field.id, value: next });
      void refresh();
    } catch (error) {
      fail(error, errorMessage(error));
      void refresh();
    }
  };
  const choices = field.options.map((option) => ({ id: option.id, label: option.label, color: option.color }));
  const selected = Array.isArray(value) ? value : value ? [String(value)] : [];
  return (
    <>
      <dt title={field.name}>
        <Sparkles /> {field.name}
      </dt>
      <dd>
        {field.type === "single" || field.type === "multi" ? (
          <ChoiceMenu
            multiple={field.type === "multi"}
            choices={choices}
            value={selected}
            onChange={(ids) => void save(field.type === "multi" ? ids : (ids[0] ?? null))}
            trigger={(props) => (
              <PropertyButton {...props} placeholder={!selected.length}>
                {selected.length ? (
                  <span className="prop-pills">
                    {selected.map((id) => {
                      const option = field.options.find((item) => item.id === id);
                      return option ? (
                        <Pill key={id} color={option.color}>
                          {option.label}
                        </Pill>
                      ) : null;
                    })}
                  </span>
                ) : (
                  "Vazio"
                )}
              </PropertyButton>
            )}
          />
        ) : (
          <input
            key={String(value)}
            className="prop-input"
            type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
            defaultValue={value === null ? "" : String(value)}
            placeholder="Vazio"
            onBlur={(event) => {
              const raw = event.target.value.trim();
              const next = raw === "" ? null : field.type === "number" ? Number(raw) : raw;
              if (String(next ?? "") !== String(value ?? "")) void save(next);
            }}
            onKeyDown={(event) => event.key === "Enter" && (event.target as HTMLInputElement).blur()}
            aria-label={field.name}
          />
        )}
      </dd>
    </>
  );
}
