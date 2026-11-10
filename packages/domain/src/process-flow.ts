import type { ProjectAutomation, ProjectOption, Status, Task, TaskDependency, WorkspaceMember } from '@orbitask/contracts'

/*
 * Fluxograma do processo de um projeto.
 *
 * Um único modelo alimenta três saídas: o SVG desenhado (prévia e download no app),
 * o PNG (rasterizado a partir do SVG no navegador) e o texto Mermaid (MCP, docs, LLMs).
 * Tudo aqui é puro — sem DOM — para rodar igual no navegador, no Electron e no Node.
 */

export interface ProcessFlowInput {
  project: { name: string; description?: string; color: string }
  statuses: Status[]
  tasks: Task[]
  dependencies: TaskDependency[]
  automations?: ProjectAutomation[]
  priorities?: ProjectOption[]
  tags?: ProjectOption[]
  members?: Pick<WorkspaceMember, 'userId' | 'name'>[]
  /** Data de referência (AAAA-MM-DD) para calcular atrasos. Padrão: hoje. */
  today?: string
  /** Quantas tarefas desenhar por etapa antes de resumir em "+N". */
  maxTasksPerStage?: number
}

export interface FlowTask {
  id: string
  title: string
  stageId: string
  priorityName: string | null
  priorityColor: string | null
  dueDate: string | null
  overdue: boolean
  assignee: string | null
  subtasks: number
}

export interface FlowRule {
  id: string
  name: string
  enabled: boolean
  trigger: string
  actions: string[]
  /** Etapa para onde a automação move a tarefa, se houver. */
  movesTo: string | null
}

export interface FlowStage {
  id: string
  name: string
  color: string
  index: number
  total: number
  overdue: number
  tasks: FlowTask[]
  hidden: number
  rules: FlowRule[]
}

