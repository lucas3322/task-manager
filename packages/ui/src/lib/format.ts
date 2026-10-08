export const initials = (name?: string | null) =>
  (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

export const firstName = (name?: string | null) => (name ?? "").trim().split(/\s+/)[0] ?? "";

/** Data local no formato AAAA-MM-DD (sem conversão de fuso). */
export const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const parseDay = (value: string) => new Date(`${value}T12:00:00`);

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

export const todayIso = () => isoDate(new Date());

const dayDiff = (value: string) => Math.round((parseDay(value).getTime() - parseDay(todayIso()).getTime()) / 86400000);

/** "Hoje", "Amanhã", "Ontem", "12 out" — curto e humano. */
export function formatDue(value: string | null) {
  if (!value) return "Sem prazo";
  const diff = dayDiff(value);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  const date = parseDay(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date
    .toLocaleDateString("pt-BR", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) })
    .replace(".", "");
}

export type DueTone = "overdue" | "today" | "soon" | "later" | "none";
export function dueTone(value: string | null, done = false): DueTone {
  if (!value) return "none";
  if (done) return "later";
  const diff = dayDiff(value);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 3) return "soon";
  return "later";
}

export function formatDate(value: string, withYear = true) {
  return new Date(value.length === 10 ? `${value}T12:00:00` : value)
    .toLocaleDateString("pt-BR", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) })
    .replace(".", "");
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    .format(new Date(value))
    .replace(".", "");
}

/** "agora", "há 5 min", "há 3 h", "ontem", "12 out". */
export function relativeTime(value: string) {
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 45) return "agora";
  if (diff < 3600) return `há ${Math.round(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.round(diff / 3600)} h`;
  if (diff < 172800) return "ontem";
  if (diff < 604800) return `há ${Math.round(diff / 86400)} dias`;
  return formatDate(value, false);
}

export const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

export function greeting(date = new Date()) {
  const hour = date.getHours();
  return hour < 5 ? "Boa noite" : hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Cor legível sobre uma cor de fundo arbitrária (escolhida pelo usuário). */
export function readableOn(hex: string) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return "#fff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.62 ? "#1d1d1f" : "#ffffff";
}

export const roleLabel = { admin: "Administrador", member: "Membro", guest: "Convidado" } as const;
