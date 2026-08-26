# Orbitask

Gestão de projetos local-first para desktop, evoluindo para colaboração via web.

## Aplicações

- `apps/desktop`: Electron + React consumindo a API HTTPS.
- `apps/api`: API NestJS conectada ao PostgreSQL.
- `apps/site`: landing, downloads, novidades e entrada do app web.
- `packages/contracts`: contratos compartilhados.
- `packages/domain`: regras de negócio independentes da interface.

## Desenvolvimento

```bash
pnpm install
docker compose up --build
ORBITASK_API_URL=http://localhost:3300/api/v1 pnpm dev
```

Validação completa:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Consulte [docs/BRANCHING.md](docs/BRANCHING.md) para o fluxo de branches e releases.
Consulte [docs/DEPLOY_RAILWAY.md](docs/DEPLOY_RAILWAY.md) para a implantação da API, PostgreSQL e landing.