export interface ProcessFlow {
  title: string
  description: string
  color: string
  today: string
  stages: FlowStage[]
  /** Regras que disparam na criação da tarefa (ou em qualquer mudança de status). */
  entryRules: FlowRule[]
  /** Dependências entre tarefas desenhadas: `from` bloqueia `to`. */
  links: { from: string; to: string }[]
  /** Automações que movem tarefas entre etapas (de `from` para `to`; `from` nulo = criação). */
  jumps: { from: string | null; to: string; label: string }[]
  stats: { total: number; done: number; overdue: number; rules: number }
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export function buildProcessFlow(input: ProcessFlowInput): ProcessFlow {
  const today = input.today ?? todayIso()
  const limit = Math.max(1, input.maxTasksPerStage ?? 8)
  const statuses = [...input.statuses].sort((a, b) => a.position - b.position)
  const doneId = statuses.at(-1)?.id
  const statusName = new Map(statuses.map((item) => [item.id, item.name]))
  const priorities = new Map((input.priorities ?? []).map((item) => [item.id, item]))
  const tagName = new Map((input.tags ?? []).map((item) => [item.id, item.name]))
  const memberName = new Map((input.members ?? []).map((item) => [item.userId, item.name]))
  const live = input.tasks.filter((task) => !task.deletedAt)
  const topLevel = live.filter((task) => !task.parentId).sort((a, b) => a.position - b.position)
  const subtaskCount = new Map<string, number>()
  for (const task of live) if (task.parentId) subtaskCount.set(task.parentId, (subtaskCount.get(task.parentId) ?? 0) + 1)

  const toFlowTask = (task: Task): FlowTask => {
    const priority = priorities.get(task.priority)
    const assigneeId = task.primaryAssigneeId ?? task.assigneeIds[0]
    return {
      id: task.id,
      title: task.title,
      stageId: task.statusId,
      priorityName: priority?.name ?? null,
      priorityColor: priority?.color ?? null,
      dueDate: task.dueDate,
      overdue: Boolean(task.dueDate && task.dueDate < today && task.statusId !== doneId),
      assignee: assigneeId ? (memberName.get(assigneeId) ?? null) : null,
      subtasks: subtaskCount.get(task.id) ?? 0,
    }
  }

  const describeAction = (type: string, value: string) => {
    switch (type) {
      case 'set_status': return `Mover para ${statusName.get(value) ?? 'outra etapa'}`
      case 'set_priority': return `Prioridade ${priorities.get(value)?.name ?? value}`
      case 'assign_user': return `Atribuir a ${memberName.get(value) ?? 'um membro'}`
      case 'add_tag': return `Adicionar tag ${tagName.get(value) ?? ''}`.trim()
      case 'set_due_days': return `Prazo em ${value} dia(s)`
      case 'create_subtask': return `Criar subtarefa "${value}"`
      default: return value
    }
  }

  const rules = (input.automations ?? []).map((automation): FlowRule & { stageId: string | null } => {
    const stageId = automation.trigger === 'status_changed' ? automation.triggerValue : null
    const trigger = automation.trigger === 'task_created'
      ? 'Ao criar tarefa'
      : stageId ? `Ao entrar em “${statusName.get(stageId) ?? 'etapa removida'}”` : 'Quando o status muda'
    const move = automation.actions.find((action) => action.type === 'set_status' && statusName.has(action.value))
    return {
      id: automation.id,
      name: automation.name,
      enabled: automation.enabled,
      trigger,
      actions: automation.actions.map((action) => describeAction(action.type, action.value)),
      movesTo: move?.value ?? null,
      stageId: stageId && statusName.has(stageId) ? stageId : null,
    }
  })
  const strip = ({ stageId: _stage, ...rule }: FlowRule & { stageId: string | null }): FlowRule => rule

  const stages: FlowStage[] = statuses.map((status, index) => {
    const tasks = topLevel.filter((task) => task.statusId === status.id).map(toFlowTask)
    return {
      id: status.id,
      name: status.name,
      color: status.color,
      index,
      total: tasks.length,
      overdue: tasks.filter((task) => task.overdue).length,
      tasks: tasks.slice(0, limit),
      hidden: Math.max(0, tasks.length - limit),
      rules: rules.filter((rule) => rule.stageId === status.id).map(strip),
    }
  })

  const visible = new Set(stages.flatMap((stage) => stage.tasks.map((task) => task.id)))
  const links = input.dependencies
    .filter((item) => visible.has(item.taskId) && visible.has(item.dependsOnTaskId))
    .map((item) => ({ from: item.dependsOnTaskId, to: item.taskId }))

  const jumps = rules
    .filter((rule) => rule.enabled && rule.movesTo && rule.movesTo !== rule.stageId)
    .map((rule) => ({ from: rule.stageId, to: rule.movesTo!, label: rule.name }))

  return {
    title: input.project.name,
    description: input.project.description ?? '',
    color: input.project.color,
    today,
    stages,
    entryRules: rules.filter((rule) => rule.stageId === null).map(strip),
    links,
    jumps,
    stats: {
      total: topLevel.length,
      done: topLevel.filter((task) => task.statusId === doneId).length,
      overdue: topLevel.filter((task) => toFlowTask(task).overdue).length,
      rules: rules.length,
    },
  }
}

/* ---------------------------------------------------------------- SVG */

export type FlowTheme = 'light' | 'dark'

const palettes = {
  light: { bg: '#f6f6f9', surface: '#ffffff', text: '#1c1c21', text2: '#5d616d', text3: '#959aa6', border: '#e3e4ea', line: '#b9bcc6', accent: '#6559e8', dep: '#e8822c', danger: '#e0484f', rule: '#7c5cf0' },
  dark: { bg: '#131316', surface: '#1d1d22', text: '#f3f3f6', text2: '#aeb1bc', text3: '#727684', border: '#2d2e35', line: '#545865', accent: '#8b82ff', dep: '#f19a4b', danger: '#f06b71', rule: '#a08cff' },
}

const FONT = `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
const PAD = 48
const COL = 236
const GAP = 64
const TERM = 176
const STAGE_H = 78
const CARD_GAP = 10
const LANE_PAD = 12
const TITLE_CHARS = 27
/** Caracteres que cabem numa largura, para fontes de ~12.5px (texto) e caixa-alta 10.5px (gatilho). */
const fitChars = (width: number, perChar: number) => Math.max(8, Math.floor(width / perChar))

const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Quebra o texto em até `lines` linhas de ~`chars` caracteres, com reticências no fim. */
export function wrapText(text: string, chars: number, lines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const out: string[] = []
  let current = ''
  for (const raw of words) {
    let word = raw
    while (word.length > chars) {
      if (current) { out.push(current); current = '' }
      out.push(word.slice(0, chars))
      word = word.slice(chars)
    }
    const next = current ? `${current} ${word}` : word
    if (next.length > chars) { out.push(current); current = word }
    else current = next
  }
  if (current) out.push(current)
  if (out.length <= lines) return out.length ? out : ['']
  const kept = out.slice(0, lines)
  const last = kept[lines - 1]
  kept[lines - 1] = `${last.length >= chars ? last.slice(0, chars - 1) : last}…`
  return kept
}

/** Corta em uma linha por caracteres (não por palavra), com reticências. */
export const clipText = (text: string, chars: number) => {
  const value = text.replace(/\s+/g, ' ').trim()
  return value.length <= chars ? value : `${value.slice(0, Math.max(1, chars - 1)).trimEnd()}…`
}

const formatDay = (iso: string) => {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}
const shortDay = (iso: string) => {
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const [, month, day] = iso.split('-')
  return `${Number(day)} ${months[Number(month) - 1] ?? ''}`
}
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

interface Box { x: number; y: number; w: number; h: number }

export function renderProcessFlowSvg(flow: ProcessFlow, options: { theme?: FlowTheme; idPrefix?: string; /** false desenha só as etapas, sem os cartões de tarefa. */ showTasks?: boolean } = {}): string {
  const showTasks = options.showTasks !== false
  const c = palettes[options.theme ?? 'light']
  const id = (name: string) => `${options.idPrefix ?? 'of'}-${name}`
  const parts: string[] = []
  const stageCount = Math.max(flow.stages.length, 1)
  const columnX = (index: number) => PAD + TERM + GAP + index * (COL + GAP)
  const endX = columnX(stageCount)
  const width = endX + TERM + PAD

  /* Cabeçalho */
  const headerH = flow.description ? 112 : 92
  const jumpLevels = flow.jumps.length
  const arcSpace = jumpLevels ? 30 + jumpLevels * 26 : 0
  const stageY = PAD + headerH + arcSpace
  const flowY = stageY + STAGE_H / 2

  /* Cartões de tarefa: altura depende das linhas do título */
  const cardBoxes = new Map<string, Box>()
  const laneTop = stageY + STAGE_H + 18
  let lanesBottom = laneTop
  const laneHeights = flow.stages.map((stage) => {
    let y = laneTop + LANE_PAD
    for (const task of stage.tasks) {
      const lines = wrapText(task.title, TITLE_CHARS, 2).length
      const h = 22 + lines * 17 + 18
      cardBoxes.set(task.id, { x: columnX(stage.index) + LANE_PAD, y, w: COL - LANE_PAD * 2, h })
      y += h + CARD_GAP
    }
    if (stage.hidden) y += 26
    if (!stage.tasks.length) y += 44
    return y - CARD_GAP + LANE_PAD - laneTop
  })
  const laneH = Math.max(80, ...laneHeights)
  lanesBottom = showTasks ? laneTop + laneH : stageY + STAGE_H

  /* Regras: cartões abaixo das raias */
  const ruleH = (rule: FlowRule, w: number) => 40 + wrapText(rule.name, fitChars(w - 24, 7), 2).length * 16 + rule.actions.length * 17
  const rulesTop = lanesBottom + 28
  const ruleColumns: { x: number; w: number; rules: FlowRule[] }[] = [
    { x: PAD, w: TERM, rules: flow.entryRules },
    ...flow.stages.map((stage) => ({ x: columnX(stage.index), w: COL, rules: stage.rules })),
  ]
  const anyRules = ruleColumns.some((column) => column.rules.length)
  const rulesH = anyRules
    ? 30 + Math.max(...ruleColumns.map((column) => column.rules.reduce((sum, rule) => sum + ruleH(rule, column.w) + 10, 0)))
    : 0
  const legendY = rulesTop + rulesH + (anyRules ? 18 : 0)
  const height = legendY + 64

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${esc(FONT)}">`)
  parts.push(`<title>${esc(`Fluxograma — ${flow.title}`)}</title>`)
  parts.push(`<defs>
  <marker id="${id('arrow')}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1.2 L9 5 L1 8.8 Z" fill="${c.line}"/></marker>
  <marker id="${id('arrow-dep')}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1.2 L9 5 L1 8.8 Z" fill="${c.dep}"/></marker>
  <marker id="${id('arrow-rule')}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1.2 L9 5 L1 8.8 Z" fill="${c.rule}"/></marker>
  <filter id="${id('shadow')}" x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="1.5" stdDeviation="2.2" flood-color="#0b0b20" flood-opacity="${options.theme === 'dark' ? 0.45 : 0.08}"/></filter>
</defs>`)
  parts.push(`<rect width="100%" height="100%" fill="${c.bg}"/>`)

  /* Título e números */
  parts.push(`<rect x="${PAD}" y="${PAD + 2}" width="6" height="34" rx="3" fill="${esc(flow.color)}"/>`)
  parts.push(`<text x="${PAD + 18}" y="${PAD + 28}" font-size="26" font-weight="700" fill="${c.text}" letter-spacing="-0.4">${esc(flow.title)}</text>`)
  parts.push(`<text x="${PAD + 18}" y="${PAD + 54}" font-size="13" fill="${c.text2}">Fluxograma do processo · ${plural(flow.stages.length, 'etapa', 'etapas')} · gerado em ${formatDay(flow.today)}</text>`)
  if (flow.description) parts.push(`<text x="${PAD + 18}" y="${PAD + 76}" font-size="13" fill="${c.text3}">${esc(clipText(flow.description, 110))}</text>`)
  const chips = [
    { label: plural(flow.stats.total, 'tarefa', 'tarefas'), color: c.text2 },
    { label: `${flow.stats.total ? Math.round((flow.stats.done / flow.stats.total) * 100) : 0}% concluído`, color: '#23a26d' },
    ...(flow.stats.overdue ? [{ label: plural(flow.stats.overdue, 'atrasada', 'atrasadas'), color: c.danger }] : []),
    ...(flow.stats.rules ? [{ label: plural(flow.stats.rules, 'automação', 'automações'), color: c.rule }] : []),
  ]
  let chipX = width - PAD
  for (const chip of [...chips].reverse()) {
    const w = chip.label.length * 7 + 26
    chipX -= w
    parts.push(`<g><rect x="${chipX}" y="${PAD + 6}" width="${w}" height="28" rx="14" fill="${c.surface}" stroke="${c.border}"/><circle cx="${chipX + 13}" cy="${PAD + 20}" r="3.5" fill="${chip.color}"/><text x="${chipX + 22}" y="${PAD + 24.5}" font-size="12.5" font-weight="500" fill="${c.text}">${esc(chip.label)}</text></g>`)
    chipX -= 8
  }

  /* Raias de cada etapa (fundo tingido com a cor da etapa) */
  if (showTasks) for (const stage of flow.stages) {
    const x = columnX(stage.index)
    parts.push(`<rect x="${x}" y="${laneTop}" width="${COL}" height="${laneH}" rx="14" fill="${esc(stage.color)}" fill-opacity="${options.theme === 'dark' ? 0.1 : 0.07}" stroke="${esc(stage.color)}" stroke-opacity="0.18"/>`)
    parts.push(`<line x1="${x + COL / 2}" y1="${stageY + STAGE_H}" x2="${x + COL / 2}" y2="${laneTop}" stroke="${esc(stage.color)}" stroke-opacity="0.45" stroke-width="2" stroke-dasharray="2 4"/>`)
  }

  /* Fluxo principal: Entrada → etapas → Fim */
  const terminal = (x: number, label: string, sub: string, filled: boolean) =>
    `<g><rect x="${x}" y="${flowY - 26}" width="${TERM}" height="52" rx="26" fill="${filled ? c.accent : c.surface}" stroke="${filled ? c.accent : c.border}" filter="url(#${id('shadow')})"/>` +
    `<text x="${x + TERM / 2}" y="${flowY - 3}" text-anchor="middle" font-size="14" font-weight="650" fill="${filled ? '#ffffff' : c.text}">${esc(label)}</text>` +
    `<text x="${x + TERM / 2}" y="${flowY + 14}" text-anchor="middle" font-size="11.5" fill="${filled ? '#ffffffcc' : c.text3}">${esc(sub)}</text></g>`
  parts.push(terminal(PAD, 'Entrada', 'nova tarefa', true))
  parts.push(terminal(endX, 'Entregue', `${flow.stats.done} de ${flow.stats.total}`, false))

  const arrow = (x1: number, x2: number) => `<line x1="${x1 + 4}" y1="${flowY}" x2="${x2 - 4}" y2="${flowY}" stroke="${c.line}" stroke-width="2" marker-end="url(#${id('arrow')})"/>`
  if (flow.stages.length) {
    parts.push(arrow(PAD + TERM, columnX(0)))
    for (let index = 0; index < flow.stages.length - 1; index++) parts.push(arrow(columnX(index) + COL, columnX(index + 1)))
    parts.push(arrow(columnX(flow.stages.length - 1) + COL, endX))
  } else parts.push(arrow(PAD + TERM, endX))

  for (const stage of flow.stages) {
    const x = columnX(stage.index)
    const share = flow.stats.total ? stage.total / flow.stats.total : 0
    parts.push(`<g filter="url(#${id('shadow')})"><rect x="${x}" y="${stageY}" width="${COL}" height="${STAGE_H}" rx="14" fill="${c.surface}" stroke="${c.border}"/></g>`)
    parts.push(`<clipPath id="${id(`stage-${stage.index}`)}"><rect x="${x}" y="${stageY}" width="${COL}" height="${STAGE_H}" rx="14"/></clipPath>`)
    parts.push(`<rect x="${x}" y="${stageY}" width="${COL}" height="5" fill="${esc(stage.color)}" clip-path="url(#${id(`stage-${stage.index}`)})"/>`)
    parts.push(`<circle cx="${x + 30}" cy="${stageY + 34}" r="13" fill="${esc(stage.color)}" fill-opacity="0.16"/><text x="${x + 30}" y="${stageY + 38.5}" text-anchor="middle" font-size="12" font-weight="700" fill="${esc(stage.color)}">${stage.index + 1}</text>`)
    parts.push(`<text x="${x + 52}" y="${stageY + 39}" font-size="15" font-weight="650" fill="${c.text}">${esc(clipText(stage.name, 20))}</text>`)
    const meta = `${plural(stage.total, 'tarefa', 'tarefas')}${stage.overdue ? ` · ${stage.overdue} atrasada${stage.overdue > 1 ? 's' : ''}` : ''}`
    parts.push(`<text x="${x + 18}" y="${stageY + 64}" font-size="12" fill="${stage.overdue ? c.danger : c.text2}">${esc(meta)}</text>`)
    const barX = x + COL - 78
    parts.push(`<rect x="${barX}" y="${stageY + 58}" width="60" height="5" rx="2.5" fill="${c.border}"/><rect x="${barX}" y="${stageY + 58}" width="${Math.max(share ? 5 : 0, 60 * share)}" height="5" rx="2.5" fill="${esc(stage.color)}"/>`)
  }

  /* Automações que movem tarefas: arcos acima das etapas */
  flow.jumps.forEach((jump, level) => {
    const fromIndex = jump.from ? flow.stages.findIndex((stage) => stage.id === jump.from) : -1
    const toIndex = flow.stages.findIndex((stage) => stage.id === jump.to)
    if (toIndex < 0) return
    const sx = fromIndex < 0 ? PAD + TERM / 2 : columnX(fromIndex) + COL / 2 + 24
    const tx = columnX(toIndex) + COL / 2 - 24
    const sy = fromIndex < 0 ? flowY - 26 : stageY
    const top = stageY - 24 - (jumpLevels - 1 - level) * 26 - 12
    const r = 12
    const dir = tx >= sx ? 1 : -1
    parts.push(`<path d="M${sx} ${sy - 2} V${top + r} Q${sx} ${top} ${sx + r * dir} ${top} H${tx - r * dir} Q${tx} ${top} ${tx} ${top + r} V${stageY - 3}" fill="none" stroke="${c.rule}" stroke-width="1.8" stroke-dasharray="6 4" marker-end="url(#${id('arrow-rule')})"/>`)
    const label = `⚡ ${clipText(jump.label, 34)}`
    const lw = label.length * 6.4 + 18
    const lx = (sx + tx) / 2 - lw / 2
    parts.push(`<rect x="${lx}" y="${top - 11}" width="${lw}" height="22" rx="11" fill="${c.surface}" stroke="${c.rule}" stroke-opacity="0.5"/><text x="${lx + lw / 2}" y="${top + 4}" text-anchor="middle" font-size="11.5" font-weight="550" fill="${c.rule}">${esc(label)}</text>`)
  })

  /* Dependências: quem bloqueia → quem depende */
  if (showTasks) for (const link of flow.links) {
    const a = cardBoxes.get(link.from)
    const b = cardBoxes.get(link.to)
    if (!a || !b) continue
    let d: string
    if (Math.abs(a.x - b.x) < 1) {
      const sx = a.x + a.w, sy = a.y + a.h / 2, ty = b.y + b.h / 2
      d = `M${sx} ${sy} C${sx + 34} ${sy} ${sx + 34} ${ty} ${sx + 4} ${ty}`
    } else if (a.x < b.x) {
      const sx = a.x + a.w, sy = a.y + a.h / 2, tx = b.x, ty = b.y + b.h / 2
      d = `M${sx} ${sy} C${sx + GAP * 0.7} ${sy} ${tx - GAP * 0.7} ${ty} ${tx - 3} ${ty}`
    } else {
      const sx = a.x, sy = a.y + a.h / 2, tx = b.x + b.w, ty = b.y + b.h / 2
      d = `M${sx} ${sy} C${sx - GAP * 0.7} ${sy} ${tx + GAP * 0.7} ${ty} ${tx + 3} ${ty}`
    }
    parts.push(`<path d="${d}" fill="none" stroke="${c.dep}" stroke-width="1.8" stroke-dasharray="5 4" marker-end="url(#${id('arrow-dep')})"/>`)
  }

  /* Cartões de tarefa */
  if (showTasks) for (const stage of flow.stages) {
    const x = columnX(stage.index)
    for (const task of stage.tasks) {
      const box = cardBoxes.get(task.id)!
      const lines = wrapText(task.title, TITLE_CHARS, 2)
      parts.push(`<g><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="10" fill="${c.surface}" stroke="${task.overdue ? c.danger : c.border}" stroke-opacity="${task.overdue ? 0.55 : 1}" filter="url(#${id('shadow')})"/>`)
      parts.push(`<rect x="${box.x}" y="${box.y + 10}" width="3" height="${box.h - 20}" rx="1.5" fill="${esc(task.priorityColor ?? stage.color)}"/>`)
      lines.forEach((line, index) => parts.push(`<text x="${box.x + 14}" y="${box.y + 25 + index * 17}" font-size="13" font-weight="500" fill="${c.text}">${esc(line)}</text>`))
      const metaY = box.y + 25 + lines.length * 17 + 6
      const meta: string[] = []
      if (task.priorityName) meta.push(task.priorityName)
      if (task.dueDate) meta.push(task.overdue ? `atrasada · ${shortDay(task.dueDate)}` : shortDay(task.dueDate))
      if (task.subtasks) meta.push(plural(task.subtasks, 'subtarefa', 'subtarefas'))
      parts.push(`<text x="${box.x + 14}" y="${metaY}" font-size="11" fill="${task.overdue ? c.danger : c.text3}">${esc(meta.join(' · ') || 'Sem prazo')}</text>`)
      if (task.assignee) {
        const initials = task.assignee.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
        parts.push(`<circle cx="${box.x + box.w - 18}" cy="${metaY - 4}" r="10" fill="${esc(stage.color)}" fill-opacity="0.18"/><text x="${box.x + box.w - 18}" y="${metaY - 0.5}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${c.text2}">${esc(initials)}</text>`)
      }
      parts.push('</g>')
    }
    const last = stage.tasks.at(-1)
    const afterY = last ? cardBoxes.get(last.id)!.y + cardBoxes.get(last.id)!.h + CARD_GAP : laneTop + LANE_PAD
    if (stage.hidden) parts.push(`<text x="${x + COL / 2}" y="${afterY + 12}" text-anchor="middle" font-size="12" font-weight="500" fill="${c.text2}">+ ${plural(stage.hidden, 'tarefa', 'tarefas')}</text>`)
    if (!stage.tasks.length) parts.push(`<text x="${x + COL / 2}" y="${afterY + 26}" text-anchor="middle" font-size="12" fill="${c.text3}">Nenhuma tarefa nesta etapa</text>`)
  }

  /* Regras automáticas */
  if (anyRules) {
    parts.push(`<text x="${PAD}" y="${rulesTop + 12}" font-size="12" font-weight="650" fill="${c.text2}" letter-spacing="0.6">AUTOMAÇÕES</text>`)
    for (const column of ruleColumns) {
      let y = rulesTop + 30
      for (const rule of column.rules) {
        const h = ruleH(rule, column.w)
        const chars = fitChars(column.w - 24, 7)
        const triggerChars = fitChars(column.w - 24 - (rule.enabled ? 0 : 58), 7.1)
        const actionChars = fitChars(column.w - 36, 6.3)
        parts.push(`<g opacity="${rule.enabled ? 1 : 0.55}"><rect x="${column.x}" y="${y}" width="${column.w}" height="${h}" rx="10" fill="${c.surface}" stroke="${c.rule}" stroke-opacity="0.35" stroke-dasharray="${rule.enabled ? '' : '4 3'}"/>`)
        parts.push(`<text x="${column.x + 12}" y="${y + 19}" font-size="10.5" font-weight="650" fill="${c.rule}" letter-spacing="0.3">⚡ ${esc(clipText(rule.trigger.toUpperCase(), triggerChars - 2))}</text>`)
        const nameLines = wrapText(rule.name, chars, 2)
        nameLines.forEach((line, index) => parts.push(`<text x="${column.x + 12}" y="${y + 37 + index * 16}" font-size="12.5" font-weight="600" fill="${c.text}">${esc(line)}</text>`))
        rule.actions.forEach((action, index) => parts.push(`<text x="${column.x + 12}" y="${y + 37 + nameLines.length * 16 + 2 + index * 17}" font-size="11.5" fill="${c.text2}">→ ${esc(clipText(action, actionChars))}</text>`))
        if (!rule.enabled) parts.push(`<rect x="${column.x + column.w - 62}" y="${y + 8}" width="52" height="16" rx="8" fill="${c.border}"/><text x="${column.x + column.w - 36}" y="${y + 19.5}" text-anchor="middle" font-size="10" font-weight="600" fill="${c.text2}">pausada</text>`)
        parts.push('</g>')
        y += h + 10
      }
    }
  }

  /* Legenda */
  const ly = legendY + 22
  parts.push(`<line x1="${PAD}" y1="${legendY}" x2="${width - PAD}" y2="${legendY}" stroke="${c.border}"/>`)
  const legend = [
    { svg: `<line x1="0" y1="0" x2="30" y2="0" stroke="${c.line}" stroke-width="2" marker-end="url(#${id('arrow')})"/>`, label: 'Fluxo entre etapas' },
    { svg: `<line x1="0" y1="0" x2="30" y2="0" stroke="${c.dep}" stroke-width="1.8" stroke-dasharray="5 4" marker-end="url(#${id('arrow-dep')})"/>`, label: 'Dependência (bloqueia)' },
    { svg: `<line x1="0" y1="0" x2="30" y2="0" stroke="${c.rule}" stroke-width="1.8" stroke-dasharray="6 4" marker-end="url(#${id('arrow-rule')})"/>`, label: 'Automação move a tarefa' },
    { svg: `<rect x="0" y="-8" width="30" height="16" rx="4" fill="${c.surface}" stroke="${c.danger}" stroke-opacity="0.55"/>`, label: 'Tarefa atrasada' },
  ]
  let lx = PAD
  for (const item of legend) {
    parts.push(`<g transform="translate(${lx} ${ly})">${item.svg}<text x="40" y="4" font-size="12" fill="${c.text2}">${esc(item.label)}</text></g>`)
    lx += 40 + item.label.length * 6.6 + 34
  }
  parts.push(`<text x="${width - PAD}" y="${ly + 4}" text-anchor="end" font-size="12" fill="${c.text3}">Orbitask</text>`)
  parts.push('</svg>')
  return parts.join('\n')
}

