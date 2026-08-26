import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const dryRun = process.argv.includes('--dry-run')
const explicit = process.argv.find((arg) => ['major', 'minor', 'patch'].includes(arg))
const root = JSON.parse(readFileSync('package.json', 'utf8'))
const commits = (() => {
  try {
    const lastTag = execFileSync('git', ['describe', '--tags', '--abbrev=0'], { encoding: 'utf8' }).trim()
    return execFileSync('git', ['log', `${lastTag}..HEAD`, '--pretty=%s%n%b%x00'], { encoding: 'utf8' })
  } catch {
    try { return execFileSync('git', ['log', '--pretty=%s%n%b%x00'], { encoding: 'utf8' }) }
    catch { return '' }
  }
})()

const level = explicit ?? (/BREAKING CHANGE:|^[a-z]+!:/m.test(commits) ? 'major' : /^feat(?:\(.+\))?:/m.test(commits) ? 'minor' : 'patch')
const [major, minor, patch] = root.version.split('.').map(Number)
const next = level === 'major' ? `${major + 1}.0.0` : level === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`

console.log(`${dryRun ? '[dry-run] ' : ''}${root.version} -> ${next} (${level})`)
if (dryRun) process.exit(0)

for (const file of ['package.json', 'apps/api/package.json', 'apps/desktop/package.json', 'apps/site/package.json', 'packages/contracts/package.json', 'packages/domain/package.json']) {
  const manifest = JSON.parse(readFileSync(file, 'utf8'))
  manifest.version = next
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`)
}
console.log('Versões atualizadas. Revise o changelog, valide o projeto e só então crie a tag.')
