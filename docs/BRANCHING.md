# Versionamento e branches

O Orbitask usa Git, Semantic Versioning e Conventional Commits.

## Branches

- `main`: produção; recebe apenas versões validadas e tags `vX.Y.Z`.
- `develop`: integração da próxima versão.
- `feat/<nome>`: funcionalidade criada a partir de `develop`.
- `fix/<nome>`: correção comum criada a partir de `develop`.
- `hotfix/<nome>`: correção urgente criada de `main` e mesclada em `main` e `develop`.

Não faça commits de implementação diretamente em `main`. Toda mudança passa por uma branch curta, pull request, typecheck, testes e build.

## Commits e versões

- `feat:` incrementa a versão minor.
- `fix:`, `perf:` e `refactor:` incrementam patch.
- `feat!:` ou `BREAKING CHANGE:` incrementa major.
- `docs:`, `test:`, `build:` e `chore:` não geram versão sozinhos.

Use `pnpm release:dry` para conferir e `pnpm release` para atualizar os manifests e o changelog. Publicação e tags devem ocorrer somente depois da CI verde.
