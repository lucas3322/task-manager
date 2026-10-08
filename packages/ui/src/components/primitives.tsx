import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, FolderKanban, X, type LucideIcon } from "lucide-react";
import { create } from "zustand";
import { projectIcons } from "../lib/catalog";
import { initials, readableOn } from "../lib/format";
import { useStore } from "../store";

/* ---------- Presença: mantém montado durante a animação de saída ---------- */

export function usePresence(open: boolean, exitMs = 220) {
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<"open" | "closed">(open ? "open" : "closed");
  useEffect(() => {
    if (open) {
      setMounted(true);
      setState("open");
      return;
    }
    setState("closed");
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => setMounted(false), reduce ? 0 : exitMs);
    return () => clearTimeout(timer);
  }, [open, exitMs]);
  return { mounted, state };
}

/** Pilha de camadas: Escape fecha apenas a camada mais recente (popover antes do dialog). */
const escapeStack: { current: () => void }[] = [];
let escapeListening = false;
function onGlobalEscape(event: KeyboardEvent) {
  if (event.key !== "Escape" || !escapeStack.length) return;
  event.preventDefault();
  event.stopPropagation();
  escapeStack[escapeStack.length - 1].current();
}
export function useEscape(active: boolean, onEscape: () => void) {
  const handler = useRef(onEscape);
  handler.current = onEscape;
  useEffect(() => {
    if (!active) return;
    if (!escapeListening) {
      document.addEventListener("keydown", onGlobalEscape, true);
      escapeListening = true;
    }
    const entry = { current: () => handler.current() };
    escapeStack.push(entry);
    return () => {
      const index = escapeStack.indexOf(entry);
      if (index >= 0) escapeStack.splice(index, 1);
    };
  }, [active]);
}
export const hasOpenLayer = () => escapeStack.length > 0;

/** Mantém o foco dentro de um painel modal e devolve ao gatilho ao fechar. */
function useFocusTrap(active: boolean, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusable = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.offsetParent !== null);
    if (node && !node.contains(document.activeElement)) {
      const preferred = node.querySelector<HTMLElement>("[data-autofocus]") ?? focusable()[0];
      requestAnimationFrame(() => preferred?.focus());
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !node) return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [active, ref]);
}

/* ---------- Dialog ---------- */

export function Dialog({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  children,
  footer,
  size = "md",
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { mounted, state } = usePresence(open, 200);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEscape(open, onClose);
  useFocusTrap(open && mounted, panel);
  if (!mounted) return null;
  return createPortal(
    <div className="ui-overlay" data-state={state} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`ui-dialog ui-dialog-${size} ${className}`}
        data-state={state}
      >
        <header className="ui-dialog-header">
          {Icon && (
            <span className="ui-dialog-icon">
              <Icon />
            </span>
          )}
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="ui-icon-button" onClick={onClose} aria-label="Fechar">
            <X />
          </button>
        </header>
        {children && <div className="ui-dialog-body">{children}</div>}
        {footer && <footer className="ui-dialog-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Sheet lateral ---------- */

export function Sheet({
  open,
  onClose,
  label,
  children,
  width = 600,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
  width?: number;
}) {
  const { mounted, state } = usePresence(open, 280);
  const panel = useRef<HTMLDivElement>(null);
  useEscape(open, onClose);
  useFocusTrap(open && mounted, panel);
  if (!mounted) return null;
  return createPortal(
    <div className="ui-sheet-overlay" data-state={state} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="ui-sheet"
        data-state={state}
        style={{ "--sheet-width": `${width}px` } as React.CSSProperties}
      >
        {children}
      </aside>
    </div>,
    document.body,
  );
}

/* ---------- Popover ancorado ao gatilho ---------- */

export function Popover({
  trigger,
  children,
  align = "start",
  width,
  className = "",
  open: controlledOpen,
  onOpenChange,
}: {
  trigger: (props: { ref: React.Ref<HTMLButtonElement>; onClick: () => void; "aria-expanded": boolean; "aria-haspopup": "menu" }) => React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: "start" | "end";
  width?: number;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = useCallback(
    (value: boolean) => {
      if (controlledOpen === undefined) setInnerOpen(value);
      onOpenChange?.(value);
    },
    [controlledOpen, onOpenChange],
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; origin: string; maxHeight: number } | null>(null);
  const { mounted, state } = usePresence(open, 140);
  const close = useCallback(() => setOpen(false), [setOpen]);
  useEscape(open, close);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const panelWidth = panelRef.current?.offsetWidth ?? width ?? 240;
      const panelHeight = panelRef.current?.offsetHeight ?? 280;
      const gap = 6;
      let left = align === "end" ? rect.right - panelWidth : rect.left;
      left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));
      const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
      const spaceAbove = rect.top - gap - 8;
      const above = spaceBelow < Math.min(panelHeight, 280) && spaceAbove > spaceBelow;
      const top = above ? Math.max(8, rect.top - gap - Math.min(panelHeight, spaceAbove)) : rect.bottom + gap;
      setPosition({
        top,
        left,
        origin: `${align === "end" ? "right" : "left"} ${above ? "bottom" : "top"}`,
        maxHeight: Math.max(160, above ? spaceAbove : spaceBelow),
      });
    };
    place();
    const frame = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align, width]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open, close]);

  return (
    <>
      {trigger({ ref: triggerRef, onClick: () => setOpen(!open), "aria-expanded": open, "aria-haspopup": "menu" })}
      {mounted &&
        createPortal(
          <div
            ref={panelRef}
            className={`ui-popover ${className}`}
            data-state={state}
            style={{
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              width,
              maxHeight: position?.maxHeight,
              transformOrigin: position?.origin,
            }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
              const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(".ui-menu-item:not([disabled])") ?? []);
              if (!items.length) return;
              event.preventDefault();
              const index = items.indexOf(document.activeElement as HTMLElement);
              const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
              items[next].focus();
            }}
          >
            {typeof children === "function" ? children(close) : children}
          </div>,
          document.body,
        )}
    </>
  );
}

