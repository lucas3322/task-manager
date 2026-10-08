import { useEffect, useMemo, useState } from "react";
import { AtSign, Bell, CalendarClock, CheckCheck, CircleCheck, CircleDot, Link2, MessageSquare, UserPlus, Zap, type LucideIcon } from "lucide-react";
import type { Notification } from "@orbitask/contracts";
import { api } from "../api";
import { EmptyState, ProjectGlyph, Segmented, Spinner } from "../components/primitives";
import { formatDate, relativeTime } from "../lib/format";
import { PageHeader } from "../shell/Sidebar";
import { useStore } from "../store";

const typeIcon = (type: string): LucideIcon =>
  /comment/.test(type)
    ? MessageSquare
    : /mention/.test(type)
      ? AtSign
      : /assign/.test(type)
        ? UserPlus
        : /status/.test(type)
          ? CircleDot
          : /due/.test(type)
            ? CalendarClock
            : /attachment/.test(type)
              ? Link2
              : /automation/.test(type)
                ? Zap
                : /complete|done/.test(type)
                  ? CircleCheck
                  : Bell;

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Hoje";
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";
  return formatDate(value, date.getFullYear() !== today.getFullYear());
}

export function InboxScreen() {
  const snapshot = useStore((state) => state.snapshot)!;
  const openTask = useStore((state) => state.openTask);
  const navigate = useStore((state) => state.navigate);
  const setUnread = useStore((state) => state.setUnread);
  const fail = useStore((state) => state.fail);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    api()
      .listNotifications()
      .then(setItems)
      .catch((error) => {
        setItems([]);
        fail(error, "Não foi possível carregar a caixa de entrada");
      });
  }, [fail]);

  useEffect(() => {
    if (items) setUnread(items.filter((item) => !item.readAt).length);
  }, [items, setUnread]);

  const visible = (items ?? []).filter((item) => filter === "all" || !item.readAt);
  const groups = useMemo(() => {
    const map = new Map<string, Notification[]>();
    visible.forEach((item) => {
      const key = dayLabel(item.createdAt);
      map.set(key, [...(map.get(key) ?? []), item]);
    });
    return [...map.entries()];
  }, [visible]);
  const unread = (items ?? []).filter((item) => !item.readAt).length;

  const markRead = async (item: Notification) => {
    if (item.readAt) return;
    setItems((current) => current?.map((value) => (value.id === item.id ? { ...value, readAt: new Date().toISOString() } : value)) ?? null);
    try {
      await api().markNotificationRead(item.id);
    } catch {
      /* leitura é otimista; tentaremos novamente na próxima abertura */
    }
  };
  const markAll = async () => {
    const previous = items;
    setItems((current) => current?.map((value) => ({ ...value, readAt: value.readAt ?? new Date().toISOString() })) ?? null);
    try {
      await api().markAllNotificationsRead();
    } catch (error) {
      setItems(previous);
      fail(error);
    }
  };
  const open = (item: Notification) => {
    void markRead(item);
    if (item.projectId) navigate({ name: "project", projectId: item.projectId, view: "board" });
    if (item.taskId) void openTask(item.taskId, item.projectId ?? undefined);
  };

  return (
    <div className="page">
      <PageHeader
        title="Caixa de entrada"
        subtitle={unread ? `${unread} ${unread === 1 ? "não lida" : "não lidas"}` : "Você está em dia"}
        actions={
          <button type="button" className="ui-button" onClick={markAll} disabled={!unread}>
            <CheckCheck /> Marcar tudo como lido
          </button>
        }
      >
        <div className="page-toolbar">
          <Segmented
            label="Filtro"
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Todas" },
              { value: "unread", label: `Não lidas${unread ? ` (${unread})` : ""}` },
            ]}
          />
        </div>
      </PageHeader>
      <div className="page-body narrow">
        {!items && (
          <div className="page-loading">
            <Spinner />
          </div>
        )}
        {items && !visible.length && (
          <EmptyState icon={Bell} title={filter === "unread" ? "Nenhuma notificação não lida" : "Sua caixa de entrada está vazia"}>
            Quando alguém atribuir uma tarefa a você, comentar ou uma automação rodar, você verá aqui.
          </EmptyState>
        )}
        {groups.map(([label, list]) => (
          <section key={label} className="task-group">
            <header>
              <h2>{label}</h2>
            </header>
            <div className="ui-card inbox-list">
              {list.map((item) => {
                const Icon = typeIcon(item.type);
                const project = snapshot.projects.find((value) => value.id === item.projectId);
                return (
                  <div key={item.id} className={`inbox-item ${item.readAt ? "" : "unread"}`}>
                    <span className="inbox-icon">
                      <Icon />
                    </span>
                    <button type="button" className="inbox-main" onClick={() => open(item)}>
                      <strong>{item.title}</strong>
                      <span>{item.message}</span>
                      <small>
                        {project && (
                          <>
                            <ProjectGlyph icon={project.icon} color={project.color} size={13} /> {project.name} ·{" "}
                          </>
                        )}
                        {relativeTime(item.createdAt)}
                      </small>
                    </button>
                    {!item.readAt && (
                      <button type="button" className="ui-icon-button small inbox-read" aria-label="Marcar como lida" title="Marcar como lida" onClick={() => markRead(item)}>
                        <CheckCheck />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
