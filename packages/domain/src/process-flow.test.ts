import { describe, expect, it } from 'vitest'
import type { ProjectAutomation, Task } from '@orbitask/contracts'
import { buildProcessFlow, describeProcessFlow, renderProcessFlowMermaid, renderProcessFlowSvg, wrapText } from './process-flow'

const statuses = [
  { id: 'todo', name: 'A fazer', color: '#a0a5b1', position: 0 },
  { id: 'doing', name: 'Em andamento', color: '#665cf6', position: 1 },
  { id: 'done', name: 'Concluído', color: '#2ca87f', position: 2 },
]
const task = (id: string, statusId: string, extra: Partial<Task> = {}): Task => ({
  id, projectId: 'p', parentId: null, title: `Tarefa ${id}`, description: '', statusId, priority: 'high', startDate: null, dueDate: null,
  position: 0, deletedAt: null, createdAt: '', updatedAt: '', tagIds: [], badgeIds: [], assigneeIds: ['u1'], primaryAssigneeId: 'u1', followerIds: [], ...extra,
})
const automation = (extra: Partial<ProjectAutomation>): ProjectAutomation => ({
  id: 'a1', projectId: 'p', name: 'Triagem', enabled: true, trigger: 'task_created', triggerValue: null, actions: [], createdAt: '', updatedAt: '', ...extra,
})

const input = {
  project: { name: 'Lançamento <beta> & "app"', color: '#6559e8' },
  statuses,
  tasks: [
    task('a', 'todo', { dueDate: '2026-01-01' }),
    task('b', 'doing', { title: 'Revisar "app"' }),
    task('c', 'done', { dueDate: '2026-01-01' }),
    task('sub', 'todo', { parentId: 'a' }),
    task('gone', 'todo', { deletedAt: '2026-01-02' }),
  ],
  dependencies: [{ taskId: 'b', dependsOnTaskId: 'a', createdAt: '' }],
  automations: [
    automation({ actions: [{ id: 'x', type: 'set_status', value: 'doing' }, { id: 'y', type: 'assign_user', value: 'u1' }] }),
    automation({ id: 'a2', name: 'Revisão', trigger: 'status_changed', triggerValue: 'doing', actions: [{ id: 'z', type: 'set_priority', value: 'high' }] }),
  ],
  priorities: [{ id: 'high', name: 'Alta', color: '#ee8b3b', position: 0 }],
  members: [{ userId: 'u1', name: 'Ana Maria' }],
  today: '2026-06-01',
}

describe('buildProcessFlow', () => {
  it('monta etapas, estatísticas, dependências e automações', () => {
    const flow = buildProcessFlow(input)
    expect(flow.stages.map((stage) => stage.total)).toEqual([1, 1, 1])
    expect(flow.stats).toEqual({ total: 3, done: 1, overdue: 1, rules: 2 })
    expect(flow.stages[0].tasks[0]).toMatchObject({ overdue: true, subtasks: 1, assignee: 'Ana Maria', priorityName: 'Alta' })
    expect(flow.stages[2].tasks[0].overdue).toBe(false)
    expect(flow.links).toEqual([{ from: 'a', to: 'b' }])
    expect(flow.jumps).toEqual([{ from: null, to: 'doing', label: 'Triagem' }])
    expect(flow.entryRules[0].actions).toEqual(['Mover para Em andamento', 'Atribuir a Ana Maria'])
    expect(flow.stages[1].rules[0]).toMatchObject({ trigger: 'Ao entrar em “Em andamento”', actions: ['Prioridade Alta'] })
  })

  it('resume o excedente de tarefas por etapa', () => {
    const tasks = Array.from({ length: 5 }, (_, index) => task(`t${index}`, 'todo'))
    const flow = buildProcessFlow({ ...input, tasks, dependencies: [], maxTasksPerStage: 2 })
    expect(flow.stages[0].tasks).toHaveLength(2)
    expect(flow.stages[0].hidden).toBe(3)
  })
})

describe('saídas', () => {
  const flow = buildProcessFlow(input)
  it('gera SVG válido com texto escapado', () => {
    const svg = renderProcessFlowSvg(flow, { theme: 'dark', idPrefix: 'x' })
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('Lançamento &lt;beta&gt; &amp; &quot;app&quot;')
    expect(svg).not.toMatch(/<beta>/)
    expect(svg).toContain('url(#x-arrow-dep)')
    expect(svg.match(/<svg/g)).toHaveLength(1)
  })
  it('omite os cartões quando showTasks é false', () => {
    const svg = renderProcessFlowSvg(flow, { showTasks: false })
    expect(svg).not.toContain('>Tarefa a<')
    expect(svg).toContain('A fazer')
  })
  it('gera Mermaid com etapas, dependência e automação', () => {
    const text = renderProcessFlowMermaid(flow)
    expect(text).toMatch(/^flowchart LR/)
    expect(text).toContain('start --> s0 --> s1 --> s2 --> finish')
    expect(text).toContain('t0_0 -. bloqueia .-> t1_0')
    expect(text).toContain('start == "⚡ Triagem" ==> s1')
    expect(text).toContain('#quot;app#quot;')
  })
  it('descreve o processo em texto', () => {
    expect(describeProcessFlow(flow)).toContain('Entrada → A fazer (1) → Em andamento (1) → Concluído (1) → Entregue')
  })
})

describe('wrapText', () => {
  it('quebra palavras longas e corta com reticências', () => {
    expect(wrapText('um dois tres quatro', 8, 2)).toEqual(['um dois', 'tres…'])
    expect(wrapText('aaaaaaaaaaaa', 5, 3)).toEqual(['aaaaa', 'aaaaa', 'aa'])
  })
})