export function MenuItem({
  icon: Icon,
  children,
  onSelect,
  danger,
  checked,
  hint,
  disabled,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  checked?: boolean;
  hint?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role={checked === undefined ? "menuitem" : "menuitemcheckbox"}
      aria-checked={checked}
      className={`ui-menu-item ${danger ? "danger" : ""}`}
      onClick={onSelect}
      disabled={disabled}
    >
      {checked !== undefined ? (
        <span className={`ui-menu-check ${checked ? "on" : ""}`}>{checked && <Check />}</span>
      ) : (
        Icon && <Icon className="ui-menu-icon" />
      )}
      <span className="ui-menu-label">{children}</span>
      {hint && <span className="ui-menu-hint">{hint}</span>}
    </button>
  );
}
export const MenuSeparator = () => <div className="ui-menu-separator" role="separator" />;
export const MenuLabel = ({ children }: { children: React.ReactNode }) => <div className="ui-menu-section">{children}</div>;

/* ---------- Confirmação ---------- */

interface ConfirmRequest {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  requireText?: string;
  resolve: (value: boolean) => void;
}
const useConfirmStore = create<{ request: ConfirmRequest | null; set: (request: ConfirmRequest | null) => void }>((set) => ({
  request: null,
  set: (request) => set({ request }),
}));

export function confirm(options: Omit<ConfirmRequest, "resolve">) {
  return new Promise<boolean>((resolve) => useConfirmStore.getState().set({ ...options, resolve }));
}

export function ConfirmHost() {
  const { request, set } = useConfirmStore();
  const [typed, setTyped] = useState("");
  const [last, setLast] = useState<ConfirmRequest | null>(null);
  useEffect(() => {
    if (request) {
      setLast(request);
      setTyped("");
    }
  }, [request]);
  const shown = request ?? last;
  const finish = (value: boolean) => {
    request?.resolve(value);
    set(null);
  };
  const blocked = Boolean(shown?.requireText && typed.trim() !== shown.requireText);
  return (
    <Dialog
      open={Boolean(request)}
      onClose={() => finish(false)}
      title={shown?.title ?? ""}
      size="sm"
      className="ui-confirm"
      footer={
        <>
          <button type="button" className="ui-button" onClick={() => finish(false)}>
            Cancelar
          </button>
          <button
            type="button"
            data-autofocus={shown?.requireText ? undefined : true}
            className={`ui-button ${shown?.destructive ? "danger" : "primary"}`}
            disabled={blocked}
            onClick={() => finish(true)}
          >
            {shown?.confirmLabel ?? "Confirmar"}
          </button>
        </>
      }
    >
      {shown?.message && <div className="ui-confirm-message">{shown.message}</div>}
      {shown?.requireText && (
        <label className="ui-field">
          <span>
            Digite <strong>{shown.requireText}</strong> para confirmar
          </span>
          <input data-autofocus value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
        </label>
      )}
    </Dialog>
  );
}

/* ---------- Toasts ---------- */

export function Toaster() {
  const toasts = useStore((state) => state.toasts);
  const dismiss = useStore((state) => state.dismissToast);
  return createPortal(
    <div className="ui-toaster" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`ui-toast ${toast.tone ?? "default"}`}>
          {toast.tone === "success" && <Check className="ui-toast-icon" />}
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.run();
                dismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      ))}
    </div>,
    document.body,
  );
}

/* ---------- Peças visuais ---------- */

export function Avatar({
  name,
  url,
  size = 24,
  title,
}: {
  name?: string | null;
  url?: string | null;
  size?: number;
  title?: string;
}) {
  const [broken, setBroken] = useState(false);
  const hue = [...(name ?? "?")].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
  return (
    <span
      className="ui-avatar"
      title={title ?? name ?? undefined}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.4), "--avatar-hue": hue } as React.CSSProperties}
    >
      {url && !broken ? <img src={url} alt="" onError={() => setBroken(true)} /> : initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 3, size = 22 }: { people: { name: string; avatarUrl: string | null }[]; max?: number; size?: number }) {
  if (!people.length) return null;
  return (
    <span className="ui-avatar-stack">
      {people.slice(0, max).map((person, index) => (
        <Avatar key={`${person.name}-${index}`} name={person.name} url={person.avatarUrl} size={size} />
      ))}
      {people.length > max && (
        <span className="ui-avatar ui-avatar-more" style={{ width: size, height: size }}>
          +{people.length - max}
        </span>
      )}
    </span>
  );
}

