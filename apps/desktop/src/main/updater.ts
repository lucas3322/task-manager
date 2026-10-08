import { createWriteStream } from 'node:fs'
import { join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream } from 'node:stream/web'
import { app, shell, type WebContents } from 'electron'

const LATEST_RELEASE_API = 'https://api.github.com/repos/lucas3322/task-manager/releases/latest'

export type UpdateInfo = { current: string; latest: string; available: boolean; releaseUrl: string }

type Release = { tag_name: string; html_url: string; assets: { name: string; browser_download_url: string; size: number }[] }

const assetName = () => (process.platform === 'darwin' ? 'Orbitask-mac-universal.dmg' : process.platform === 'win32' ? 'Orbitask-windows-setup.exe' : null)

/** Compara versões semânticas simples (x.y.z); retorna > 0 quando a for mais nova que b. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}

async function fetchLatestRelease(): Promise<Release> {
  const response = await fetch(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': `Orbitask/${app.getVersion()}` } })
  if (!response.ok) throw new Error(`Não foi possível consultar atualizações (${response.status})`)
  return response.json() as Promise<Release>
}

export async function checkForUpdates(): Promise<UpdateInfo> {
  const release = await fetchLatestRelease()
  const current = app.getVersion()
  const latest = release.tag_name.replace(/^v/, '')
  return { current, latest, available: compareVersions(latest, current) > 0, releaseUrl: release.html_url }
}

/** Baixa o instalador da última versão para Downloads, reportando o progresso, e o abre. */
export async function downloadUpdate(sender: WebContents): Promise<void> {
  const name = assetName()
  const release = await fetchLatestRelease()
  const asset = release.assets.find((item) => item.name === name)
  if (!asset) {
    await shell.openExternal(release.html_url)
    return
  }
  const response = await fetch(asset.browser_download_url)
  if (!response.ok || !response.body) throw new Error(`Falha ao baixar a atualização (${response.status})`)

  const total = Number(response.headers.get('content-length')) || asset.size
  let received = 0
  let lastPercent = -1
  const progress = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length
      const percent = Math.floor((received / total) * 100)
      if (percent !== lastPercent && !sender.isDestroyed()) sender.send('updates:progress', percent)
      lastPercent = percent
      callback(null, chunk)
    },
  })
  const target = join(app.getPath('downloads'), asset.name)
  await pipeline(Readable.fromWeb(response.body as ReadableStream), progress, createWriteStream(target))

  const error = await shell.openPath(target)
  if (error) throw new Error(error)
  // No Windows o instalador precisa substituir os arquivos do app em execução.
  if (process.platform === 'win32') setTimeout(() => app.quit(), 1500)
}
