import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { OrbitaskClient } from './client.js'
import { registerTools } from './tools.js'

declare const __ORBITASK_MCP_VERSION__: string
declare const __ORBITASK_DEFAULT_API_URL__: string
const VERSION = typeof __ORBITASK_MCP_VERSION__ === 'string' ? __ORBITASK_MCP_VERSION__ : 'dev'
const DEFAULT_API_URL = typeof __ORBITASK_DEFAULT_API_URL__ === 'string' ? __ORBITASK_DEFAULT_API_URL__ : 'http://localhost:3300/api/v1'

const HELP = `Orbitask MCP ${VERSION}

Servidor MCP (stdio) que dá a clientes como Claude Code e Codex acesso aos seus projetos do Orbitask.

Variáveis de ambiente:
  ORBITASK_TOKEN      Token de acesso pessoal (Ajustes › Integrações e MCP). Obrigatório.
  ORBITASK_API_URL    URL da API. Padrão: ${DEFAULT_API_URL}
  ORBITASK_READ_ONLY  1 para expor só ferramentas de consulta.

Exemplo (Claude Code):
  claude mcp add orbitask --scope user --env ORBITASK_TOKEN=otk_... -- node ~/.orbitask/orbitask-mcp.mjs
`

const instructions = `Orbitask é um gerenciador de projetos e tarefas (quadro kanban com etapas).
- Comece com list_projects; use get_project para conhecer etapas, prioridades, tags e pessoas válidas.
- Status, prioridade, tags, pessoas e projetos aceitam o nome legível (sem acento/caixa) ou o id; "me" é o usuário conectado.
- Mover uma tarefa no quadro = update_task com um novo status.
- get_process_flow descreve o processo do projeto e devolve um fluxograma Mermaid (e salva SVG se pedido).
- Confirme com o usuário antes de usar trash_task.`

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(HELP)
    return
  }
  if (args.includes('--version') || args.includes('-v')) {
    process.stdout.write(`${VERSION}\n`)
    return
  }
  const token = process.env.ORBITASK_TOKEN?.trim()
  if (!token) {
    process.stderr.write('orbitask-mcp: defina ORBITASK_TOKEN com um token gerado em Ajustes › Integrações e MCP.\n\n' + HELP)
    process.exit(1)
  }
  const apiUrl = process.env.ORBITASK_API_URL?.trim() || DEFAULT_API_URL
  const readOnly = /^(1|true|yes|sim)$/i.test(process.env.ORBITASK_READ_ONLY ?? '')
  const server = new McpServer({ name: 'orbitask', title: 'Orbitask', version: VERSION }, { instructions })
  registerTools(server, { client: new OrbitaskClient(apiUrl, token), readOnly })
  await server.connect(new StdioServerTransport())
  /* stdout é do protocolo MCP: mensagens humanas vão para stderr. */
  process.stderr.write(`orbitask-mcp ${VERSION} conectado a ${apiUrl}${readOnly ? ' (somente leitura)' : ''}\n`)
}

main().catch((error) => {
  process.stderr.write(`orbitask-mcp: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exit(1)
})