export function ProjectGlyph({ icon, color, size = 22 }: { icon?: string; color: string; size?: number }) {
  const Icon = projectIcons[icon ?? "folder"]?.icon ?? FolderKanban;
  return (
    <span
      className="ui-project-glyph"
      style={{ width: size, height: size, background: color, color: readableOn(color), borderRadius: Math.round(size * 0.28) } as React.CSSProperties}
    >
      <Icon style={{ width: size * 0.6, height: size * 0.6 }} />
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`ui-empty ${compact ? "compact" : ""}`}>
      <span className="ui-empty-icon">
        <Icon />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: React.ReactNode; icon?: LucideIcon }[];
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={`ui-segmented ${size}`} role="radiogroup" aria-label={label}>
      {options.map(({ value: optionValue, label: optionLabel, icon: Icon }) => (
        <button
          type="button"
          role="radio"
          aria-checked={optionValue === value}
          key={optionValue}
          className={optionValue === value ? "active" : ""}
          onClick={() => onChange(optionValue)}
        >
          {Icon && <Icon />}
          {optionLabel}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="ui-switch" onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <span className="ui-spinner" style={{ width: size, height: size }} aria-label="Carregando" />;
}

export function ProgressBar({ value, color, label }: { value: number; color?: string; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <span className="ui-progress" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ width: `${clamped}%`, background: color }} />
    </span>
  );
}

export function ProgressRing({ value, size = 64, stroke = 6, color = "var(--accent)" }: { value: number; size?: number; stroke?: number; color?: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <svg className="ui-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${clamped}%`}>
      <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} className="ui-ring-track" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
        stroke={color}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped / 100)}
        strokeLinecap="round"
        className="ui-ring-value"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export function ColorSwatches({ colors, value, onChange, label }: { colors: string[]; value: string; onChange: (color: string) => void; label: string }) {
  return (
    <div className="ui-swatches" role="radiogroup" aria-label={label}>
      {colors.map((color) => (
        <button
          type="button"
          role="radio"
          aria-checked={color === value}
          aria-label={color}
          key={color}
          className={color === value ? "selected" : ""}
          style={{ "--swatch": color } as React.CSSProperties}
          onClick={() => onChange(color)}
        >
          {color === value && <Check style={{ color: readableOn(color) }} />}
        </button>
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="ui-kbd">{children}</kbd>;
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "green" | "orange" | "red" | "blue"; children: React.ReactNode }) {
  return <span className={`ui-badge ${tone}`}>{children}</span>;
}

export function Dot({ color, size = 8 }: { color?: string; size?: number }) {
  return <i className="ui-dot" style={{ background: color ?? "var(--text-3)", width: size, height: size }} />;
}

/** Textarea que cresce com o conteúdo. */
export function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
}

export const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const modKey = () => (isMac() ? "⌘" : "Ctrl");

/** Ignora atalhos de teclado enquanto o usuário digita. */
export const isTyping = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null;
  return Boolean(target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)));
};

/* ---------- Pergunta com texto (substitui window.prompt, indisponível no Electron) ---------- */

interface PromptRequest {
  title: string;
  label?: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  resolve: (value: string | null) => void;
}
const usePromptStore = create<{ request: PromptRequest | null; set: (request: PromptRequest | null) => void }>((set) => ({
  request: null,
  set: (request) => set({ request }),
}));

export function askText(options: Omit<PromptRequest, "resolve">) {
  return new Promise<string | null>((resolve) => usePromptStore.getState().set({ ...options, resolve }));
}

export function PromptHost() {
  const { request, set } = usePromptStore();
  const [value, setValue] = useState("");
  const [last, setLast] = useState<PromptRequest | null>(null);
  useEffect(() => {
    if (request) {
      setLast(request);
      setValue(request.initial ?? "");
    }
  }, [request]);
  const shown = request ?? last;
  const finish = (result: string | null) => {
    request?.resolve(result);
    set(null);
  };
  return (
    <Dialog
      open={Boolean(request)}
      onClose={() => finish(null)}
      title={shown?.title ?? ""}
      size="sm"
      footer={
        <>
          <button type="button" className="ui-button" onClick={() => finish(null)}>
            Cancelar
          </button>
          <button type="submit" form="ui-prompt" className="ui-button primary" disabled={!value.trim()}>
            {shown?.confirmLabel ?? "Salvar"}
          </button>
        </>
      }
    >
      <form
        id="ui-prompt"
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) finish(value.trim());
        }}
      >
        <label className="ui-field">
          {shown?.label && <span>{shown.label}</span>}
          <input data-autofocus value={value} placeholder={shown?.placeholder} onChange={(event) => setValue(event.target.value)} />
        </label>
      </form>
    </Dialog>
  );
}