/* ------------------------------------------------------------ Mermaid */

const mermaidText = (value: string) => value.replace(/"/g, '#quot;').replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim()

export function renderProcessFlowMermaid(flow: ProcessFlow): string {
  const lines = ['flowchart LR']
  const nodeId = new Map<string, string>()
  flow.stages.forEach((stage, index) => {
    stage.tasks.forEach((task, taskIndex) => nodeId.set(task.id, `t${index}_${taskIndex}`))
  })
  lines.push('  start(["Entrada: nova tarefa"])')
  for (const stage of flow.stages) {
    const sid = `s${stage.index}`
    lines.push(`  subgraph ${sid}["${stage.index + 1}. ${mermaidText(stage.name)} · ${stage.total}"]`)
    lines.push('    direction TB')
    stage.tasks.forEach((task) => {
      const meta = [task.priorityName, task.dueDate ? (task.overdue ? `atrasada ${shortDay(task.dueDate)}` : shortDay(task.dueDate)) : null].filter(Boolean).join(' · ')
      lines.push(`    ${nodeId.get(task.id)}["${mermaidText(task.title)}${meta ? `<br/><small>${mermaidText(meta)}</small>` : ''}"]`)
    })
    if (stage.hidden) lines.push(`    ${sid}_more["+ ${stage.hidden} tarefa(s)"]`)
    if (!stage.tasks.length && !stage.hidden) lines.push(`    ${sid}_empty["sem tarefas"]`)
    lines.push('  end')
  }
  lines.push(`  finish(["Entregue: ${flow.stats.done} de ${flow.stats.total}"])`)
  const chain = ['start', ...flow.stages.map((stage) => `s${stage.index}`), 'finish']
  lines.push(`  ${chain.join(' --> ')}`)
  for (const link of flow.links) lines.push(`  ${nodeId.get(link.from)} -. bloqueia .-> ${nodeId.get(link.to)}`)
  for (const jump of flow.jumps) {
    const from = jump.from ? `s${flow.stages.find((stage) => stage.id === jump.from)?.index}` : 'start'
    const to = flow.stages.find((stage) => stage.id === jump.to)
    if (to) lines.push(`  ${from} == "⚡ ${mermaidText(jump.label)}" ==> s${to.index}`)
  }
  for (const stage of flow.stages) lines.push(`  style s${stage.index} fill:${stage.color}14,stroke:${stage.color},stroke-width:1.5px`)
  const overdue = flow.stages.flatMap((stage) => stage.tasks.filter((task) => task.overdue).map((task) => nodeId.get(task.id)))
  if (overdue.length) {
    lines.push('  classDef overdue stroke:#e0484f,stroke-width:2px')
    lines.push(`  class ${overdue.join(',')} overdue`)
  }
  lines.push('  classDef terminal fill:#6559e8,color:#ffffff,stroke:#6559e8')
  lines.push('  class start terminal')
  return lines.join('\n')
}

/** Resumo em texto, útil para LLMs entenderem o processo sem ler o diagrama. */
export function describeProcessFlow(flow: ProcessFlow): string {
  const out = [`Projeto "${flow.title}" — ${flow.stages.length} etapas, ${flow.stats.total} tarefas (${flow.stats.done} concluídas, ${flow.stats.overdue} atrasadas).`]
  out.push(`Fluxo: Entrada → ${flow.stages.map((stage) => `${stage.name} (${stage.total})`).join(' → ')} → Entregue.`)
  for (const rule of [...flow.entryRules, ...flow.stages.flatMap((stage) => stage.rules)]) {
    out.push(`Automação${rule.enabled ? '' : ' (pausada)'} "${rule.name}": ${rule.trigger.toLowerCase()} → ${rule.actions.join('; ')}.`)
  }
  if (flow.links.length) out.push(`${flow.links.length} dependência(s) entre tarefas visíveis.`)
  return out.join('\n')
}
