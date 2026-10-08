import React, { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronDown, Flag, type LucideIcon } from "lucide-react";
import type { ProjectOption, Status, Task, WorkspaceMember, WorkspaceSnapshot } from "@orbitask/contracts";
import { dueTone, formatDue } from "../lib/format";
import { Avatar, AvatarStack, Popover } from "./primitives";

/* ---------- Exibição ---------- */

export function Pill({ color, children, title }: { color: string; children: React.ReactNode; title?: string }) {
  return (
    <span className="ui-pill" style={{ "--pill": color } as React.CSSProperties} title={title}>
      <i className="ui-dot" style={{ background: color, width: 7, height: 7 }} />
      <span>{children}</span>
    </span>
  );
}

export function StatusPill({ status }: { status?: Status }) {
  if (!status) return null;
  return <Pill color={status.color}>{status.name}</Pill>;
}

export function PriorityFlag({ option, showLabel = false }: { option?: ProjectOption; showLabel?: boolean }) {
  if (!option) return null;
  return (
    <span className="task-priority" style={{ color: option.color }} title={`Prioridade ${option.name.toLowerCase()}`}>
      <Flag />
      {showLabel && <span>{option.name}</span>}
    </span>
  );
}

export function DueChip({ date, done, compact }: { date: string | null; done?: boolean; compact?: boolean }) {
  if (!date) return null;
  const tone = dueTone(date, done);
  return (
    <span className={`task-due ${tone}`} title="Prazo">
      {!compact && <CalendarDays />}
      {formatDue(date)}
    </span>
  );
}

export function Assignees({ task, members, size = 22 }: { task: Task; members: WorkspaceMember[]; size?: number }) {
  const people = task.assigneeIds
    .map((id) => members.find((member) => member.userId === id))
    .filter((member): member is WorkspaceMember => Boolean(member))
    .map((member) => ({ name: member.name, avatarUrl: member.avatarUrl }));
  return <AvatarStack people={people} size={size} max={3} />;
}

/* ---------- Seleção ---------- */

export interface Choice {
  id: string;
  label: string;
  color?: string;
  avatar?: { name: string; url: string | null };
  icon?: LucideIcon;
  hint?: string;
}

/** Menu de escolha com busca, simples ou múltipla. O gatilho é renderizado pelo chamador. */
export function ChoiceMenu({
  choices,
  value,
  onChange,
  multiple,
  trigger,
  searchable,
  placeholder = "Buscar…",
  align = "start",
  emptyLabel = "Nada encontrado",
  footer,
}: {
  choices: Choice[];
  value: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
  trigger: (props: { ref: React.Ref<HTMLButtonElement>; onClick: () => void; "aria-expanded": boolean; "aria-haspopup": "menu" }) => React.ReactNode;
  searchable?: boolean;
  placeholder?: string;
  align?: "start" | "end";
  emptyLabel?: string;
  footer?: (close: () => void) => React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => choices.filter((choice) => choice.label.toLowerCase().includes(query.trim().toLowerCase())),
    [choices, query],
  );
  const showSearch = searchable ?? choices.length > 7;
  return (
    <Popover trigger={trigger} align={align} width={248} onOpenChange={(open) => !open && setQuery("")}>
      {(close) => (
        <>
          {showSearch && (
            <div className="ui-menu-search">
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} />
            </div>
          )}
          {filtered.map((choice) => {
            const selected = value.includes(choice.id);
            const Icon = choice.icon;
            return (
              <button
                type="button"
                key={choice.id}
                role={multiple ? "menuitemcheckbox" : "menuitemradio"}
                aria-checked={selected}
                className="ui-menu-item"
                onClick={() => {
                  if (multiple) onChange(selected ? value.filter((id) => id !== choice.id) : [...value, choice.id]);
                  else {
                    onChange([choice.id]);
                    close();
                  }
                }}
              >
                {multiple && <span className={`ui-menu-check ${selected ? "on" : ""}`}>{selected && <Check />}</span>}
                <span className="ui-menu-label">
                  {choice.avatar ? (
                    <Avatar name={choice.avatar.name} url={choice.avatar.url} size={20} />
                  ) : Icon ? (
                    <Icon className="ui-menu-icon" style={choice.color ? { color: choice.color } : undefined} />
                  ) : choice.color ? (
                    <i className="ui-dot" style={{ background: choice.color, width: 9, height: 9 }} />
                  ) : null}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{choice.label}</span>
                </span>
                {choice.hint && <span className="ui-menu-hint">{choice.hint}</span>}
                {!multiple && selected && <Check className="ui-menu-icon" />}
              </button>
            );
          })}
          {!filtered.length && <div className="ui-menu-empty">{emptyLabel}</div>}
          {footer?.(close)}
        </>
      )}
    </Popover>
  );
}

/** Botão de propriedade usado no painel da tarefa e nos formulários. */
export const PropertyButton = React.forwardRef<
  HTMLButtonElement,
  { children: React.ReactNode; placeholder?: boolean; disabled?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function PropertyButton({ children, placeholder, className = "", ...props }, ref) {
  return (
    <button ref={ref} type="button" className={`prop-button ${placeholder ? "placeholder" : ""} ${className}`} {...props}>
      {children}
      <ChevronDown className="prop-caret" />
    </button>
  );
});

export const statusChoices = (snapshot: WorkspaceSnapshot): Choice[] =>
  snapshot.statuses.map((status) => ({ id: status.id, label: status.name, color: status.color }));
export const priorityChoices = (snapshot: WorkspaceSnapshot): Choice[] =>
  [...snapshot.settings.priorities]
    .sort((a, b) => a.position - b.position)
    .map((priority) => ({ id: priority.id, label: priority.name, color: priority.color, icon: Flag }));
export const memberChoices = (members: WorkspaceMember[], projectId?: string): Choice[] =>
  members
    .filter((member) => !projectId || member.role !== "guest" || member.projectIds.includes(projectId))
    .map((member) => ({ id: member.userId, label: member.name, avatar: { name: member.name, url: member.avatarUrl }, hint: member.role === "guest" ? "Convidado" : undefined }));
export const optionChoices = (options: ProjectOption[]): Choice[] =>
  [...options].sort((a, b) => a.position - b.position).map((option) => ({ id: option.id, label: option.name, color: option.color }));
