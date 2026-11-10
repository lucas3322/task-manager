import { writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, resolve } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import type { Task, WorkspaceSnapshot } from '@orbitask/contracts'
import { buildProcessFlow, describeProcessFlow, renderProcessFlowMermaid, renderProcessFlowSvg } from '@orbitask/domain'
import { OrbitaskClient } from './client.js'

/* ------------------------------------------------------------ helpers */

const ok = (data: unknown): CallToolResult => ({ content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] })
const fail = (error: unknown): CallToolResult => ({ isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] })

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/** Aceita id exato, nome exato (sem acento/caixa) ou um prefixo único do nome. */
export function resolveOne<T>(items: T[], value: string, kind: string, id: (item: T) => string, name: (item: T) => string): T {
  const wanted = normalize(value)
  const byId = items.find((item) => id(item) === value)
  if (byId) return byId
  const exact = items.filter((item) => normalize(name(item)) === wanted)
  if (exact.length === 1) return exact[0]
  const partial = items.filter((item) => normalize(name(item)).includes(wanted))
  if (partial.length === 1) return partial[0]
  const options = items.map((item) => `"${name(item)}"`).join(', ') || 'nenhum cadastrado'
  throw new Error(partial.length > 1 ? `${kind} "${value}" é ambíguo. Opções: ${options}` : `${kind} "${value}" não encontrado. Opções: ${options}`)
}

const today = () => new Date().toISOString().slice(0, 10)
const addDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD')

interface Context {
  client: OrbitaskClient
  readOnly: boolean
}

async function projectSnapshot(client: OrbitaskClient, project?: string): Promise<WorkspaceSnapshot> {
  if (!project) return client.snapshot()
  const base = await client.snapshot()
  const match = resolveOne(base.projects, project, 'Projeto', (item) => item.id, (item) => item.name)
  return match.id === base.project.id ? base : client.snapshot(match.id)
}

/** Encontra a tarefa em qualquer projeto acessível (começando pelo informado, se houver). */
async function findTask(client: OrbitaskClient, taskId: string, project?: string): Promise<{ snapshot: WorkspaceSnapshot; task: Task }> {
  const first = await projectSnapshot(client, project)
  const hit = first.tasks.find((task) => task.id === taskId)
  if (hit) return { snapshot: first, task: hit }
  for (const other of first.projects) {
    if (other.id === first.project.id) continue
    const snapshot = await client.snapshot(other.id)
    const task = snapshot.tasks.find((item) => item.id === taskId)
    if (task) return { snapshot, task }
  }
  throw new Error(`Tarefa ${taskId} não encontrada (ou foi para a lixeira). Use list_tasks ou search para achar o id.`)
}

function helpers(snapshot: WorkspaceSnapshot) {
  const statuses = [...snapshot.statuses].sort((a, b) => a.position - b.position)
  const doneId = statuses.at(-1)?.id
  const people = snapshot.members.filter((member) => member.role !== 'guest' || member.projectIds.includes(snapshot.project.id))
  const name = <T extends { id: string; name: string }>(items: T[], id: string) => items.find((item) => item.id === id)?.name ?? null
  const person = (id: string) => snapshot.members.find((member) => member.userId === id)?.name ?? null
  return {
    statuses,
    doneId,
    people,
    status: (value: string) => resolveOne(statuses, value, 'Status', (item) => item.id, (item) => item.name).id,
    priority: (value: string) => resolveOne(snapshot.settings.priorities, value, 'Prioridade', (item) => item.id, (item) => item.name).id,
    tag: (value: string) => resolveOne(snapshot.settings.tags, value, 'Tag', (item) => item.id, (item) => item.name).id,
    badge: (value: string) => resolveOne(snapshot.settings.badges, value, 'Selo', (item) => item.id, (item) => item.name).id,
    member: (value: string) =>
      value === 'me' || normalize(value) === 'eu'
        ? snapshot.user.id
        : resolveOne(people, value, 'Pessoa', (item) => item.userId, (item) => item.name).userId,
    summary: (task: Task) => ({
      id: task.id,
      title: task.title,
      status: name(statuses, task.statusId),
      priority: name(snapshot.settings.priorities, task.priority),
      badges: task.badgeIds.map((id) => name(snapshot.settings.badges, id)).filter(Boolean),
      tags: task.tagIds.map((id) => name(snapshot.settings.tags, id)).filter(Boolean),
      assignees: task.assigneeIds.map(person).filter(Boolean),
      startDate: task.startDate,
      dueDate: task.dueDate,
      overdue: Boolean(task.dueDate && task.dueDate < today() && task.statusId !== doneId),
      subtasks: snapshot.tasks.filter((item) => item.parentId === task.id).length,
      parentId: task.parentId ?? undefined,
      updatedAt: task.updatedAt,
    }),
    person,
  }
}

