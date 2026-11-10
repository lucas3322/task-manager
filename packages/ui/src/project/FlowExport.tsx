import { useEffect, useMemo, useState } from "react";
import { Code2, FileImage, FileType2, Workflow } from "lucide-react";
import type { ProjectAutomation } from "@orbitask/contracts";
import { buildProcessFlow, renderProcessFlowMermaid, renderProcessFlowSvg, type FlowTheme } from "@orbitask/domain";
import { api } from "../api";
import { Dialog, Segmented, Spinner, Switch } from "../components/primitives";
import { useStore } from "../store";

const slug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "projeto";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Rasteriza o SVG em PNG no próprio navegador (2× para ficar nítido em telas Retina e slides). */
async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const width = Number(/width="(\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? 1600);
  const height = Number(/height="(\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? 900);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Não foi possível desenhar o fluxograma"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponível");
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar o PNG"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function FlowExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const snapshot = useStore((state) => state.snapshot)!;
  const prefsTheme = useStore((state) => state.prefs.theme);
  const toast = useStore((state) => state.toast);
  const fail = useStore((state) => state.fail);
  const [automations, setAutomations] = useState<ProjectAutomation[] | null>(null);
  const [theme, setTheme] = useState<FlowTheme>("light");
  const [showTasks, setShowTasks] = useState(true);
  const [busy, setBusy] = useState(false);
  const projectId = snapshot.project.id;

  useEffect(() => {
    if (!open) return;
    setAutomations(null);
    if (prefsTheme === "dark") setTheme("dark");
    api()
      .listAutomations(projectId)
      .then((result) => setAutomations(result.automations))
      .catch(() => setAutomations([]));
  }, [open, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const flow = useMemo(
    () =>
      buildProcessFlow({
        project: snapshot.project,
        statuses: snapshot.statuses,
        tasks: snapshot.tasks,
        dependencies: snapshot.dependencies,
        automations: automations ?? [],
        priorities: snapshot.settings.priorities,
        tags: snapshot.settings.tags,
        members: snapshot.members,
      }),
    [snapshot, automations],
  );
  const svg = useMemo(() => renderProcessFlowSvg(flow, { theme, showTasks, idPrefix: "flow-preview" }), [flow, theme, showTasks]);
  const fileBase = `${slug(snapshot.project.name)}-fluxograma`;
  /* O arquivo baixado usa ids próprios para não colidir com a prévia se for colado numa página. */
  const exportSvg = () => renderProcessFlowSvg(flow, { theme, showTasks, idPrefix: "orbitask-flow" });

  const savePng = async () => {
    setBusy(true);
    try {
      download(await svgToPng(exportSvg()), `${fileBase}.png`);
    } catch (error) {
      fail(error, "Não foi possível gerar o PNG");
    } finally {
      setBusy(false);
    }
  };
  const copyMermaid = async () => {
    try {
      await navigator.clipboard.writeText(renderProcessFlowMermaid(flow));
      toast("Mermaid copiado — cole no Notion, GitHub, Confluence ou numa LLM", { tone: "success" });
    } catch (error) {
      fail(error, "Não foi possível copiar");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Exportar fluxograma"
      description="Etapas, tarefas, dependências e automações do projeto desenhadas como um processo."
      icon={Workflow}
      size="lg"
      className="flow-export-dialog"
      footer={
        <>
          <button type="button" className="ui-button" onClick={() => void copyMermaid()} disabled={!automations}>
            <Code2 /> Copiar Mermaid
          </button>
          <span className="spacer" />
          <button type="button" className="ui-button" onClick={() => download(new Blob([exportSvg()], { type: "image/svg+xml" }), `${fileBase}.svg`)} disabled={!automations}>
            <FileType2 /> Baixar SVG
          </button>
          <button type="button" className="ui-button primary" onClick={() => void savePng()} disabled={!automations || busy}>
            {busy ? <Spinner size={14} /> : <FileImage />} Baixar PNG
          </button>
        </>
      }
    >
      <div className="flow-export-options">
        <Segmented
          label="Tema do fluxograma"
          size="sm"
          value={theme}
          onChange={setTheme}
          options={[
            { value: "light", label: "Claro" },
            { value: "dark", label: "Escuro" },
          ]}
        />
        <label className="flow-export-toggle">
          <Switch checked={showTasks} onChange={setShowTasks} label="Mostrar tarefas" />
          Mostrar tarefas
        </label>
        <span className="subtle small-text flow-export-hint">
          {flow.stages.length} etapas · {flow.stats.total} tarefas · {flow.stats.rules} automações
        </span>
      </div>
      <div className={`flow-export-preview ${theme}`} aria-label="Prévia do fluxograma">
        {automations ? (
          /* SVG gerado por nós a partir do snapshot; todo texto do usuário é escapado no gerador. */
          <div className="flow-export-canvas" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="page-loading">
            <Spinner />
          </div>
        )}
      </div>
    </Dialog>
  );
}
