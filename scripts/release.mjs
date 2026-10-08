import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const RELEASE_BRANCH = 'develop'
const dryRun = process.argv.includes('--dry-run')
const explicit = process.argv.find((arg) => ['major', 'minor', 'patch'].includes(arg))

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' })
const fail = (message) => { console.error(`✖ ${message}`); process.exit(1) }

const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
if (!dryRun) {
  if (branch !== RELEASE_BRANCH) fail(`Releases saem da branch ${RELEASE_BRANCH} (atual: ${branch}).`)
  if (git('status', '--porcelain')) fail('Há alterações não commitadas. Faça commit ou stash antes do release.')
  git('fetch', 'origin', RELEASE_BRANCH, '--tags')
  if (git('rev-list', '--count', `HEAD..origin/${RELEASE_BRANCH}`) !== '0') fail(`Sua ${RELEASE_BRANCH} está atrás da origin. Rode git pull antes.`)
}

const lastTag = (() => { try { return git('describe', '--tags', '--abbrev=0') } catch { return null } })()
const subjects = git('log', ...(lastTag ? [`${lastTag}..HEAD`] : []), '--pretty=%s').split('\n').filter(Boolean)
const bodies = git('log', ...(lastTag ? [`${lastTag}..HEAD`] : []), '--pretty=%s%n%b%x00')
if (!explicit && subjects.length === 0) fail(`Nenhum commit novo desde ${lastTag}.`)

const level = explicit ?? (/BREAKING CHANGE:|^[a-z]+(\(.+\))?!:/m.test(bodies) ? 'major' : /^feat(?:\(.+\))?:/m.test(bodies) ? 'minor' : 'patch')
const root = JSON.parse(readFileSync('package.json', 'utf8'))
const [major, minor, patch] = root.version.split('.').map(Number)
const next = level === 'major' ? `${major + 1}.0.0` : level === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`
const tag = `v${next}`

console.log(`${dryRun ? '[dry-run] ' : ''}${root.version} -> ${next} (${level}) · ${subjects.length} commit(s) desde ${lastTag ?? 'o início'}`)
if (dryRun) process.exit(0)
if (git('tag', '-l', tag)) fail(`A tag ${tag} já existe.`)

console.log('\n▸ Validando (typecheck + testes)…')
run('pnpm', ['typecheck'])
run('pnpm', ['test'])

console.log('\n▸ Atualizando versões…')
const manifests = ['package.json', 'apps/api/package.json', 'apps/desktop/package.json', 'apps/site/package.json', 'packages/contracts/package.json', 'packages/domain/package.json', 'packages/ui/package.json']
for (const file of manifests) {
  const manifest = JSON.parse(readFileSync(file, 'utf8'))
  manifest.version = next
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`)
}

const sitePages = 'apps/site/src/pages.tsx'
writeFileSync(sitePages, readFileSync(sitePages, 'utf8').replace(/const VERSION = "[^"]+";/, `const VERSION = "${next}";`))

const today = new Date().toISOString().slice(0, 10)
const changelog = readFileSync('CHANGELOG.md', 'utf8')
const pending = /^## Em desenvolvimento.*$/m
const updatedChangelog = pending.test(changelog)
  ? changelog.replace(pending, `## ${next} — ${today}`)
  : changelog.replace(/^## /m, `## ${next} — ${today}\n\n${subjects.map((s) => `- ${s}`).join('\n')}\n\n## `)
writeFileSync('CHANGELOG.md', updatedChangelog)

console.log('\n▸ Commit, tag e push…')
run('git', ['add', ...manifests, sitePages, 'CHANGELOG.md'])
run('git', ['commit', '-m', `chore(release): ${tag}`])
run('git', ['tag', '-a', tag, '-m', `Orbitask ${next}`])
run('git', ['push', 'origin', RELEASE_BRANCH])
run('git', ['push', 'origin', tag])

console.log(`\n✔ ${tag} publicada. O GitHub Actions está gerando os instaladores:`)
console.log('  https://github.com/lucas3322/task-manager/actions/workflows/release.yml')
