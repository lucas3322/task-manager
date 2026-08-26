# Implantação no Railway

## Arquitetura

Use um único repositório e três serviços no mesmo projeto Railway:

1. `orbitask-postgres`: PostgreSQL gerenciado e privado.
2. `orbitask-api`: container criado por `Dockerfile.api`, com domínio público HTTPS.
3. `orbitask-site`: container criado por `Dockerfile.site`, com domínio público e, depois, domínio próprio.

O Electron chama somente a URL pública da API. A API acessa o PostgreSQL pela rede privada do Railway. O banco não deve receber domínio público nem TCP Proxy em produção.

## Configuração dos serviços

### PostgreSQL

- No projeto, selecione **New → Database → PostgreSQL**.
- Renomeie para `orbitask-postgres`.
- Não habilite Public Networking.
- Ative backups conforme o plano contratado antes de armazenar dados reais.

### API

- Crie um serviço a partir do mesmo repositório GitHub e branch `main`.
- Root Directory: `/`.
- Variável `RAILWAY_DOCKERFILE_PATH=/Dockerfile.api`.
- Healthcheck: `/health`.
- Gere um domínio público, por exemplo `api.orbitask.app`.
- Variáveis:

```text
DATABASE_URL=${{orbitask-postgres.DATABASE_URL}}
DATABASE_SSL=false
ALLOWED_ORIGINS=https://orbitask.app,https://app.orbitask.app
```

Não defina `PORT`: o Railway fornece essa variável automaticamente e a API escuta em `0.0.0.0`.

### Landing

- Crie outro serviço a partir do mesmo repositório e branch `main`.
- Root Directory: `/`.
- Variável `RAILWAY_DOCKERFILE_PATH=/Dockerfile.site`.
- Variável de build `VITE_API_URL=https://api.orbitask.app/api/v1`.
- Gere um domínio e vincule `orbitask.app`.
- O Caddy usa a variável `PORT` fornecida pelo Railway e redireciona rotas como `/download` para a SPA.

## Configuração do Electron

Builds de produção devem receber a URL pública versionada:

```bash
ORBITASK_API_URL=https://api.orbitask.app/api/v1 pnpm --filter @orbitask/desktop build
```

Antes de publicar instaladores, valide `/health`, crie uma tarefa pelo app e confirme que ela aparece após reiniciar o Electron.

## Fluxo de entrega

1. Desenvolver em `feat/*` a partir de `develop`.
2. Pull request para `develop`; CI executa tipos, testes e builds.
3. Preparar changelog e versão.
4. Pull request de release de `develop` para `main`.
5. O push em `main` dispara os serviços Railway.
6. Validar healthcheck, migrations, landing e operações de tarefa.
7. Criar a tag `vX.Y.Z` somente após a implantação saudável.

## Estado atual e evolução

1. **Entregue:** PostgreSQL, API, cadastro/login, workspaces, projetos, tarefas, landing, app web e Electron online.
2. **Próximo:** convites, papéis completos, comentários, anexos e notificações persistidas.
3. **Colaboração:** WebSocket, presença e Redis gerenciado quando necessário.
4. **Offline:** cache local e fila de sincronização no Electron, sem conexão direta ao banco.
5. **Operação:** migrations numeradas, backups testados, observabilidade, rate limiting e rollout gradual.

## Checklist de produção

- Banco sem acesso público.
- API somente via HTTPS.
- CORS restrito aos domínios oficiais.
- Segredos apenas nas Variables do Railway.
- Healthcheck e logs verificados.
- Backup e restauração ensaiados.
- Migration executada antes de tráfego da nova versão.
- API compatível com pelo menos uma versão anterior do Electron.
- Cadastro, login, logout e isolamento entre dois workspaces validados.
