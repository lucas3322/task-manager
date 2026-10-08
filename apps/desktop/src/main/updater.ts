import { createWriteStream } from 'node:fs'
import { rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { app, net, shell } from 'electron'
import type { DesktopUpdateInfo, DesktopUpdateProgress } from '@orbitask/contracts'

const REPOSITORY = 'lucas3322/task-manager'
const RELEASE_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`
const RELEASE_PAGE = `https://github.com/${REPOSITORY}/releases/latest`

type ReleaseAsset = { name: string; browser_download_url: string; size: number }

let lastCheck: DesktopUpdateInfo | null = null

const normalizeVersion = (value: string) => value.trim().replace(/^v/i, '').match(/^\d+\.\d+\.\d+/)?.[0] ?? null

/** Compara versões x.y.z; retorna > 0 quando a for mais nova que b. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}

function selectAsset(assets: ReleaseAsset[]): ReleaseAsset | undefined {
  if (process.platform === 'darwin') return assets.find((a) => /mac.*\.dmg$/i.test(a.name))
  if (process.platform === 'win32') return assets.find((a) => /setup\.exe$/i.test(a.name))
  return undefined
}

export async function checkForUpdates(): Promise<DesktopUpdateInfo> {
  const currentVersion = app.getVersion()
  try {
    const response = await net.fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': `Orbitask/${currentVersion}` } })
    if (response.status === 403) return { status: 'error', currentVersion, message: 'O GitHub limitou as consultas temporariamente. Tente mais tarde.' }
    if (!response.ok) return { status: 'error', currentVersion, message: `Não foi possível consultar as versões (HTTP ${response.status}).` }

    const release = (await response.json()) as { tag_name?: string; body?: string; html_url?: string; assets?: ReleaseAsset[] }
    const latestVersion = normalizeVersion(release.tag_name ?? '')
    if (!latestVersion) return { status: 'error', currentVersion, message: 'A última versão publicada não tem um número válido.' }
    if (compareVersions(latestVersion, currentVersion) <= 0) return (lastCheck = { status: 'current', currentVersion, latestVersion })

    const asset = selectAsset(release.assets ?? [])
    lastCheck = asset
      ? { status: 'available', currentVersion, latestVersion, notes: release.body?.trim() || undefined, releasePageUrl: release.html_url, downloadUrl: asset.browser_download_url, fileName: asset.name, sizeBytes: asset.size }
      : { status: 'missing-asset', currentVersion, latestVersion, releasePageUrl: release.html_url, message: `A versão ${latestVersion} ainda não tem instalador para este sistema.` }
    return lastCheck
  } catch (error) {
    return { status: 'error', currentVersion, message: `Não foi possível acessar o GitHub: ${error instanceof Error ? error.message : String(error)}` }
  }
}

/** Baixa o instalador para Downloads (via .partial, conferindo o tamanho), abre-o e fecha o app. */
export async function downloadAndInstall(onProgress: (progress: DesktopUpdateProgress) => void): Promise<void> {
  const info = lastCheck
  if (info?.status !== 'available' || !info.downloadUrl || !info.fileName) throw new Error('Nenhuma atualização pronta para baixar. Verifique novamente.')

  const destination = join(app.getPath('downloads'), info.fileName)
  const partial = `${destination}.partial`
  const response = await net.fetch(info.downloadUrl)
  if (!response.ok || !response.body) throw new Error(`O download falhou (HTTP ${response.status}).`)

  const totalBytes = Number(response.headers.get('content-length')) || info.sizeBytes || 0
  let receivedBytes = 0
  let lastEvent = 0
  await rm(partial, { force: true })
  await pipeline(
    Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
    async function* (source) {
      for await (const chunk of source) {
        receivedBytes += (chunk as Buffer).length
        if (Date.now() - lastEvent >= 150) {
          lastEvent = Date.now()
          onProgress({ receivedBytes, totalBytes })
        }
        yield chunk
      }
    },
    createWriteStream(partial),
  )
  if (info.sizeBytes && (await stat(partial)).size !== info.sizeBytes) {
    await rm(partial, { force: true })
    throw new Error('O download chegou incompleto. Tente novamente.')
  }
  await rm(destination, { force: true })
  await rename(partial, destination)
  onProgress({ receivedBytes: totalBytes || receivedBytes, totalBytes })

  const error = await shell.openPath(destination)
  if (error) {
    shell.showItemInFolder(destination)
    throw new Error(`Não foi possível abrir o instalador: ${error}`)
  }
  // Fecha para o instalador poder substituir o app (no Mac, arrastar para Aplicativos).
  setTimeout(() => app.quit(), 1500)
}

export const openLatestRelease = () => shell.openExternal(lastCheck?.releasePageUrl ?? RELEASE_PAGE)
