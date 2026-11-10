# Orbitask MCP

Servidor [MCP](https://modelcontextprotocol.io) (stdio) que conecta o Orbitask ao Claude Code, Codex, Claude Desktop, Cursor e outros clientes MCP. A IA age com as mesmas permissões do usuário dono do token.

## Instalação

1. No Orbitask, abra **Ajustes › Integrações e MCP** e gere um token de acesso (`otk_…`). Ele aparece uma única vez.
2. Baixe o servidor (arquivo único, Node.js 18+):

   ```bash
   mkdir -p ~/.orbitask && curl -fsSL https://SEU-SITE/mcp/orbitask-mcp.mjs -o ~/.orbitask/orbitask-mcp.mjs
   ```

   O arquivo também é anexado a cada GitHub Release (`orbitask-mcp.mjs`).

3. Registre no cliente.

   **Claude Code**

   ```bash
   claude mcp add orbitask --scope user \
     --env ORBITASK_API_URL=https://SUA-API/api/v1 \
     --env ORBITASK_TOKEN=otk_... \
     -- node ~/.orbitask/orbitask-mcp.mjs
   ```

   **Codex** (`~/.codex/config.toml`; use caminho absoluto)

   ```toml
   [mcp_servers.orbitask]
   command = "node"
   args = ["/Users/voce/.orbitask/orbitask-mcp.mjs"]
   env = { ORBITASK_API_URL = "https://SUA-API/api/v1", ORBITASK_TOKEN = "otk_..." }
   ```

   **Outros clientes (JSON)**

   ```json
   { "mcpServers": { "orbitask": { "command": "node", "args": ["/Users/voce/.orbitask/orbitask-mcp.mjs"], "env": { "ORBITASK_API_URL": "https://SUA-API/api/v1", "ORBITASK_TOKEN": "otk_..." } } } }
   ```

A tela de Integrações já mostra esses comandos com a URL da API e o token preenchidos.

## Variáveis

| Variável | Descrição |
| --- | --- |
| `ORBITASK_TOKEN` | Token de acesso pessoal. Obrigatório. |
| `ORBITASK_API_URL` | URL da API (`…/api/v1`). Padrão: a API embutida no build. |
| `ORBITASK_READ_ONLY` | `1` expõe só as ferramentas de consulta. |

## Ferramentas

| Ferramenta | O que faz |
| --- | --- |
| `list_projects` | Usuário, workspace e projetos com totais |
| `get_project` | Etapas, prioridades, tags, pessoas e campos de um projeto |
| `list_tasks` | Tarefas com filtros (etapa, responsável, tag, texto, prazo) |
| `get_task` | Detalhe completo: descrição, subtarefas, checklist, comentários, dependências |
| `search` | Busca em todo o workspace |
| `my_tasks` | Tarefas atribuídas a você |
| `get_process_flow` | Resumo + fluxograma Mermaid do processo; salva SVG se pedido |
| `create_task` | Cria tarefa ou subtarefa |
| `update_task` | Move de etapa, muda prioridade, datas, tags e responsáveis |
| `add_comment` | Comenta na tarefa |
| `add_checklist_items` / `set_checklist_item` | Gerencia o checklist |
| `add_dependency` | Registra bloqueio entre tarefas |
| `trash_task` | Move para a lixeira (restaurável) |

Status, prioridade, tags, pessoas e projetos aceitam o nome (sem acento ou caixa) ou o id; `"me"` é o usuário conectado. Nomes inválidos são recusados antes de qualquer alteração, com a lista de opções válidas.

## Segurança

- O token é guardado só como hash SHA-256 na API; revogue em **Ajustes › Integrações e MCP**.
- Um token não consegue criar outros tokens.
- Tudo o que as ferramentas devolvem vai para o modelo do seu cliente MCP. Use `ORBITASK_READ_ONLY=1` se a IA só deve consultar.

## Desenvolvimento

```bash
pnpm --filter @orbitask/mcp build      # gera dist/orbitask-mcp.mjs
pnpm --filter @orbitask/mcp test
ORBITASK_TOKEN=otk_... ORBITASK_API_URL=http://localhost:3300/api/v1 npx @modelcontextprotocol/inspector node apps/mcp/dist/orbitask-mcp.mjs
```