const projectParam = z.string().optional().describe('Nome ou id do projeto. Sem informar, usa o projeto padrão do workspace.')

/* ------------------------------------------------------------- tools */

export function registerTools(server: McpServer, { client, readOnly }: Context) {
  const read = { readOnlyHint: true, openWorldHint: false } as const
  const run = (handler: () => Promise<unknown>) => handler().then(ok, fail)

  server.registerTool(
    'list_projects',
    {
      title: 'Listar projetos',
      description: 'Mostra o usuário conectado, o workspace e todos os projetos acessíveis, com totais de tarefas. Comece por aqui.',
      annotations: read,
    },
    () =>
      run(async () => {
        const [session, report] = await Promise.all([client.me(), client.dashboard().catch(() => null)])
        const snapshot = await client.snapshot()
        const metrics = new Map((report?.projects ?? []).map((item) => [item.id, item]))
        return {
          user: session.user.name,
          workspace: session.workspace.name,
          role: session.workspace.role,
          readOnly,
          defaultProjectId: snapshot.project.id,
          projects: snapshot.projects.map((project) => ({
            id: project.id,
            name: project.name,
            description: project.description || undefined,
            tasks: metrics.get(project.id)?.total,
            completed: metrics.get(project.id)?.completed,
            overdue: metrics.get(project.id)?.overdue,
          })),
        }
      }),
  )

  server.registerTool(
    'get_project',
    {
      title: 'Ver projeto',
      description: 'Estrutura do projeto: etapas (status) em ordem com contagem de tarefas, prioridades, tags, campos personalizados e pessoas. Use para saber os nomes válidos antes de criar ou atualizar tarefas.',
      inputSchema: { project: projectParam },
      annotations: read,
    },
    ({ project }) =>
      run(async () => {
        const snapshot = await projectSnapshot(client, project)
        const h = helpers(snapshot)
        const top = snapshot.tasks.filter((task) => !task.parentId)
        return {
          id: snapshot.project.id,
          name: snapshot.project.name,
          description: snapshot.project.description || undefined,
          stages: h.statuses.map((status, index) => ({
            id: status.id,
            name: status.name,
            order: index + 1,
            tasks: top.filter((task) => task.statusId === status.id).length,
            isDone: status.id === h.doneId,
          })),
          priorities: snapshot.settings.priorities.map(({ id, name }) => ({ id, name })),
          badges: snapshot.settings.badges.map(({ id, name }) => ({ id, name })),
          tags: snapshot.settings.tags.map(({ id, name }) => ({ id, name })),
          people: h.people.map((member) => ({ id: member.userId, name: member.name, role: member.role, isMe: member.userId === snapshot.user.id })),
          customFields: snapshot.customFields.map(({ id, name, type }) => ({ id, name, type })),
          totals: { tasks: top.length, done: top.filter((task) => task.statusId === h.doneId).length },
        }
      }),
  )

  server.registerTool(
    'list_tasks',
    {
      title: 'Listar tarefas',
      description: 'Lista tarefas de um projeto com filtros. Filtros aceitam nomes (ex.: status "Em andamento", tag "Bug", responsável "Ana" ou "me").',
      inputSchema: {
        project: projectParam,
        status: z.string().optional().describe('Nome ou id da etapa'),
        assignee: z.string().optional().describe('Nome, id ou "me"'),
        tag: z.string().optional().describe('Nome ou id da tag'),
        query: z.string().optional().describe('Texto no título ou na descrição'),
        due: z.enum(['overdue', 'today', 'week', 'no_due']).optional().describe('overdue = atrasadas, today = vencem hoje, week = próximos 7 dias, no_due = sem prazo'),
        includeDone: z.boolean().optional().describe('Incluir tarefas concluídas (padrão: true)'),
        includeSubtasks: z.boolean().optional().describe('Incluir subtarefas (padrão: false)'),
        limit: z.number().int().min(1).max(200).optional().describe('Máximo de resultados (padrão: 50)'),
      },
      annotations: read,
    },
    (args) =>
      run(async () => {
        const snapshot = await projectSnapshot(client, args.project)
        const h = helpers(snapshot)
        const statusId = args.status ? h.status(args.status) : null
        const assigneeId = args.assignee ? h.member(args.assignee) : null
        const tagId = args.tag ? h.tag(args.tag) : null
        const query = args.query ? normalize(args.query) : null
        const order = new Map(h.statuses.map((status, index) => [status.id, index]))
        const now = today()
        const week = addDays(7)
        const matches = snapshot.tasks
          .filter((task) => args.includeSubtasks || !task.parentId)
          .filter((task) => args.includeDone !== false || task.statusId !== h.doneId)
          .filter((task) => !statusId || task.statusId === statusId)
          .filter((task) => !assigneeId || task.assigneeIds.includes(assigneeId))
          .filter((task) => !tagId || task.tagIds.includes(tagId))
          .filter((task) => !query || normalize(`${task.title} ${task.description}`).includes(query))
          .filter((task) => {
            if (!args.due) return true
            if (args.due === 'no_due') return !task.dueDate
            if (!task.dueDate || task.statusId === h.doneId) return false
            if (args.due === 'overdue') return task.dueDate < now
            if (args.due === 'today') return task.dueDate === now
            return task.dueDate >= now && task.dueDate <= week
          })
          .sort((a, b) => (order.get(a.statusId) ?? 0) - (order.get(b.statusId) ?? 0) || a.position - b.position)
        const limit = args.limit ?? 50
        return { project: snapshot.project.name, total: matches.length, showing: Math.min(limit, matches.length), tasks: matches.slice(0, limit).map(h.summary) }
      }),
  )

  server.registerTool(
    'get_task',
    {
      title: 'Ver tarefa',
      description: 'Detalhes completos de uma tarefa: descrição, subtarefas, checklist, comentários, links, dependências e histórico recente.',
      inputSchema: { taskId: z.string().describe('Id da tarefa'), project: projectParam },
      annotations: read,
    },
    ({ taskId, project }) =>
      run(async () => {
        const { snapshot, task } = await findTask(client, taskId, project)
        const h = helpers(snapshot)
        const title = (id: string) => snapshot.tasks.find((item) => item.id === id)?.title ?? id
        return {
          ...h.summary(task),
          project: { id: snapshot.project.id, name: snapshot.project.name },
          description: task.description,
          followers: task.followerIds.map(h.person).filter(Boolean),
          subtasks: snapshot.tasks.filter((item) => item.parentId === task.id).map(h.summary),
          checklist: snapshot.checklistItems.filter((item) => item.taskId === task.id).sort((a, b) => a.position - b.position).map(({ id, title, completed }) => ({ id, title, completed })),
          blockedBy: snapshot.dependencies.filter((item) => item.taskId === task.id).map((item) => ({ id: item.dependsOnTaskId, title: title(item.dependsOnTaskId) })),
          blocks: snapshot.dependencies.filter((item) => item.dependsOnTaskId === task.id).map((item) => ({ id: item.taskId, title: title(item.taskId) })),
          links: snapshot.attachments.filter((item) => item.taskId === task.id).map(({ name, url }) => ({ name, url })),
          customFields: snapshot.customFieldValues
            .filter((item) => item.taskId === task.id)
            .map((item) => ({ field: snapshot.customFields.find((field) => field.id === item.fieldId)?.name ?? item.fieldId, value: item.value })),
          comments: snapshot.comments.filter((item) => item.taskId === task.id).map(({ authorName, body, createdAt }) => ({ author: authorName, body, createdAt })),
          recentActivity: snapshot.activities.filter((item) => item.taskId === task.id).slice(0, 10).map(({ action, authorName, createdAt }) => ({ action, author: authorName, createdAt })),
          createdAt: task.createdAt,
        }
      }),
  )

  server.registerTool(
    'search',
    {
      title: 'Buscar',
      description: 'Busca tarefas, projetos e pessoas em todo o workspace por texto.',
      inputSchema: { query: z.string().min(2).describe('Texto a buscar (mínimo 2 caracteres)') },
      annotations: read,
    },
    ({ query }) =>
      run(async () => {
        const result = await client.search(query)
        return {
          tasks: result.tasks.map(({ id, title, projectName, statusName, dueDate }) => ({ id, title, project: projectName, status: statusName, dueDate })),
          projects: result.projects.map(({ id, name }) => ({ id, name })),
          people: result.people.map(({ id, name }) => ({ id, name })),
        }
      }),
  )

  server.registerTool(
    'my_tasks',
    {
      title: 'Minhas tarefas',
      description: 'Tarefas atribuídas ao usuário conectado em todos os projetos, com prazo e status.',
      inputSchema: { includeDone: z.boolean().optional().describe('Incluir concluídas (padrão: false)') },
      annotations: read,
    },
    ({ includeDone }) =>
      run(async () => {
        const tasks = await client.myTasks()
        const now = today()
        return tasks
          .filter((task) => includeDone || !task.done)
          .map((task) => ({ id: task.id, title: task.title, project: task.projectName, status: task.statusName, priority: task.priorityName, dueDate: task.dueDate, overdue: Boolean(task.dueDate && task.dueDate < now && !task.done), done: task.done }))
      }),
  )

  server.registerTool(
    'get_process_flow',
    {
      title: 'Fluxograma do processo',
      description:
        'Desenha o processo do projeto: etapas em ordem, tarefas por etapa, dependências e automações. Retorna um resumo em texto e o diagrama em Mermaid; opcionalmente salva um SVG pronto para apresentação.',
      inputSchema: {
        project: projectParam,
        includeTasks: z.boolean().optional().describe('Mostrar as tarefas dentro de cada etapa (padrão: true)'),
        maxTasksPerStage: z.number().int().min(1).max(30).optional().describe('Tarefas por etapa antes de resumir em "+N" (padrão: 8)'),
        saveSvgTo: z.string().optional().describe('Caminho para salvar o SVG, ex.: ~/Desktop/fluxo.svg ou C:\\Users\\voce\\Desktop\\fluxo.svg'),
        theme: z.enum(['light', 'dark']).optional().describe('Tema do SVG (padrão: light)'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (args) =>
      run(async () => {
        const snapshot = await projectSnapshot(client, args.project)
        const automations = await client.automations(snapshot.project.id).then((result) => result.automations, () => [])
        const flow = buildProcessFlow({
          project: snapshot.project,
          statuses: snapshot.statuses,
          tasks: snapshot.tasks,
          dependencies: snapshot.dependencies,
          automations,
          priorities: snapshot.settings.priorities,
          tags: snapshot.settings.tags,
          members: snapshot.members,
          maxTasksPerStage: args.maxTasksPerStage,
        })
        const parts = [describeProcessFlow(flow), '', '```mermaid', renderProcessFlowMermaid(flow), '```']
        if (args.saveSvgTo) {
          const target = args.saveSvgTo.replace(/^~(?=$|[\\/])/, homedir())
          const path = isAbsolute(target) ? target : resolve(process.cwd(), target)
          await writeFile(path, renderProcessFlowSvg(flow, { theme: args.theme, showTasks: args.includeTasks !== false }), 'utf8')
          parts.push('', `SVG salvo em ${path}`)
        }
        return parts.join('\n')
      }),
  )

  /* ------------------------------------------------------------ escrita */

  /* Em modo somente leitura as ferramentas de escrita nem são anunciadas ao cliente. */
  if (readOnly) return

  server.registerTool(
    'create_task',
    {
      title: 'Criar tarefa',
      description: 'Cria uma tarefa (ou subtarefa, com parentTaskId). Status, prioridade, selos, tags e responsáveis aceitam nomes.',
      inputSchema: {
        project: projectParam,
        title: z.string().min(1).max(240),
        description: z.string().optional(),
        status: z.string().optional().describe('Etapa inicial (padrão: a primeira)'),
        priority: z.string().optional(),
        tags: z.array(z.string()).optional(),
        badges: z.array(z.string()).optional().describe('Selos (destaques como "Cliente" ou "Bloqueado")'),
        assignees: z.array(z.string()).optional().describe('Nomes, ids ou "me". Padrão: você'),
        startDate: isoDate.optional(),
        dueDate: isoDate.optional(),
        parentTaskId: z.string().optional().describe('Id da tarefa-mãe, para criar uma subtarefa'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    (args) =>
      run(async () => {
        let snapshot = await projectSnapshot(client, args.project)
        if (args.parentTaskId) snapshot = (await findTask(client, args.parentTaskId, args.project)).snapshot
        const h = helpers(snapshot)
        /* Resolve todos os nomes antes de criar: um nome errado não pode deixar tarefa pela metade. */
        const statusId = args.status ? h.status(args.status) : h.statuses[0].id
        const priority = args.priority ? h.priority(args.priority) : undefined
        const tagIds = args.tags?.map(h.tag)
        const badgeIds = args.badges?.map(h.badge)
        const assigneeIds = args.assignees?.map(h.member)
        const created = await client.createTask({ projectId: snapshot.project.id, title: args.title.trim(), statusId, priority, parentId: args.parentTaskId ?? null })
        const extra = {
          ...(args.description?.trim() ? { description: args.description.trim() } : {}),
          ...(tagIds?.length ? { tagIds } : {}),
          ...(badgeIds?.length ? { badgeIds } : {}),
          ...(assigneeIds ? { assigneeIds, primaryAssigneeId: assigneeIds[0] ?? null } : {}),
          ...(args.startDate ? { startDate: args.startDate } : {}),
          ...(args.dueDate ? { dueDate: args.dueDate } : {}),
        }
        const task = Object.keys(extra).length ? await client.updateTask({ id: created.id, ...extra }) : created
        return { created: helpers(await client.snapshot(snapshot.project.id)).summary(task), project: snapshot.project.name }
      }),
  )

  server.registerTool(
    'update_task',
    {
      title: 'Atualizar tarefa',
      description:
        'Altera título, descrição, etapa (mover no quadro), prioridade, datas, selos, tags ou responsáveis. Envie só o que mudar. Para limpar uma data, envie null.',
      inputSchema: {
        taskId: z.string(),
        title: z.string().min(1).max(240).optional(),
        description: z.string().optional(),
        status: z.string().optional().describe('Nova etapa (nome ou id)'),
        priority: z.string().optional(),
        startDate: isoDate.nullable().optional(),
        dueDate: isoDate.nullable().optional(),
        tags: z.array(z.string()).optional().describe('Substitui todas as tags'),
        addTags: z.array(z.string()).optional(),
        removeTags: z.array(z.string()).optional(),
        badges: z.array(z.string()).optional().describe('Substitui todos os selos'),
        addBadges: z.array(z.string()).optional(),
        removeBadges: z.array(z.string()).optional(),
        assignees: z.array(z.string()).optional().describe('Substitui os responsáveis (nomes, ids ou "me")'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (args) =>
      run(async () => {
        const { snapshot, task } = await findTask(client, args.taskId)
        const h = helpers(snapshot)
        let tagIds: string[] | undefined = args.tags?.map(h.tag)
        if (args.addTags?.length || args.removeTags?.length) {
          const current = new Set(tagIds ?? task.tagIds)
          for (const tag of args.addTags ?? []) current.add(h.tag(tag))
          for (const tag of args.removeTags ?? []) current.delete(h.tag(tag))
          tagIds = [...current]
        }
        let badgeIds: string[] | undefined = args.badges?.map(h.badge)
        if (args.addBadges?.length || args.removeBadges?.length) {
          const current = new Set(badgeIds ?? task.badgeIds)
          for (const badge of args.addBadges ?? []) current.add(h.badge(badge))
          for (const badge of args.removeBadges ?? []) current.delete(h.badge(badge))
          badgeIds = [...current]
        }
        const assigneeIds = args.assignees?.map(h.member)
        const input = {
          id: task.id,
          ...(args.title !== undefined ? { title: args.title.trim() } : {}),
          ...(args.description !== undefined ? { description: args.description } : {}),
          ...(args.status ? { statusId: h.status(args.status) } : {}),
          ...(args.priority ? { priority: h.priority(args.priority) } : {}),
          ...(args.startDate !== undefined ? { startDate: args.startDate } : {}),
          ...(args.dueDate !== undefined ? { dueDate: args.dueDate } : {}),
          ...(tagIds ? { tagIds } : {}),
          ...(badgeIds ? { badgeIds } : {}),
          ...(assigneeIds ? { assigneeIds, primaryAssigneeId: assigneeIds[0] ?? null } : {}),
        }
        if (Object.keys(input).length === 1) throw new Error('Nada para alterar: informe ao menos um campo.')
        const updated = await client.updateTask(input)
        return { updated: helpers(await client.snapshot(snapshot.project.id)).summary(updated) }
      }),
  )

  server.registerTool(
    'add_comment',
    {
      title: 'Comentar',
      description: 'Adiciona um comentário na tarefa, assinado pelo usuário do token. Responsáveis e seguidores são notificados.',
      inputSchema: { taskId: z.string(), body: z.string().min(1).max(5000) },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    ({ taskId, body }) =>
      run(async () => {
        const comment = await client.comment(taskId, body.trim())
        return { commented: true, id: comment.id, createdAt: comment.createdAt }
      }),
  )

  server.registerTool(
    'add_checklist_items',
    {
      title: 'Adicionar ao checklist',
      description: 'Adiciona um ou mais itens ao checklist de uma tarefa.',
      inputSchema: { taskId: z.string(), items: z.array(z.string().min(1).max(240)).min(1).max(50) },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    ({ taskId, items }) =>
      run(async () => {
        const created = []
        for (const title of items) created.push(await client.addChecklistItem(taskId, title.trim()))
        return { added: created.map(({ id, title }) => ({ id, title })) }
      }),
  )

  server.registerTool(
    'set_checklist_item',
    {
      title: 'Marcar item do checklist',
      description: 'Marca ou desmarca (e opcionalmente renomeia) um item do checklist. O id vem de get_task.',
      inputSchema: { itemId: z.string(), completed: z.boolean().optional(), title: z.string().min(1).max(240).optional() },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ({ itemId, completed, title }) =>
      run(async () => {
        if (completed === undefined && title === undefined) throw new Error('Informe completed ou title.')
        const item = await client.updateChecklistItem(itemId, { completed, title })
        return { id: item.id, title: item.title, completed: item.completed }
      }),
  )

  server.registerTool(
    'add_dependency',
    {
      title: 'Adicionar dependência',
      description: 'Registra que a tarefa taskId só pode avançar depois de dependsOnTaskId (bloqueio). Ciclos são recusados.',
      inputSchema: { taskId: z.string(), dependsOnTaskId: z.string() },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ({ taskId, dependsOnTaskId }) =>
      run(async () => {
        await client.addDependency(taskId, dependsOnTaskId)
        return { linked: true, taskId, dependsOnTaskId }
      }),
  )

  server.registerTool(
    'trash_task',
    {
      title: 'Mover tarefa para a lixeira',
      description: 'Move a tarefa (e suas subtarefas) para a lixeira do projeto. Pode ser restaurada pelo app. Confirme com o usuário antes.',
      inputSchema: { taskId: z.string() },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    ({ taskId }) =>
      run(async () => {
        await client.trashTask(taskId)
        return { trashed: true, taskId }
      }),
  )
}
