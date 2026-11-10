import { describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { OrbitaskClient } from './client.js'
import { registerTools, resolveOne } from './tools.js'

const snapshot = {
  workspace: { id: 'w', name: 'Acme', role: 'admin' },
  user: { id: 'u1', name: 'Ana Martins', email: 'ana@example.com', avatarUrl: null, createdAt: '' },
  project: { id: 'p1', workspaceId: 'w', name: 'Lançamento', description: '', color: '#6559e8', icon: 'folder', createdAt: '' },
  projects: [{ id: 'p1', workspaceId: 'w', name: 'Lançamento', description: '', color: '#6559e8', icon: 'folder', createdAt: '' }],
  statuses: [
    { id: 's1', name: 'A fazer', color: '#999999', position: 0 },
    { id: 's2', name: 'Em revisão', color: '#ee9b3b', position: 1 },
    { id: 's3', name: 'Concluído', color: '#2ca87f', position: 2 },
  ],
  tasks: [],
  comments: [], attachments: [], checklistItems: [], dependencies: [], customFields: [], customFieldValues: [], activities: [], invites: [],
  preferences: { cardDensity: 'detailed', defaultView: 'board' },
  settings: { priorities: [{ id: 'high', name: 'Alta', color: '#ee8b3b', position: 0 }], tags: [{ id: 'tag-bug', name: 'Bug', color: '#e45f65', position: 0 }], badges: [] },
  members: [{ userId: 'u1', name: 'Ana Martins', email: 'ana@example.com', avatarUrl: null, role: 'admin', projectIds: [], createdAt: '' }],
}

function fakeApi() {
  const calls: { method: string; path: string; body?: unknown }[] = []
  const fetcher = (async (url: string, init?: RequestInit) => {
    const path = url.replace('http://api.test/api/v1', '')
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method, path, body })
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
    if (path.startsWith('/workspace/snapshot')) return json(snapshot)
    if (method === 'POST' && path === '/tasks') return json({ id: 't1', projectId: 'p1', parentId: null, title: body.title, description: '', statusId: body.statusId, priority: body.priority ?? 'high', startDate: null, dueDate: null, position: 1, deletedAt: null, createdAt: '', updatedAt: '', tagIds: [], badgeIds: [], assigneeIds: ['u1'], primaryAssigneeId: 'u1', followerIds: [] })
    if (method === 'PATCH' && path === '/tasks/t1') return json({ id: 't1', projectId: 'p1', parentId: null, title: 'x', description: '', statusId: 's1', priority: 'high', startDate: null, dueDate: null, position: 1, deletedAt: null, createdAt: '', updatedAt: '', tagIds: body.tagIds ?? [], badgeIds: [], assigneeIds: ['u1'], primaryAssigneeId: 'u1', followerIds: [] })
    return json({ message: 'não encontrado' }, 404)
  }) as typeof fetch
  return { calls, fetcher }
}

async function connect(readOnly = false) {
  const api = fakeApi()
  const server = new McpServer({ name: 'orbitask', version: 'test' })
  registerTools(server, { client: new OrbitaskClient('http://api.test/api/v1', 'otk_test', api.fetcher), readOnly })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test', version: '1' })
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] }
    return { error: Boolean(result.isError), text: result.content[0].text }
  }
  return { client, call, calls: api.calls }
}

describe('resolveOne', () => {
  const items = [{ id: 'a', name: 'Em andamento' }, { id: 'b', name: 'Em revisão' }, { id: 'c', name: 'Concluído' }]
  const pick = (value: string) => resolveOne(items, value, 'Status', (item) => item.id, (item) => item.name).id
  it('aceita id, nome sem acento/caixa e trecho único', () => {
    expect(pick('b')).toBe('b')
    expect(pick('concluido')).toBe('c')
    expect(pick('revis')).toBe('b')
  })
  it('explica nomes ambíguos ou inexistentes', () => {
    expect(() => pick('em')).toThrow(/ambíguo/)
    expect(() => pick('feito')).toThrow(/não encontrado. Opções: "Em andamento"/)
  })
})

describe('ferramentas MCP', () => {
  it('não cria a tarefa quando um nome é inválido', async () => {
    const { call, calls } = await connect()
    const result = await call('create_task', { title: 'Nova', tags: ['Inexistente'] })
    expect(result.error).toBe(true)
    expect(result.text).toMatch(/Tag "Inexistente" não encontrado/)
    expect(calls.some((item) => item.method === 'POST')).toBe(false)
  })

  it('cria com nomes legíveis e aplica tags e responsáveis', async () => {
    const { call, calls } = await connect()
    const result = await call('create_task', { title: 'Nova', status: 'revisao', priority: 'alta', tags: ['bug'], assignees: ['me'] })
    expect(result.error).toBe(false)
    expect(calls.find((item) => item.method === 'POST')?.body).toMatchObject({ projectId: 'p1', statusId: 's2', priority: 'high' })
    expect(calls.find((item) => item.method === 'PATCH')?.body).toMatchObject({ tagIds: ['tag-bug'], assigneeIds: ['u1'], primaryAssigneeId: 'u1' })
  })

  it('modo somente leitura esconde as ferramentas de escrita', async () => {
    const { client } = await connect(true)
    const names = (await client.listTools()).tools.map((tool) => tool.name)
    expect(names).toContain('get_process_flow')
    expect(names).not.toContain('create_task')
    expect(names).not.toContain('trash_task')
  })

  it('devolve o fluxograma em Mermaid', async () => {
    const { call } = await connect()
    const result = await call('get_process_flow')
    expect(result.text).toContain('flowchart LR')
    expect(result.text).toContain('Entrada → A fazer (0) → Em revisão (0) → Concluído (0) → Entregue')
  })
})
