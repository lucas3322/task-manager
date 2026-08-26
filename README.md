# Orbitask

Gestão de projetos local-first para desktop, evoluindo para colaboração via web.

## Aplicações

- `apps/desktop`: Electron + React + SQLite.
- `apps/site`: landing, downloads, novidades e entrada do app web.
- `packages/contracts`: contratos compartilhados.
- `packages/domain`: regras de negócio independentes da interface.

## Desenvolvimento

```bash
pnpm install
pnpm dev
pnpm --filter @orbitask/site dev
```

Validação completa:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Consulte [docs/BRANCHING.md](docs/BRANCHING.md) para o fluxo de branches e releases.
