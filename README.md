# Orbitask

Gestão de projetos para desktop e web, com contas, workspaces e persistência em PostgreSQL.

## Aplicações

- `apps/desktop`: Electron + React consumindo a API HTTPS.
- `apps/api`: API NestJS conectada ao PostgreSQL.
- `apps/site`: landing, downloads, novidades e entrada do app web.
- `apps/mcp`: servidor MCP para Claude Code, Codex e outros clientes ([como instalar](apps/mcp/README.md)).
- `packages/contracts`: contratos compartilhados.
- `packages/domain`: regras de negócio independentes da interface.

## Funcionalidades atuais

- Cadastro e login com senha protegida por bcrypt e sessões revogáveis.
- Workspace e primeiro projeto criados automaticamente no cadastro.
- Projetos isolados por workspace e criação de novos projetos.
- Kanban e lista com criação, edição, busca, filtros e exclusão de tarefas.
- Status, prioridade, descrição e data de entrega.
- Landing page, novidades, download e acesso ao aplicativo web.
- Sessão do Electron protegida pelo cofre seguro do sistema operacional.
- Exportação do fluxograma do processo de cada projeto em SVG, PNG ou Mermaid.
- Tokens de acesso pessoal e servidor MCP para usar o Orbitask de dentro de LLMs.

## Desenvolvimento

```bash
pnpm install
docker compose up --build
ORBITASK_API_URL=http://localhost:3300/api/v1 pnpm dev
```

Abra `http://localhost:4173` para a landing, `http://localhost:4173/app` para o app web e `http://localhost:3300/health` para verificar a API.

Validação completa:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Consulte [docs/BRANCHING.md](docs/BRANCHING.md) para o fluxo de branches e releases.
Consulte [docs/DEPLOY_RAILWAY.md](docs/DEPLOY_RAILWAY.md) para a implantação da API, PostgreSQL e landing.
