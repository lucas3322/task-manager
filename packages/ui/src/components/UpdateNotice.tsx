import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Download, ExternalLink, RefreshCw, X } from "lucide-react";
import type { DesktopUpdateInfo, DesktopUpdateProgress } from "@orbitask/contracts";

const DISMISSED_VERSION_KEY = "orbitask.update.dismissed-version";
const AUTOMATIC_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MANUAL_CHECK_EVENT = "orbitask:check-updates";

/** Pede uma verificação manual (mostra o resultado mesmo quando já está atualizado). */
export const requestUpdateCheck = () => window.dispatchEvent(new Event(MANUAL_CHECK_EVENT));

const readDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED_VERSION_KEY);
  } catch {
    return null;
  }
};

const formatBytes = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);

/** Verifica novas versões ao abrir e a cada 6 h; oferece baixar e abrir o instalador. Só existe no Desktop. */
export function UpdateNotice() {
  const updates = window.orbitaskDesktop?.updates;
  const [info, setInfo] = useState<DesktopUpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DesktopUpdateProgress | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const check = useCallback(
    async (showEveryResult: boolean) => {
      if (!updates) return;
      setChecking(showEveryResult);
      setDownloadError(null);
      if (showEveryResult) setInfo(null);
      try {
        const result = await updates.check();
        const isNew = result.status === "available" || result.status === "missing-asset";
        if (showEveryResult || (isNew && readDismissed() !== result.latestVersion)) setInfo(result);
      } finally {
        setChecking(false);
      }
    },
    [updates],
  );

  useEffect(() => {
    if (!updates) return;
    const timeout = window.setTimeout(() => void check(false), 3000);
    const interval = window.setInterval(() => void check(false), AUTOMATIC_CHECK_INTERVAL_MS);
    const onManual = () => void check(true);
    window.addEventListener(MANUAL_CHECK_EVENT, onManual);
    const offProgress = updates.onProgress(setProgress);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      window.removeEventListener(MANUAL_CHECK_EVENT, onManual);
      offProgress();
    };
  }, [check, updates]);

  if (!updates || (!info && !checking)) return null;

  const dismiss = () => {
    if (info?.latestVersion && (info.status === "available" || info.status === "missing-asset")) {
      try {
        localStorage.setItem(DISMISSED_VERSION_KEY, info.latestVersion);
      } catch {
        /* armazenamento indisponível: o aviso volta na próxima verificação */
      }
    }
    setInfo(null);
    setProgress(null);
    setDownloadError(null);
  };

  const install = async () => {
    if (info?.status === "missing-asset") return void updates.openReleasePage();
    setDownloading(true);
    setProgress({ receivedBytes: 0, totalBytes: info?.sizeBytes ?? 0 });
    setDownloadError(null);
    try {
      await updates.downloadAndInstall();
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "O download não pôde ser concluído.");
    } finally {
      setDownloading(false);
    }
  };

  const percent = progress?.totalBytes ? Math.min(100, Math.round((progress.receivedBytes / progress.totalBytes) * 100)) : 0;
  const isNew = info?.status === "available" || info?.status === "missing-asset";

  return (
    <aside className="update-notice" role="status" aria-live="polite">
      <button type="button" className="update-notice-close" onClick={dismiss} disabled={downloading} aria-label="Fechar aviso">
        <X />
      </button>
      {checking && !info ? (
        <div className="update-notice-row">
          <RefreshCw className="update-spin" />
          <div>
            <strong>Verificando atualizações</strong>
            <p>Consultando a versão mais recente…</p>
          </div>
        </div>
      ) : info?.status === "current" ? (
        <div className="update-notice-row">
          <CheckCircle2 className="update-ok" />
          <div>
            <strong>Orbitask está atualizado</strong>
            <p>Você já usa a versão {info.currentVersion}.</p>
          </div>
        </div>
      ) : info?.status === "error" ? (
        <div className="update-notice-row">
          <RefreshCw />
          <div>
            <strong>Não foi possível verificar</strong>
            <p>{info.message}</p>
          </div>
        </div>
      ) : isNew && info ? (
        <>
          <div className="update-notice-row">
            <span className="update-notice-icon">
              <Download />
            </span>
            <div>
              <strong>Nova versão disponível</strong>
              <p>
                Orbitask {info.latestVersion} · você tem a {info.currentVersion}
              </p>
            </div>
          </div>
          {downloading && (
            <div className="update-progress">
              <div className="update-progress-label">
                <span>Baixando {info.fileName}</span>
                <b>{progress?.totalBytes ? `${percent}%` : formatBytes(progress?.receivedBytes ?? 0)}</b>
              </div>
              <div className="update-progress-track">
                <i style={{ width: `${percent}%` }} />
              </div>
            </div>
          )}
          {downloadError && <p className="update-error">{downloadError}</p>}
          {!downloading && info.status === "available" && <p className="update-hint">O instalador abre sozinho e o Orbitask fecha para concluir.</p>}
          <div className="update-notice-actions">
            <button type="button" className="ui-button" onClick={dismiss} disabled={downloading}>
              Agora não
            </button>
            <button type="button" className="ui-button primary" onClick={() => void install()} disabled={downloading}>
              {info.status === "missing-asset" ? <ExternalLink /> : <Download />}
              {downloading ? "Baixando…" : info.status === "missing-asset" ? "Abrir página" : "Atualizar agora"}
            </button>
          </div>
        </>
      ) : null}
    </aside>
  );
}
