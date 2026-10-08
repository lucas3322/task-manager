import {
  BriefcaseBusiness,
  Bug,
  Building2,
  CalendarCheck,
  ChartNoAxesCombined,
  Code2,
  FolderKanban,
  GraduationCap,
  HeartPulse,
  Lightbulb,
  Megaphone,
  Palette,
  Rocket,
  ShoppingCart,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { AutomationActionType, CustomFieldType, GoalStatus, PortfolioHealth } from "@orbitask/contracts";

export const projectIcons: Record<string, { label: string; icon: LucideIcon }> = {
  folder: { label: "Projeto", icon: FolderKanban },
  rocket: { label: "Lançamento", icon: Rocket },
  target: { label: "Metas", icon: Target },
  code: { label: "Tecnologia", icon: Code2 },
  bug: { label: "Bugs", icon: Bug },
  megaphone: { label: "Marketing", icon: Megaphone },
  briefcase: { label: "Negócios", icon: BriefcaseBusiness },
  palette: { label: "Design", icon: Palette },
  cart: { label: "Comercial", icon: ShoppingCart },
  health: { label: "Saúde", icon: HeartPulse },
  education: { label: "Educação", icon: GraduationCap },
  calendar: { label: "Planejamento", icon: CalendarCheck },
  idea: { label: "Ideias", icon: Lightbulb },
  company: { label: "Empresa", icon: Building2 },
  chart: { label: "Resultados", icon: ChartNoAxesCombined },
};

/** Paleta calma para projetos, colunas e etiquetas — saturação moderada, boa em claro e escuro. */
export const palette = [
  "#6559e8",
  "#2f7ff0",
  "#1aa3b8",
  "#30a46c",
  "#8cb43a",
  "#e8a33a",
  "#f07a3a",
  "#e5484d",
  "#d6409f",
  "#8e4ec6",
  "#7c7c85",
  "#3b3b44",
];

export const healthLabels: Record<PortfolioHealth, string> = {
  on_track: "Em dia",
  at_risk: "Em risco",
  off_track: "Atrasado",
  on_hold: "Pausado",
};
export const healthTone: Record<PortfolioHealth, "green" | "orange" | "red" | "neutral"> = {
  on_track: "green",
  at_risk: "orange",
  off_track: "red",
  on_hold: "neutral",
};
export const goalLabels: Record<GoalStatus, string> = {
  not_started: "Não iniciada",
  on_track: "Em dia",
  at_risk: "Em risco",
  completed: "Concluída",
};
export const goalTone: Record<GoalStatus, "green" | "orange" | "accent" | "neutral"> = {
  not_started: "neutral",
  on_track: "accent",
  at_risk: "orange",
  completed: "green",
};

export const customFieldLabels: Record<CustomFieldType, string> = {
  text: "Texto",
  number: "Número",
  date: "Data",
  single: "Seleção única",
  multi: "Seleção múltipla",
};

export const automationActionLabels: Record<AutomationActionType, string> = {
  set_status: "Mover para o status",
  set_priority: "Definir prioridade",
  assign_user: "Atribuir a",
  add_tag: "Adicionar a tag",
  set_due_days: "Definir prazo em (dias)",
  create_subtask: "Criar subtarefa",
};

export const activityLabels: Record<string, string> = {
  created: "criou a tarefa",
  subtask_created: "criou uma subtarefa",
  updated: "atualizou a tarefa",
  commented: "comentou",
  attachment_added: "adicionou um anexo",
  checklist_added: "adicionou um item ao checklist",
  checklist_completed: "concluiu um item do checklist",
  checklist_updated: "atualizou o checklist",
  dependency_added: "adicionou uma dependência",
  custom_field_updated: "atualizou um campo personalizado",
};
